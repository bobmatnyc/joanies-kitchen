'use server';

import { revalidatePath } from 'next/cache';
import * as core from '@/lib/favorites';
import { findViewableRecipe, getRecipeViewer } from '@/lib/recipe-visibility';
import { getSessionUser, getSessionUserId } from '@/lib/session-user';
import { isUniqueViolation, toErrorMessage } from '@/lib/utils/error-handling';

/**
 * Favorites Server Actions
 *
 * Manage user favorite recipes (heart button functionality).
 * Separate from collections for quick favoriting without organization.
 *
 * #167 (D26): each action resolves the session user and delegates to the shared
 * favorites core (`@/lib/favorites`), the single like/favorite store.
 */

// ============================================================================
// ADD / REMOVE FAVORITES
// ============================================================================

/**
 * Add recipe to favorites
 */
export async function addFavorite(recipeId: string) {
  try {
    const user = await getSessionUser();
    const userId = user?.id;

    if (!userId) {
      return { success: false, error: 'Please sign in to favorite recipes' };
    }

    // #41: a recipe the caller cannot see is answered as nonexistent.
    const recipe = await findViewableRecipe(recipeId, await getRecipeViewer());

    if (!recipe) {
      return { success: false, error: 'Recipe not found' };
    }

    // #167 (D26): core ensures the profile, then inserts and increments like_count
    // in one statement; a repeat add inserts nothing and counts nothing.
    const result = await core.addFavorite(userId, recipeId, user ?? null);

    if (result.status === 'no-profile') {
      return { success: false, error: 'Failed to create user profile' };
    }
    if (result.status === 'exists') {
      return { success: false, error: 'Recipe already in favorites' };
    }
    // #208: the core refused the add because the account has a pending deletion.
    if (result.status === 'pending-deletion') {
      return { success: false, error: core.PENDING_DELETION_FAVORITE_ERROR };
    }

    revalidatePath('/favorites');
    revalidatePath(`/recipes/${recipeId}`);

    return { success: true, favorite: result.favorite };
  } catch (error) {
    console.error('Error adding favorite:', error);

    // #44: match SQLSTATE 23505 (on error.cause), not message text.
    if (isUniqueViolation(error)) {
      return { success: false, error: 'Recipe already in favorites' };
    }

    return { success: false, error: toErrorMessage(error) };
  }
}

/**
 * Remove recipe from favorites
 */
export async function removeFavorite(recipeId: string) {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return { success: false, error: 'Unauthorized' };
    }

    // #167 (D26): the #176 delete-and-decrement statement now lives in the core.
    await core.removeFavorite(userId, recipeId);

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
    const userId = await getSessionUserId();

    if (!userId) {
      return { success: false, error: 'Please sign in to favorite recipes' };
    }

    if (await core.isFavorite(userId, recipeId)) {
      // #167 (D26): was a bare DELETE that never decremented like_count.
      await core.removeFavorite(userId, recipeId);

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
    const currentUserId = await getSessionUserId();
    const userId = targetUserId || currentUserId;

    if (!userId) {
      return [];
    }

    // Only allow viewing own favorites for now
    // In Phase 2 we can add social features to view others' public favorites
    if (userId !== currentUserId) {
      return [];
    }

    // #41: drop favorites whose recipe the viewer can no longer read.
    // #167 (D26): the query lives in the favorites core.
    const userFavorites = await core.listFavorites(userId, await getRecipeViewer());

    return userFavorites.map((f) => ({
      ...f.recipe,
      favoritedAt: f.favoritedAt,
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
    const userId = await getSessionUserId();

    if (!userId) {
      return false;
    }

    return await core.isFavorite(userId, recipeId);
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
    // #167 (D26): a real count(*); the old version returned 0 or 1.
    return await core.getFavoriteCount(recipeId);
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
    const userId = await getSessionUserId();

    if (!userId) {
      return [];
    }

    return await core.listFavoriteRecipeIds(userId);
  } catch (error) {
    console.error('Error fetching favorite IDs:', error);
    return [];
  }
}
