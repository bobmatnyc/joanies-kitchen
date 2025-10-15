/**
 * Brave Search API Client
 *
 * This module provides a type-safe client for interacting with the Brave Search API
 * through the Recipe Manager's API route.
 *
 * @example
 * ```typescript
 * import { searchRecipes } from '@/lib/brave-search';
 *
 * const results = await searchRecipes('chocolate chip cookies', 10);
 * console.log(results);
 * ```
 */

// ============================================================================
// Type Definitions
// ============================================================================

export interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
  age?: string;
  language?: string;
}

export interface BraveSearchResponse {
  type?: string;
  query?: {
    original: string;
    show_strict_warning: boolean;
    altered?: string;
  };
  web?: {
    results: BraveSearchResult[];
  };
  videos?: unknown;
  news?: unknown;
  discussions?: unknown;
}

export interface BraveSearchError {
  error: string;
  details?: string;
}

export interface BraveSearchOptions {
  query: string;
  count?: number;
}

// ============================================================================
// Error Classes
// ============================================================================

export class BraveSearchAPIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public details?: string
  ) {
    super(message);
    this.name = 'BraveSearchAPIError';
  }
}

export class BraveSearchAuthError extends BraveSearchAPIError {
  constructor(details?: string) {
    super('Authentication required', 401, details);
    this.name = 'BraveSearchAuthError';
  }
}

export class BraveSearchValidationError extends BraveSearchAPIError {
  constructor(details?: string) {
    super('Invalid search parameters', 400, details);
    this.name = 'BraveSearchValidationError';
  }
}

export class BraveSearchRateLimitError extends BraveSearchAPIError {
  constructor(details?: string) {
    super('Rate limit exceeded', 429, details);
    this.name = 'BraveSearchRateLimitError';
  }
}

export class BraveSearchServiceError extends BraveSearchAPIError {
  constructor(details?: string) {
    super('Search service unavailable', 503, details);
    this.name = 'BraveSearchServiceError';
  }
}

// ============================================================================
// API Client Functions
// ============================================================================

/**
 * Search using the Brave Search API
 *
 * @param options - Search options including query and optional count
 * @returns Promise with search results
 * @throws {BraveSearchAuthError} If user is not authenticated
 * @throws {BraveSearchValidationError} If search parameters are invalid
 * @throws {BraveSearchRateLimitError} If rate limit is exceeded
 * @throws {BraveSearchServiceError} If the service is unavailable
 * @throws {BraveSearchAPIError} For other API errors
 *
 * @example
 * ```typescript
 * try {
 *   const response = await braveSearch({ query: 'recipe', count: 10 });
 *   console.log(response.web?.results);
 * } catch (error) {
 *   if (error instanceof BraveSearchRateLimitError) {
 *     console.error('Rate limit exceeded');
 *   }
 * }
 * ```
 */
export async function braveSearch(
  options: BraveSearchOptions
): Promise<BraveSearchResponse> {
  const { query, count = 10 } = options;

  // Client-side validation
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    throw new BraveSearchValidationError('Query must be a non-empty string');
  }

  if (typeof count !== 'number' || count < 1 || count > 100) {
    throw new BraveSearchValidationError('Count must be between 1 and 100');
  }

  try {
    const response = await fetch('/api/brave-search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, count }),
    });

    // Handle error responses
    if (!response.ok) {
      const errorData: BraveSearchError = await response.json();

      switch (response.status) {
        case 401:
          throw new BraveSearchAuthError(errorData.details);
        case 400:
          throw new BraveSearchValidationError(errorData.details);
        case 429:
          throw new BraveSearchRateLimitError(errorData.details);
        case 503:
          throw new BraveSearchServiceError(errorData.details);
        default:
          throw new BraveSearchAPIError(
            errorData.error || 'Search failed',
            response.status,
            errorData.details
          );
      }
    }

    // Parse and return success response
    const data: BraveSearchResponse = await response.json();
    return data;

  } catch (error) {
    // Re-throw our custom errors
    if (error instanceof BraveSearchAPIError) {
      throw error;
    }

    // Handle network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new BraveSearchAPIError(
        'Network error',
        0,
        'Failed to connect to search service'
      );
    }

    // Handle unknown errors
    throw new BraveSearchAPIError(
      'Unknown error',
      500,
      error instanceof Error ? error.message : 'An unknown error occurred'
    );
  }
}

/**
 * Convenience function to search for recipes and return just the results array
 *
 * @param query - Search query string
 * @param count - Number of results to return (default: 10)
 * @returns Promise with array of search results
 *
 * @example
 * ```typescript
 * const recipes = await searchRecipes('chocolate chip cookies', 5);
 * recipes.forEach(recipe => {
 *   console.log(recipe.title, recipe.url);
 * });
 * ```
 */
export async function searchRecipes(
  query: string,
  count: number = 10
): Promise<BraveSearchResult[]> {
  const response = await braveSearch({ query, count });
  return response.web?.results || [];
}

/**
 * Check if a search error is recoverable (user can retry)
 *
 * @param error - The error to check
 * @returns true if the error is potentially recoverable
 */
export function isRecoverableSearchError(error: unknown): boolean {
  if (!(error instanceof BraveSearchAPIError)) {
    return false;
  }

  // Rate limits are recoverable (retry after delay)
  if (error instanceof BraveSearchRateLimitError) {
    return true;
  }

  // Service errors are recoverable (temporary outage)
  if (error instanceof BraveSearchServiceError) {
    return true;
  }

  // Network errors are recoverable
  if (error.statusCode === 0) {
    return true;
  }

  // Auth and validation errors are not recoverable without changes
  return false;
}

/**
 * Get user-friendly error message for display
 *
 * @param error - The error to format
 * @returns User-friendly error message
 */
export function getSearchErrorMessage(error: unknown): string {
  if (error instanceof BraveSearchAuthError) {
    return 'Please sign in to search for recipes.';
  }

  if (error instanceof BraveSearchValidationError) {
    return error.details || 'Invalid search query. Please try again.';
  }

  if (error instanceof BraveSearchRateLimitError) {
    return 'Too many searches. Please wait a moment and try again.';
  }

  if (error instanceof BraveSearchServiceError) {
    return 'Search service is temporarily unavailable. Please try again later.';
  }

  if (error instanceof BraveSearchAPIError) {
    return error.details || error.message || 'Search failed. Please try again.';
  }

  return 'An unexpected error occurred. Please try again.';
}
