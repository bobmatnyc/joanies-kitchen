/**
 * Example React Component: Recipe Search using Brave Search API
 *
 * This is a reference implementation showing how to integrate the Brave Search API
 * into a React component with proper error handling and loading states.
 *
 * Usage:
 * 1. Copy this component to your project
 * 2. Customize the UI and styling
 * 3. Integrate with your recipe management features
 */

'use client';

import { useState } from 'react';
import {
  searchRecipes,
  getSearchErrorMessage,
  isRecoverableSearchError,
  type BraveSearchResult,
} from '@/lib/brave-search';

export function ExampleBraveSearch() {
  const [query, setQuery] = useState('');
  const [count, setCount] = useState(10);
  const [results, setResults] = useState<BraveSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    // Reset state
    setError(null);
    setResults([]);

    // Validate input
    if (!query.trim()) {
      setError('Please enter a search query');
      return;
    }

    setLoading(true);

    try {
      // Call the search API
      const searchResults = await searchRecipes(query, count);
      setResults(searchResults);

      // Log success
      console.log(`Found ${searchResults.length} results for "${query}"`);
    } catch (err) {
      // Handle errors with user-friendly messages
      const errorMessage = getSearchErrorMessage(err);
      setError(errorMessage);

      // Log error for debugging
      console.error('Search error:', err);

      // Check if error is recoverable
      if (isRecoverableSearchError(err)) {
        console.log('Error is recoverable - user can retry');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Recipe Search</h1>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="mb-8">
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="query" className="block text-sm font-medium mb-2">
              Search Query
            </label>
            <input
              id="query"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g., chocolate chip cookies"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="count" className="block text-sm font-medium mb-2">
              Number of Results
            </label>
            <input
              id="count"
              type="number"
              min="1"
              max="100"
              value={count}
              onChange={(e) => setCount(parseInt(e.target.value, 10))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="bg-blue-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Searching...' : 'Search Recipes'}
          </button>
        </div>
      </form>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 font-medium">Error</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-600">Searching for recipes...</p>
        </div>
      )}

      {/* Search Results */}
      {!loading && results.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">
            Found {results.length} results for "{query}"
          </h2>
          <div className="space-y-4">
            {results.map((result, index) => (
              <div
                key={`${result.url}-${index}`}
                className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
              >
                <a
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 font-medium text-lg"
                >
                  {result.title}
                </a>
                <p className="text-gray-600 text-sm mt-2">{result.description}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                  <span>{new URL(result.url).hostname}</span>
                  {result.age && <span>Published: {result.age}</span>}
                  {result.language && <span>Language: {result.language}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Results */}
      {!loading && results.length === 0 && query && !error && (
        <div className="text-center py-12 text-gray-600">
          <p>No results found for "{query}"</p>
          <p className="text-sm mt-2">Try different search terms</p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Alternative: Server Component with Server Action
// ============================================================================

/**
 * Example Server Component with Server Action
 *
 * This approach uses Next.js Server Actions for better performance
 * and automatic form handling.
 */

/*
'use server';

import { auth } from '@/lib/auth';

export async function searchRecipesAction(formData: FormData) {
  const { userId } = await auth();

  if (!userId) {
    return { error: 'You must be signed in to search' };
  }

  const query = formData.get('query') as string;
  const count = parseInt(formData.get('count') as string, 10) || 10;

  try {
    const response = await fetch('https://api.search.brave.com/res/v1/web/search', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': process.env.BRAVE_SEARCH_API_KEY!,
      },
    });

    if (!response.ok) {
      return { error: 'Search failed' };
    }

    const data = await response.json();
    return { results: data.web?.results || [] };
  } catch (error) {
    return { error: 'An error occurred' };
  }
}
*/

// ============================================================================
// Usage in a Page Component
// ============================================================================

/**
 * Example usage in a Next.js page:
 *
 * // app/search/page.tsx
 * import { ExampleBraveSearch } from '@/components/example-brave-search';
 *
 * export default function SearchPage() {
 *   return (
 *     <div>
 *       <ExampleBraveSearch />
 *     </div>
 *   );
 * }
 */
