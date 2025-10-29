/**
 * Server Actions for Recipe Instruction Classification
 *
 * Provides actions to classify recipe instructions using AI.
 */

'use server';

import { eq } from 'drizzle-orm';
import { classifyRecipeInstructions } from '@/lib/ai/instruction-classifier';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import type { InstructionMetadata } from '@/types/instruction-metadata';

/**
 * Classifies a single recipe's instructions
 */
export async function classifyRecipe(recipeId: string): Promise<{
  success: boolean;
  metadata?: InstructionMetadata[];
  error?: string;
}> {
  try {
    // Get recipe
    const recipe = await db.query.recipes.findFirst({
      where: eq(recipes.id, recipeId),
    });

    if (!recipe) {
      return { success: false, error: 'Recipe not found' };
    }

    // Parse instructions
    const instructions = JSON.parse(recipe.instructions) as string[];

    if (instructions.length === 0) {
      return { success: false, error: 'No instructions to classify' };
    }

    // Classify
    const metadata = await classifyRecipeInstructions(instructions, {
      recipeName: recipe.name,
      cuisine: recipe.cuisine || undefined,
      difficulty: recipe.difficulty || undefined,
    });

    if (metadata.length === 0) {
      return { success: false, error: 'Classification failed' };
    }

    // Save to database
    await db
      .update(recipes)
      .set({
        instruction_metadata: JSON.stringify(metadata),
        instruction_metadata_version: '1.0.0',
        instruction_metadata_generated_at: new Date(),
        instruction_metadata_model: 'google/gemini-2.0-flash-exp:free',
      })
      .where(eq(recipes.id, recipeId));

    return { success: true, metadata };
  } catch (error) {
    console.error('Failed to classify recipe:', error);
    return { success: false, error: 'Classification failed' };
  }
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
