/**
 * Server Actions for Recipe Instruction Classification
 *
 * Provides actions to classify recipe instructions using AI.
 */

'use server';

import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/admin';
import { classifyAndStoreRecipe } from '@/lib/ai/classify-recipe';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import type { InstructionMetadata } from '@/types/instruction-metadata';

/**
 * Classifies a single recipe's instructions (admin only).
 * Scripts call `classifyAndStoreRecipe` from `@/lib/ai/classify-recipe`.
 */
export async function classifyRecipe(recipeId: string): Promise<{
  success: boolean;
  metadata?: InstructionMetadata[];
  error?: string;
}> {
  await requireAdmin(); // See #13: paid OpenRouter call and a write to any recipe
  return classifyAndStoreRecipe(recipeId);
}

/**
 * Gets instruction metadata for a recipe
 */
export async function getInstructionMetadata(recipeId: string): Promise<{
  success: boolean;
  metadata?: InstructionMetadata[];
  error?: string;
}> {
  try {
    const recipe = await db.query.recipes.findFirst({
      where: eq(recipes.id, recipeId),
    });

    if (!recipe) {
      return { success: false, error: 'Recipe not found' };
    }

    if (!recipe.instruction_metadata) {
      return { success: false, error: 'Recipe not classified yet' };
    }

    const metadata = JSON.parse(recipe.instruction_metadata) as InstructionMetadata[];

    return { success: true, metadata };
  } catch (error) {
    console.error('Failed to get instruction metadata:', error);
    return { success: false, error: 'Failed to retrieve metadata' };
  }
}

/**
 * Checks if a recipe has been classified
 */
export async function isRecipeClassified(recipeId: string): Promise<{
  success: boolean;
  classified?: boolean;
  error?: string;
}> {
  try {
    const recipe = await db.query.recipes.findFirst({
      where: eq(recipes.id, recipeId),
      columns: {
        id: true,
        instruction_metadata: true,
      },
    });

    if (!recipe) {
      return { success: false, error: 'Recipe not found' };
    }

    return {
      success: true,
      classified: recipe.instruction_metadata !== null,
    };
  } catch (error) {
    console.error('Failed to check recipe classification:', error);
    return { success: false, error: 'Failed to check classification' };
  }
}
