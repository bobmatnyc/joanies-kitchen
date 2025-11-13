'use client';

import { CheckCircle, ChefHat, Edit, Loader2, Package, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { searchRecipesByIngredients } from '@/app/actions/ingredient-search';
import { ErrorFallback } from '@/components/errors/ErrorFallback';
import { RecipeCard } from '@/components/recipe/RecipeCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { RecipeWithMatch } from '@/types/ingredient-search';

type SortOption = 'best-match' | 'fewest-missing' | 'cook-time';

/**
 * Fridge Results Page - Recipe Matches
 *
 * Display recipes that match user's available ingredients
 * with match percentage, ingredient indicators, and filters.
 *
 * Features:
 * - Parse ingredients from URL query params
 * - Fetch matching recipes via server action
 * - Display match percentage per recipe
 * - Show which ingredients you have vs missing
 * - Sort/filter options
 * - Edit ingredients (back to /fridge)
 * - Empty states with helpful messages
 *
 * Mobile-First:
 * - Responsive grid (1 col mobile, 2 tablet, 3 desktop)
 * - Stack filters vertically on mobile
 * - Touch-friendly controls
 */
function FridgeResultsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Parse URL parameters
  const ingredientsParam = searchParams.get('ingredients');
  const sourceParam = searchParams.get('source'); // 'inventory' or null
  const prioritizeParam = searchParams.get('prioritize'); // 'expiring' or null

  // Memoize ingredients array to prevent infinite re-renders
  const ingredients = useMemo(
    () =>
      ingredientsParam
        ?.split(',')
        .map((i) => i.trim())
        .filter(Boolean) || [],
    [ingredientsParam]
  );

  const isInventoryMode = sourceParam === 'inventory';
  const prioritizeExpiring = prioritizeParam === 'expiring';

  // State
  const [recipes, setRecipes] = useState<RecipeWithMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('best-match');
  const [minMatchFilter, setMinMatchFilter] = useState<number>(0); // 0 = no filter

  // Validation: Redirect if no ingredients provided
  useEffect(() => {
    if (!isInventoryMode && ingredients.length === 0) {
      console.warn('No ingredients provided, redirecting to /fridge');
      router.push('/fridge');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInventoryMode, ingredients.length, router]);

  // Fetch recipes with comprehensive error handling and retry
  const fetchRecipes = useCallback(async () => {
    // Validation: Don't fetch if no ingredients
    if (!isInventoryMode && ingredients.length === 0) {
      setError('No ingredients provided. Please select ingredients first.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let result;

      if (isInventoryMode) {
        // Inventory mode: use matchRecipesToInventory
        const { matchRecipesToInventory } = await import('@/app/actions/inventory');

        result = await matchRecipesToInventory({
          minMatchPercentage: 0, // Get all matches, we'll filter client-side
          prioritizeExpiring,
          limit: 50,
        });

        // Convert to RecipeWithMatch format
        if (result.success && result.data) {
          const recipes = result.data.map((r: any) => ({
            ...r,
            matchedIngredients: [], // Will be in missing_ingredients format
            totalIngredients: r.total_ingredients || 0,
            matchPercentage: r.match_percentage || 0,
            rankingScore: r.match_percentage || 0,
          }));
          setRecipes(recipes);
        } else {
          throw new Error(result.error || 'Failed to match recipes to inventory');
        }
      } else {
        // Manual mode: use searchRecipesByIngredients
        console.log('[Fridge Results] Searching for ingredients:', ingredients);
        result = await searchRecipesByIngredients(ingredients, {
          matchMode: 'any',
          minMatchPercentage: 0, // Get all matches, we'll filter client-side
          limit: 50,
          includePrivate: false, // Only public recipes
          rankingMode: 'balanced',
        });

        console.log('[Fridge Results] Search result:', {
          success: result.success,
          recipesCount: result.recipes?.length || 0,
          totalCount: result.totalCount,
          error: result.error,
        });

        if (result.success) {
          setRecipes(result.recipes);
        } else {
          throw new Error(result.error || 'Failed to search recipes');
        }
      }
    } catch (err: unknown) {
      console.error('Recipe search error:', err);

      // Categorize error and provide helpful message
      let errorMessage = 'An unexpected error occurred. Please try again.';

      if (err instanceof Error) {
        if (err.message.includes('timeout') || err.message.includes('timed out')) {
          errorMessage =
            'The search is taking longer than expected. This might be due to high server load. Please try again in a moment.';
        } else if (err.message.includes('network') || err.message.includes('fetch')) {
          errorMessage =
            'Network error. Please check your internet connection and try again.';
        } else if (err.message.includes('validation')) {
          errorMessage = err.message; // Use validation error as-is
        } else {
          errorMessage = `Error: ${err.message}`;
        }
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [isInventoryMode, ingredients, prioritizeExpiring]);

  // Fetch recipes on mount or when parameters change
  useEffect(() => {
    fetchRecipes();
  }, [fetchRecipes]);

  // Retry handler
  const handleRetry = useCallback(() => {
    fetchRecipes();
  }, [fetchRecipes]);

  // Apply client-side sorting and filtering
  const filteredAndSortedRecipes = [...recipes]
    .filter((recipe) => recipe.matchPercentage >= minMatchFilter)
    .sort((a, b) => {
      switch (sortBy) {
        case 'best-match':
          return b.matchPercentage - a.matchPercentage;
        case 'fewest-missing':
          return (
            a.totalIngredients -
            a.matchedIngredients.length -
            (b.totalIngredients - b.matchedIngredients.length)
          );
        case 'cook-time':
          return (
            (a.prep_time || 0) + (a.cook_time || 0) - ((b.prep_time || 0) + (b.cook_time || 0))
          );
        default:
          return 0;
      }
    });

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-jk-clay mx-auto" />
          <p className="text-lg text-jk-charcoal/70 font-ui">
            Finding recipes that match your ingredients...
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <ErrorFallback
          title="Recipe Search Failed"
          message={error}
          onRetry={handleRetry}
          altAction={{
            label: 'Change Ingredients',
            onClick: () => router.push('/fridge'),
          }}
        />
      </div>
    );
  }

  // Empty state - No recipes found
  if (filteredAndSortedRecipes.length === 0 && recipes.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-4">
          <ChefHat className="w-12 h-12 text-jk-clay mx-auto" />
          <h2 className="text-2xl font-heading text-jk-olive">No Recipes Found</h2>
          <p className="text-base text-jk-charcoal/70 font-body">
            We couldn't find any recipes matching your ingredients. Try removing some ingredients or
            browse all recipes.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={() => router.push('/fridge')} variant="default">
              Edit Ingredients
            </Button>
            <Button onClick={() => router.push('/discover')} variant="outline">
              Browse All Recipes
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Empty state - Filters too restrictive
  if (filteredAndSortedRecipes.length === 0 && recipes.length > 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header with ingredients */}
        <IngredientHeader
          ingredients={ingredients}
          totalResults={recipes.length}
          isInventoryMode={isInventoryMode}
          prioritizeExpiring={prioritizeExpiring}
        />

        <div className="text-center space-y-4 mt-12">
          <p className="text-lg text-jk-charcoal/70 font-body">
            No recipes match your current filters. Try adjusting your minimum match percentage.
          </p>
          <Button onClick={() => setMinMatchFilter(0)} variant="outline">
            Clear Filters
          </Button>
        </div>
      </div>
    );
  }

  // Main results display
  return (
    <div className="min-h-screen bg-gradient-to-br from-jk-cream via-white to-jk-sage/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
        {/* Header with selected ingredients */}
        <IngredientHeader
          ingredients={ingredients}
          totalResults={filteredAndSortedRecipes.length}
          isInventoryMode={isInventoryMode}
          prioritizeExpiring={prioritizeExpiring}
        />

        {/* Filters and Sort Controls */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6 sm:mb-8 bg-white rounded-lg p-4 shadow-sm border border-jk-sage/20">
          {/* Sort By */}
          <div className="flex items-center gap-2 flex-1">
            <label
              htmlFor="sort-by"
              className="text-sm font-ui text-jk-charcoal/70 whitespace-nowrap"
            >
              Sort by:
            </label>
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
              <SelectTrigger id="sort-by" className="flex-1 sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="best-match">Best Match</SelectItem>
                <SelectItem value="fewest-missing">Fewest Missing</SelectItem>
                <SelectItem value="cook-time">Cook Time</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Min Match Filter */}
          <div className="flex items-center gap-2 flex-1">
            <label
              htmlFor="min-match"
              className="text-sm font-ui text-jk-charcoal/70 whitespace-nowrap"
            >
              Min Match:
            </label>
            <Select
              value={minMatchFilter.toString()}
              onValueChange={(value) => setMinMatchFilter(parseInt(value, 10))}
            >
              <SelectTrigger id="min-match" className="flex-1 sm:w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">All Matches</SelectItem>
                <SelectItem value="50">50%+</SelectItem>
                <SelectItem value="70">70%+</SelectItem>
                <SelectItem value="90">90%+</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Results Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredAndSortedRecipes.map((recipe) => (
            <RecipeMatchCard key={recipe.id} recipe={recipe} userIngredients={ingredients} />
          ))}
        </div>

        {/* Results Summary */}
        <div className="mt-8 text-center text-sm text-jk-charcoal/60 font-ui">
          Showing {filteredAndSortedRecipes.length} of {recipes.length} recipes
        </div>
      </div>
    </div>
  );
}

/**
 * Default export wrapped in Suspense boundary
 * Required by Next.js 15 for useSearchParams()
 */
export default function FridgeResultsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <FridgeResultsContent />
    </Suspense>
  );
}

