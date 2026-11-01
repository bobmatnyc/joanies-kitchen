/**
 * #105 (D7c S6): comment reports, auto-hide, and admin outcomes on a comment report.
 *
 * Why: users report abusive comments; three distinct reporters hide a comment
 * without waiting for an admin, and the admin queue decides the final outcome.
 * What: `hideCommentAtThreshold` is the auto-hide step and `applyCommentFlagAction`
 * the admin outcome. The hidden state is `recipe_comments.is_flagged`, the same
 * column the admin hide (`setCommentHidden`, #59) writes and every public read filters.
 * Test: `src/app/actions/__tests__/comment-reports.test.ts`
 */

import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { recipeComments, recipeFlags } from '@/lib/db/schema';

/** Distinct pending reporters that hide a comment. */
export const COMMENT_AUTO_HIDE_THRESHOLD = 3;

/** #59: rows per page in the admin hidden-comments list. */
export const HIDDEN_COMMENTS_PAGE_SIZE = 25;

/** #59: answered when an admin acts on a report another action already closed. */
export const STALE_REPORT_ERROR =
  'This report was already closed. Refresh the page to see its current state.';

/** #59: answered when an admin acts on a comment that is no longer hidden. */
export const STALE_HIDDEN_COMMENT_ERROR =
  'This comment is no longer hidden. Refresh the page to see its current state.';

/**
 * #59: the WHERE that closes a report only while it is pending. Postgres re-checks
 * it on the locked row, so of two racing closes only one matches.
 */
export function reportStillPending(flagId: string) {
  return and(eq(recipeFlags.id, flagId), eq(recipeFlags.status, 'pending'));
}

/**
 * #59: guards a write on a report's target. `FOR UPDATE` holds the report row until
 * the batch commits and re-reads it after any rival commit, so a close that lost the
 * race leaves the target unchanged.
 */
export function lockReportIfPending(flagId: string) {
  return sql`EXISTS (SELECT 1 FROM ${recipeFlags} WHERE ${reportStillPending(flagId)} FOR UPDATE)`;
}

/**
 * Why: the hide must fire exactly once when the third distinct reporter lands,
 * and two concurrent reports must not both miss it.
 * What: one UPDATE that sets `is_flagged` only while it is false and the count
 * of distinct pending reporters is at least the threshold. Returns true when this
 * call hid the comment. Throws on a database error; the caller surfaces it.
 *
 * Race (neon-http, autocommit per statement): the caller runs this AFTER its
 * report insert has committed, as a separate statement. Of N concurrent reports,
 * the statement following the last insert to commit starts after every insert
 * has committed, so it sees all of them: no hide is skipped. Running insert and
 * hide in one `db.batch` would be worse — each transaction would see only its
 * own uncommitted insert, so two concurrent 3rd reports could both count 2.
 * Two updates that both qualify serialize on the row lock; Postgres re-checks
 * `is_flagged = false` on the updated row, so the second matches nothing and
 * only one caller gets `true` (side effects run once).
 */
export async function hideCommentAtThreshold(commentId: string): Promise<boolean> {
  const reporters = sql`(SELECT count(DISTINCT ${recipeFlags.user_id}) FROM ${recipeFlags} WHERE ${recipeFlags.comment_id} = ${commentId} AND ${recipeFlags.status} = 'pending')`;
  const hidden = await db
    .update(recipeComments)
    .set({ is_flagged: true, updated_at: new Date() })
    .where(
      and(
        eq(recipeComments.id, commentId),
        eq(recipeComments.is_flagged, false),
        sql`${reporters} >= ${COMMENT_AUTO_HIDE_THRESHOLD}`
      )
    )
    .returning({ id: recipeComments.id });
  return hidden.length > 0;
}

/**
 * Why: #194 (ruling Df8) "unhide resolves all pending reports, like dismiss;
 * three new reporters re-hide". Pending reports left behind by an unhide made the
 * next single report re-hide the comment at once. #59: dismiss now closes one
 * report; this function still closes all of them.
 * What: admin-checked by the caller. In one `db.batch` (one transaction) marks
 * every pending report on the comment `dismissed` with the reviewer and time and
 * clears `is_flagged`, both only while the comment is hidden. #59: the report write
 * locks the hidden comment row first, so an Unhide from a stale page, after another
 * admin's unhide, closes no newer report. A reporter whose report is closed cannot
 * count again: the unique index (comment_id, user_id) spans every status. Returns
 * the comment's recipe id; else, with nothing written, `STALE_HIDDEN_COMMENT_ERROR`
 * for a visible comment or 'Comment not found' for a missing one.
 * Test: `src/app/actions/__tests__/comment-reports.test.ts`
 */
