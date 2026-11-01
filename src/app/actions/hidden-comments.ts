/**
 * #59: admin list and actions for hidden comments.
 *
 * Why: a comment stays hidden until an admin unhides it, but the report queue
 * shows only the newest rows per view and a hidden comment can have no report
 * rows at all. This list reads `recipe_comments` directly, so every hidden comment
 * can be reached.
 * What: `getHiddenComments` pages through every hidden comment with the total;
 * `actOnHiddenComment` unhides or removes one. Both require an admin.
 * Test: `src/app/actions/__tests__/hidden-comments.test.ts`
 */

'use server';

import { and, count, desc, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin';
import {
  HIDDEN_COMMENTS_PAGE_SIZE,
  removeHiddenCommentResolvingReports,
  STALE_HIDDEN_COMMENT_ERROR,
  unhideCommentResolvingReports,
} from '@/lib/comment-moderation';
import { db } from '@/lib/db';
import { recipeComments, recipeFlags, recipes } from '@/lib/db/schema';
import { toErrorMessage } from '@/lib/utils/error-handling';

export interface HiddenComment {
  id: string;
  recipe_id: string;
  recipeName: string;
  user_id: string;
  content: string;
  created_at: Date;
  pendingReports: number;
}

export interface HiddenCommentsPage {
  comments: HiddenComment[];
  /** Every hidden comment, not only this page. */
  total: number;
  /** The page returned, 1-based; a request past the end returns the last page. */
  page: number;
  pageCount: number;
}

export type HiddenCommentAction = 'unhide' | 'remove';

/**
 * Why: an admin must see how many comments are hidden and reach all of them.
 * What: admin-only; a non-admin caller gets a thrown error and no comment text.
 * Returns one page, newest comment first. An invalid `page` reads as 1 and a page
 * past the end reads as the last page, so removing the last row of a page still
 * shows rows.
 * Test: `src/app/actions/__tests__/hidden-comments.test.ts`
 */
export async function getHiddenComments(page: number = 1): Promise<HiddenCommentsPage> {
  await requireAdmin();

  const hidden = eq(recipeComments.is_flagged, true);
  const [{ total }] = await db.select({ total: count() }).from(recipeComments).where(hidden);

  const pageCount = Math.max(1, Math.ceil(total / HIDDEN_COMMENTS_PAGE_SIZE));
  const requested = Number.isFinite(page) ? Math.max(1, Math.trunc(page)) : 1;
  const current = Math.min(requested, pageCount);

  const pendingReports = db
    .select({ n: count() })
    .from(recipeFlags)
    .where(and(eq(recipeFlags.comment_id, recipeComments.id), eq(recipeFlags.status, 'pending')));

  const comments = await db
    .select({
      id: recipeComments.id,
      recipe_id: recipeComments.recipe_id,
      recipeName: recipes.name,
      user_id: recipeComments.user_id,
      content: recipeComments.content,
      created_at: recipeComments.created_at,
      pendingReports: sql<number>`(${pendingReports})::int`,
    })
    .from(recipeComments)
    .leftJoin(recipes, eq(recipeComments.recipe_id, recipes.id))
    .where(hidden)
    // The id breaks created_at ties, so paging neither repeats nor skips a row.
    .orderBy(desc(recipeComments.created_at), desc(recipeComments.id))
    .limit(HIDDEN_COMMENTS_PAGE_SIZE)
    .offset((current - 1) * HIDDEN_COMMENTS_PAGE_SIZE);

  return {
    comments: comments.map((c) => ({ ...c, recipeName: c.recipeName ?? 'Unknown Recipe' })),
    total,
    page: current,
    pageCount,
  };
}

/**
 * Why: Unhide and Remove must work with no report row to act through.
 * What: admin-only. `unhide` clears the hide and dismisses every pending report
 * (#194, ruling Df8). `remove` deletes the comment and resolves every pending
 * report. Both record `reviewNotes` on the reports they close and leave closed
 * reports alone. A comment that is no longer hidden returns
 * `STALE_HIDDEN_COMMENT_ERROR` and nothing is written; a missing comment returns
 * 'Comment not found'.
 * Test: `src/app/actions/__tests__/hidden-comments.test.ts`
 */
export async function actOnHiddenComment(
  commentId: string,
  action: HiddenCommentAction,
  reviewNotes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { userId } = await requireAdmin();

    if (action !== 'unhide' && action !== 'remove') {
      return { success: false, error: 'Invalid action' };
    }

    const [comment] = await db
      .select({ recipe_id: recipeComments.recipe_id, is_flagged: recipeComments.is_flagged })
      .from(recipeComments)
      .where(eq(recipeComments.id, commentId))
      .limit(1);

    if (!comment) {
      return { success: false, error: 'Comment not found' };
    }
    if (!comment.is_flagged) {
      return { success: false, error: STALE_HIDDEN_COMMENT_ERROR };
    }

    const notes = reviewNotes || null;
    if (action === 'unhide') {
      const restored = await unhideCommentResolvingReports(commentId, userId, notes);
      if (!restored) return { success: false, error: 'Comment not found' };
    } else {
      const removed = await removeHiddenCommentResolvingReports(commentId, userId, notes);
      if (!removed) return { success: false, error: STALE_HIDDEN_COMMENT_ERROR };
    }

    console.log(`[Hidden Comments] Admin ${userId} applied ${action} to comment ${commentId}`);
    revalidatePath('/admin/flags');
    revalidatePath(`/recipes/${comment.recipe_id}`);
    return { success: true };
  } catch (error: unknown) {
    console.error('[Hidden Comments] Error:', error);
    return { success: false, error: toErrorMessage(error) || 'Failed to apply action' };
  }
}
