/**
 * #270: rating-review reports, auto-hide, and admin outcomes on a review report.
 *
 * Why: `recipe_ratings.review` is user-written free text with no report path.
 * Reviews follow the comment model (#59, #105): three distinct reporters hide the
 * text without waiting for an admin, and the admin queue decides the outcome.
 * What: `hideReviewAtThreshold` is the auto-hide step and `applyReviewFlagAction`
 * the admin outcome. The hidden state is `recipe_ratings.review_hidden`; it hides
 * only the text. The stars and the recipe's aggregates never change. `remove`
 * clears the text and keeps the rating. The stale guards are the comment ones
 * (`reportStillPending`, `lockReportIfPending`), reused from `comment-moderation`.
 * Test: `src/app/actions/__tests__/review-reports.test.ts`
 */

import { and, eq, isNotNull, sql } from 'drizzle-orm';
import {
  lockReportIfPending,
  reportStillPending,
  STALE_REPORT_ERROR,
} from '@/lib/comment-moderation';
import { db } from '@/lib/db';
import { recipeFlags, recipeRatings } from '@/lib/db/schema';

/** #270 (D72): distinct pending reporters that hide a review, as for comments. */
export const REVIEW_AUTO_HIDE_THRESHOLD = 3;

/** #270: rows per page in the admin hidden-reviews list. */
export const HIDDEN_REVIEWS_PAGE_SIZE = 25;

/** #270: answered when an admin acts on a review that is no longer hidden. */
export const STALE_HIDDEN_REVIEW_ERROR =
  'This review is no longer hidden. Refresh the page to see its current state.';

/**
 * Why: the hide must fire exactly once when the third distinct reporter lands,
 * and two concurrent reports must not both miss it.
 * What: one UPDATE that sets `review_hidden` only while it is false, the review has
 * text, and the count of distinct pending reporters is at least the threshold.
 * Returns true when this call hid the review. Throws on a database error.
 * It does not touch `updated_at`: the rating's edit time and the #197 aggregate
 * guard (which matches on it) are the author's, not moderation's.
 * Race reasoning: as `hideCommentAtThreshold` (the caller runs this after its
 * report insert committed; two qualifying updates serialize on the row lock and
 * the second re-checks `review_hidden = false`, so only one caller gets `true`).
 * Test: `src/app/actions/__tests__/review-reports.test.ts`
 */
export async function hideReviewAtThreshold(ratingId: string): Promise<boolean> {
  const reporters = sql`(SELECT count(DISTINCT ${recipeFlags.user_id}) FROM ${recipeFlags} WHERE ${recipeFlags.rating_id} = ${ratingId} AND ${recipeFlags.status} = 'pending')`;
  const hidden = await db
    .update(recipeRatings)
    .set({ review_hidden: true })
    .where(
      and(
        eq(recipeRatings.id, ratingId),
        eq(recipeRatings.review_hidden, false),
        isNotNull(recipeRatings.review),
        sql`${reporters} >= ${REVIEW_AUTO_HIDE_THRESHOLD}`
      )
    )
    .returning({ id: recipeRatings.id });
  return hidden.length > 0;
}

/**
 * Why: "unhide resolves all pending reports, like dismiss; three new reporters
 * re-hide" (#194, ruling Df8), as for comments.
 * What: admin-checked by the caller. In one `db.batch` marks every pending report
 * on the rating `dismissed` and clears `review_hidden`, both only while the review
 * is hidden; the report write locks the hidden rating row first, so an Unhide from
 * a stale page closes no newer report. Returns the rating's recipe id; else, with
 * nothing written, `STALE_HIDDEN_REVIEW_ERROR` for a visible review or
 * 'Review not found' for a missing one.
 * Test: `src/app/actions/__tests__/review-reports.test.ts`
 */
export async function unhideReviewResolvingReports(
  ratingId: string,
  adminId: string,
  reviewNotes: string | null
): Promise<{ recipeId: string } | { error: string }> {
  const now = new Date();
  const stillHidden = and(eq(recipeRatings.id, ratingId), eq(recipeRatings.review_hidden, true));
  const flagsWrite = db
    .update(recipeFlags)
    .set({
      status: 'dismissed',
      reviewed_by: adminId,
      reviewed_at: now,
      review_notes: reviewNotes,
      updated_at: now,
    })
    .where(
      and(
        eq(recipeFlags.rating_id, ratingId),
        eq(recipeFlags.status, 'pending'),
        sql`EXISTS (SELECT 1 FROM ${recipeRatings} WHERE ${stillHidden} FOR UPDATE)`
      )
    );
  const ratingWrite = db
    .update(recipeRatings)
    .set({ review_hidden: false })
    .where(stillHidden)
    .returning({ recipeId: recipeRatings.recipe_id });
  const rating = db
    .select({ id: recipeRatings.id })
    .from(recipeRatings)
    .where(eq(recipeRatings.id, ratingId));
  const [, restored, found] = await db.batch([flagsWrite, ratingWrite, rating]);
  if (restored[0]) return restored[0];
  return { error: found.length > 0 ? STALE_HIDDEN_REVIEW_ERROR : 'Review not found' };
}

