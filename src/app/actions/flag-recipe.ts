/**
 * Server Actions for Recipe Flagging
 *
 * Handles content moderation through user-submitted flags:
 * - Flag inappropriate/spam content
 * - Track flag status (pending, reviewed, resolved, dismissed)
 * - Admin review and management
 */

'use server';

import { and, count, desc, eq, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { checkAdminAccess, requireAdmin } from '@/lib/admin';
import { auth } from '@/lib/auth';
import { applyCommentFlagAction } from '@/lib/comment-moderation';
import { db } from '@/lib/db';
import { recipeComments, recipeFlags, recipes } from '@/lib/db/schema';
import { findViewableRecipe, getRecipeViewer } from '@/lib/recipe-visibility';
import { toErrorMessage } from '@/lib/utils/error-handling';

export type FlagReason =
  | 'inappropriate'
  | 'spam'
  | 'copyright'
  | 'quality'
  | 'harassment'
  | 'other';
export type FlagStatus = 'pending' | 'reviewed' | 'resolved' | 'dismissed';

export interface FlagRecipeResult {
  success: boolean;
  error?: string;
  flagId?: string;
}

/**
 * Flag a recipe for review
 *
 * @param recipeId - Recipe ID to flag
 * @param reason - Reason for flagging
 * @param description - Optional detailed description
 * @returns Result with success status
 */
export async function flagRecipe(
  recipeId: string,
  reason: FlagReason,
  description?: string
): Promise<FlagRecipeResult> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return {
        success: false,
        error: 'You must be logged in to flag recipes',
      };
    }

    // Validate reason
    const validReasons: FlagReason[] = [
      'inappropriate',
      'spam',
      'copyright',
      'quality',
      'harassment',
      'other',
    ];
    if (!validReasons.includes(reason)) {
      return {
        success: false,
        error: 'Invalid flag reason',
      };
    }

    // #41: a recipe the caller cannot see is answered as nonexistent.
    const recipe = await findViewableRecipe(recipeId, await getRecipeViewer());

    if (!recipe) {
      return {
        success: false,
        error: 'Recipe not found',
      };
    }

    // #59: one report per user per recipe, whatever its status.
    // #105: comment reports also carry recipe_id; they do not count here.
    const existing = await db
      .select({ id: recipeFlags.id })
      .from(recipeFlags)
      .where(
        and(
          eq(recipeFlags.recipe_id, recipeId),
          eq(recipeFlags.user_id, userId),
          isNull(recipeFlags.comment_id)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return {
        success: false,
        error: 'You have already reported this recipe',
      };
    }

    // Create flag
    const [newFlag] = await db
      .insert(recipeFlags)
      .values({
        recipe_id: recipeId,
        user_id: userId,
        reason,
        description: description || null,
        status: 'pending',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning({ id: recipeFlags.id });

    console.log(`[Flag Recipe] User ${userId} flagged recipe ${recipeId} for ${reason}`);

    // Revalidate paths
    revalidatePath(`/recipes/${recipeId}`);
    revalidatePath('/admin/flags');

    return {
      success: true,
      flagId: newFlag.id,
    };
  } catch (error: unknown) {
    console.error('[Flag Recipe] Error:', error);
    return {
      success: false,
      error: toErrorMessage(error) || 'Failed to flag recipe',
    };
  }
}

/**
 * Get flag count for a recipe
 *
 * @param recipeId - Recipe ID
 * @returns Count of pending flags
 */
export async function getFlagCount(recipeId: string): Promise<number> {
  try {
    const result = await db
      .select({ count: count() })
      .from(recipeFlags)
      .where(
        and(
          eq(recipeFlags.recipe_id, recipeId),
          eq(recipeFlags.status, 'pending'),
          isNull(recipeFlags.comment_id) // #105: recipe reports only
        )
      );

    return result[0]?.count || 0;
  } catch (error: unknown) {
    console.error('[Get Flag Count] Error:', error);
    return 0;
  }
}

/**
 * Check if current user has flagged a recipe
 *
 * @param recipeId - Recipe ID
 * @returns True if user has an active flag on this recipe
 */
export async function hasUserFlagged(recipeId: string): Promise<boolean> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return false;
    }

    const flags = await db
      .select({ id: recipeFlags.id })
      .from(recipeFlags)
      .where(
        and(
          eq(recipeFlags.recipe_id, recipeId),
          eq(recipeFlags.user_id, userId),
          eq(recipeFlags.status, 'pending'),
          isNull(recipeFlags.comment_id) // #105: recipe reports only
        )
      )
      .limit(1);

    return flags.length > 0;
  } catch (error: unknown) {
    console.error('[Has User Flagged] Error:', error);
    return false;
  }
}

/**
 * Get all flags (admin only)
 *
 * @param status - Filter by status (optional)
 * @param limit - Max number of flags to return
 * @returns Array of flags with recipe info
 */
