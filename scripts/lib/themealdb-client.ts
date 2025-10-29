/**
 * TheMealDB API Client
 *
 * TypeScript client for TheMealDB API (https://themealdb.com)
 *
 * API Documentation: https://www.themealdb.com/api.php
 * Free Test API: Use key "1" for development
 * Premium API: $2/month on Patreon for production use
 *
 * Rate Limiting: Self-imposed 1 second between requests (respectful crawling)
 */

/**
 * Category response from TheMealDB
 */
export interface TheMealDBCategory {
  idCategory: string;
  strCategory: string;
  strCategoryThumb: string;
  strCategoryDescription: string;
}

/**
 * Recipe summary from category listing
 */
export interface TheMealDBRecipeSummary {
  strMeal: string;
  strMealThumb: string;
  idMeal: string;
}

/**
 * Full recipe details from TheMealDB
 */
export interface TheMealDBRecipe {
  idMeal: string;
  strMeal: string;
  strCategory: string;
  strArea: string;
  strInstructions: string;
  strMealThumb: string;
  strYoutube?: string;
  strTags?: string;
  strSource?: string;
  strIngredient1?: string | null;
  strIngredient2?: string | null;
  strIngredient3?: string | null;
  strIngredient4?: string | null;
  strIngredient5?: string | null;
  strIngredient6?: string | null;
  strIngredient7?: string | null;
  strIngredient8?: string | null;
  strIngredient9?: string | null;
  strIngredient10?: string | null;
  strIngredient11?: string | null;
  strIngredient12?: string | null;
  strIngredient13?: string | null;
  strIngredient14?: string | null;
  strIngredient15?: string | null;
  strIngredient16?: string | null;
  strIngredient17?: string | null;
  strIngredient18?: string | null;
  strIngredient19?: string | null;
  strIngredient20?: string | null;
  strMeasure1?: string | null;
  strMeasure2?: string | null;
  strMeasure3?: string | null;
  strMeasure4?: string | null;
  strMeasure5?: string | null;
  strMeasure6?: string | null;
  strMeasure7?: string | null;
  strMeasure8?: string | null;
  strMeasure9?: string | null;
  strMeasure10?: string | null;
  strMeasure11?: string | null;
  strMeasure12?: string | null;
  strMeasure13?: string | null;
  strMeasure14?: string | null;
  strMeasure15?: string | null;
  strMeasure16?: string | null;
  strMeasure17?: string | null;
  strMeasure18?: string | null;
  strMeasure19?: string | null;
  strMeasure20?: string | null;
}

/**
 * TheMealDB API response wrapper
 */
interface TheMealDBResponse<T> {
  meals: T[] | null;
  categories?: TheMealDBCategory[];
}

/**
 * TheMealDB API Client
 *
 * Handles all interactions with TheMealDB API including:
 * - Fetching categories
 * - Getting recipes by category
 * - Fetching full recipe details
 * - Rate limiting (1 second between requests)
 */
export class TheMealDBClient {
  private baseUrl = 'https://www.themealdb.com/api/json/v1';
  private apiKey: string;
  private lastRequestTime = 0;
  private rateLimitMs = 1000; // 1 second between requests

  /**
   * Create a new TheMealDB API client
   *
   * @param apiKey - API key (use "1" for free test key, or Patreon key for production)
   */
  constructor(apiKey: string = '1') {
    this.apiKey = apiKey;
  }

