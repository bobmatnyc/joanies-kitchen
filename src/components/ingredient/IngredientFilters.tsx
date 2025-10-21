'use client';

import { useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SortOption } from '@/app/actions/ingredients';

interface IngredientFiltersProps {
  categories: Array<{ category: string | null; count: number }>;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  searchTerm: string;
  onSearchChange: (search: string) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  totalCount: number;
}

/**
 * IngredientFilters - Filter and search controls for ingredients
 *
 * Features:
 * - Category filter dropdown
 * - Search input with debouncing
 * - Sort options (alphabetical, most used, recently added)
 * - Results count display
 * - Clear filters button
 *
 * Design:
 * - Responsive layout (stacks on mobile)
 * - Sticky filters bar on desktop
 * - Clear visual feedback
 */
export function IngredientFilters({
  categories,
  selectedCategory,
  onCategoryChange,
  searchTerm,
  onSearchChange,
  sortBy,
  onSortChange,
  totalCount,
}: IngredientFiltersProps) {
  const [localSearch, setLocalSearch] = useState(searchTerm);

  const handleSearchChange = (value: string) => {
    setLocalSearch(value);
    // Debounce search (500ms)
    const timeoutId = setTimeout(() => {
      onSearchChange(value);
    }, 500);
    return () => clearTimeout(timeoutId);
  };

  const handleClearFilters = () => {
    setLocalSearch('');
    onSearchChange('');
    onCategoryChange('all');
    onSortChange('alphabetical');
  };

  const hasActiveFilters = selectedCategory !== 'all' || searchTerm !== '' || sortBy !== 'alphabetical';

  return (
    <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 p-4 space-y-4">
      {/* Top Row: Search and Category */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            type="text"
            placeholder="Search ingredients..."
            value={localSearch}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10 pr-10"
          />
          {localSearch && (
            <button
              onClick={() => handleSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          <Select value={selectedCategory} onValueChange={onCategoryChange}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => {
                const categoryName = cat.category || 'uncategorized';
                return (
                  <SelectItem key={categoryName} value={categoryName}>
                    {categoryName.charAt(0).toUpperCase() + categoryName.slice(1)} ({cat.count})
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Bottom Row: Sort and Results Count */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Sort */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">Sort by:</span>
          <Select value={sortBy} onValueChange={(value) => onSortChange(value as SortOption)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alphabetical">Alphabetical</SelectItem>
              <SelectItem value="most-used">Most Used</SelectItem>
              <SelectItem value="recently-added">Recently Added</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Results Count and Clear */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {totalCount} {totalCount === 1 ? 'ingredient' : 'ingredients'}
          </span>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
            >
              Clear Filters
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
