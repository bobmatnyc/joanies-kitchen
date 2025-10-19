/**
 * Tasty API Client (RapidAPI)
 *
 * Client for BuzzFeed's Tasty API via RapidAPI platform
 * API Documentation: https://rapidapi.com/apidojo/api/tasty
 *
 * Features:
 * - Recipe search and listing
 * - Recipe details fetching
 * - Rate limiting (respects free tier: 500 req/month)
 * - Error handling with retry logic
 * - Automatic delay between requests
 */

export interface TastyRecipe {
  id: number;
  name: string;
  description: string;
  thumbnail_url?: string;
  thumbnail_alt_text?: string;
  video_url?: string;
  original_video_url?: string;
  keywords?: string;
  num_servings?: number;
  prep_time_minutes?: number;
  cook_time_minutes?: number;
  total_time_minutes?: number;
  credits?: Array<{
    name?: string;
    type?: string;
  }>;
  sections?: Array<{
    components?: Array<{
      raw_text?: string;
      ingredient?: {
        name?: string;
        display_singular?: string;
      };
      measurements?: Array<{
        quantity?: string;
        unit?: {
          name?: string;
          display_singular?: string;
        };
      }>;
    }>;
  }>;
  instructions?: Array<{
    display_text?: string;
    position?: number;
    start_time?: number;
    end_time?: number;
  }>;
  nutrition?: {
    calories?: number;
    fat?: number;
    carbohydrates?: number;
    protein?: number;
    fiber?: number;
    sugar?: number;
  };
  tags?: Array<{
    name?: string;
    display_name?: string;
    type?: string;
  }>;
  topics?: Array<{
    name?: string;
    slug?: string;
  }>;
  yields?: string;
  user_ratings?: {
    count_positive?: number;
    count_negative?: number;
    score?: number;
  };
}

export interface TastySearchResponse {
  count: number;
  results: TastyRecipe[];
}

export class TastyClient {
  private apiKey: string;
  private apiHost: string;
  private baseUrl: string;
  private requestDelay: number;
  private lastRequestTime: number;

  constructor(apiKey: string, apiHost = 'tasty.p.rapidapi.com', requestDelay = 1000) {
    this.apiKey = apiKey;
    this.apiHost = apiHost;
    this.baseUrl = `https://${apiHost}`;
    this.requestDelay = requestDelay; // Default: 1 second between requests
    this.lastRequestTime = 0;
  }

  /**
   * Enforce rate limiting by waiting between requests
   */
  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.requestDelay) {
      const waitTime = this.requestDelay - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Make API request with error handling and retry logic
   */
  private async makeRequest<T>(
    endpoint: string,
    params: Record<string, string> = {},
    retries = 3
  ): Promise<T> {
    await this.waitForRateLimit();

    const url = new URL(`${this.baseUrl}${endpoint}`);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    const headers = {
      'X-RapidAPI-Key': this.apiKey,
      'X-RapidAPI-Host': this.apiHost,
    };

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url.toString(), {
          method: 'GET',
          headers,
        });

        // Check for rate limiting
        if (response.status === 429) {
          console.warn(`⏳ Rate limit hit, waiting 60 seconds... (attempt ${attempt}/${retries})`);
          await new Promise((resolve) => setTimeout(resolve, 60000));
          continue;
        }

        // Check for other errors
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `API request failed: ${response.status} ${response.statusText} - ${errorText}`
          );
        }

        const data = await response.json();
        return data as T;
      } catch (error) {
        if (attempt === retries) {
          throw error;
        }

        console.warn(`⚠️  Request failed (attempt ${attempt}/${retries}), retrying...`);
        await new Promise((resolve) => setTimeout(resolve, 2000 * attempt)); // Exponential backoff
      }
    }

    throw new Error('Max retries exceeded');
  }

  /**
   * Search/list recipes with pagination
   *
   * @param from - Starting index (default: 0)
   * @param size - Number of results to return (default: 20, max: 40)
   * @param tags - Optional tag filter (e.g., "under_30_minutes")
   * @param query - Optional search query
   */
  async searchRecipes(
    from = 0,
    size = 20,
    tags?: string,
    query?: string
  ): Promise<TastySearchResponse> {
    const params: Record<string, string> = {
      from: from.toString(),
      size: size.toString(),
    };

    if (tags) {
      params.tags = tags;
    }

    if (query) {
      params.q = query;
    }

    return this.makeRequest<TastySearchResponse>('/recipes/list', params);
  }

  /**
   * Get full recipe details by ID
   *
   * @param id - Recipe ID
   */
  async getRecipeById(id: number): Promise<TastyRecipe | null> {
    try {
      const response = await this.makeRequest<{ id: number }>('/recipes/get-more-info', {
        id: id.toString(),
      });

      // The API returns the full recipe object directly
      return response as unknown as TastyRecipe;
    } catch (error) {
      console.error(`Failed to fetch recipe ${id}:`, error);
      return null;
    }
  }

  /**
   * Get list of available tags for filtering
   */
  async getTags(): Promise<Array<{ name: string; display_name: string }>> {
    try {
      const response = await this.makeRequest<{
        results: Array<{ name: string; display_name: string }>;
      }>('/tags/list');
      return response.results || [];
    } catch (error) {
      console.error('Failed to fetch tags:', error);
      return [];
    }
  }

  /**
   * Test API connectivity
   */
  async testConnection(): Promise<boolean> {
    try {
      // Try to fetch a single recipe
      const response = await this.searchRecipes(0, 1);
      return response.count > 0;
    } catch (error) {
      console.error('API connectivity test failed:', error);
      return false;
    }
  }
}
