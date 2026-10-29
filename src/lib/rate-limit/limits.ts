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
  /**
   * `generateBalancedMeal`: one call is an LLM completion plus four embedding
   * searches, so the budget is a quarter of `substitutions`; planning a meal needs few calls.
   */
  'meal-pairing': { limit: 5, windowSec: 60 },
  // Paid paths below use a UTC-day window (aligned with the $10/day cap), so each
  // limit bounds one caller's daily spend; the per-user sum stays well under the cap.
  /** `discoverRecipe`: one LLM completion with a caller-chosen model (~$0.03 each). */
  'recipe-generation': { limit: 30, windowSec: 86_400 },
  /** `uploadRecipeWithAI`, `previewRecipeParse`: one Sonnet/GPT-4o parse; preview + save is two calls. */
  'recipe-parse': { limit: 40, windowSec: 86_400 },
  /** `uploadRecipeFromUrl`, `parseRecipeFromUrl`, `discoverRecipeFromUrl`: scrape + one or two LLM calls. */
  'recipe-url-import': { limit: 30, windowSec: 86_400 },
  /** `searchWebRecipes`: one Perplexity Sonar completion with a per-request search fee. */
  'web-recipe-search': { limit: 30, windowSec: 86_400 },
  /** `discoverRecipes`: Brave + two LLM calls and an embedding per URL (up to 10 URLs). */
  'recipe-discovery': { limit: 5, windowSec: 86_400 },
  /** `getRecipeRecommendations`: one small-model completion. */
  'meal-recommendations': { limit: 50, windowSec: 86_400 },
  /** `POST /api/brave-search`: one Brave web query (~$0.005). */
  'brave-search': { limit: 100, windowSec: 86_400 },
  /** `POST /api/ingest-recipe`, per API key and counted per URL: Firecrawl + Sonnet parse + embedding. */
  'recipe-ingest-api': { limit: 100, windowSec: 86_400 },
  /** #58: `GET /api/account/export`, per user: one read of every user-owned table. */
  'account-export': { limit: 3, windowSec: 3_600 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitBucket = keyof typeof RATE_LIMITS;

/** Shared key for callers whose IP cannot be read; they share one budget (fail closed). */
export const UNKNOWN_IP_KEY = 'ip:unknown';
