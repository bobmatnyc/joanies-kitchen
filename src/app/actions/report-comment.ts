'use server';

import { eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { hideCommentAtThreshold } from '@/lib/comment-moderation';
import { db } from '@/lib/db';
import { recipeComments, recipeFlags } from '@/lib/db/schema';
import { enforceRateLimit } from '@/lib/rate-limit';
import { findViewableRecipe, getRecipeViewer } from '@/lib/recipe-visibility';
import { toErrorMessage } from '@/lib/utils/error-handling';
import type { FlagReason } from './flag-recipe';

export interface ReportCommentResult {
  success: boolean;
  error?: string;
  /** True when this user had already reported the comment; nothing changed. */
  alreadyReported?: boolean;
  /** True when this report hid the comment (third distinct reporter). */
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
 * Why: #105 lets signed-in users report a comment into the /admin/flags queue,
 * and hides it once three distinct users have reported it.
 * What: requires a session and the `comment-report` rate limit. Refuses an
 * unknown reason, a comment that does not exist or sits on a recipe the caller
 * cannot see, and the caller's own comment. Stores a `recipe_flags` row with
 * `comment_id`; the partial unique index (comment_id, user_id) makes a repeat
 * report a no-op (`alreadyReported`). Then runs the auto-hide step
 * (`hideCommentAtThreshold`; race reasoning there). A failed hide is logged and
 * returns `success: false` — the report row stays and the next report retries
 * the hide. Recipes are never auto-hidden.
 * Test: `src/app/actions/__tests__/comment-reports.test.ts`
 */
export async function reportComment(
  commentId: string,
  reason: FlagReason,
  description?: string
): Promise<ReportCommentResult> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'You must be logged in to report comments' };
    }

    if (!VALID_REASONS.includes(reason)) {
      return { success: false, error: 'Invalid flag reason' };
    }

    const verdict = await enforceRateLimit('comment-report', userId);
    if (!verdict.allowed) {
      return { success: false, error: 'Too many reports. Please try again later.' };
    }

    const [comment] = await db
      .select({ recipe_id: recipeComments.recipe_id, user_id: recipeComments.user_id })
      .from(recipeComments)
      .where(eq(recipeComments.id, commentId))
      .limit(1);
    // #41 pattern: a comment on a recipe the caller cannot see is answered as nonexistent.
    if (!comment || !(await findViewableRecipe(comment.recipe_id, await getRecipeViewer()))) {
      return { success: false, error: 'Comment not found' };
    }

    if (comment.user_id === userId) {
      return { success: false, error: 'You cannot report your own comment' };
    }

    const now = new Date();
    const inserted = await db
      .insert(recipeFlags)
      .values({
        recipe_id: comment.recipe_id,
        comment_id: commentId,
        user_id: userId,
        reason,
        description: description?.trim() || null,
        status: 'pending',
        created_at: now,
        updated_at: now,
      })
      .onConflictDoNothing({
        target: [recipeFlags.comment_id, recipeFlags.user_id],
        where: sql`${recipeFlags.comment_id} IS NOT NULL`,
      })
      .returning({ id: recipeFlags.id });

    if (inserted.length === 0) {
      return { success: true, alreadyReported: true };
    }

    revalidatePath('/admin/flags');

    // Fail-Open Check: a hide failure is surfaced, never reported as success.
    let hidden: boolean;
    try {
      hidden = await hideCommentAtThreshold(commentId);
    } catch (error: unknown) {
      console.error(`[Report Comment] Report stored but auto-hide failed for ${commentId}:`, error);
      return { success: false, error: 'Report saved, but the comment could not be hidden' };
    }

    if (hidden) {
      console.log(`[Report Comment] Comment ${commentId} auto-hidden at threshold`);
      revalidatePath(`/recipes/${comment.recipe_id}`);
    }
    return { success: true, hidden };
  } catch (error: unknown) {
    console.error('[Report Comment] Error:', error);
    return { success: false, error: toErrorMessage(error) || 'Failed to report comment' };
  }
}
