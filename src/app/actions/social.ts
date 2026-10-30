'use server';

import { and, count, desc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { authorNotPendingDeletion } from '@/lib/account-deletion';
import { requireAdmin } from '@/lib/admin';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { recipeComments, recipeForks, recipes } from '@/lib/db/schema';
import { userProfiles } from '@/lib/db/user-discovery-schema';
import { canViewRecipe, getRecipeViewer } from '@/lib/recipe-visibility';
import { toErrorMessage } from '@/lib/utils/error-handling';

// #167 (D26): the recipe_likes actions (toggleRecipeLike, getRecipeLikesCount,
// hasUserLikedRecipe, getUserLikedRecipes) are gone; likes are favorites now
// (`@/app/actions/favorites`, `@/lib/favorites`).

// ==================
// TYPE DEFINITIONS
// ==================

export interface DataResult<T> {
  success: boolean;
  data: T;
  error?: string;
}

export interface SuccessResult {
  success: boolean;
  error?: string;
}

// ==================
// RECIPE FORKS
// ==================

/**
 * Fork a recipe (create a copy with attribution to original)
 */
export async function forkRecipe(
  originalRecipeId: string
): Promise<DataResult<typeof recipes.$inferSelect> | SuccessResult> {
  try {
    const viewer = await getRecipeViewer();
    const { userId } = viewer;

    if (!userId) {
      return { success: false, error: 'Authentication required' };
    }

    // Get the original recipe
    const originalRecipe = await db
      .select()
      .from(recipes)
      .where(eq(recipes.id, originalRecipeId))
      .limit(1);

    // #32: forking copies content; a recipe the caller may not read answers as nonexistent.
    if (originalRecipe.length === 0 || !canViewRecipe(originalRecipe[0], viewer)) {
      return { success: false, error: 'Recipe not found' };
    }

    const recipe = originalRecipe[0];

    // Create a copy of the recipe
    const [newRecipe] = await db
      .insert(recipes)
      .values({
        user_id: userId,
        name: `${recipe.name} (Forked)`,
        description: recipe.description,
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
        prep_time: recipe.prep_time,
        cook_time: recipe.cook_time,
        servings: recipe.servings,
        difficulty: recipe.difficulty,
        cuisine: recipe.cuisine,
        tags: recipe.tags,
        images: recipe.images,
        is_ai_generated: false,
        is_public: false, // Forked recipes are private by default
        nutrition_info: recipe.nutrition_info,
        source: `Forked from: ${recipe.name}`,
      })
      .returning();

    // Create fork relationship
    await db.insert(recipeForks).values({
      recipe_id: newRecipe.id,
      original_recipe_id: originalRecipeId,
      user_id: userId,
    });

    revalidatePath('/recipes');
    revalidatePath(`/recipes/${originalRecipeId}`);

    return {
      success: true,
      data: newRecipe,
    };
  } catch (error) {
    console.error('[forkRecipe] Error:', error);
    return {
      success: false,
      error: toErrorMessage(error),
    };
  }
}

/**
 * Get fork count for a recipe
 */
export async function getRecipeForkCount(recipeId: string): Promise<DataResult<number>> {
  try {
    const result = await db
      .select({ count: count() })
      .from(recipeForks)
      .where(eq(recipeForks.original_recipe_id, recipeId));

    return {
      success: true,
      data: result[0]?.count || 0,
    };
  } catch (error) {
    console.error('[getRecipeForkCount] Error:', error);
    return {
      success: false,
      error: toErrorMessage(error),
      data: 0,
    };
  }
}

/**
 * Get original recipe info for a forked recipe
 */
export async function getOriginalRecipe(
  forkedRecipeId: string
): Promise<
  DataResult<{ originalRecipe: typeof recipes.$inferSelect; forkedAt: Date | null } | null>
> {
  try {
    const forkInfo = await db
      .select({
        originalRecipe: recipes,
        forkedAt: recipeForks.created_at,
      })
      .from(recipeForks)
      .innerJoin(recipes, eq(recipeForks.original_recipe_id, recipes.id))
      .where(eq(recipeForks.recipe_id, forkedRecipeId))
      .limit(1);

    // #32: both the fork and its original must be readable by the caller.
    const viewer = await getRecipeViewer();
    const [forked] = await db
      .select({
        is_public: recipes.is_public,
        moderation_status: recipes.moderation_status,
        user_id: recipes.user_id,
      })
      .from(recipes)
      .where(eq(recipes.id, forkedRecipeId))
      .limit(1);
    if (
      forkInfo.length === 0 ||
      !forked ||
      !canViewRecipe(forked, viewer) ||
      !canViewRecipe(forkInfo[0].originalRecipe, viewer)
    ) {
      return { success: true, data: null };
    }

    return {
      success: true,
      data: forkInfo[0],
    };
  } catch (error) {
    console.error('[getOriginalRecipe] Error:', error);
    return {
      success: false,
      error: toErrorMessage(error),
      data: null,
    };
  }
}

// ==================
// RECIPE COMMENTS
// ==================

/**
 * Add a comment to a recipe
 */
export async function addRecipeComment(
  recipeId: string,
  content: string
): Promise<DataResult<typeof recipeComments.$inferSelect> | SuccessResult> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return { success: false, error: 'Authentication required' };
    }

    if (!content || content.trim().length === 0) {
      return { success: false, error: 'Comment cannot be empty' };
    }

    const [comment] = await db
      .insert(recipeComments)
      .values({
        recipe_id: recipeId,
        user_id: userId,
        content: content.trim(),
      })
      .returning();

    revalidatePath(`/recipes/${recipeId}`);

    return {
      success: true,
      data: comment,
    };
  } catch (error) {
    console.error('[addRecipeComment] Error:', error);
    return {
      success: false,
      error: toErrorMessage(error),
    };
  }
}

