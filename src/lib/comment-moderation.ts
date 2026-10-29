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

export type CommentFlagAction = 'dismiss' | 'hide' | 'remove' | 'unhide';

/**
 * Why: #105 "admin dismiss un-hides the comment"; the queue's other actions act
 * on the comment, not the recipe the report row also names.
 * What: admin-checked by the caller. `dismiss` un-hides the comment and dismisses
 * every pending report on it (so stale reports cannot re-trigger the auto-hide);
 * `hide` hides it and `remove` deletes it, each resolving every pending report;
 * `unhide` clears the hidden state and leaves reports alone. The comment write
 * and the report updates run in one `db.batch`. Returns an error string when
 * `unhide` finds no comment or no report row was updated, else null.
 */
export async function applyCommentFlagAction(
  flag: { id: string; comment_id: string },
  action: CommentFlagAction,
  adminId: string,
  reviewNotes: string | null
): Promise<string | null> {
  const now = new Date();
  const commentWhere = eq(recipeComments.id, flag.comment_id);
  const commentWrite =
    action === 'remove'
      ? db.delete(recipeComments).where(commentWhere).returning({ id: recipeComments.id })
      : db
          .update(recipeComments)
          .set({ is_flagged: action === 'hide', updated_at: now })
          .where(commentWhere)
          .returning({ id: recipeComments.id });

  if (action === 'unhide') {
    const restored = await commentWrite;
    return restored.length === 0 ? 'Comment not found' : null;
  }

  const flagsWrite = db
    .update(recipeFlags)
    .set({
      status: action === 'dismiss' ? 'dismissed' : 'resolved',
      reviewed_by: adminId,
      reviewed_at: now,
      review_notes: reviewNotes,
      updated_at: now,
    })
    .where(
      sql`${recipeFlags.id} = ${flag.id} OR (${recipeFlags.comment_id} = ${flag.comment_id} AND ${recipeFlags.status} = 'pending')`
    )
    .returning({ id: recipeFlags.id });

  // A comment already gone needs no write; the reports still close.
  const [, flags] = await db.batch([commentWrite, flagsWrite]);
  return flags.length === 0 ? 'Failed to update flag' : null;
}
