'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin';
import { getOpenRouterClient } from '@/lib/ai/openrouter-server';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';

/**
 * Admin Recipe Editing Actions
 * Provides inline editing capabilities for recipe content with AI assistance
 */

// ==================== Ingredient Management ====================

/**
 * Update recipe ingredients
 */
export async function updateRecipeIngredients(recipeId: string, ingredients: string[]) {
  try {
    await requireAdmin();

    // Validate ingredients
    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      return { success: false, error: 'Invalid ingredients array' };
    }

    // Get current recipe to verify it exists
    const recipe = await db.select().from(recipes).where(eq(recipes.id, recipeId)).limit(1);

    if (recipe.length === 0) {
      return { success: false, error: 'Recipe not found' };
    }

    // Update recipe with new ingredients
    const result = await db
      .update(recipes)
      .set({
        ingredients: JSON.stringify(ingredients),
        updated_at: new Date(),
      })
      .where(eq(recipes.id, recipeId))
      .returning();

    // Revalidate relevant paths
    revalidatePath(`/recipes/${recipeId}`);
    if (recipe[0].slug) {
      revalidatePath(`/recipes/${recipe[0].slug}`);
    }

    return { success: true, data: result[0] };
  } catch (error) {
    console.error('Failed to update recipe ingredients:', error);
    return { success: false, error: 'Failed to update recipe ingredients' };
  }
}

/**
 * Parse and fix ingredient formatting with LLM
 */
export async function parseIngredientsWithLLM(recipeId: string) {
  try {
    await requireAdmin();

    // Get current recipe
    const recipe = await db.select().from(recipes).where(eq(recipes.id, recipeId)).limit(1);

    if (recipe.length === 0) {
      return { success: false, error: 'Recipe not found' };
    }

    const currentIngredients =
      typeof recipe[0].ingredients === 'string'
        ? JSON.parse(recipe[0].ingredients)
        : recipe[0].ingredients;

    // Use OpenRouter to parse and clean up ingredients
    const client = getOpenRouterClient();

    const prompt = `You are a culinary assistant. Please analyze the following ingredient list and return a properly formatted, standardized version. Each ingredient should follow this format: "[amount] [unit] [ingredient], [preparation]" where applicable.

Current ingredients:
${currentIngredients.map((ing: string, i: number) => `${i + 1}. ${ing}`).join('\n')}

Please return ONLY a JSON array of strings with the cleaned ingredients. Fix any typos, standardize measurements, and ensure consistent formatting. Example format:
["2 cups all-purpose flour", "1/2 teaspoon salt, finely ground", "3 large eggs, beaten"]

Return ONLY the JSON array, no additional text.`;

    const response = await client.chat.completions.create({
      model: 'anthropic/claude-3.5-sonnet',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { success: false, error: 'Failed to generate response from LLM' };
    }

    // Extract JSON array from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return { success: false, error: 'Failed to parse LLM response' };
    }

    const parsedIngredients = JSON.parse(jsonMatch[0]);

    // Update recipe with parsed ingredients
    const result = await db
      .update(recipes)
      .set({
        ingredients: JSON.stringify(parsedIngredients),
        updated_at: new Date(),
      })
      .where(eq(recipes.id, recipeId))
      .returning();

    // Revalidate relevant paths
    revalidatePath(`/recipes/${recipeId}`);
    if (recipe[0].slug) {
      revalidatePath(`/recipes/${recipe[0].slug}`);
    }

    return { success: true, data: { ingredients: parsedIngredients, recipe: result[0] } };
  } catch (error) {
    console.error('Failed to parse ingredients with LLM:', error);
    return { success: false, error: 'Failed to parse ingredients with AI' };
  }
}

// ==================== Instruction Management ====================

/**
 * Update recipe instructions
 */
export async function updateRecipeInstructions(recipeId: string, instructions: string[]) {
  try {
    await requireAdmin();

    // Validate instructions
    if (!Array.isArray(instructions) || instructions.length === 0) {
      return { success: false, error: 'Invalid instructions array' };
    }

    // Get current recipe to verify it exists
    const recipe = await db.select().from(recipes).where(eq(recipes.id, recipeId)).limit(1);

    if (recipe.length === 0) {
      return { success: false, error: 'Recipe not found' };
    }

    // Update recipe with new instructions
    const result = await db
      .update(recipes)
      .set({
        instructions: JSON.stringify(instructions),
        updated_at: new Date(),
      })
      .where(eq(recipes.id, recipeId))
      .returning();

    // Revalidate relevant paths
    revalidatePath(`/recipes/${recipeId}`);
    if (recipe[0].slug) {
      revalidatePath(`/recipes/${recipe[0].slug}`);
    }

    return { success: true, data: result[0] };
  } catch (error) {
    console.error('Failed to update recipe instructions:', error);
    return { success: false, error: 'Failed to update recipe instructions' };
  }
}

