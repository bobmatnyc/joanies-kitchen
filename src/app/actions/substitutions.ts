'use server';

/**
 * Server Actions for Ingredient Substitutions
 *
 * Provides server-side substitution lookup with error handling
 */

import { isPaidCallBlocked, type PaidCallBlockedCode } from '@/lib/costs';
import { enforceRateLimit } from '@/lib/rate-limit';
import { getSessionUserId } from '@/lib/session-user';
import {
  getBatchSubstitutions,
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
  errorCode?: 'RATE_LIMITED' | 'LIMITER_UNAVAILABLE' | 'AI_FAILED' | PaidCallBlockedCode; // #57: cost codes
  retryAfterSec?: number;
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
      const userId = await getSessionUserId();
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

    // #95: every ingredient failed in the AI call -> a failure, not an empty success.
    // A partial failure stays success:true; failed items carry `failed: true`.
    if (results.length > 0 && results.every((r) => r.failed)) {
      return {
        success: false,
        error: 'Substitutions could not be generated right now. Please try again.',
        errorCode: 'AI_FAILED',
      };
    }

    return {
      success: true,
      data: results,
    };
  } catch (error) {
    console.error('Error getting multiple ingredient substitutions:', error);
    // #57: the daily cost ceiling returns its typed code.
    if (isPaidCallBlocked(error)) {
      return { success: false, error: error.message, errorCode: error.code };
    }
    return {
      success: false,
      error: toErrorMessage(error),
    };
  }
}
