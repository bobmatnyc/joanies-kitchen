/**
 * Tavily AI Search Integration Library for Recipe Manager
 *
 * Provides AI-powered web search capabilities using Tavily API
 * for discovering high-quality recipe URLs from the web.
 *
 * Features:
 * - AI-powered search with quality filtering
 * - Recipe-focused URL discovery
 * - Automatic filtering of social media and non-recipe pages
 * - Rate limiting to respect API constraints
 * - Relevance scoring for results
 */

import 'server-only';

// Type definitions for Tavily responses
export interface TavilySearchParams {
  query: string;
  searchDepth?: 'basic' | 'advanced';
  maxResults?: number;
  includeDomains?: string[];
  excludeDomains?: string[];
}

export interface TavilyRecipeResult {
  title: string;
  url: string;
  content: string;
  score: number;
  publishedDate?: string;
  source?: string;
}

export interface TavilySearchResponse {
  success: boolean;
  results: TavilyRecipeResult[];
  error?: string;
  searchInfo?: {
    query: string;
    totalResults: number;
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

// Domains to exclude (social media, video platforms, etc.)
const EXCLUDED_DOMAINS = [
  'youtube.com',
  'facebook.com',
  'instagram.com',
  'pinterest.com',
  'twitter.com',
  'tiktok.com',
  'reddit.com',
];

// Rate limiting state
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000; // 1 second between requests

/**
 * Initialize Tavily client with API key validation
 */
export function getTavilyClient() {
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    throw new Error('TAVILY_API_KEY environment variable is not set');
  }

  return { apiKey };
}

/**
 * Rate limiting helper - ensures minimum interval between requests
 */
async function enforceRateLimit() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    console.log(`[Tavily] Rate limiting: waiting ${waitTime}ms...`);
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }

  lastRequestTime = Date.now();
}

/**
 * Search for recipes using Tavily AI Search
 * Returns structured results with URL, title, and relevance score
 *
 * @param query - Search query (e.g., "pasta carbonara recipe")
 * @param options - Optional search parameters
 * @returns Search response with recipe results
 *
 * @example
 * const results = await searchRecipesWithTavily('pasta carbonara', {
 *   maxResults: 10,
 *   searchDepth: 'basic'
 * });
 */
export async function searchRecipesWithTavily(
  query: string,
  options?: Partial<TavilySearchParams>
): Promise<TavilySearchResponse> {
  try {
    const { apiKey } = getTavilyClient();

    // Enforce rate limiting
    await enforceRateLimit();

    // Build search query with "recipe" keyword if not already present
    const searchQuery = query.toLowerCase().includes('recipe') ? query : `${query} recipe`;

    console.log(`[Tavily] Starting search for: "${searchQuery}"`);

    // Build request payload
    const requestBody = {
      api_key: apiKey,
      query: searchQuery,
      search_depth: options?.searchDepth || 'basic',
      max_results: options?.maxResults || 10,
      include_domains: options?.includeDomains || RECIPE_SITES,
      exclude_domains: options?.excludeDomains || EXCLUDED_DOMAINS,
      include_answer: false,
      include_raw_content: false,
    };

    console.log(`[Tavily] Request config:`, {
      searchDepth: requestBody.search_depth,
      maxResults: requestBody.max_results,
      includeDomains: requestBody.include_domains?.length,
      excludeDomains: requestBody.exclude_domains?.length,
    });

    // Make API request
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Tavily] ERROR: HTTP ${response.status}`);
      console.error(`[Tavily] Error details:`, errorText);
      throw new Error(`Tavily API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    // Check for API-level errors
    if (data.error) {
      console.error(`[Tavily] API Error:`, data.error);
      throw new Error(`Tavily API error: ${data.error}`);
    }

    // Extract and transform results
    const results: TavilyRecipeResult[] = (data.results || []).map((result: any) => ({
      title: result.title || '',
      url: result.url || '',
      content: result.content || '',
      score: result.score || 0,
      publishedDate: result.published_date,
      source: extractDomain(result.url),
    }));

    console.log(`[Tavily] Success! Found ${results.length} results`);
    console.log(`[Tavily] Top result:`, results[0] ?
      `${results[0].title} (score: ${results[0].score.toFixed(2)})` : 'none');

    return {
      success: true,
      results,
      searchInfo: {
        query: searchQuery,
        totalResults: results.length,
      },
    };
  } catch (error: any) {
    console.error(`[Tavily] ERROR searching for "${query}"`);
    console.error(`[Tavily] Error message:`, error?.message);
    console.error(`[Tavily] Error type:`, error?.constructor?.name);

    return {
      success: false,
      results: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Filters search results to only include recipe-like URLs
 * Excludes social media, video platforms, and non-recipe pages
 *
 * @param results - Array of search results
 * @returns Filtered results containing only recipe URLs
 */
export function filterRecipeUrls(results: TavilyRecipeResult[]): TavilyRecipeResult[] {
  return results.filter((result) => {
    const domain = extractDomain(result.url).toLowerCase();

    // Exclude blocked domains
    const isExcluded = EXCLUDED_DOMAINS.some((excluded) => domain.includes(excluded));
    if (isExcluded) {
      return false;
    }

    // Check if from known recipe site
    const isRecipeSite = RECIPE_SITES.some((site) => domain.includes(site));

    // Or check if URL/title contains recipe-related keywords
    const hasRecipeKeywords =
      result.url.toLowerCase().includes('recipe') ||
      result.title.toLowerCase().includes('recipe') ||
      result.content.toLowerCase().includes('ingredients');

    return isRecipeSite || hasRecipeKeywords;
  });
}

/**
 * Extracts domain from a URL
 *
 * @param url - Full URL
 * @returns Domain name without www prefix
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
 * Gets the list of excluded domains
 *
 * @returns Array of excluded domains
 */
export function getExcludedDomains(): string[] {
  return [...EXCLUDED_DOMAINS];
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

/**
 * Check if Tavily API is configured and available
 */
export function isTavilyConfigured(): boolean {
  return !!process.env.TAVILY_API_KEY;
}
