'use server';

/**
 * Server Actions for Ingredient Substitutions
 *
 * Provides server-side substitution lookup with error handling
 */

import { auth } from '@/lib/auth';
import { enforceRateLimit } from '@/lib/rate-limit';
import {
  getBatchSubstitutions,
  getSubstitutions,
  needsAiSubstitution,
} from '@/lib/substitutions/substitution-service';
import type { SubstitutionContext, SubstitutionResult } from '@/lib/substitutions/types';
import { toErrorMessage } from '@/lib/utils/error-handling';

/**
 * Server action result wrapper
 */
interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  /** #17: typed refusal before any paid AI call. */
  errorCode?: 'RATE_LIMITED' | 'LIMITER_UNAVAILABLE';
  retryAfterSec?: number;
}

/**
 * Get ingredient substitutions
 *
 * @param ingredient - Ingredient to find substitutions for
 * @param context - Optional context (recipe name, cooking method, user ingredients)
 * @returns SubstitutionResult with 0-5 substitution options
 *
 * @example
 * ```ts
 * const result = await getIngredientSubstitutions('butter', {
 *   recipeName: 'Chocolate Chip Cookies',
 *   cookingMethod: 'baking',
 *   userIngredients: ['coconut oil', 'olive oil'],
 * });
 *
 * if (result.success) {
 *   console.log(result.data.substitutions);
 * }
 * ```
 */
export async function getIngredientSubstitutions(
  ingredient: string,
  context?: {
    recipeName?: string;
    cookingMethod?: string;
    userIngredients?: string[];
    dietaryRestrictions?: string[];
  }
): Promise<ActionResult<SubstitutionResult>> {
  try {
    // Validate input
    if (!ingredient || ingredient.trim() === '') {
      return {
        success: false,
        error: 'Ingredient name is required',
      };
    }

    // Build context
    const substitutionContext: SubstitutionContext = {
      recipeName: context?.recipeName,
      cookingMethod: context?.cookingMethod,
      userIngredients: context?.userIngredients,
      dietaryRestrictions: context?.dietaryRestrictions,
    };

    // Get substitutions
    const result = await getSubstitutions(ingredient, substitutionContext);

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error('Error getting ingredient substitutions:', error);
    return {
      success: false,
      error: toErrorMessage(error),
    };
  }
}

/**
 * Get substitutions for multiple ingredients at once
 *
 * @param ingredients - Array of ingredient names
 * @param context - Optional context
 * @returns Array of SubstitutionResults
 *
 * @example
 * ```ts
 * const result = await getMultipleIngredientSubstitutions(
 *   ['butter', 'eggs', 'milk'],
 *   { recipeName: 'Pancakes' }
 * );
 *
 * if (result.success) {
 *   result.data.forEach(sub => {
 *     console.log(`${sub.ingredient}: ${sub.substitutions.length} options`);
 *   });
 * }
 * ```
 */
export async function getMultipleIngredientSubstitutions(
  ingredients: string[],
  context?: {
    recipeName?: string;
    cookingMethod?: string;
    userIngredients?: string[];
    dietaryRestrictions?: string[];
  }
): Promise<ActionResult<SubstitutionResult[]>> {
  try {
    // Validate input
    if (!ingredients || ingredients.length === 0) {
      return {
        success: false,
        error: 'At least one ingredient is required',
      };
    }

    // Filter out empty strings
    const validIngredients = ingredients.filter((i) => i && i.trim() !== '');
    if (validIngredients.length === 0) {
      return {
        success: false,
        error: 'No valid ingredients provided',
      };
    }

    // Build context
    const substitutionContext: SubstitutionContext = {
      recipeName: context?.recipeName,
      cookingMethod: context?.cookingMethod,
      userIngredients: context?.userIngredients,
      dietaryRestrictions: context?.dietaryRestrictions,
    };

    // #17: no auth check here and signed-out pages call it, so a call that
    // reaches the paid AI path counts against the caller's rate limit.
    // Static-table and cache hits stay free.
    if (validIngredients.some(needsAiSubstitution)) {
      const { userId } = await auth();
      const verdict = await enforceRateLimit('substitutions', userId ?? null);
      if (!verdict.allowed) {
        return verdict.reason === 'unavailable'
          ? {
              success: false,
              error: 'Substitutions are temporarily unavailable',
              errorCode: 'LIMITER_UNAVAILABLE',
            }
          : {
              success: false,
              error: 'Too many substitution requests; try again shortly',
              errorCode: 'RATE_LIMITED',
              retryAfterSec: verdict.retryAfterSec,
            };
      }
    }

    // Get substitutions
    const results = await getBatchSubstitutions(validIngredients, substitutionContext);

    return {
      success: true,
      data: results,
    };
  } catch (error) {
    console.error('Error getting multiple ingredient substitutions:', error);
    return {
      success: false,
      error: toErrorMessage(error),
    };
  }
}
