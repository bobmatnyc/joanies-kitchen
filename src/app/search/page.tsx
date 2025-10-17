'use client';

import { Info, Loader2, Search, Sparkles, TrendingUp } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import {
  hybridSearchRecipes,
  type RecipeWithSimilarity,
  semanticSearchRecipes,
} from '@/app/actions/semantic-search';
import { RecipeFilters } from '@/components/recipe/RecipeFilters';
import { type SearchMode, SearchModeComparison } from '@/components/search/SearchModeTooltip';
import { SearchResults } from '@/components/search/SearchResults';
import { SemanticSearchBar } from '@/components/search/SemanticSearchBar';
import { Badge } from '@/components/ui/badge';

/**
 * Main search page with semantic, text, and hybrid search capabilities
 *
 * URL Parameters:
 * - q: Search query string
 * - mode: Search mode (semantic | text | hybrid)
 * - cuisine: Filter by cuisine
 * - difficulty: Filter by difficulty
 * - minRating: Minimum rating filter
 *
 * @example
 * /search?q=spicy+pasta&mode=hybrid&cuisine=Italian
 */
function SearchPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Parse URL parameters
  const query = searchParams.get('q') || '';
  const mode = (searchParams.get('mode') as SearchMode) || 'hybrid';
  const cuisine = searchParams.get('cuisine') || undefined;
  const difficulty = searchParams.get('difficulty') as 'easy' | 'medium' | 'hard' | undefined;
  const _minRating = searchParams.get('minRating') || undefined;

  // State
  const [results, setResults] = useState<RecipeWithSimilarity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [hasSearched, setHasSearched] = useState(false);

  const performSearch = useCallback(
    async (searchQuery: string, searchMode: SearchMode) => {
      setLoading(true);
      setError(undefined);
      setHasSearched(true);

      try {
        const searchOptions = {
          limit: 50,
          minSimilarity: 0.3,
          cuisine,
          difficulty,
          includePrivate: true,
          rankingMode: 'balanced' as const,
          includeScoreBreakdown: true,
        };

        let result;
        if (searchMode === 'semantic') {
          result = await semanticSearchRecipes(searchQuery, searchOptions);
        } else if (searchMode === 'hybrid') {
          result = await hybridSearchRecipes(searchQuery, searchOptions);
        } else {
          // For text mode, use hybrid with higher text weight
          result = await hybridSearchRecipes(searchQuery, {
            ...searchOptions,
            rankingMode: 'balanced',
          });
        }

        if (result.success) {
          setResults(result.recipes);
        } else {
          setError(result.error || 'Search failed. Please try again.');
          setResults([]);
        }
      } catch (err: any) {
        console.error('Search error:', err);
        setError(err.message || 'An unexpected error occurred');
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [cuisine, difficulty]
  );

  // Perform search when URL params change
  useEffect(() => {
    if (query.trim()) {
      performSearch(query, mode);
    } else {
      setHasSearched(false);
      setResults([]);
    }
  }, [query, mode, performSearch]);

  const handleSearch = (searchQuery: string, searchMode: SearchMode) => {
    const params = new URLSearchParams(searchParams);
    params.set('q', searchQuery);
    params.set('mode', searchMode);
    router.push(`/search?${params.toString()}`);
  };

  const handleRefineSearch = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-8 w-8 text-jk-tomato" />
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-jk-olive font-heading">
            Recipe Search
          </h1>
        </div>
        <p className="text-jk-charcoal/70 text-base md:text-lg font-ui">
          Find the perfect recipe using AI-powered semantic search, traditional keyword search, or a
          hybrid approach
        </p>
      </div>

      {/* Search bar */}
      <div className="mb-8">
        <SemanticSearchBar
          defaultQuery={query}
          defaultMode={mode}
          onSearch={handleSearch}
          autoFocus={!query}
          showExamples={!hasSearched}
        />
      </div>

      {/* Results or initial state */}
      {hasSearched ? (
        <div className="space-y-6">
          {/* Filters */}
          <div className="bg-jk-sage/5 rounded-lg p-4 border border-jk-sage">
            <RecipeFilters
              showSearch={false}
              showSystemRecipeFilter={false}
              showTop50Toggle={false}
            />
          </div>

          {/* Results */}
          <SearchResults
            recipes={results}
            query={query}
            loading={loading}
            error={error}
            showSimilarity={true}
            defaultSort="relevance"
            onRefineSearch={handleRefineSearch}
          />
        </div>
      ) : (
        <div className="space-y-12">
          {/* How it works */}
          <section className="bg-jk-sage/5 rounded-lg p-8 border border-jk-sage">
            <div className="flex items-center gap-2 mb-4">
              <Info className="h-5 w-5 text-jk-clay" />
              <h2 className="text-xl font-semibold text-jk-olive font-heading">How It Works</h2>
            </div>
            <SearchModeComparison />
          </section>

          {/* Example searches */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Search className="h-5 w-5 text-jk-clay" />
              <h2 className="text-xl font-semibold text-jk-olive font-heading">Popular Searches</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                {
                  query: 'Comfort food for cold weather',
                  mode: 'semantic' as SearchMode,
                  tag: 'Cozy',
                },
                { query: 'Quick easy pasta', mode: 'hybrid' as SearchMode, tag: 'Fast' },
                {
                  query: 'Healthy breakfast ideas',
                  mode: 'semantic' as SearchMode,
                  tag: 'Morning',
                },
                { query: 'Spicy Asian stir-fry', mode: 'hybrid' as SearchMode, tag: 'Bold' },
                { query: 'Light summer salad', mode: 'semantic' as SearchMode, tag: 'Fresh' },
                { query: 'Decadent chocolate dessert', mode: 'hybrid' as SearchMode, tag: 'Sweet' },
              ].map((example, index) => (
                <button
                  key={index}
                  onClick={() => handleSearch(example.query, example.mode)}
                  className="group p-4 text-left border-2 border-jk-sage rounded-lg hover:border-jk-clay hover:bg-jk-sage/10 transition-all"
                >
                  <div className="flex items-start justify-between mb-2">
                    <Badge
                      variant="secondary"
                      className="bg-jk-sage/20 text-jk-olive border-jk-sage text-xs"
                    >
                      {example.tag}
                    </Badge>
                    <Badge variant="outline" className="text-xs border-jk-clay/30 text-jk-clay/70">
                      {example.mode}
                    </Badge>
                  </div>
                  <p className="font-medium text-jk-olive group-hover:text-jk-clay transition-colors font-ui">
                    {example.query}
                  </p>
                </button>
              ))}
            </div>
          </section>

          {/* Features */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-jk-clay" />
              <h2 className="text-xl font-semibold text-jk-olive font-heading">Search Features</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 border border-jk-sage rounded-lg space-y-3">
                <div className="w-12 h-12 bg-jk-sage/20 rounded-lg flex items-center justify-center">
                  <Sparkles className="h-6 w-6 text-jk-tomato" />
                </div>
                <h3 className="font-semibold text-jk-olive font-heading">AI Understanding</h3>
                <p className="text-sm text-jk-charcoal/70 font-ui">
                  Our semantic search understands intent, context, and mood. Search naturally like
                  you're talking to a friend.
                </p>
              </div>
              <div className="p-6 border border-jk-sage rounded-lg space-y-3">
                <div className="w-12 h-12 bg-jk-sage/20 rounded-lg flex items-center justify-center">
                  <Search className="h-6 w-6 text-jk-tomato" />
                </div>
                <h3 className="font-semibold text-jk-olive font-heading">Smart Ranking</h3>
                <p className="text-sm text-jk-charcoal/70 font-ui">
                  Results are ranked by relevance, quality, popularity, and recency to surface the
                  best matches first.
                </p>
              </div>
              <div className="p-6 border border-jk-sage rounded-lg space-y-3">
                <div className="w-12 h-12 bg-jk-sage/20 rounded-lg flex items-center justify-center">
                  <Info className="h-6 w-6 text-jk-tomato" />
                </div>
                <h3 className="font-semibold text-jk-olive font-heading">Transparent Scoring</h3>
                <p className="text-sm text-jk-charcoal/70 font-ui">
                  See why each recipe matched your search with detailed similarity scores and
                  component breakdowns.
                </p>
              </div>
            </div>
          </section>

          {/* Tips */}
          <section className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="font-semibold text-blue-900 mb-3 font-heading">💡 Search Tips</h3>
            <ul className="space-y-2 text-sm text-blue-800 font-ui">
              <li>
                <strong>For semantic search:</strong> Describe what you want naturally - "comfort
                food for a rainy day" or "healthy protein-rich dinner"
              </li>
              <li>
                <strong>For text search:</strong> Use specific keywords like recipe names or
                ingredients - "chocolate chip cookies" or "basil pesto"
              </li>
              <li>
                <strong>For hybrid search:</strong> Combine both approaches - "easy Italian pasta
                with vegetables" gets you the best of both worlds
              </li>
              <li>
                <strong>Use filters:</strong> Narrow down results by cuisine, difficulty, or rating
                for more targeted matches
              </li>
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-jk-clay" />
        </div>
      }
    >
      <SearchPageContent />
    </Suspense>
  );
}