/**
 * Why: a hidden review can have no pending report, so Remove cannot depend on
 * a report being open.
 * What: admin-checked by the caller. In one `db.batch` marks the rating's pending
 * reports `resolved` and clears the review text, both only while the review is
 * hidden. The rating (stars) stays, and `review_hidden` returns to false: no text
 * is left to hide, and a later review by the author is not hidden unseen. Returns
 * false when no hidden review was cleared.
 * Test: `src/app/actions/__tests__/review-reports.test.ts`
 */
export async function removeHiddenReviewResolvingReports(
  ratingId: string,
  adminId: string,
  reviewNotes: string | null
): Promise<boolean> {
  const now = new Date();
  const stillHidden = and(eq(recipeRatings.id, ratingId), eq(recipeRatings.review_hidden, true));
  const flagsWrite = db
    .update(recipeFlags)
    .set({
      status: 'resolved',
      reviewed_by: adminId,
      reviewed_at: now,
      review_notes: reviewNotes,
      updated_at: now,
    })
    .where(
      and(
        eq(recipeFlags.rating_id, ratingId),
        eq(recipeFlags.status, 'pending'),
        sql`EXISTS (SELECT 1 FROM ${recipeRatings} WHERE ${stillHidden})`
      )
    );
  const ratingWrite = db
    .update(recipeRatings)
    .set({ review: null, review_hidden: false })
    .where(stillHidden)
    .returning({ id: recipeRatings.id });
  const [, removed] = await db.batch([flagsWrite, ratingWrite]);
  return removed.length > 0;
}

export type ReviewFlagAction = 'dismiss' | 'hide' | 'remove' | 'unhide';

/**
 * Why: the queue's actions act on the review text, not the recipe the report row
 * also names. A dismiss must not un-hide (#59): `review_hidden` does not record who
 * hid a review, so a dismiss cannot tell whether other grounds remain. A page can
 * be stale, so `dismiss`, `hide` and `remove` act only while this report is pending.
 * What: admin-checked by the caller. `dismiss` closes this one report and never
 * writes the rating; other pending reports stay and keep counting toward the
 * auto-hide. `hide` hides the review text and `remove` clears it (keeping the
 * rating), each resolving every pending report in one `db.batch`. `unhide`
 * delegates to `unhideReviewResolvingReports` and is the only action that shows the
 * text again; it works from a closed report and leaves that report as it is.
 * Returns `STALE_REPORT_ERROR`, with nothing written, when this report is no longer
 * pending; `unhide` returns `STALE_HIDDEN_REVIEW_ERROR` for a visible review and
 * 'Review not found' for a missing one; else null.
 * Test: `src/app/actions/__tests__/review-reports.test.ts`
 */
export async function applyReviewFlagAction(
  flag: { id: string; rating_id: string },
  action: ReviewFlagAction,
  adminId: string,
  reviewNotes: string | null
): Promise<string | null> {
  if (action === 'unhide') {
    const restored = await unhideReviewResolvingReports(flag.rating_id, adminId, reviewNotes);
    return 'error' in restored ? restored.error : null;
  }

  const now = new Date();
  const review = {
    reviewed_by: adminId,
    reviewed_at: now,
    review_notes: reviewNotes,
    updated_at: now,
  };

  if (action === 'dismiss') {
    const dismissed = await db
      .update(recipeFlags)
      .set({ ...review, status: 'dismissed' })
      .where(reportStillPending(flag.id))
      .returning({ id: recipeFlags.id });
    return dismissed.length === 0 ? STALE_REPORT_ERROR : null;
  }

  // Both writes match only while this report is pending, so a stale page writes nothing.
  const ratingWhere = and(eq(recipeRatings.id, flag.rating_id), lockReportIfPending(flag.id));
  const ratingWrite =
    action === 'remove'
      ? db.update(recipeRatings).set({ review: null, review_hidden: false }).where(ratingWhere)
      : db.update(recipeRatings).set({ review_hidden: true }).where(ratingWhere);

  const flagsWrite = db
    .update(recipeFlags)
    .set({ ...review, status: 'resolved' })
    .where(
      and(
        eq(recipeFlags.rating_id, flag.rating_id),
        eq(recipeFlags.status, 'pending'),
        lockReportIfPending(flag.id)
      )
    )
    .returning({ id: recipeFlags.id });

  const [, flags] = await db.batch([ratingWrite, flagsWrite]);
  return flags.length === 0 ? STALE_REPORT_ERROR : null;
}
