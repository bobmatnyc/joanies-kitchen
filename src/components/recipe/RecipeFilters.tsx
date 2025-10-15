'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { X, SlidersHorizontal, Search } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';

interface RecipeFiltersProps {
  availableCuisines?: string[];
  showSearch?: boolean;
  showSystemRecipeFilter?: boolean;
}

export function RecipeFilters({
  availableCuisines = [],
  showSearch = true,
  showSystemRecipeFilter = false,
}: RecipeFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Local state for filters
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [sort, setSort] = useState(searchParams.get('sort') || 'rating');
  const [minRating, setMinRating] = useState(searchParams.get('minRating') || '');
  const [difficulty, setDifficulty] = useState(searchParams.get('difficulty') || '');
  const [cuisine, setCuisine] = useState(searchParams.get('cuisine') || '');
  const [isSystemRecipe, setIsSystemRecipe] = useState(searchParams.get('isSystemRecipe') || '');

  // Track active filters count
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);

  useEffect(() => {
    let count = 0;
    if (searchQuery) count++;
    if (minRating) count++;
    if (difficulty) count++;
    if (cuisine) count++;
    if (isSystemRecipe) count++;
    setActiveFiltersCount(count);
  }, [searchQuery, minRating, difficulty, cuisine, isSystemRecipe]);

  const updateURL = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams);

    // Apply updates
    Object.entries(updates).forEach(([key, value]) => {
      if (value && value !== '') {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });

    // Navigate with new params
    router.push(`?${params.toString()}`, { scroll: false });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateURL({ search: searchQuery });
  };

  const handleSortChange = (value: string) => {
    setSort(value);
    updateURL({ sort: value });
  };

  const handleMinRatingChange = (value: string) => {
    const actualValue = value === 'all' ? '' : value;
    setMinRating(actualValue);
    updateURL({ minRating: actualValue });
  };

  const handleDifficultyChange = (value: string) => {
    const actualValue = value === 'all' ? '' : value;
    setDifficulty(actualValue);
    updateURL({ difficulty: actualValue });
  };

  const handleCuisineChange = (value: string) => {
    const actualValue = value === 'all' ? '' : value;
    setCuisine(actualValue);
    updateURL({ cuisine: actualValue });
  };

  const handleSystemRecipeChange = (value: string) => {
    const actualValue = value === 'all' ? '' : value;
    setIsSystemRecipe(actualValue);
    updateURL({ isSystemRecipe: actualValue });
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setMinRating('');
    setDifficulty('');
    setCuisine('');
    setIsSystemRecipe('');

    // Keep only sort parameter
    const params = new URLSearchParams();
    params.set('sort', sort);
    router.push(`?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      {showSearch && (
        <form onSubmit={handleSearchSubmit} className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-jk-clay/60 h-4 w-4" />
          <Input
            placeholder="Search recipes by name, description, or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10 font-ui"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                updateURL({ search: '' });
              }}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-jk-clay/60 hover:text-jk-clay"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </form>
      )}

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-3 items-end">
        {/* Sort */}
        <div className="flex-1 min-w-[180px]">
          <Label htmlFor="sort" className="text-sm text-jk-olive mb-1 block">
            Sort By
          </Label>
          <Select value={sort} onValueChange={handleSortChange}>
            <SelectTrigger id="sort" className="font-ui">
              <SelectValue placeholder="Sort by..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rating">Highest Rated</SelectItem>
              <SelectItem value="recent">Most Recent</SelectItem>
              <SelectItem value="name">Alphabetical</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Min Rating */}
        <div className="flex-1 min-w-[180px]">
          <Label htmlFor="minRating" className="text-sm text-jk-olive mb-1 block">
            Minimum Rating
          </Label>
          <Select value={minRating || 'all'} onValueChange={handleMinRatingChange}>
            <SelectTrigger id="minRating" className="font-ui">
              <SelectValue placeholder="All ratings" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Ratings</SelectItem>
              <SelectItem value="4.5">4.5+ Stars</SelectItem>
              <SelectItem value="4.0">4.0+ Stars</SelectItem>
              <SelectItem value="3.5">3.5+ Stars</SelectItem>
              <SelectItem value="3.0">3.0+ Stars</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Difficulty */}
        <div className="flex-1 min-w-[180px]">
          <Label htmlFor="difficulty" className="text-sm text-jk-olive mb-1 block">
            Difficulty
          </Label>
          <Select value={difficulty || 'all'} onValueChange={handleDifficultyChange}>
            <SelectTrigger id="difficulty" className="font-ui">
              <SelectValue placeholder="All difficulties" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Difficulties</SelectItem>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Cuisine */}
        {availableCuisines.length > 0 ? (
          <div className="flex-1 min-w-[180px]">
            <Label htmlFor="cuisine" className="text-sm text-jk-olive mb-1 block">
              Cuisine
            </Label>
            <Select value={cuisine || 'all'} onValueChange={handleCuisineChange}>
              <SelectTrigger id="cuisine" className="font-ui">
                <SelectValue placeholder="All cuisines" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cuisines</SelectItem>
                {availableCuisines.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="flex-1 min-w-[180px]">
            <Label htmlFor="cuisine" className="text-sm text-jk-olive mb-1 block">
              Cuisine
            </Label>
            <Input
              id="cuisine"
              placeholder="e.g., Italian, Mexican"
              value={cuisine}
              onChange={(e) => {
                setCuisine(e.target.value);
                // Update on blur or enter
              }}
              onBlur={(e) => updateURL({ cuisine: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  updateURL({ cuisine: cuisine });
                }
              }}
              className="font-ui"
            />
          </div>
        )}

        {/* System Recipe Filter (optional) */}
        {showSystemRecipeFilter && (
          <div className="flex-1 min-w-[180px]">
            <Label htmlFor="isSystemRecipe" className="text-sm text-jk-olive mb-1 block">
              Recipe Type
            </Label>
            <Select value={isSystemRecipe || 'all'} onValueChange={handleSystemRecipeChange}>
              <SelectTrigger id="isSystemRecipe" className="font-ui">
                <SelectValue placeholder="All recipes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Recipes</SelectItem>
                <SelectItem value="true">Curated Recipes</SelectItem>
                <SelectItem value="false">Community Recipes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Clear Filters Button */}
        {activeFiltersCount > 0 && (
          <Button
            type="button"
            variant="outline"
            onClick={clearAllFilters}
            className="border-jk-sage text-jk-clay hover:bg-jk-sage/20"
          >
            <X className="h-4 w-4 mr-1" />
            Clear {activeFiltersCount} filter{activeFiltersCount !== 1 ? 's' : ''}
          </Button>
        )}
      </div>

      {/* Active Filters Display */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {searchQuery && (
            <Badge variant="secondary" className="gap-1">
              Search: {searchQuery}
              <button
                onClick={() => {
                  setSearchQuery('');
                  updateURL({ search: '' });
                }}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {minRating && (
            <Badge variant="secondary" className="gap-1">
              {minRating}+ stars
              <button
                onClick={() => {
                  setMinRating('');
                  updateURL({ minRating: '' });
                }}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {difficulty && (
            <Badge variant="secondary" className="gap-1">
              {difficulty}
              <button
                onClick={() => {
                  setDifficulty('');
                  updateURL({ difficulty: '' });
                }}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {cuisine && (
            <Badge variant="secondary" className="gap-1">
              {cuisine}
              <button
                onClick={() => {
                  setCuisine('');
                  updateURL({ cuisine: '' });
                }}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {isSystemRecipe && (
            <Badge variant="secondary" className="gap-1">
              {isSystemRecipe === 'true' ? 'Curated' : 'Community'}
              <button
                onClick={() => {
                  setIsSystemRecipe('');
                  updateURL({ isSystemRecipe: '' });
                }}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
