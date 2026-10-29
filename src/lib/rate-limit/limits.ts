/** #17: every rate limit in one place. Fixed windows, counted per IP (anonymous) or per user. */

export interface RateLimitRule {
  /** Calls allowed per window. */
  limit: number;
  windowSec: number;
}

export const RATE_LIMITS = {
  /** `semanticSearchRecipes`, `hybridSearchRecipes`, `/api/search/semantic`. */
  'semantic-search': { limit: 30, windowSec: 60 },
  /** `findSimilarToRecipe` (similar-recipes widget on every recipe page). */
  'similar-recipes': { limit: 60, windowSec: 60 },
  /** `getMultipleIngredientSubstitutions`, counted only when a call reaches the AI path. */
  substitutions: { limit: 20, windowSec: 60 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitBucket = keyof typeof RATE_LIMITS;

/** Shared key for callers whose IP cannot be read; they share one budget (fail closed). */
export const UNKNOWN_IP_KEY = 'ip:unknown';
