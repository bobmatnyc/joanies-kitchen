/**
 * #270: admin list and actions for hidden rating reviews.
 *
 * Why: a review's text stays hidden until an admin unhides it, but the report queue
 * shows only the newest rows per view and a hidden review can have no report rows.
 * This list reads `recipe_ratings` directly, so every hidden review can be reached.
 * What: `getHiddenReviews` pages through every hidden review with the total;
 * `actOnHiddenReview` unhides or removes one. Both require an admin.
 * Test: `src/app/actions/__tests__/review-reports.test.ts`
 */

'use server';

import { and, count, desc, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin';
import { db } from '@/lib/db';
import { recipeFlags, recipeRatings, recipes } from '@/lib/db/schema';
import {
  HIDDEN_REVIEWS_PAGE_SIZE,
  removeHiddenReviewResolvingReports,
  STALE_HIDDEN_REVIEW_ERROR,
  unhideReviewResolvingReports,
} from '@/lib/review-moderation';
import { toErrorMessage } from '@/lib/utils/error-handling';

export interface HiddenReview {
  id: string;
  recipe_id: string;
  recipeName: string;
  user_id: string;
  rating: number;
  review: string | null;
  created_at: Date | null;
  pendingReports: number;
}

export interface HiddenReviewsPage {
  reviews: HiddenReview[];
  /** Every hidden review, not only this page. */
  total: number;
  /** The page returned, 1-based; a request past the end returns the last page. */
  page: number;
  pageCount: number;
}

export type HiddenReviewAction = 'unhide' | 'remove';

/**
 * Why: an admin must see how many reviews are hidden and reach all of them.
 * What: admin-only; a non-admin caller gets a thrown error and no review text.
 * Returns one page, newest first. An invalid `page` reads as 1 and a page past
 * the end reads as the last page.
 * Test: `src/app/actions/__tests__/review-reports.test.ts`
 */
export async function getHiddenReviews(page: number = 1): Promise<HiddenReviewsPage> {
  await requireAdmin();

  const hidden = eq(recipeRatings.review_hidden, true);
  const [{ total }] = await db.select({ total: count() }).from(recipeRatings).where(hidden);

  const pageCount = Math.max(1, Math.ceil(total / HIDDEN_REVIEWS_PAGE_SIZE));
  const requested = Number.isFinite(page) ? Math.max(1, Math.trunc(page)) : 1;
  const current = Math.min(requested, pageCount);

  const pendingReports = db
    .select({ n: count() })
    .from(recipeFlags)
    .where(and(eq(recipeFlags.rating_id, recipeRatings.id), eq(recipeFlags.status, 'pending')));

  const reviews = await db
    .select({
      id: recipeRatings.id,
      recipe_id: recipeRatings.recipe_id,
      recipeName: recipes.name,
      user_id: recipeRatings.user_id,
      rating: recipeRatings.rating,
      review: recipeRatings.review,
      created_at: recipeRatings.created_at,
      pendingReports: sql<number>`(${pendingReports})::int`,
    })
    .from(recipeRatings)
    .leftJoin(recipes, eq(recipeRatings.recipe_id, recipes.id))
    .where(hidden)
    // The id breaks created_at ties, so paging neither repeats nor skips a row.
    .orderBy(desc(recipeRatings.created_at), desc(recipeRatings.id))
    .limit(HIDDEN_REVIEWS_PAGE_SIZE)
    .offset((current - 1) * HIDDEN_REVIEWS_PAGE_SIZE);

  return {
    reviews: reviews.map((r) => ({ ...r, recipeName: r.recipeName ?? 'Unknown Recipe' })),
    total,
    page: current,
    pageCount,
  };
}

/**
 * Why: Unhide and Remove must work with no report row to act through.
 * What: admin-only. `unhide` shows the text again and dismisses every pending
 * report; `remove` clears the review text (the rating stays) and resolves every
 * pending report. A review that is no longer hidden returns
 * `STALE_HIDDEN_REVIEW_ERROR` and nothing is written; a missing one 'Review not found'.
 * Test: `src/app/actions/__tests__/review-reports.test.ts`
 */
export async function actOnHiddenReview(
  ratingId: string,
  action: HiddenReviewAction,
  reviewNotes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { userId } = await requireAdmin();

    if (action !== 'unhide' && action !== 'remove') {
      return { success: false, error: 'Invalid action' };
    }

    const [rating] = await db
      .select({
        recipe_id: recipeRatings.recipe_id,
        review_hidden: recipeRatings.review_hidden,
      })
      .from(recipeRatings)
      .where(eq(recipeRatings.id, ratingId))
      .limit(1);

    if (!rating) {
      return { success: false, error: 'Review not found' };
    }
    if (!rating.review_hidden) {
      return { success: false, error: STALE_HIDDEN_REVIEW_ERROR };
    }

    const notes = reviewNotes || null;
    if (action === 'unhide') {
      const restored = await unhideReviewResolvingReports(ratingId, userId, notes);
      // The hidden check above can be stale by the write; the write re-checks it.
      if ('error' in restored) return { success: false, error: restored.error };
    } else {
      const removed = await removeHiddenReviewResolvingReports(ratingId, userId, notes);
      if (!removed) return { success: false, error: STALE_HIDDEN_REVIEW_ERROR };
    }

    console.log(`[Hidden Reviews] Admin ${userId} applied ${action} to review ${ratingId}`);
    revalidatePath('/admin/flags');
    revalidatePath(`/recipes/${rating.recipe_id}`);
    return { success: true };
  } catch (error: unknown) {
    console.error('[Hidden Reviews] Error:', error);
    return { success: false, error: toErrorMessage(error) || 'Failed to apply action' };
  }
}
