'use server';

import { auth } from '@clerk/nextjs/server';
import { and, count, desc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { recipeComments, recipeForks, recipeLikes, recipes } from '@/lib/db/schema';
import { userProfiles } from '@/lib/db/user-discovery-schema';
import { toErrorMessage } from '@/lib/utils/error-handling';

// ==================
// TYPE DEFINITIONS
// ==================

export interface LikeToggleResult {
  success: boolean;
  liked?: boolean;
  likesCount?: number;
  error?: string;
}

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
// RECIPE LIKES
// ==================

/**
 * Toggle like on a recipe (add if not liked, remove if liked)
 */
export async function toggleRecipeLike(recipeId: string): Promise<LikeToggleResult> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return { success: false, error: 'Authentication required' };
    }

    // Check if user already liked this recipe
    const existingLike = await db
      .select()
      .from(recipeLikes)
      .where(and(eq(recipeLikes.recipe_id, recipeId), eq(recipeLikes.user_id, userId)))
      .limit(1);

    if (existingLike.length > 0) {
      // Unlike: remove the like
      await db
        .delete(recipeLikes)
        .where(and(eq(recipeLikes.recipe_id, recipeId), eq(recipeLikes.user_id, userId)));

      // Get updated count
      const likesCount = await getRecipeLikesCount(recipeId);

      revalidatePath(`/recipes/${recipeId}`);
      revalidatePath('/recipes');
      revalidatePath('/discover');

      return {
        success: true,
        liked: false,
        likesCount: likesCount.data || 0,
      };
    } else {
      // Like: add new like
      await db.insert(recipeLikes).values({
        recipe_id: recipeId,
        user_id: userId,
      });

      // Get updated count
      const likesCount = await getRecipeLikesCount(recipeId);

      revalidatePath(`/recipes/${recipeId}`);
      revalidatePath('/recipes');
      revalidatePath('/discover');

      return {
        success: true,
        liked: true,
        likesCount: likesCount.data || 0,
      };
    }
  } catch (error) {
    console.error('[toggleRecipeLike] Error:', error);
    return {
      success: false,
      error: toErrorMessage(error),
    };
  }
}

/**
 * Get total likes count for a recipe
 */
export async function getRecipeLikesCount(recipeId: string): Promise<DataResult<number>> {
  try {
    const result = await db
      .select({ count: count() })
      .from(recipeLikes)
      .where(eq(recipeLikes.recipe_id, recipeId));

    return {
      success: true,
      data: result[0]?.count || 0,
    };
  } catch (error) {
    console.error('[getRecipeLikesCount] Error:', error);
    return {
      success: false,
      error: toErrorMessage(error),
      data: 0,
    };
  }
}

/**
 * Check if current user has liked a recipe
 */
export async function hasUserLikedRecipe(recipeId: string): Promise<DataResult<boolean>> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return { success: true, data: false };
    }

    const result = await db
      .select()
      .from(recipeLikes)
      .where(and(eq(recipeLikes.recipe_id, recipeId), eq(recipeLikes.user_id, userId)))
      .limit(1);

    return {
      success: true,
      data: result.length > 0,
    };
  } catch (error) {
    console.error('[hasUserLikedRecipe] Error:', error);
    return {
      success: false,
      error: toErrorMessage(error),
      data: false,
    };
  }
}

/**
 * Get recipes liked by current user
 */
export async function getUserLikedRecipes(): Promise<
  DataResult<Array<{ recipe: typeof recipes.$inferSelect; likedAt: Date | null }>>
> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return { success: false, error: 'Authentication required', data: [] };
    }

    const likedRecipes = await db
      .select({
        recipe: recipes,
        likedAt: recipeLikes.created_at,
      })
      .from(recipeLikes)
      .innerJoin(recipes, eq(recipeLikes.recipe_id, recipes.id))
      .where(eq(recipeLikes.user_id, userId))
      .orderBy(desc(recipeLikes.created_at));

    return {
      success: true,
      data: likedRecipes,
    };
  } catch (error) {
    console.error('[getUserLikedRecipes] Error:', error);
    return {
      success: false,
      error: toErrorMessage(error),
      data: [],
    };
  }
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
    const { userId } = await auth();

    if (!userId) {
      return { success: false, error: 'Authentication required' };
    }

    // Get the original recipe
    const originalRecipe = await db
      .select()
      .from(recipes)
      .where(eq(recipes.id, originalRecipeId))
      .limit(1);

    if (originalRecipe.length === 0) {
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

    if (forkInfo.length === 0) {
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
          eq(recipeComments.is_flagged, false) // Don't show flagged comments
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
      .where(and(eq(recipeComments.recipe_id, recipeId), eq(recipeComments.is_flagged, false)));

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
