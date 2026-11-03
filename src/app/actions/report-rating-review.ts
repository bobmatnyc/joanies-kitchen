'use server';

import { eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import {
  insertUnlessPendingDeletion,
  pendingDeletionError,
} from '@/lib/account-deletion/guarded-insert';
import { db } from '@/lib/db';
import { recipeFlags, recipeRatings } from '@/lib/db/schema';
import { enforceRateLimit } from '@/lib/rate-limit';
import { findViewableRecipe, getRecipeViewer } from '@/lib/recipe-visibility';
import { hideReviewAtThreshold } from '@/lib/review-moderation';
import { getSessionUserId } from '@/lib/session-user';
import { toErrorMessage } from '@/lib/utils/error-handling';
import type { FlagReason } from './flag-recipe';

export interface ReportRatingReviewResult {
  success: boolean;
  error?: string;
  /** True when this user had already reported the review; nothing changed. */
  alreadyReported?: boolean;
  /** True when this report hid the review text (third distinct reporter). */
  hidden?: boolean;
}

const VALID_REASONS: FlagReason[] = [
  'inappropriate',
  'spam',
  'copyright',
  'quality',
  'harassment',
  'other',
];

/**
 * Why: #270 lets signed-in users report a rating review into the /admin/flags
 * queue, and hides its text once three distinct users have reported it.
 * What: cloned from `reportComment` (#105). Requires a session and the
 * `review-report` rate limit (its own 20/h bucket; the limiter fails closed).
 * Refuses an unknown reason, a rating that does not exist, whose review is empty
 * or already hidden, or that sits on a recipe the caller cannot see (all answered
 * 'Review not found'), and the caller's own review. Stores a `recipe_flags` row with
 * `rating_id`; the unique index (rating_id, user_id) makes a repeat report a no-op
 * (`alreadyReported`). Then runs `hideReviewAtThreshold`. A failed hide is logged
 * and returns `success: false`; the report row stays and the next report retries.
 * Only the review text is hidden: the stars and the aggregates are unchanged.
 * Test: `src/app/actions/__tests__/review-reports.test.ts`
 */
export async function reportRatingReview(
  ratingId: string,
  reason: FlagReason,
  description?: string
): Promise<ReportRatingReviewResult> {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return { success: false, error: 'You must be logged in to report reviews' };
    }

    if (!VALID_REASONS.includes(reason)) {
      return { success: false, error: 'Invalid flag reason' };
    }

    // #270: its own bucket, so review reports do not spend the comment or recipe budget.
    const verdict = await enforceRateLimit('review-report', userId);
    if (!verdict.allowed) {
      return { success: false, error: 'Too many reports. Please try again later.' };
    }

    const [rating] = await db
      .select({
        recipe_id: recipeRatings.recipe_id,
        user_id: recipeRatings.user_id,
        review: recipeRatings.review,
        review_hidden: recipeRatings.review_hidden,
      })
      .from(recipeRatings)
      .where(eq(recipeRatings.id, ratingId))
      .limit(1);
    // #41 pattern: a review on a recipe the caller cannot see is answered as nonexistent.
    if (!rating || !(await findViewableRecipe(rating.recipe_id, await getRecipeViewer()))) {
      return { success: false, error: 'Review not found' };
    }

    // A hidden review, or a star-only rating, has no text a reader can see: answered as nonexistent.
    if (rating.review_hidden || !rating.review?.trim()) {
      return { success: false, error: 'Review not found' };
    }

    if (rating.user_id === userId) {
      return { success: false, error: 'You cannot report your own review' };
    }

    const now = new Date();
    // #208: refused in the insert statement itself for an account pending deletion.
    const { allowed, row: inserted } = await insertUnlessPendingDeletion(
      recipeFlags,
      {
        recipe_id: rating.recipe_id,
        rating_id: ratingId,
        user_id: userId,
        reason,
        description: description?.trim() || null,
        status: 'pending',
        created_at: now,
        updated_at: now,
      },
      userId,
      { onConflict: sql`ON CONFLICT (rating_id, user_id) DO NOTHING` }
    );

    if (!allowed) {
      return { success: false, error: pendingDeletionError('report reviews') };
    }
    if (!inserted) {
      return { success: true, alreadyReported: true };
    }

    revalidatePath('/admin/flags');

    let hidden: boolean;
    try {
      hidden = await hideReviewAtThreshold(ratingId);
    } catch (error: unknown) {
      console.error(`[Report Review] Report stored but auto-hide failed for ${ratingId}:`, error);
      return { success: false, error: 'Report saved, but the review could not be hidden' };
    }

    if (hidden) {
      console.log(`[Report Review] Review ${ratingId} auto-hidden at threshold`);
      revalidatePath(`/recipes/${rating.recipe_id}`);
    }
    return { success: true, hidden };
  } catch (error: unknown) {
    console.error('[Report Review] Error:', error);
    return { success: false, error: toErrorMessage(error) || 'Failed to report review' };
  }
}
