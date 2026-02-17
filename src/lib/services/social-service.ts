import { and, count, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  recipeComments,
  recipeForks,
  recipeLikes,
  recipes,
} from '@/lib/db/schema';
import { userProfiles } from '@/lib/db/user-discovery-schema';

/**
 * SocialService - Business logic for social features
 *
 * Responsibilities:
 * - Recipe likes (favorites)
 * - Recipe comments
 * - Recipe forks
 * - Social interactions and counts
 *
 * Note: This service is stateless. Caller must provide userId for authentication.
 */
export class SocialService {
  // ==================
  // FAVORITES (LIKES)
  // ==================

  /**
   * Get all recipes favorited by a user
   */
  async getFavorites(userId: string): Promise<typeof recipes.$inferSelect[]> {
    const likedRecipes = await db
      .select({
        recipe: recipes,
      })
      .from(recipeLikes)
      .innerJoin(recipes, eq(recipeLikes.recipe_id, recipes.id))
      .where(eq(recipeLikes.user_id, userId))
      .orderBy(desc(recipeLikes.created_at));

    return likedRecipes.map((lr) => lr.recipe);
  }

  /**
   * Add a recipe to user's favorites
   */
  async addFavorite(userId: string, recipeId: string): Promise<void> {
    // Check if already liked
    const existingLike = await this.isFavorite(userId, recipeId);

    if (existingLike) {
      return; // Already favorited, idempotent operation
    }

    await db.insert(recipeLikes).values({
      recipe_id: recipeId,
      user_id: userId,
    });
  }

  /**
   * Remove a recipe from user's favorites
   */
  async removeFavorite(userId: string, recipeId: string): Promise<void> {
    await db
      .delete(recipeLikes)
      .where(and(eq(recipeLikes.recipe_id, recipeId), eq(recipeLikes.user_id, userId)));
  }

  /**
   * Check if a user has favorited a recipe
   */
  async isFavorite(userId: string, recipeId: string): Promise<boolean> {
    const [result] = await db
      .select()
      .from(recipeLikes)
      .where(and(eq(recipeLikes.recipe_id, recipeId), eq(recipeLikes.user_id, userId)))
      .limit(1);

    return !!result;
  }

  /**
   * Toggle favorite status (add if not liked, remove if liked)
   */
  async toggleFavorite(userId: string, recipeId: string): Promise<{ liked: boolean }> {
    const isCurrentlyLiked = await this.isFavorite(userId, recipeId);

    if (isCurrentlyLiked) {
      await this.removeFavorite(userId, recipeId);
      return { liked: false };
    } else {
      await this.addFavorite(userId, recipeId);
      return { liked: true };
    }
  }

  // ==================
  // LIKES (SAME AS FAVORITES - ALIASED FOR CLARITY)
  // ==================

  /**
   * Like a recipe (same as addFavorite)
   */
  async likeRecipe(userId: string, recipeId: string): Promise<void> {
    return this.addFavorite(userId, recipeId);
  }

  /**
   * Unlike a recipe (same as removeFavorite)
   */
  async unlikeRecipe(userId: string, recipeId: string): Promise<void> {
    return this.removeFavorite(userId, recipeId);
  }

  /**
   * Check if user has liked a recipe (same as isFavorite)
   */
  async isLiked(userId: string, recipeId: string): Promise<boolean> {
    return this.isFavorite(userId, recipeId);
  }

  /**
   * Get total like count for a recipe
   */
  async getLikeCount(recipeId: string): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(recipeLikes)
      .where(eq(recipeLikes.recipe_id, recipeId));