export interface RecipeCommentWithProfile {
  id: string;
  user_id: string;
  recipe_id: string;
  content: string;
  is_edited: boolean;
  is_flagged: boolean;
  created_at: Date;
  updated_at: Date;
  user_name: string;
  user_avatar?: string;
}

/**
 * Get comments for a recipe with user profile data
 */
export async function getRecipeComments(
  recipeId: string
): Promise<DataResult<RecipeCommentWithProfile[]>> {
  try {
    const commentsWithProfiles = await db
      .select({
        id: recipeComments.id,
        userId: recipeComments.user_id,
        recipeId: recipeComments.recipe_id,
        content: recipeComments.content,
        isEdited: recipeComments.is_edited,
        isFlagged: recipeComments.is_flagged,
        createdAt: recipeComments.created_at,
        updatedAt: recipeComments.updated_at,
        displayName: userProfiles.display_name,
        avatar: userProfiles.profile_image_url,
      })
      .from(recipeComments)
      .leftJoin(userProfiles, eq(recipeComments.user_id, userProfiles.user_id))
      .where(
        and(
          eq(recipeComments.recipe_id, recipeId),
          eq(recipeComments.is_flagged, false), // Don't show flagged comments
          // #103: hide comments by an author with a pending account deletion.
          authorNotPendingDeletion(recipeComments.user_id)
        )
      )
      .orderBy(desc(recipeComments.created_at));

    const comments = commentsWithProfiles.map((c) => ({
      id: c.id,
      user_id: c.userId,
      recipe_id: c.recipeId,
      content: c.content,
      is_edited: c.isEdited,
      is_flagged: c.isFlagged,
      created_at: c.createdAt || new Date(),
      updated_at: c.updatedAt || new Date(),
      user_name: c.displayName || 'Anonymous User',
      user_avatar: c.avatar || undefined,
    }));

    return {
      success: true,
      data: comments,
    };
  } catch (error) {
    console.error('[getRecipeComments] Error:', error);
    return {
      success: false,
      error: toErrorMessage(error),
      data: [],
    };
  }
}