export async function getAllFlags(
  status?: FlagStatus,
  limit: number = 50
): Promise<
  {
    id: string;
    recipe_id: string;
    recipeName: string;
    /** #105: set for a comment report. */
    comment_id: string | null;
    /** #105: the reported comment's text; null when not a comment report or deleted. */
    commentContent: string | null;
    /** #105: true while the reported comment is hidden. */
    commentHidden: boolean;
    user_id: string;
    reason: string;
    description: string | null;
    status: string;
    reviewed_by: string | null;
    reviewed_at: Date | null;
    review_notes: string | null;
    created_at: Date | null;
  }[]
> {
  try {
    const { userId, isAdmin } = await checkAdminAccess(); // #22: users.is_admin, not the JWT

    if (!userId) {
      throw new Error('Unauthorized');
    }

    // Check if user is admin
    if (!isAdmin) {
      throw new Error('Admin access required');
    }

    // Query flags with recipe information
    const query = db
      .select({
        id: recipeFlags.id,
        recipe_id: recipeFlags.recipe_id,
        recipeName: recipes.name,
        comment_id: recipeFlags.comment_id,
        commentContent: recipeComments.content,
        commentHidden: recipeComments.is_flagged,
        user_id: recipeFlags.user_id,
        reason: recipeFlags.reason,
        description: recipeFlags.description,
        status: recipeFlags.status,
        reviewed_by: recipeFlags.reviewed_by,
        reviewed_at: recipeFlags.reviewed_at,
        review_notes: recipeFlags.review_notes,
        created_at: recipeFlags.created_at,
      })
      .from(recipeFlags)
      .leftJoin(recipes, eq(recipeFlags.recipe_id, recipes.id))
      .leftJoin(recipeComments, eq(recipeFlags.comment_id, recipeComments.id)) // #105
      .orderBy(desc(recipeFlags.created_at))
      .limit(limit);

    // Add status filter if provided
    const flags = status ? await query.where(eq(recipeFlags.status, status)) : await query;

    return flags.map((flag) => ({
      id: flag.id,
      recipe_id: flag.recipe_id,
      recipeName: flag.recipeName || 'Unknown Recipe',
      comment_id: flag.comment_id,
      commentContent: flag.commentContent,
      commentHidden: flag.commentHidden ?? false,
      user_id: flag.user_id,
      reason: flag.reason || 'other',
      description: flag.description,
      status: flag.status || 'pending',
      reviewed_by: flag.reviewed_by,
      reviewed_at: flag.reviewed_at,
      review_notes: flag.review_notes,
      created_at: flag.created_at,
    }));
  } catch (error: unknown) {
    console.error('[Get All Flags] Error:', error);
    throw error;
  }
}

/**
 * Review a flag (admin only)
 *
 * @param flagId - Flag ID to review
 * @param status - New status (reviewed, resolved, dismissed)
 * @param reviewNotes - Optional admin notes
 * @returns Success status
 */
export async function reviewFlag(
  flagId: string,
  status: 'reviewed' | 'resolved' | 'dismissed',
  reviewNotes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { userId, isAdmin } = await checkAdminAccess(); // #22: users.is_admin, not the JWT

    if (!userId) {
      return {
        success: false,
        error: 'You must be logged in',
      };
    }

    // Check if user is admin
    if (!isAdmin) {
      return {
        success: false,
        error: 'Admin access required',
      };
    }

    // Validate status
    const validStatuses = ['reviewed', 'resolved', 'dismissed'];
    if (!validStatuses.includes(status)) {
      return {
        success: false,
        error: 'Invalid status',
      };
    }

    // Update flag
    await db
      .update(recipeFlags)
      .set({
        status,
        reviewed_by: userId,
        reviewed_at: new Date(),
        review_notes: reviewNotes || null,
        updated_at: new Date(),
      })
      .where(eq(recipeFlags.id, flagId));

    console.log(`[Review Flag] Admin ${userId} reviewed flag ${flagId} as ${status}`);

    revalidatePath('/admin/flags');

    return { success: true };
  } catch (error: unknown) {
    console.error('[Review Flag] Error:', error);
    return {
      success: false,
      error: toErrorMessage(error),
    };
  }
}

/**
 * Get flags for a specific recipe (admin only)
 *
 * @param recipeId - Recipe ID
 * @returns Array of flags for this recipe
 */
export async function getRecipeFlags(recipeId: string): Promise<
  {
    id: string;
    user_id: string;
    reason: string;
    description: string | null;
    status: string;
    created_at: Date | null;
  }[]
