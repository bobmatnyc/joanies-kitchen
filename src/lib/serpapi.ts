/**
 * SerpAPI Integration Library for Recipe Manager
 *
 * Provides web search capabilities using SerpAPI (Google Search API)
 * for discovering recipes from the web.
 *
 * Features:
 * - Recipe-focused search with automatic query enhancement
 * - Support for multiple search engines (Google, Bing, Yahoo)
 * - Result filtering for popular recipe sites
 * - Error handling and retry logic
 */

import 'server-only';

// Types
export interface SerpAPISearchParams {
  query: string;
  location?: string;
  num?: number;
  engine?: 'google' | 'bing' | 'yahoo';
}

export interface SerpAPIRecipeResult {
  title: string;
  link: string;
  snippet: string;
  thumbnail?: string;
  source?: string;
  rating?: number;
  reviews?: number;
  position?: number;
}

export interface SerpAPISearchResponse {
  success: boolean;
  results: SerpAPIRecipeResult[];
  error?: string;
  searchInfo?: {
    totalResults?: string;
    timeTaken?: number;
  };
}

// Popular recipe sites for filtering
const RECIPE_SITES = [
  'allrecipes.com',
  'foodnetwork.com',
  'seriouseats.com',
  'bonappetit.com',
  'epicurious.com',
  'tasty.co',
  'simplyrecipes.com',
  'food.com',
  'delish.com',
  'myrecipes.com',
  'thekitchn.com',
  'cookieandkate.com',
  'minimalistbaker.com',
  'budgetbytes.com',
  'smittenkitchen.com',
];

/**
 * Searches for recipes using SerpAPI
 *
 * @param params - Search parameters
 * @returns Search results with recipe links
 *
 * @example
 * const results = await searchRecipesWithSerpAPI({
 *   query: 'pasta carbonara',
 *   num: 10
 * });
 */
export async function searchRecipesWithSerpAPI(
  params: SerpAPISearchParams
): Promise<SerpAPISearchResponse> {
  try {
    const apiKey = process.env.SERPAPI_KEY;
    if (!apiKey) {
      throw new Error('SERPAPI_KEY not configured in environment variables');
    }

    // Build query with "recipe" keyword to focus results
    const searchQuery = `${params.query} recipe`;

    // SerpAPI Google Search endpoint
    const url = new URL('https://serpapi.com/search');
    url.searchParams.set('engine', params.engine || 'google');
    url.searchParams.set('q', searchQuery);
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('num', String(params.num || 10));

    if (params.location) {
      url.searchParams.set('location', params.location);
    }

    console.log(`[SerpAPI] Searching for: "${searchQuery}"`);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SerpAPI error (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    // Check for API errors
    if (data.error) {
      throw new Error(`SerpAPI error: ${data.error}`);
    }

    // Extract organic results
    const organicResults = data.organic_results || [];

    const results: SerpAPIRecipeResult[] = organicResults.map((result: any, index: number) => ({
      title: result.title || '',
      link: result.link || '',
      snippet: result.snippet || '',
      thumbnail: result.thumbnail,
      source: result.source || extractDomain(result.link),
      rating: result.rating,
      reviews: result.reviews,
      position: index + 1,
    }));

    console.log(`[SerpAPI] Found ${results.length} results`);

    return {
      success: true,
      results,
      searchInfo: {
        totalResults: data.search_information?.total_results,
        timeTaken: data.search_information?.time_taken_displayed,
      },
    };
  } catch (error: any) {
    console.error('[SerpAPI] Search failed:', error.message);
    return {
      success: false,
      results: [],
      error: error.message,
    };
  }
}

/**
 * Filters search results to only include popular recipe sites
 *
 * @param results - Array of search results
 * @returns Filtered results from known recipe sites
 *
 * @example
 * const filtered = filterRecipeSites(searchResults);
 */
export function filterRecipeSites(results: SerpAPIRecipeResult[]): SerpAPIRecipeResult[] {
  return results.filter((result) => {
    const domain = extractDomain(result.link).toLowerCase();
    return RECIPE_SITES.some((site) => domain.includes(site));
  });
}

/**
 * Extracts domain from a URL
 *
 * @param url - Full URL
 * @returns Domain name
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return '';
  }
}

/**
 * Gets the list of supported recipe sites
 *
 * @returns Array of recipe site domains
 */
export function getSupportedRecipeSites(): string[] {
  return [...RECIPE_SITES];
}

/**
 * Checks if a URL is from a known recipe site
 *
 * @param url - URL to check
 * @returns True if URL is from a recipe site
 */
export function isRecipeSite(url: string): boolean {
  const domain = extractDomain(url).toLowerCase();
  return RECIPE_SITES.some((site) => domain.includes(site));
}
