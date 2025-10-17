/**
 * AI-powered Recipe Quality Evaluator
 *
 * Uses LLM to evaluate recipe quality on a 0-5 scale based on:
 * - Clarity of instructions
 * - Ingredient quality and completeness
 * - Cooking techniques
 * - Overall recipe completeness
 * - Practicality for home cooks
 */

import 'server-only';
import { getOpenRouterClient } from './openrouter-server';

export interface RecipeQualityEvaluation {
  rating: number; // 0.0-5.0
  reasoning: string; // Brief explanation
}

export interface RecipeToEvaluate {
  name: string;
  description?: string;
  ingredients: string[];
  instructions: string[];
  prepTime?: string;
  cookTime?: string;
  servings?: string | number;
}

/**
 * Evaluates recipe quality using AI
 *
 * @param recipe - Recipe data to evaluate
 * @returns Quality evaluation with rating and reasoning
 */
export async function evaluateRecipeQuality(
  recipe: RecipeToEvaluate
): Promise<RecipeQualityEvaluation> {
  try {
    console.log(`[Quality Evaluator] Evaluating: ${recipe.name}`);

    const openrouter = getOpenRouterClient();

    const prompt = `You are a professional recipe quality evaluator. Rate this recipe on a scale of 0-5 based on:

EVALUATION CRITERIA:
1. Clarity of instructions (are steps clear, logical, and easy to follow?)
2. Ingredient quality and completeness (well-defined measurements and descriptions?)
3. Cooking techniques used (appropriate methods for the dish?)
4. Overall recipe completeness (has all necessary information?)
5. Practicality (can average home cook make this successfully?)

RECIPE TO EVALUATE:
Name: ${recipe.name}
${recipe.description ? `Description: ${recipe.description}` : ''}
Prep Time: ${recipe.prepTime || 'Not specified'}
Cook Time: ${recipe.cookTime || 'Not specified'}
Servings: ${recipe.servings || 'Not specified'}

Ingredients:
${recipe.ingredients.map((ing, i) => `${i + 1}. ${ing}`).join('\n')}

Instructions:
${recipe.instructions.map((step, i) => `${i + 1}. ${step}`).join('\n')}

RATING SCALE:
- 5.0: Excellent - Professional quality, clear, complete, practical
- 4.0-4.9: Very Good - Minor improvements possible but highly usable
- 3.0-3.9: Good - Usable but has some issues or missing details
- 2.0-2.9: Fair - Significant issues or missing important information
- 1.0-1.9: Poor - Major problems, unclear, or incomplete
- 0.0-0.9: Unusable - Critical issues, cannot be followed

Respond in JSON format (no markdown code blocks):
{
  "rating": <number 0-5, can use decimals like 4.5>,
  "reasoning": "<brief 1-2 sentence explanation of the rating>"
}`;

    const response = await openrouter.chat.completions.create({
      model: 'anthropic/claude-3-haiku',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No response from LLM');
    }

    // Parse JSON response
    const evaluation = JSON.parse(content);

    // Validate and clamp rating to 0-5 range
    const rating = Math.max(0, Math.min(5, Number(evaluation.rating) || 3.0));

    // Round to 1 decimal place
    const roundedRating = Math.round(rating * 10) / 10;

    const result: RecipeQualityEvaluation = {
      rating: roundedRating,
      reasoning: evaluation.reasoning || 'No reasoning provided',
    };

    console.log(`[Quality Evaluator] Result: ${result.rating}/5 - ${result.reasoning}`);

    return result;
  } catch (error: any) {
    console.error('[Quality Evaluator] Error:', error.message);

    // Return neutral rating on error (don't fail the entire process)
    return {
      rating: 3.0,
      reasoning: 'Unable to evaluate recipe quality (evaluation error)',
    };
  }
}

/**
 * Evaluates multiple recipes in batch
 * Useful for bulk re-evaluation or initial seeding
 *
 * @param recipes - Array of recipes to evaluate
 * @param delayMs - Delay between evaluations to avoid rate limits
 * @returns Array of evaluations
 */
export async function evaluateRecipesBatch(
  recipes: RecipeToEvaluate[],
  delayMs: number = 1000
): Promise<RecipeQualityEvaluation[]> {
  const evaluations: RecipeQualityEvaluation[] = [];

  for (const recipe of recipes) {
    const evaluation = await evaluateRecipeQuality(recipe);
    evaluations.push(evaluation);

    // Rate limiting delay
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return evaluations;
}
