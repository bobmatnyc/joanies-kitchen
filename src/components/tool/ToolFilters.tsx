'use client';

import { Search } from 'lucide-react';
import type { SortOption } from '@/app/actions/tools';

interface ToolFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  sortBy: SortOption;
  onSortChange: (value: SortOption) => void;
  totalCount: number;
}

/**
 * ToolFilters - Filter and search controls for kitchen tools
 *
 * Features:
 * - Search input with debouncing
 * - Sort options (alphabetical, usage, canonical)
 * - Total count display
 *
 * Design:
 * - Matches IngredientFilters style
 * - Sticky bar for always-visible controls
 * - Mobile-responsive
 */
export function ToolFilters({
  searchTerm,
  onSearchChange,
  sortBy,
  onSortChange,
  totalCount,
}: ToolFiltersProps) {
  return (
    <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="container mx-auto px-4 py-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search kitchen tools..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-amber-400 dark:focus:ring-amber-400"
            />
          </div>

          {/* Sort & Count */}
          <div className="flex items-center gap-4">
            {/* Total Count */}
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {totalCount} {totalCount === 1 ? 'tool' : 'tools'}
            </span>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value as SortOption)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-amber-400 dark:focus:ring-amber-400"
            >
              <option value="usage">Most Used</option>
              <option value="alphabetical">Alphabetical</option>
              <option value="category">By Category</option>
              <option value="essential">Essential First</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