/**
 * Format and clean instructions with LLM
 */
export async function formatInstructionsWithLLM(recipeId: string) {
  try {
    await requireAdmin();

    // Get current recipe
    const recipe = await db.select().from(recipes).where(eq(recipes.id, recipeId)).limit(1);

    if (recipe.length === 0) {
      return { success: false, error: 'Recipe not found' };
    }

    const currentInstructions =
      typeof recipe[0].instructions === 'string'
        ? JSON.parse(recipe[0].instructions)
        : recipe[0].instructions;

    // Use OpenRouter to format and clean up instructions
    const client = getOpenRouterClient();

    const prompt = `You are a culinary assistant. Please analyze the following cooking instructions and return a properly formatted, clear, and well-organized version. Each step should be a complete, actionable instruction.

Current instructions:
${currentInstructions.map((inst: string, i: number) => `${i + 1}. ${inst}`).join('\n')}

Please return ONLY a JSON array of strings with the cleaned instructions. Fix any typos, improve clarity, ensure logical flow, and make each step actionable. Keep the same number of steps unless combining or splitting makes the recipe clearer.

Return ONLY the JSON array, no additional text.`;

    const response = await client.chat.completions.create({
      model: 'anthropic/claude-3.5-sonnet',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 3000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { success: false, error: 'Failed to generate response from LLM' };
    }

    // Extract JSON array from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return { success: false, error: 'Failed to parse LLM response' };
    }

    const formattedInstructions = JSON.parse(jsonMatch[0]);

    // Update recipe with formatted instructions
    const result = await db
      .update(recipes)
      .set({
        instructions: JSON.stringify(formattedInstructions),
        updated_at: new Date(),
      })
      .where(eq(recipes.id, recipeId))
      .returning();

    // Revalidate relevant paths
    revalidatePath(`/recipes/${recipeId}`);
    if (recipe[0].slug) {
      revalidatePath(`/recipes/${recipe[0].slug}`);
    }

    return { success: true, data: { instructions: formattedInstructions, recipe: result[0] } };
  } catch (error) {
    console.error('Failed to format instructions with LLM:', error);
    return { success: false, error: 'Failed to format instructions with AI' };
  }
}

// ==================== Image Management ====================

/**
 * Upload recipe image
 * Note: This accepts a base64-encoded image string
 */
export async function uploadRecipeImage(recipeId: string, imageBase64: string) {
  try {
    await requireAdmin();

    // Get current recipe to verify it exists
    const recipe = await db.select().from(recipes).where(eq(recipes.id, recipeId)).limit(1);

    if (recipe.length === 0) {
      return { success: false, error: 'Recipe not found' };
    }

    // In a real implementation, you would upload to a storage service (S3, Cloudinary, etc.)
    // For now, we'll store the base64 image directly (not recommended for production)
    // TODO: Integrate with image storage service

    // Update recipe with new image
    const result = await db
      .update(recipes)
      .set({
        image_url: imageBase64,
        images: JSON.stringify([imageBase64]),
        updated_at: new Date(),
      })
      .where(eq(recipes.id, recipeId))
      .returning();

    // Revalidate relevant paths
    revalidatePath(`/recipes/${recipeId}`);
    if (recipe[0].slug) {
      revalidatePath(`/recipes/${recipe[0].slug}`);
    }

    return { success: true, data: result[0] };
  } catch (error) {
    console.error('Failed to upload recipe image:', error);
    return { success: false, error: 'Failed to upload recipe image' };
  }
}

/**
 * Regenerate recipe image using existing admin-recipes.ts function
 * This is a convenience wrapper that calls the existing regenerateRecipeImage
 */
export async function regenerateImage(recipeId: string) {
  try {
    await requireAdmin();

    // First, flag the image for regeneration
    await db
      .update(recipes)
      .set({
        image_flagged_for_regeneration: true,
        image_regeneration_requested_at: new Date(),
        updated_at: new Date(),
      })
      .where(eq(recipes.id, recipeId));

    // Import and use the existing regeneration function
    const { regenerateRecipeImage } = await import('./admin-recipes');
    const result = await regenerateRecipeImage(recipeId);

    return result;
  } catch (error) {
    console.error('Failed to regenerate recipe image:', error);
    return { success: false, error: 'Failed to regenerate recipe image' };
  }
}