export async function unhideCommentResolvingReports(
  commentId: string,
  adminId: string,
  reviewNotes: string | null
): Promise<{ recipeId: string } | { error: string }> {
  const now = new Date();
  const stillHidden = and(eq(recipeComments.id, commentId), eq(recipeComments.is_flagged, true));
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
        eq(recipeFlags.comment_id, commentId),
        eq(recipeFlags.status, 'pending'),
        sql`EXISTS (SELECT 1 FROM ${recipeComments} WHERE ${stillHidden} FOR UPDATE)`
      )
    );
  const commentWrite = db
    .update(recipeComments)
    .set({ is_flagged: false, updated_at: now })
    .where(stillHidden)
    .returning({ recipeId: recipeComments.recipe_id });
  const comment = db
    .select({ id: recipeComments.id })
    .from(recipeComments)
    .where(eq(recipeComments.id, commentId));
  const [, restored, found] = await db.batch([flagsWrite, commentWrite, comment]);
  if (restored[0]) return restored[0];
  return { error: found.length > 0 ? STALE_HIDDEN_COMMENT_ERROR : 'Comment not found' };
}

/**
 * Why: #59: a hidden comment can have no pending report, or no report row at all,
 * so Remove cannot depend on a report being open.
 * What: admin-checked by the caller. In one `db.batch` marks the comment's pending
 * reports `resolved` and deletes the comment, both only while the comment is hidden.
 * Closed reports keep their status and notes. Returns false when no hidden comment
 * was deleted.
 * Test: `src/app/actions/__tests__/hidden-comments.test.ts`
 */
export async function removeHiddenCommentResolvingReports(
  commentId: string,
  adminId: string,
  reviewNotes: string | null
): Promise<boolean> {
  const now = new Date();
  const stillHidden = and(eq(recipeComments.id, commentId), eq(recipeComments.is_flagged, true));
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
        eq(recipeFlags.comment_id, commentId),
        eq(recipeFlags.status, 'pending'),
        sql`EXISTS (SELECT 1 FROM ${recipeComments} WHERE ${stillHidden})`
      )
    );
  const commentWrite = db
    .delete(recipeComments)
    .where(stillHidden)
    .returning({ id: recipeComments.id });
  const [, removed] = await db.batch([flagsWrite, commentWrite]);
  return removed.length > 0;
}

export type CommentFlagAction = 'dismiss' | 'hide' | 'remove' | 'unhide';

/**
 * Why: the queue's actions act on the comment, not the recipe the report row also
 * names. #59: a dismiss must not un-hide. `is_flagged` does not record who hid a
 * comment, so an admin hide and an auto-hide look the same, and a dismiss cannot
 * tell whether other grounds for the hide remain. #59: a page can be stale, so
 * `dismiss`, `hide` and `remove` act only while this report is pending.
 * What: admin-checked by the caller. `dismiss` closes this one report and never
 * writes the comment; other pending reports stay in the queue and keep counting
 * toward the auto-hide. `hide` hides the comment and `remove` deletes it, each
 * resolving every pending report in one `db.batch`. `unhide` delegates to
 * `unhideCommentResolvingReports` (#194) and is the only queue action that makes
 * a comment visible; it works from a closed report and leaves that report as it is.
 * Returns `STALE_REPORT_ERROR`, with nothing written, when this report is no longer
 * pending; `unhide` returns `STALE_HIDDEN_COMMENT_ERROR` for a visible comment and
 * 'Comment not found' for a missing one; else null.
 * Test: `src/app/actions/__tests__/comment-reports.test.ts`
 */
export async function applyCommentFlagAction(
  flag: { id: string; comment_id: string },
  action: CommentFlagAction,
  adminId: string,
  reviewNotes: string | null
): Promise<string | null> {
  if (action === 'unhide') {
    // #194: unhide closes every pending report in the same transaction. #59: dismiss closes only one.
    const restored = await unhideCommentResolvingReports(flag.comment_id, adminId, reviewNotes);
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
    // #59: one report closes; the comment's hidden state changes only through an explicit unhide.
    const dismissed = await db
      .update(recipeFlags)
      .set({ ...review, status: 'dismissed' })
      // #59: a stale page must not overwrite a closed report's status or notes.
      .where(reportStillPending(flag.id))
      .returning({ id: recipeFlags.id });
    return dismissed.length === 0 ? STALE_REPORT_ERROR : null;
  }

  // #59: both writes match only while this report is pending, so a stale page writes nothing.
  const commentWhere = and(eq(recipeComments.id, flag.comment_id), lockReportIfPending(flag.id));
  const commentWrite =
    action === 'remove'
      ? db.delete(recipeComments).where(commentWhere)
      : db.update(recipeComments).set({ is_flagged: true, updated_at: now }).where(commentWhere);

  const flagsWrite = db
    .update(recipeFlags)
    .set({ ...review, status: 'resolved' })
    .where(
      and(
        eq(recipeFlags.comment_id, flag.comment_id),
        eq(recipeFlags.status, 'pending'),
        lockReportIfPending(flag.id)
      )
    )
    .returning({ id: recipeFlags.id });

  // A comment already gone needs no write; the reports still close.
  const [, flags] = await db.batch([commentWrite, flagsWrite]);
  return flags.length === 0 ? STALE_REPORT_ERROR : null;
}