/**
 * Update a comment
 */
export async function updateRecipeComment(
  commentId: string,
  content: string
): Promise<DataResult<typeof recipeComments.$inferSelect> | SuccessResult> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return { success: false, error: 'Authentication required' };
    }

    if (!content || content.trim().length === 0) {
      return { success: false, error: 'Comment cannot be empty' };
    }

    // Check if user owns the comment
    const comment = await db
      .select()
      .from(recipeComments)
      .where(eq(recipeComments.id, commentId))
      .limit(1);

    if (comment.length === 0) {
      return { success: false, error: 'Comment not found' };
    }

    if (comment[0].user_id !== userId) {
      return { success: false, error: 'Unauthorized' };
    }

    const [updatedComment] = await db
      .update(recipeComments)
      .set({
        content: content.trim(),
        is_edited: true,
        updated_at: new Date(),
      })
      .where(eq(recipeComments.id, commentId))
      .returning();

    revalidatePath(`/recipes/${comment[0].recipe_id}`);

    return {
      success: true,
      data: updatedComment,
    };
  } catch (error) {
    console.error('[updateRecipeComment] Error:', error);
    return {
      success: false,
      error: toErrorMessage(error),
    };
  }
}

/**
 * Delete a comment
 */
export async function deleteRecipeComment(commentId: string): Promise<SuccessResult> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return { success: false, error: 'Authentication required' };
    }

    // Check if user owns the comment
    const comment = await db
      .select()
      .from(recipeComments)
      .where(eq(recipeComments.id, commentId))
      .limit(1);

    if (comment.length === 0) {
      return { success: false, error: 'Comment not found' };
    }

    if (comment[0].user_id !== userId) {
      return { success: false, error: 'Unauthorized' };
    }

    await db.delete(recipeComments).where(eq(recipeComments.id, commentId));

    revalidatePath(`/recipes/${comment[0].recipe_id}`);

    return {
      success: true,
    };
  } catch (error) {
    console.error('[deleteRecipeComment] Error:', error);
    return {
      success: false,
      error: toErrorMessage(error),
    };
  }
}

/**
 * Get comment count for a recipe
 */
export async function getRecipeCommentCount(recipeId: string): Promise<DataResult<number>> {
  try {
    const result = await db
      .select({ count: count() })
      .from(recipeComments)
      .where(
        and(
          eq(recipeComments.recipe_id, recipeId),
          eq(recipeComments.is_flagged, false),
          authorNotPendingDeletion(recipeComments.user_id) // #103
        )
      );

    return {
      success: true,
      data: result[0]?.count || 0,
    };
  } catch (error) {
    console.error('[getRecipeCommentCount] Error:', error);
    return {
      success: false,
      error: toErrorMessage(error),
      data: 0,
    };
  }
}

/**
 * Why: #59 lets an admin hide an abusive comment without deleting it.
 * What: admin-only. Sets (`hidden: true`) or clears `recipe_comments.is_flagged`;
 * `getRecipeComments` and `getRecipeCommentCount` already exclude flagged rows.
 * A comment id that matches no row, or any thrown error, returns `success: false`.
 * Test: `src/app/actions/__tests__/report-moderation.test.ts`
 */
export async function setCommentHidden(commentId: string, hidden: boolean): Promise<SuccessResult> {
  try {
    await requireAdmin();

    const updated = await db
      .update(recipeComments)
      .set({ is_flagged: hidden, updated_at: new Date() })
      .where(eq(recipeComments.id, commentId))
      .returning({ recipeId: recipeComments.recipe_id });

    if (updated.length === 0) {
      return { success: false, error: 'Comment not found' };
    }

    revalidatePath(`/recipes/${updated[0].recipeId}`);
    return { success: true };
  } catch (error) {
    console.error('[setCommentHidden] Error:', error);
    return { success: false, error: toErrorMessage(error) };
  }
}
