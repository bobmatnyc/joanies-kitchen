'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin';
import { getOpenRouterClient } from '@/lib/ai/openrouter-server';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { toErrorMessage } from '@/lib/utils/error-handling';

/**
 * Admin Recipe Image Management Actions
 * All actions require admin access via requireAdmin() check
 */

// ==================== Image Flagging ====================

export interface FlaggedRecipe {
  id: string;
  name: string;
  image_url: string | null;
  images: string | null;
  image_flagged_for_regeneration: boolean;
  image_regeneration_requested_at: Date | null;
  image_regeneration_requested_by: string | null;
}

/**
 * Flag a recipe image for regeneration
 */
export async function flagRecipeImageForRegeneration(recipeId: string) {
  try {
    const { userId } = await requireAdmin();

    // Get current recipe to verify it exists
    const recipe = await db.select().from(recipes).where(eq(recipes.id, recipeId)).limit(1);

    if (recipe.length === 0) {
      return { success: false, error: 'Recipe not found' };
    }

    // Update recipe with flag
    const result = await db
      .update(recipes)
      .set({
        image_flagged_for_regeneration: true,
        image_regeneration_requested_at: new Date(),
        image_regeneration_requested_by: userId,
        updated_at: new Date(),
      })
      .where(eq(recipes.id, recipeId))
      .returning();

    // Revalidate relevant paths
    revalidatePath('/admin');
    revalidatePath('/admin/recipes');
    revalidatePath(`/recipes/${recipeId}`);
    if (recipe[0].slug) {
      revalidatePath(`/recipes/${recipe[0].slug}`);
    }

    return { success: true, data: result[0] };
  } catch (error) {
    console.error('Failed to flag recipe image:', error);
    return { success: false, error: 'Failed to flag recipe image for regeneration' };
  }
}

/**
 * Unflag a recipe image (remove regeneration flag)
 */
export async function unflagRecipeImage(recipeId: string) {
  try {
    await requireAdmin();

    const result = await db
      .update(recipes)
      .set({
        image_flagged_for_regeneration: false,
        image_regeneration_requested_at: null,
        image_regeneration_requested_by: null,
        updated_at: new Date(),
      })
      .where(eq(recipes.id, recipeId))
      .returning();

    if (result.length === 0) {
      return { success: false, error: 'Recipe not found' };
    }

    // Revalidate relevant paths
    revalidatePath('/admin');
    revalidatePath('/admin/recipes');
    revalidatePath(`/recipes/${recipeId}`);
    if (result[0].slug) {
      revalidatePath(`/recipes/${result[0].slug}`);
    }

    return { success: true, data: result[0] };
  } catch (error) {
    console.error('Failed to unflag recipe image:', error);
    return { success: false, error: 'Failed to remove image flag' };
  }
}

/**
 * Get all flagged recipes
 */
export async function getFlaggedRecipes() {
  try {
    await requireAdmin();

    const flaggedRecipes = await db
      .select({
        id: recipes.id,
        name: recipes.name,
        image_url: recipes.image_url,
        images: recipes.images,
        image_flagged_for_regeneration: recipes.image_flagged_for_regeneration,
        image_regeneration_requested_at: recipes.image_regeneration_requested_at,
        image_regeneration_requested_by: recipes.image_regeneration_requested_by,
        slug: recipes.slug,
        description: recipes.description,
      })
      .from(recipes)
      .where(eq(recipes.image_flagged_for_regeneration, true));

    return { success: true, data: flaggedRecipes };
  } catch (error) {
    console.error('Failed to fetch flagged recipes:', error);
    return { success: false, error: 'Failed to fetch flagged recipes' };
  }
}

/**
 * Get count of flagged recipes
 */
export async function getFlaggedRecipesCount() {
  try {
    await requireAdmin();

    const result = await db
      .select({
        id: recipes.id,
      })
      .from(recipes)
      .where(eq(recipes.image_flagged_for_regeneration, true));

    return { success: true, data: result.length };
  } catch (error) {
    console.error('Failed to count flagged recipes:', error);
    return { success: false, error: 'Failed to count flagged recipes' };
  }
}

