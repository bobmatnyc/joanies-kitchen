'use client';

import { Calendar, Loader2, Search, Sparkles, Star, TrendingUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { RecipeWithSimilarity } from '@/app/actions/semantic-search';
import { RecipeCard } from '@/components/recipe/RecipeCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { RankedRecipe } from '@/lib/search/ranking';
import { cn } from '@/lib/utils';
import { SimilarityBadge } from './SimilarityBadge';

export type SortOption = 'relevance' | 'rating' | 'recent' | 'popular';

interface SearchResultsProps {
  recipes: RecipeWithSimilarity[] | RankedRecipe[];
  query: string;
  loading?: boolean;
  error?: string;
  showSimilarity?: boolean;
  defaultSort?: SortOption;
  className?: string;
  emptyMessage?: string;
  onRefineSearch?: () => void;
}

/**
 * Display search results with relevance scoring and sorting
 *
 * Features:
 * - Multiple sort options: Relevance, Rating, Recent, Popular
 * - Similarity badges for each result
 * - Empty state with refinement suggestions
 * - Loading and error states
 * - Responsive grid layout
 *
 * @example
 * <SearchResults
 *   recipes={results}
 *   query="spicy pasta"
 *   showSimilarity
 *   defaultSort="relevance"
 * />
 */
export function SearchResults({
  recipes,
  query,
  loading = false,
  error,
  showSimilarity = true,
  defaultSort = 'relevance',
  className,
  emptyMessage,
  onRefineSearch,
}: SearchResultsProps) {
  const [sortBy, setSortBy] = useState<SortOption>(defaultSort);
  const [_showFilters, _setShowFilters] = useState(false);

  // Check if recipes have ranking scores (RankedRecipe type)
  const hasRankingScores = recipes.length > 0 && 'rankingScore' in recipes[0];

  // Sort recipes based on selected option
  const sortedRecipes = useMemo(() => {
    const recipesCopy = [...recipes];

    switch (sortBy) {
      case 'relevance':
        // If we have ranking scores, use those; otherwise use similarity
        if (hasRankingScores) {
          return recipesCopy.sort((a, b) => {
            const aScore = (a as RankedRecipe).rankingScore || 0;
            const bScore = (b as RankedRecipe).rankingScore || 0;
            return bScore - aScore;
          });
        }
        return recipesCopy.sort((a, b) => b.similarity - a.similarity);

      case 'rating':
        return recipesCopy.sort((a, b) => {
          const aRating = parseFloat(a.system_rating || a.avg_user_rating || '0');
          const bRating = parseFloat(b.system_rating || b.avg_user_rating || '0');
          return bRating - aRating;
        });

      case 'recent':
        return recipesCopy.sort((a, b) => {
          const aDate = new Date(a.updated_at || a.created_at);
          const bDate = new Date(b.updated_at || b.created_at);
          return bDate.getTime() - aDate.getTime();
        });

      case 'popular':
        return recipesCopy.sort((a, b) => {
          const aCount = a.total_user_ratings || 0;
          const bCount = b.total_user_ratings || 0;
          return bCount - aCount;
        });

      default:
        return recipesCopy;
    }
  }, [recipes, sortBy, hasRankingScores]);

  // Loading state
  if (loading) {
    return (
      <div className={cn('flex items-center justify-center py-12', className)}>
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-jk-clay mx-auto" />
          <p className="text-sm text-jk-charcoal/60 font-ui">Searching for recipes...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={cn('rounded-lg border-2 border-red-200 bg-red-50 p-6', className)}>
        <div className="text-center space-y-2">
          <p className="text-sm font-semibold text-red-800 font-heading">Search Error</p>
          <p className="text-sm text-red-600 font-ui">{error}</p>
          {onRefineSearch && (
            <Button onClick={onRefineSearch} variant="outline" className="mt-4">
              Try Again
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Empty state
  if (sortedRecipes.length === 0) {
    return (
      <div
        className={cn(
          'rounded-lg border-2 border-dashed border-jk-sage bg-jk-sage/5 p-8',
          className
        )}
      >
        <div className="text-center space-y-4 max-w-md mx-auto">
          <Search className="h-12 w-12 text-jk-clay/40 mx-auto" />
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-jk-olive font-heading">No recipes found</h3>
            <p className="text-sm text-jk-charcoal/70 font-ui">
              {emptyMessage || `We couldn't find any recipes matching "${query}"`}
            </p>
          </div>

          <div className="space-y-2 pt-4">
            <p className="text-xs font-semibold text-jk-olive">Try:</p>
            <ul className="text-xs text-jk-charcoal/70 space-y-1">
              <li>• Using different keywords or phrases</li>
              <li>• Making your search more general</li>
              <li>• Trying a different search mode</li>
              <li>• Checking your spelling</li>
            </ul>
          </div>

          {onRefineSearch && (
            <Button onClick={onRefineSearch} variant="outline" className="mt-4">
              Refine Search
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Results header with sorting */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-jk-sage">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="border-jk-clay text-jk-clay font-ui">
            <Sparkles className="h-3 w-3 mr-1" />
            {sortedRecipes.length} {sortedRecipes.length === 1 ? 'recipe' : 'recipes'} found
          </Badge>
          {query && (
            <p className="text-sm text-jk-charcoal/70 font-ui hidden sm:block">
              for <span className="font-semibold text-jk-olive">"{query}"</span>
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="sort" className="text-sm text-jk-charcoal/70 font-ui">
            Sort by:
          </Label>
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
            <SelectTrigger id="sort" className="w-[160px] font-ui">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="relevance">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5" />
                  Relevance
                </div>
              </SelectItem>
              <SelectItem value="rating">
                <div className="flex items-center gap-2">
                  <Star className="h-3.5 w-3.5" />
                  Rating
                </div>
              </SelectItem>
              <SelectItem value="recent">
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5" />
                  Recent
                </div>
              </SelectItem>
              <SelectItem value="popular">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Popular
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Recipe grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedRecipes.map((recipe, index) => {
          const rankedRecipe = recipe as RankedRecipe;
          const showRank = sortBy === 'relevance' && index < 3; // Show rank for top 3 in relevance mode

          return (
            <div key={recipe.id} className="relative space-y-2">
              <RecipeCard
                recipe={recipe}
                showSimilarity={false}
                showRank={showRank ? index + 1 : undefined}
              />
              {/* Similarity badge below card */}
              {showSimilarity && (
                <div className="flex justify-center">
                  <SimilarityBadge
                    similarity={recipe.similarity}
                    rankingScore={rankedRecipe.rankingScore}
                    scoreComponents={rankedRecipe.scoreComponents}
                    showTooltip
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Load more hint (for future pagination) */}
      {sortedRecipes.length >= 20 && (
        <div className="text-center py-6 text-sm text-jk-charcoal/60 font-ui">
          Showing {sortedRecipes.length} results. Try refining your search for more specific
          matches.
        </div>
      )}
    </div>
  );
}

/**
 * Compact search results for sidebars or smaller spaces
 */
export function CompactSearchResults({
  recipes,
  query,
  loading,
  className,
}: Pick<SearchResultsProps, 'recipes' | 'query' | 'loading' | 'className'>) {
  if (loading) {
    return (
      <div className={cn('flex items-center justify-center py-6', className)}>
        <Loader2 className="h-5 w-5 animate-spin text-jk-clay" />
      </div>
    );
  }

  if (recipes.length === 0) {
    return (
      <div className={cn('text-center py-6 text-sm text-jk-charcoal/60', className)}>
        No recipes found
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {recipes.slice(0, 5).map((recipe) => (
        <div
          key={recipe.id}
          className="flex items-center gap-3 p-3 rounded-lg border border-jk-sage hover:bg-jk-sage/10 transition-colors"
        >
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-jk-olive truncate font-heading">
              {recipe.name}
            </p>
            <p className="text-xs text-jk-charcoal/60 truncate font-ui">
              {recipe.cuisine || 'Recipe'}
            </p>
          </div>
          <SimilarityBadge similarity={recipe.similarity} variant="compact" showTooltip={false} />
        </div>
      ))}
    </div>
  );
}
