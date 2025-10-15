'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { RecipeCard } from './RecipeCard';
import { Loader2, AlertCircle } from 'lucide-react';
import { type Recipe } from '@/lib/db/schema';
import { type PaginationMetadata, type RecipeFilters } from '@/app/actions/recipes';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface RecipeInfiniteListProps {
  initialRecipes: Recipe[];
  initialPagination: PaginationMetadata;
  filters?: RecipeFilters;
  sort?: 'rating' | 'recent' | 'name';
  emptyMessage?: string;
}

export function RecipeInfiniteList({
  initialRecipes,
  initialPagination,
  filters = {},
  sort = 'rating',
  emptyMessage = 'No recipes found',
}: RecipeInfiniteListProps) {
  const [recipes, setRecipes] = useState<Recipe[]>(initialRecipes);
  const [pagination, setPagination] = useState(initialPagination);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Reset recipes when filters or sort change
  useEffect(() => {
    setRecipes(initialRecipes);
    setPagination(initialPagination);
    setError(null);
  }, [initialRecipes, initialPagination]);

  const loadMore = useCallback(async () => {
    if (loading || !pagination.hasMore || error) return;

    // Cancel any pending requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setLoading(true);
    setError(null);

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/recipes/paginated', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page: pagination.page + 1,
          limit: pagination.limit,
          filters,
          sort,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setRecipes((prev) => [...prev, ...data.recipes]);
      setPagination(data.pagination);
    } catch (err) {
      if (err instanceof Error) {
        // Ignore abort errors (user navigated away or filters changed)
        if (err.name === 'AbortError') {
          return;
        }
        console.error('Failed to load more recipes:', err);
        setError(err.message || 'Failed to load more recipes');
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, [loading, pagination, filters, sort, error]);

  // Set up intersection observer for infinite scroll
  useEffect(() => {
    if (!pagination.hasMore || loading || error) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        // Load more when the sentinel element is visible
        if (entries[0].isIntersecting && pagination.hasMore && !loading) {
          loadMore();
        }
      },
      {
        threshold: 0.1,
        rootMargin: '200px', // Start loading 200px before reaching the bottom
      }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [pagination.hasMore, loading, loadMore, error]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  if (recipes.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertCircle className="w-16 h-16 text-jk-clay/40 mb-4" />
        <h3 className="text-xl font-heading text-jk-olive mb-2">
          {emptyMessage}
        </h3>
        <p className="text-jk-charcoal/60 max-w-md">
          Try adjusting your filters or search criteria to find more recipes.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Recipe Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {recipes.map((recipe) => (
          <RecipeCard
            key={recipe.id}
            recipe={recipe}
            onDelete={() => {
              // Remove deleted recipe from list
              setRecipes((prev) => prev.filter((r) => r.id !== recipe.id));
              // Update pagination total count
              setPagination((prev) => ({
                ...prev,
                total: prev.total - 1,
                totalPages: Math.ceil((prev.total - 1) / prev.limit),
              }));
            }}
          />
        ))}
      </div>

      {/* Loading indicator / sentinel element */}
      {pagination.hasMore && (
        <div
          ref={loadMoreRef}
          className="flex justify-center py-8"
          aria-live="polite"
          aria-busy={loading}
        >
          {loading ? (
            <div className="flex items-center gap-2 text-jk-clay">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Loading more recipes...</span>
            </div>
          ) : (
            <div className="text-jk-clay/60">
              Scroll for more recipes...
            </div>
          )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
            <button
              onClick={() => {
                setError(null);
                loadMore();
              }}
              className="ml-2 underline"
            >
              Try again
            </button>
          </AlertDescription>
        </Alert>
      )}

      {/* End of results message */}
      {!pagination.hasMore && recipes.length > 0 && (
        <div className="text-center py-8">
          <div className="inline-block bg-jk-sage/20 rounded-full px-6 py-3">
            <p className="text-jk-olive font-ui">
              That's all! {pagination.total} recipe{pagination.total !== 1 ? 's' : ''} total
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