    return result?.count || 0;
  }

  // ==================
  // COMMENTS
  // ==================

  /**
   * Get comments for a recipe
   */
  async getComments(
    recipeId: string
  ): Promise<
    Array<{
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
    }>
  > {
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
          eq(recipeComments.is_flagged, false)
        )
      )
      .orderBy(desc(recipeComments.created_at));

    return commentsWithProfiles.map((c) => ({
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
  }

  /**
   * Add a comment to a recipe
   */
  async addComment(
    userId: string,
    recipeId: string,
    content: string
  ): Promise<typeof recipeComments.$inferSelect> {
    if (!content || content.trim().length === 0) {
      throw new Error('Comment cannot be empty');
    }

    const [comment] = await db
      .insert(recipeComments)
      .values({
        recipe_id: recipeId,
        user_id: userId,
        content: content.trim(),
      })
      .returning();

    if (!comment) {
      throw new Error('Failed to create comment');
    }

    return comment;
  }

  /**
   * Update a comment
   */
  async updateComment(
    commentId: string,
    content: string
  ): Promise<typeof recipeComments.$inferSelect | null> {
    if (!content || content.trim().length === 0) {
      throw new Error('Comment cannot be empty');
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

    return updatedComment || null;
  }

  /**
   * Delete a comment
   */
  async deleteComment(commentId: string): Promise<boolean> {
    const result = await db
      .delete(recipeComments)
      .where(eq(recipeComments.id, commentId))
      .returning();

    return result.length > 0;
  }

  /**
   * Get comment by ID
   */
  async getCommentById(commentId: string): Promise<typeof recipeComments.$inferSelect | null> {
    const [comment] = await db
      .select()
      .from(recipeComments)
      .where(eq(recipeComments.id, commentId))
      .limit(1);

    return comment || null;
  }

  /**
   * Get comment count for a recipe
   */
  async getCommentCount(recipeId: string): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(recipeComments)
      .where(
        and(eq(recipeComments.recipe_id, recipeId), eq(recipeComments.is_flagged, false))
      );

    return result?.count || 0;
  }

  // ==================
  // FORKS
  // ==================

  /**
   * Fork a recipe (create a copy)
   */
  async forkRecipe(
    userId: string,
    originalRecipeId: string
  ): Promise<typeof recipes.$inferSelect> {
    // Get the original recipe
    const [originalRecipe] = await db
      .select()
      .from(recipes)
      .where(eq(recipes.id, originalRecipeId))
      .limit(1);

    if (!originalRecipe) {
      throw new Error('Recipe not found');
    }

    // Create a copy of the recipe
    const [newRecipe] = await db
      .insert(recipes)
      .values({
        user_id: userId,
        name: `${originalRecipe.name} (Forked)`,
        description: originalRecipe.description,
        ingredients: originalRecipe.ingredients,
        instructions: originalRecipe.instructions,
        prep_time: originalRecipe.prep_time,
        cook_time: originalRecipe.cook_time,
        servings: originalRecipe.servings,
        difficulty: originalRecipe.difficulty,
        cuisine: originalRecipe.cuisine,
        tags: originalRecipe.tags,
        images: originalRecipe.images,
        is_ai_generated: false,
        is_public: false, // Forked recipes are private by default
        nutrition_info: originalRecipe.nutrition_info,
        source: `Forked from: ${originalRecipe.name}`,
      })
      .returning();

    if (!newRecipe) {
      throw new Error('Failed to fork recipe');
    }

    // Create fork relationship
    await db.insert(recipeForks).values({
      recipe_id: newRecipe.id,
      original_recipe_id: originalRecipeId,
      user_id: userId,
    });

    return newRecipe;
  }

  /**
   * Get fork count for a recipe
   */
  async getForkCount(recipeId: string): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(recipeForks)
      .where(eq(recipeForks.original_recipe_id, recipeId));

    return result?.count || 0;
  }

  /**
   * Get original recipe info for a forked recipe
   */
  async getOriginalRecipe(
    forkedRecipeId: string
  ): Promise<{ originalRecipe: typeof recipes.$inferSelect; forkedAt: Date } | null> {
    const [forkInfo] = await db
      .select({
        originalRecipe: recipes,
        forkedAt: recipeForks.created_at,
      })
      .from(recipeForks)
      .innerJoin(recipes, eq(recipeForks.original_recipe_id, recipes.id))
      .where(eq(recipeForks.recipe_id, forkedRecipeId))
      .limit(1);

    if (!forkInfo) {
      return null;
    }

    return {
      originalRecipe: forkInfo.originalRecipe,
      forkedAt: forkInfo.forkedAt || new Date(),
    };
  }
}

// Export singleton instance
export const socialService = new SocialService();