> {
  try {
    const { userId, isAdmin } = await checkAdminAccess(); // #22: users.is_admin, not the JWT

    if (!userId) {
      throw new Error('Unauthorized');
    }

    // Check if user is admin
    if (!isAdmin) {
      throw new Error('Admin access required');
    }

    const flags = await db
      .select({
        id: recipeFlags.id,
        user_id: recipeFlags.user_id,
        reason: recipeFlags.reason,
        description: recipeFlags.description,
        status: recipeFlags.status,
        created_at: recipeFlags.created_at,
      })
      .from(recipeFlags)
      .where(eq(recipeFlags.recipe_id, recipeId))
      .orderBy(desc(recipeFlags.created_at));

    return flags.map((flag) => ({
      id: flag.id,
      user_id: flag.user_id,
      reason: flag.reason || 'other',
      description: flag.description,
      status: flag.status || 'pending',
      created_at: flag.created_at,
    }));
  } catch (error: unknown) {
    console.error('[Get Recipe Flags] Error:', error);
    throw error;
  }
}

export type FlagQueueAction = 'dismiss' | 'hide' | 'remove' | 'unhide';

/**
 * Why: #59 gives admins three outcomes for a recipe report, each recorded on
 * the flag with the reviewer and the time.
 * What: admin-only. `unhide` undoes `hide` (sets `approved`; the flag is unchanged).
 * `dismiss` marks the flag dismissed and leaves the recipe
 * alone. `hide` sets `recipes.moderation_status` to `rejected` (not publicly
 * visible) and resolves the flag. `remove` soft-deletes the recipe
 * (`deleted_at`, `deleted_by`) and resolves the flag. A recipe write that
 * touches no row, or any thrown error, returns `success: false`; the flag is
 * only updated after the recipe write succeeds.
 * #105: a comment report (`comment_id` set) delegates to `applyCommentFlagAction`.
 * Test: `src/app/actions/__tests__/report-moderation.test.ts`,
 * `src/app/actions/__tests__/comment-reports.test.ts`
 */
export async function actOnRecipeFlag(
  flagId: string,
  action: FlagQueueAction,
  reviewNotes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { userId } = await requireAdmin();

    if (!['dismiss', 'hide', 'remove', 'unhide'].includes(action)) {
      return { success: false, error: 'Invalid action' };
    }

    const [flag] = await db
      .select({
        id: recipeFlags.id,
        recipe_id: recipeFlags.recipe_id,
        comment_id: recipeFlags.comment_id,
      })
      .from(recipeFlags)
      .where(eq(recipeFlags.id, flagId))
      .limit(1);

    if (!flag) {
      return { success: false, error: 'Flag not found' };
    }

    // #105: a comment report acts on the comment, never on the recipe.
    if (flag.comment_id) {
      const failure = await applyCommentFlagAction(
        { id: flag.id, comment_id: flag.comment_id },
        action,
        userId,
        reviewNotes || null
      );
      if (failure) return { success: false, error: failure };
      console.log(`[Flag Queue] Admin ${userId} applied ${action} to comment flag ${flagId}`);
      revalidatePath('/admin/flags');
      revalidatePath(`/recipes/${flag.recipe_id}`);
      return { success: true };
    }

    const now = new Date();

    if (action === 'unhide') {
      // #102: undo of hide. Only `rejected` hides a recipe and hide never touches
      // `is_public`, so `approved` restores exactly the prior visibility.
      const restored = await db
        .update(recipes)
        .set({
          moderation_status: 'approved',
          moderated_by: userId,
          moderated_at: now,
          updated_at: now,
        })
        .where(and(eq(recipes.id, flag.recipe_id), eq(recipes.moderation_status, 'rejected')))
        .returning({ id: recipes.id });
      if (restored.length === 0) {
        return { success: false, error: 'Recipe is not hidden' };
      }
      revalidatePath('/admin/flags');
      revalidatePath(`/recipes/${flag.recipe_id}`);
      return { success: true };
    }

    if (action === 'hide' || action === 'remove') {
      const changes =
        action === 'hide'
          ? {
              moderation_status: 'rejected' as const,
              moderated_by: userId,
              moderated_at: now,
              updated_at: now,
            }
          : { deleted_at: now, deleted_by: userId, updated_at: now };
      const updated = await db
        .update(recipes)
        .set(changes)
        .where(eq(recipes.id, flag.recipe_id))
        .returning({ id: recipes.id });
      if (updated.length === 0) {
        return { success: false, error: 'Recipe not found' };
      }
    }

    const flagged = await db
      .update(recipeFlags)
      .set({
        status: action === 'dismiss' ? 'dismissed' : 'resolved',
        reviewed_by: userId,
        reviewed_at: now,
        review_notes: reviewNotes || null,
        updated_at: now,
      })
      .where(eq(recipeFlags.id, flagId))
      .returning({ id: recipeFlags.id });
    if (flagged.length === 0) {
      return { success: false, error: 'Failed to update flag' };
    }

    console.log(`[Flag Queue] Admin ${userId} applied ${action} to flag ${flagId}`);
    revalidatePath('/admin/flags');
    revalidatePath(`/recipes/${flag.recipe_id}`);

    return { success: true };
  } catch (error: unknown) {
    console.error('[Flag Queue] Error:', error);
    return { success: false, error: toErrorMessage(error) || 'Failed to apply action' };
  }
}