// ==================== Image Generation ====================

/**
 * Generate a recipe image using AI
 */
async function generateRecipeImage(
  recipeName: string,
  description?: string | null
): Promise<string | null> {
  try {
    const client = getOpenRouterClient();

    // Create a descriptive prompt for image generation
    const prompt = `Generate a professional, appetizing photo of ${recipeName}${
      description ? `. ${description}` : ''
    }. The image should be high quality, well-lit, and make the food look delicious. Use a natural, realistic style suitable for a recipe website.`;

    // Use DALL-E 3 for image generation via OpenRouter
    const response = await client.images.generate({
      model: 'openai/dall-e-3',
      prompt: prompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
    });

    if (response.data && response.data.length > 0) {
      return response.data[0].url || null;
    }

    return null;
  } catch (error) {
    console.error('Failed to generate recipe image:', error);
    return null;
  }
}

/**
 * Regenerate a single recipe's image
 */
export async function regenerateRecipeImage(recipeId: string) {
  try {
    await requireAdmin();

    // Get the recipe
    const recipe = await db
      .select()
      .from(recipes)
      .where(and(eq(recipes.id, recipeId), eq(recipes.image_flagged_for_regeneration, true)))
      .limit(1);

    if (recipe.length === 0) {
      return { success: false, error: 'Recipe not found or not flagged for regeneration' };
    }

    const recipeData = recipe[0];

    // Generate new image
    const newImageUrl = await generateRecipeImage(recipeData.name, recipeData.description);

    if (!newImageUrl) {
      return { success: false, error: 'Failed to generate new image' };
    }

    // Update recipe with new image and clear flag
    const result = await db
      .update(recipes)
      .set({
        image_url: newImageUrl,
        images: JSON.stringify([newImageUrl]), // Update images array
        image_flagged_for_regeneration: false,
        image_regeneration_requested_at: null,
        image_regeneration_requested_by: null,
        updated_at: new Date(),
      })
      .where(eq(recipes.id, recipeId))
      .returning();

    // Revalidate all relevant paths
    revalidatePath('/admin');
    revalidatePath('/admin/recipes');
    revalidatePath(`/recipes/${recipeId}`);
    revalidatePath('/shared');
    revalidatePath('/discover');
    if (recipeData.slug) {
      revalidatePath(`/recipes/${recipeData.slug}`);
    }

    return {
      success: true,
      data: {
        recipe: result[0],
        newImageUrl,
      },
    };
  } catch (error) {
    console.error('Failed to regenerate recipe image:', error);
    return { success: false, error: 'Failed to regenerate recipe image' };
  }
}

/**
 * Batch regenerate images for all flagged recipes
 */
export async function regenerateAllFlaggedImages() {
  try {
    await requireAdmin();

    // Get all flagged recipes
    const flaggedRecipes = await db
      .select()
      .from(recipes)
      .where(eq(recipes.image_flagged_for_regeneration, true));

    if (flaggedRecipes.length === 0) {
      return { success: true, data: { processed: 0, succeeded: 0, failed: 0 } };
    }

    const results = {
      processed: flaggedRecipes.length,
      succeeded: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Process each recipe
    for (const recipe of flaggedRecipes) {
      try {
        const result = await regenerateRecipeImage(recipe.id);
        if (result.success) {
          results.succeeded++;
        } else {
          results.failed++;
          results.errors.push(`${recipe.name}: ${result.error}`);
        }
      } catch (error) {
        results.failed++;
        results.errors.push(
          `${recipe.name}: ${toErrorMessage(error)}`
        );
      }

      // Add a small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Revalidate all paths after batch operation
    revalidatePath('/admin');
    revalidatePath('/admin/recipes');
    revalidatePath('/shared');
    revalidatePath('/discover');

    return { success: true, data: results };
  } catch (error) {
    console.error('Failed to regenerate all flagged images:', error);
    return { success: false, error: 'Failed to regenerate flagged images' };
  }
}