  /**
   * Rate limiting: Wait 1 second between requests
   */
  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Enforce rate limiting before making request
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.rateLimitMs) {
      const waitTime = this.rateLimitMs - timeSinceLastRequest;
      await this.delay(waitTime);
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Make API request with error handling, timeout, and retry logic
   */
  private async makeRequest<T>(endpoint: string, retries = 3): Promise<T> {
    await this.enforceRateLimit();

    const url = `${this.baseUrl}/${this.apiKey}/${endpoint}`;
    const timeoutMs = 30000; // 30 second timeout

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const response = await fetch(url, {
            signal: controller.signal,
            headers: {
              'User-Agent': 'recipe-manager/1.0',
              Accept: 'application/json',
            },
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const data = await response.json();
          return data;
        } catch (fetchError) {
          clearTimeout(timeoutId);
          throw fetchError;
        }
      } catch (error) {
        const isLastAttempt = attempt === retries;
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Check if error is due to abort (timeout)
        const isTimeout = error instanceof Error && error.name === 'AbortError';
        const isNetworkError =
          errorMessage.includes('fetch failed') ||
          errorMessage.includes('ECONNREFUSED') ||
          errorMessage.includes('ENOTFOUND') ||
          errorMessage.includes('ETIMEDOUT');

        if (isLastAttempt) {
          if (isTimeout) {
            throw new Error(
              `TheMealDB API request timed out after ${timeoutMs / 1000}s (${endpoint})`
            );
          }
          if (isNetworkError) {
            throw new Error(
              `TheMealDB API network error (${endpoint}): ${errorMessage}. Please check your internet connection.`
            );
          }
          throw new Error(`TheMealDB API request failed (${endpoint}): ${errorMessage}`);
        }

        // Wait before retrying (exponential backoff)
        const backoffMs = 1000 * 2 ** (attempt - 1); // 1s, 2s, 4s
        console.log(
          `  ⚠️  Attempt ${attempt}/${retries} failed: ${errorMessage}. Retrying in ${backoffMs / 1000}s...`
        );
        await this.delay(backoffMs);
      }
    }

    // Should never reach here, but TypeScript needs it
    throw new Error(`TheMealDB API request failed after ${retries} attempts (${endpoint})`);
  }

  /**
   * Get all available categories
   *
   * @returns Array of categories with descriptions
   *
   * @example
   * const categories = await client.getCategories();
   * // Returns: [{ idCategory: "1", strCategory: "Beef", ... }, ...]
   */
  async getCategories(): Promise<TheMealDBCategory[]> {
    const response = await this.makeRequest<{ categories: TheMealDBCategory[] }>('categories.php');

    return response.categories || [];
  }

  /**
   * Get all recipes in a specific category
   *
   * @param category - Category name (e.g., "Beef", "Chicken", "Dessert")
   * @returns Array of recipe summaries
   *
   * @example
   * const recipes = await client.getRecipesByCategory("Chicken");
   * // Returns: [{ strMeal: "Chicken Curry", idMeal: "52795", ... }, ...]
   */
  async getRecipesByCategory(category: string): Promise<TheMealDBRecipeSummary[]> {
    const response = await this.makeRequest<TheMealDBResponse<TheMealDBRecipeSummary>>(
      `filter.php?c=${encodeURIComponent(category)}`
    );

    return response.meals || [];
  }

  /**
   * Get full recipe details by ID
   *
   * @param id - Recipe ID (e.g., "52795")
   * @returns Full recipe with ingredients, instructions, etc.
   *
   * @example
   * const recipe = await client.getRecipeById("52795");
   * // Returns: { idMeal: "52795", strMeal: "...", strIngredient1: "...", ... }
   */
  async getRecipeById(id: string): Promise<TheMealDBRecipe | null> {
    const response = await this.makeRequest<TheMealDBResponse<TheMealDBRecipe>>(
      `lookup.php?i=${encodeURIComponent(id)}`
    );

    if (!response.meals || response.meals.length === 0) {
      return null;
    }

    return response.meals[0];
  }

  /**
   * Get random recipe (useful for testing)
   *
   * @returns Random recipe
   */
  async getRandomRecipe(): Promise<TheMealDBRecipe | null> {
    const response = await this.makeRequest<TheMealDBResponse<TheMealDBRecipe>>('random.php');

    if (!response.meals || response.meals.length === 0) {
      return null;
    }

    return response.meals[0];
  }

  /**
   * Get total recipe count estimate
   *
   * This fetches all categories and counts recipes in each.
   * Note: This makes multiple API calls (one per category).
   *
   * @returns Estimated total recipe count
   */
  async getTotalRecipeCount(): Promise<number> {
    const categories = await this.getCategories();
    let totalCount = 0;

    for (const category of categories) {
      const recipes = await this.getRecipesByCategory(category.strCategory);
      totalCount += recipes.length;
    }

    return totalCount;
  }

  /**
   * Get all recipe IDs grouped by category
   *
   * This is useful for batch processing.
   *
   * @returns Map of category name to recipe IDs
   */
  async getAllRecipeIds(): Promise<Map<string, string[]>> {
    const categories = await this.getCategories();
    const recipeIdsByCategory = new Map<string, string[]>();

    for (const category of categories) {
      const recipes = await this.getRecipesByCategory(category.strCategory);
      const recipeIds = recipes.map((r) => r.idMeal);
      recipeIdsByCategory.set(category.strCategory, recipeIds);
    }

    return recipeIdsByCategory;
  }
}
