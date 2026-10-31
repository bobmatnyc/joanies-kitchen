import { and, count, desc, eq, sql } from 'drizzle-orm';
import {
  AccountPendingDeletionError,
  insertUnlessPendingDeletion,
} from '@/lib/account-deletion/guarded-insert';
import { db } from '@/lib/db';
import { recipeComments, recipeForks, recipes } from '@/lib/db/schema';
import { userProfiles } from '@/lib/db/user-discovery-schema';
import type { ProfileIdentity } from '@/lib/ensure-user-profile';
import * as favoritesCore from '@/lib/favorites';
import { ANONYMOUS_VIEWER, type RecipeViewer } from '@/lib/recipe-visibility';

type Recipe = typeof recipes.$inferSelect;

/**
 * Why: #208: a fork by an account with a pending deletion must write nothing.
 * The server action and `SocialService.forkRecipe` both copied the recipe and
 * then linked it in two statements, so a refusal could split them.
 * What: inserts the private copy of `original` and its `recipe_forks` row in
 * ONE guarded statement (the link reads the copy's RETURNING). Returns the new
 * recipe, or null when the account has a pending deletion. `fork_count` is not
 * written, as before. No lock is taken on `original` beyond the FK check.
 * Test: `src/lib/__tests__/user-writes-pending-deletion.test.ts`
 */
export async function forkRecipeUnlessPendingDeletion(
  userId: string,
  original: Recipe
): Promise<Recipe | null> {
  const { row } = await insertUnlessPendingDeletion(
    recipes,
    {
      user_id: userId,
      name: `${original.name} (Forked)`,
      description: original.description,
      ingredients: original.ingredients,
      instructions: original.instructions,
      prep_time: original.prep_time,
      cook_time: original.cook_time,
      servings: original.servings,
      difficulty: original.difficulty,
      cuisine: original.cuisine,
      tags: original.tags,
      images: original.images,
      is_ai_generated: false,
      is_public: false, // Forked recipes are private by default
      nutrition_info: original.nutrition_info,
      source: `Forked from: ${original.name}`,
    },
    userId,
    {
      followedBy: sql`INSERT INTO ${recipeForks} (recipe_id, original_recipe_id, user_id)
        SELECT id, ${original.id}::text, ${userId}::text FROM inserted`,
    }
  );
  return row;
}

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
  // #167 (D26): every method here delegates to the favorites core (`favorites`
  // table). `recipe_likes` is no longer read or written.
  // ==================

  /**
   * Get all recipes favorited by a user
   */
  async getFavorites(
    userId: string,
    viewer: RecipeViewer = ANONYMOUS_VIEWER
  ): Promise<(typeof recipes.$inferSelect)[]> {
    // #41: only recipes the viewer may read
    const rows = await favoritesCore.listFavorites(userId, viewer);
    return rows.map((r) => r.recipe);
  }

  /**
   * Add a recipe to user's favorites. Idempotent: a repeat call is a no-op.
   * Creates the user's profile first when missing (`favorites` FK).
   * Throws when the profile cannot be created.
   * #208: throws `FavoritePendingDeletionError` when the account has a pending
   * deletion; nothing is written.
   */
  async addFavorite(
    userId: string,
    recipeId: string,
    identity: ProfileIdentity | null = null
  ): Promise<void> {
    const result = await favoritesCore.addFavorite(userId, recipeId, identity);
    if (result.status === 'no-profile') {
      throw new Error('Failed to create user profile');
    }
    // #208: follows the server action, which answers this with an error.
    if (result.status === 'pending-deletion') {
      throw new favoritesCore.FavoritePendingDeletionError();
    }
  }

  /**
   * Remove a recipe from user's favorites
   */
  async removeFavorite(userId: string, recipeId: string): Promise<void> {
    await favoritesCore.removeFavorite(userId, recipeId);
  }

  /**
   * Check if a user has favorited a recipe
   */
  async isFavorite(userId: string, recipeId: string): Promise<boolean> {
    return favoritesCore.isFavorite(userId, recipeId);
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
   * Get total like count for a recipe: the number of `favorites` rows.
   */
  async getLikeCount(recipeId: string): Promise<number> {
    return favoritesCore.getFavoriteCount(recipeId);
  }

  // ==================
  // COMMENTS
  // ==================

  /**
   * Get comments for a recipe
   */
  async getComments(recipeId: string): Promise<
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
      .where(and(eq(recipeComments.recipe_id, recipeId), eq(recipeComments.is_flagged, false)))
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
   * Add a comment to a recipe.
   * #208: throws `AccountPendingDeletionError` when the account has a pending
   * deletion; the guard is in the insert statement and nothing is written.
   */
  async addComment(
    userId: string,
    recipeId: string,
    content: string
  ): Promise<typeof recipeComments.$inferSelect> {
    if (!content || content.trim().length === 0) {
      throw new Error('Comment cannot be empty');
    }

    // #208: refused in the insert statement itself for an account pending deletion.
    const { allowed, row: comment } = await insertUnlessPendingDeletion(
      recipeComments,
      { recipe_id: recipeId, user_id: userId, content: content.trim() },
      userId
    );
    if (!allowed) {
      throw new AccountPendingDeletionError('comment on recipes');
    }

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
      .where(and(eq(recipeComments.recipe_id, recipeId), eq(recipeComments.is_flagged, false)));

    return result?.count || 0;
  }

  // ==================
  // FORKS
  // ==================

  /**
   * Fork a recipe (create a copy).
   * #208: throws `AccountPendingDeletionError` when the account has a pending
   * deletion; neither the copy nor the fork link is written.
   */
  async forkRecipe(userId: string, originalRecipeId: string): Promise<typeof recipes.$inferSelect> {
    // Get the original recipe
    const [originalRecipe] = await db
      .select()
      .from(recipes)
      .where(eq(recipes.id, originalRecipeId))
      .limit(1);

    if (!originalRecipe) {
      throw new Error('Recipe not found');
    }

    // #208: copy and link in one guarded statement.
    const newRecipe = await forkRecipeUnlessPendingDeletion(userId, originalRecipe);
    if (!newRecipe) {
      throw new AccountPendingDeletionError('fork recipes');
    }

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
