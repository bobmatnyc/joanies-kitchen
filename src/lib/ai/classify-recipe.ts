import { DEFAULT_AI_MODEL } from '@/lib/ai/models';
/**
 * #13: server-internal, deliberately NOT 'use server'. Classification spends
 * OpenRouter credits and writes `recipes.instruction_metadata`; the
 * client-callable `classifyRecipe` action wraps this behind requireAdmin, and
 * CLI scripts import it directly.
 */

import { eq } from 'drizzle-orm';
import { classifyRecipeInstructions } from '@/lib/ai/instruction-classifier';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import type { InstructionMetadata } from '@/types/instruction-metadata';

/** Classifies one recipe's instructions with the LLM and stores the metadata. */
export async function classifyAndStoreRecipe(recipeId: string): Promise<{
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

    const instructions = JSON.parse(recipe.instructions) as string[];

    if (instructions.length === 0) {
      return { success: false, error: 'No instructions to classify' };
    }

    const metadata = await classifyRecipeInstructions(instructions, {
      recipeName: recipe.name,
      cuisine: recipe.cuisine || undefined,
      difficulty: recipe.difficulty || undefined,
    });

    if (metadata.length === 0) {
      return { success: false, error: 'Classification failed' };
    }

    await db
      .update(recipes)
      .set({
        instruction_metadata: JSON.stringify(metadata),
        instruction_metadata_version: '1.0.0',
        instruction_metadata_generated_at: new Date(),
        instruction_metadata_model: DEFAULT_AI_MODEL,
      })
      .where(eq(recipes.id, recipeId));

    return { success: true, metadata };
  } catch (error) {
    console.error('Failed to classify recipe:', error);
    return { success: false, error: 'Classification failed' };
  }
}
