'use server';

import { eq, isNotNull, or } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { isAdmin } from '@/lib/admin-client';
import { invalidateRecipeById } from '@/lib/cache';

/**
 * Admin Server Actions for Recipe Content Management
 *
 * Features:
 * - Flag images for regeneration
 * - Flag content (ingredients/instructions) for cleanup
 * - Soft delete recipes (hide from view but keep in database)
 *
 * All actions require admin authorization.
 */

interface ActionResult {
  success: boolean;
  error?: string;
  message?: string;
}

/**
 * Flag a recipe's image for regeneration
 * Used when AI-generated image needs to be regenerated
 */
export async function flagImageForRegeneration(recipeId: string): Promise<ActionResult> {
  try {
    const { userId } = await auth();

    if (!userId || !isAdmin(userId)) {
      return { success: false, error: 'Unauthorized: Admin access required' };
    }

    // Update recipe with flag
    await db
      .update(recipes)
      .set({
        image_flagged_for_regeneration: true,
        image_regeneration_requested_at: new Date(),
        image_regeneration_requested_by: userId,
      })
      .where(eq(recipes.id, recipeId));

    // Invalidate cache
    invalidateRecipeById(recipeId);
    revalidatePath(`/recipes/${recipeId}`);
    revalidatePath('/recipes');

    return {
      success: true,
      message: 'Image flagged for regeneration'
    };
  } catch (error) {
    console.error('[Admin] Failed to flag image:', error);
    return {
      success: false,
      error: 'Failed to flag image for regeneration'
    };
  }
}

/**
 * Flag recipe content for cleanup
 *
 * @param recipeId - Recipe ID to flag
 * @param type - Type of content to flag: 'ingredients', 'instructions', or 'both'
 */
export async function flagContentForCleanup(
  recipeId: string,
  type: 'ingredients' | 'instructions' | 'both'
): Promise<ActionResult> {
  try {
    const { userId } = await auth();

    if (!userId || !isAdmin(userId)) {
      return { success: false, error: 'Unauthorized: Admin access required' };
    }

    // Determine which flags to set
    const updates: Record<string, boolean> = {
      content_flagged_for_cleanup: true,
    };

    if (type === 'ingredients' || type === 'both') {
      updates.ingredients_need_cleanup = true;
    }

    if (type === 'instructions' || type === 'both') {
      updates.instructions_need_cleanup = true;
    }

    // Update recipe with flags
    await db
      .update(recipes)
      .set(updates)
      .where(eq(recipes.id, recipeId));

    // Invalidate cache
    invalidateRecipeById(recipeId);
    revalidatePath(`/recipes/${recipeId}`);
    revalidatePath('/recipes');

    const flaggedItems =
      type === 'both'
        ? 'ingredients and instructions'
        : type;

    return {
      success: true,
      message: `${flaggedItems} flagged for cleanup`
    };
  } catch (error) {
    console.error('[Admin] Failed to flag content:', error);
    return {
      success: false,
      error: 'Failed to flag content for cleanup'
    };
  }
}

/**
 * Clear content cleanup flags
 * Used after content has been cleaned up
 */
export async function clearContentFlags(recipeId: string): Promise<ActionResult> {
  try {
    const { userId } = await auth();

    if (!userId || !isAdmin(userId)) {
      return { success: false, error: 'Unauthorized: Admin access required' };
    }

    // Clear all content flags
    await db
      .update(recipes)
      .set({
        content_flagged_for_cleanup: false,
        ingredients_need_cleanup: false,
        instructions_need_cleanup: false,
      })
      .where(eq(recipes.id, recipeId));

    // Invalidate cache
    invalidateRecipeById(recipeId);
    revalidatePath(`/recipes/${recipeId}`);
    revalidatePath('/recipes');

    return {
      success: true,
      message: 'Content flags cleared'
    };
  } catch (error) {
    console.error('[Admin] Failed to clear flags:', error);
    return {
      success: false,
      error: 'Failed to clear content flags'
    };
  }
}

/**
 * Soft delete a recipe
 * Hides recipe from all views but keeps in database
 * Can be restored later by admin
 */
export async function softDeleteRecipe(recipeId: string): Promise<ActionResult> {
  try {
    const { userId } = await auth();

    if (!userId || !isAdmin(userId)) {
      return { success: false, error: 'Unauthorized: Admin access required' };
    }

    // Soft delete recipe
    await db
      .update(recipes)
      .set({
        deleted_at: new Date(),
        deleted_by: userId,
      })
      .where(eq(recipes.id, recipeId));

    // Invalidate cache
    invalidateRecipeById(recipeId);
    revalidatePath(`/recipes/${recipeId}`);
    revalidatePath('/recipes');
    revalidatePath('/discover');
    revalidatePath('/shared');

    return {
      success: true,
      message: 'Recipe soft deleted (hidden from view)'
    };
  } catch (error) {
    console.error('[Admin] Failed to soft delete recipe:', error);
    return {
      success: false,
      error: 'Failed to soft delete recipe'
    };
  }
}

/**
 * Restore a soft-deleted recipe
 * Makes recipe visible again
 */
export async function restoreRecipe(recipeId: string): Promise<ActionResult> {
  try {
    const { userId } = await auth();

    if (!userId || !isAdmin(userId)) {
      return { success: false, error: 'Unauthorized: Admin access required' };
    }

    // Restore recipe by clearing deletion fields
    await db
      .update(recipes)
      .set({
        deleted_at: null,
        deleted_by: null,
      })
      .where(eq(recipes.id, recipeId));

    // Invalidate cache
    invalidateRecipeById(recipeId);
    revalidatePath(`/recipes/${recipeId}`);
    revalidatePath('/recipes');
    revalidatePath('/discover');
    revalidatePath('/shared');

    return {
      success: true,
      message: 'Recipe restored successfully'
    };
  } catch (error) {
    console.error('[Admin] Failed to restore recipe:', error);
    return {
      success: false,
      error: 'Failed to restore recipe'
    };
  }
}

/**
 * Get all flagged recipes
 * Returns recipes that have been flagged for cleanup or image regeneration
 */
export async function getFlaggedRecipes() {
  try {
    const { userId } = await auth();

    if (!userId || !isAdmin(userId)) {
      return { success: false, error: 'Unauthorized: Admin access required' };
    }

    // Get all flagged recipes
    const flaggedRecipes = await db
      .select()
      .from(recipes)
      .where(
        or(
          eq(recipes.image_flagged_for_regeneration, true),
          eq(recipes.content_flagged_for_cleanup, true)
        )
      );

    return {
      success: true,
      data: flaggedRecipes
    };
  } catch (error) {
    console.error('[Admin] Failed to get flagged recipes:', error);
    return {
      success: false,
      error: 'Failed to get flagged recipes'
    };
  }
}

/**
 * Get all soft-deleted recipes
 * Returns recipes that have been soft-deleted
 */
export async function getDeletedRecipes() {
  try {
    const { userId } = await auth();

    if (!userId || !isAdmin(userId)) {
      return { success: false, error: 'Unauthorized: Admin access required' };
    }

    // Get all soft-deleted recipes
    const deletedRecipes = await db
      .select()
      .from(recipes)
      .where(isNotNull(recipes.deleted_at));

    return {
      success: true,
      data: deletedRecipes
    };
  } catch (error) {
    console.error('[Admin] Failed to get deleted recipes:', error);
    return {
      success: false,
      error: 'Failed to get deleted recipes'
    };
  }
}
