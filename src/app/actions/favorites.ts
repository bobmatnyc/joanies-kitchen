'use server';

import { auth } from '@clerk/nextjs/server';
import { and, desc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { favorites } from '@/lib/db/user-discovery-schema';

/**
 * Favorites Server Actions
 *
 * Manage user favorite recipes (heart button functionality).
 * Separate from collections for quick favoriting without organization.
 */

// ============================================================================
// ADD / REMOVE FAVORITES
// ============================================================================

/**
 * Add recipe to favorites
 */
export async function addFavorite(recipeId: string) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return { success: false, error: 'Please sign in to favorite recipes' };
    }

    // Ensure user has a profile (auto-create if needed)
    const { ensureUserProfile } = await import('./user-profiles');
    const profile = await ensureUserProfile();

    if (!profile) {
      return { success: false, error: 'Failed to create user profile' };
    }

    // Check if recipe exists
    const [recipe] = await db.select().from(recipes).where(eq(recipes.id, recipeId)).limit(1);

    if (!recipe) {
      return { success: false, error: 'Recipe not found' };
    }

    // Add to favorites
    const [newFavorite] = await db
      .insert(favorites)
      .values({
        user_id: userId,
        recipe_id: recipeId,
      })
      .returning();

    revalidatePath('/favorites');
    revalidatePath(`/recipes/${recipeId}`);

    return { success: true, favorite: newFavorite };
  } catch (error) {
    console.error('Error adding favorite:', error);

    if (error instanceof Error && error.message.includes('unique')) {
      return { success: false, error: 'Recipe already in favorites' };
    }

    return { success: false, error: 'Failed to add favorite' };
  }
}

/**
 * Remove recipe from favorites
 */
export async function removeFavorite(recipeId: string) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return { success: false, error: 'Unauthorized' };
    }

    // Remove from favorites
    await db
      .delete(favorites)
      .where(and(eq(favorites.user_id, userId), eq(favorites.recipe_id, recipeId)));

    revalidatePath('/favorites');
    revalidatePath(`/recipes/${recipeId}`);

    return { success: true };
  } catch (error) {
    console.error('Error removing favorite:', error);
    return { success: false, error: 'Failed to remove favorite' };
  }
}

/**
 * Toggle favorite status
 * Returns the new favorite status (true if added, false if removed)
 */
export async function toggleFavorite(recipeId: string) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return { success: false, error: 'Please sign in to favorite recipes' };
    }

    // Check if already favorited
    const [existingFavorite] = await db
      .select()
      .from(favorites)
      .where(and(eq(favorites.user_id, userId), eq(favorites.recipe_id, recipeId)))
      .limit(1);

    if (existingFavorite) {
      // Remove favorite
      await db
        .delete(favorites)
        .where(and(eq(favorites.user_id, userId), eq(favorites.recipe_id, recipeId)));

      revalidatePath('/favorites');
      revalidatePath(`/recipes/${recipeId}`);

      return { success: true, isFavorited: false };
    } else {
      // Add favorite
      const result = await addFavorite(recipeId);
      if (!result.success) {
        return result;
      }
      return { success: true, isFavorited: true };
    }
  } catch (error) {
    console.error('Error toggling favorite:', error);
    return { success: false, error: 'Failed to update favorite' };
  }
}

// ============================================================================
// GET FAVORITES
// ============================================================================

/**
 * Get user's favorite recipes
 */
export async function getUserFavorites(targetUserId?: string) {
  try {
    const { userId: currentUserId } = await auth();
    const userId = targetUserId || currentUserId;

    if (!userId) {
      return [];
    }

    // Only allow viewing own favorites for now
    // In Phase 2 we can add social features to view others' public favorites
    if (userId !== currentUserId) {
      return [];
    }

    const userFavorites = await db
      .select({
        favorite: favorites,
        recipe: recipes,
      })
      .from(favorites)
      .innerJoin(recipes, eq(favorites.recipe_id, recipes.id))
      .where(eq(favorites.user_id, userId))
      .orderBy(desc(favorites.created_at));

    return userFavorites.map((f) => ({
      ...f.recipe,
      favoritedAt: f.favorite.created_at,
    }));
  } catch (error) {
    console.error('Error fetching favorites:', error);
    return [];
  }
}

/**
 * Check if recipe is favorited by current user
 */
export async function isFavorited(recipeId: string): Promise<boolean> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return false;
    }

    const [favorite] = await db
      .select()
      .from(favorites)
      .where(and(eq(favorites.user_id, userId), eq(favorites.recipe_id, recipeId)))
      .limit(1);

    return !!favorite;
  } catch (error) {
    console.error('Error checking favorite status:', error);
    return false;
  }
}

/**
 * Get favorite count for a recipe
 */
export async function getFavoriteCount(recipeId: string): Promise<number> {
  try {
    const [result] = await db
      .select({ count: favorites.id })
      .from(favorites)
      .where(eq(favorites.recipe_id, recipeId));

    return result ? 1 : 0; // This is a simplified version; proper count query will be added
  } catch (error) {
    console.error('Error getting favorite count:', error);
    return 0;
  }
}

/**
 * Get favorite IDs for current user (for quick lookup)
 * Returns array of recipe IDs that are favorited
 */
export async function getUserFavoriteIds(): Promise<string[]> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return [];
    }

    const userFavorites = await db
      .select({ recipe_id: favorites.recipe_id })
      .from(favorites)
      .where(eq(favorites.user_id, userId));

    return userFavorites.map((f) => f.recipe_id);
  } catch (error) {
    console.error('Error fetching favorite IDs:', error);
    return [];
  }
}