/**
 * Ingredient Header Component
 * Displays selected ingredients or inventory status with edit button
 */
function IngredientHeader({
  ingredients,
  totalResults,
  isInventoryMode,
  prioritizeExpiring,
}: {
  ingredients: string[];
  totalResults: number;
  isInventoryMode: boolean;
  prioritizeExpiring: boolean;
}) {
  return (
    <div className="mb-6 sm:mb-8">
      {/* Title and Edit Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-heading text-jk-olive">
            {isInventoryMode ? 'Matched from Your Fridge' : 'Recipe Matches'}
          </h1>
          <p className="text-sm sm:text-base text-jk-charcoal/70 font-body mt-1">
            Found {totalResults} {totalResults === 1 ? 'recipe' : 'recipes'}{' '}
            {isInventoryMode ? 'from your inventory' : 'using your ingredients'}
            {prioritizeExpiring && ' (prioritizing expiring items)'}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/fridge">
            <Button variant="outline" className="border-jk-sage text-jk-clay hover:bg-jk-sage/20">
              <Edit className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Change Search</span>
              <span className="sm:hidden">Edit</span>
            </Button>
          </Link>
          {isInventoryMode && (
            <Link href="/inventory">
              <Button variant="outline" className="border-jk-sage text-jk-clay hover:bg-jk-sage/20">
                <Package className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">View Inventory</span>
                <span className="sm:hidden">Inventory</span>
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Selected Ingredients Display (Manual Mode Only) */}
      {!isInventoryMode && ingredients.length > 0 && (
        <div className="bg-white rounded-lg p-4 shadow-sm border border-jk-sage/20">
          <p className="text-sm font-ui text-jk-charcoal/70 mb-2">Your Ingredients:</p>
          <div className="flex flex-wrap gap-2">
            {ingredients.map((ingredient) => (
              <Badge
                key={ingredient}
                variant="secondary"
                className="bg-jk-sage/20 text-jk-olive border-jk-sage capitalize"
              >
                <CheckCircle className="w-3 h-3 mr-1" />
                {ingredient}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Inventory Mode Info */}
      {isInventoryMode && (
        <div className="bg-jk-sage/10 rounded-lg p-4 shadow-sm border border-jk-sage/20">
          <div className="flex items-start gap-2">
            <Package className="w-5 h-5 text-jk-clay flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-jk-olive">Using your tracked inventory</p>
              <p className="text-xs text-jk-charcoal/60 mt-1">
                Recipes are matched based on ingredients currently in your fridge, freezer, and
                pantry.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Recipe Match Card Component
 * Extends RecipeCard with match percentage and ingredient indicators
 */
function RecipeMatchCard({
  recipe,
  userIngredients,
}: {
  recipe: RecipeWithMatch;
  userIngredients: string[];
}) {
  const missingCount = recipe.totalIngredients - recipe.matchedIngredients.length;
  const matchPercentage = Math.round(recipe.matchPercentage);

  return (
    <div className="relative">
      {/* Match Percentage Badge - Top of Card */}
      <div className="absolute top-2 right-2 z-20">
        <Badge
          className={`
            font-bold shadow-md
            ${matchPercentage >= 90 ? 'bg-green-500 hover:bg-green-600' : ''}
            ${matchPercentage >= 70 && matchPercentage < 90 ? 'bg-yellow-500 hover:bg-yellow-600' : ''}
            ${matchPercentage < 70 ? 'bg-orange-500 hover:bg-orange-600' : ''}
          `}
        >
          {matchPercentage}% Match
        </Badge>
      </div>

      {/* Recipe Card */}
      <RecipeCard recipe={recipe} />

      {/* Ingredient Match Indicator - Below Card */}
      <div className="mt-2 bg-white rounded-lg p-3 shadow-sm border border-jk-sage/20">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="font-ui text-jk-charcoal/70">
              You Have: {recipe.matchedIngredients.length} / {recipe.totalIngredients}
            </span>
          </div>
          {missingCount > 0 && (
            <div className="flex items-center gap-1 text-orange-600">
              <XCircle className="w-4 h-4" />
              <span className="font-ui">{missingCount} missing</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
