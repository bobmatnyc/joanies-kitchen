'use client';

import { CheckCircle, ChefHat, Edit, Loader2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { searchRecipesByIngredients } from '@/app/actions/ingredient-search';
import { RecipeCard } from '@/components/recipe/RecipeCard';
import type { RecipeWithMatch } from '@/types/ingredient-search';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
export default function FridgeResultsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Parse ingredients from URL
  const ingredientsParam = searchParams.get('ingredients');
  const ingredients = ingredientsParam?.split(',').map((i) => i.trim()).filter(Boolean) || [];

  // State
  const [recipes, setRecipes] = useState<RecipeWithMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('best-match');
  const [minMatchFilter, setMinMatchFilter] = useState<number>(0); // 0 = no filter

  // Redirect if no ingredients
  useEffect(() => {
    if (ingredients.length === 0) {
      router.push('/fridge');
    }
  }, [ingredients, router]);

  // Fetch recipes on mount or when ingredients change
  useEffect(() => {
    if (ingredients.length === 0) return;

    async function fetchRecipes() {
      setLoading(true);
      setError(null);

      try {
        const result = await searchRecipesByIngredients(ingredients, {
          matchMode: 'any',
          minMatchPercentage: 0, // Get all matches, we'll filter client-side
          limit: 50,
          includePrivate: false, // Only public recipes
          rankingMode: 'balanced',
        });

        if (result.success) {
          setRecipes(result.recipes);
        } else {
          setError(result.error || 'Failed to search recipes');
        }
      } catch (err) {
        console.error('Recipe search error:', err);
        setError('An unexpected error occurred. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    fetchRecipes();
  }, [ingredients]);

  // Apply client-side sorting and filtering
  const filteredAndSortedRecipes = [...recipes]
    .filter((recipe) => recipe.matchPercentage >= minMatchFilter)
    .sort((a, b) => {
      switch (sortBy) {
        case 'best-match':
          return b.matchPercentage - a.matchPercentage;
        case 'fewest-missing':
          return (
            a.totalIngredients - a.matchedIngredients.length -
            (b.totalIngredients - b.matchedIngredients.length)
          );
        case 'cook-time':
          return (a.prep_time || 0) + (a.cook_time || 0) - ((b.prep_time || 0) + (b.cook_time || 0));
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
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-4">
          <XCircle className="w-12 h-12 text-destructive mx-auto" />
          <h2 className="text-2xl font-heading text-jk-olive">Something Went Wrong</h2>
          <p className="text-base text-jk-charcoal/70 font-body">{error}</p>
          <Button onClick={() => router.push('/fridge')} variant="default">
            Try Again
          </Button>
        </div>
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
            We couldn't find any recipes matching your ingredients.
            Try removing some ingredients or browse all recipes.
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
        <IngredientHeader ingredients={ingredients} totalResults={recipes.length} />

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
        />

        {/* Filters and Sort Controls */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6 sm:mb-8 bg-white rounded-lg p-4 shadow-sm border border-jk-sage/20">
          {/* Sort By */}
          <div className="flex items-center gap-2 flex-1">
            <label htmlFor="sort-by" className="text-sm font-ui text-jk-charcoal/70 whitespace-nowrap">
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
            <label htmlFor="min-match" className="text-sm font-ui text-jk-charcoal/70 whitespace-nowrap">
              Min Match:
            </label>
            <Select
              value={minMatchFilter.toString()}
              onValueChange={(value) => setMinMatchFilter(parseInt(value))}
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
            <RecipeMatchCard
              key={recipe.id}
              recipe={recipe}
              userIngredients={ingredients}
            />
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
 * Ingredient Header Component
 * Displays selected ingredients with edit button
 */
function IngredientHeader({
  ingredients,
  totalResults,
}: {
  ingredients: string[];
  totalResults: number;
}) {
  return (
    <div className="mb-6 sm:mb-8">
      {/* Title and Edit Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-heading text-jk-olive">
            Recipe Matches
          </h1>
          <p className="text-sm sm:text-base text-jk-charcoal/70 font-body mt-1">
            Found {totalResults} {totalResults === 1 ? 'recipe' : 'recipes'} using your ingredients
          </p>
        </div>
        <Link href="/fridge">
          <Button variant="outline" className="border-jk-sage text-jk-clay hover:bg-jk-sage/20">
            <Edit className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Edit Ingredients</span>
            <span className="sm:hidden">Edit</span>
          </Button>
        </Link>
      </div>

      {/* Selected Ingredients Display */}
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
              <span className="font-ui">
                {missingCount} missing
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
