'use client';

import { useEffect, useState } from 'react';
import { Package } from 'lucide-react';
import { IngredientFilters } from '@/components/ingredient/IngredientFilters';
import { IngredientList } from '@/components/ingredient/IngredientList';
import {
  getAllIngredients,
  getIngredientCategories,
  type SortOption,
} from '@/app/actions/ingredients';
import type { IngredientWithStats } from '@/lib/db/ingredients-schema';

/**
 * Ingredients Directory Page
 *
 * Browse all ingredients with:
 * - Category filtering
 * - Search functionality
 * - Multiple sort options
 * - Grid view with images
 * - Usage statistics
 *
 * Features:
 * - Client-side filtering for instant feedback
 * - Pagination support
 * - Mobile-responsive design
 * - Link to fridge search with ingredient pre-filled
 */
export default function IngredientsPage() {
  const [ingredients, setIngredients] = useState<IngredientWithStats[]>([]);
  const [categories, setCategories] = useState<Array<{ category: string; count: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('alphabetical');

  // Pagination
  const [totalCount, setTotalCount] = useState(0);

  // Fetch categories on mount
  useEffect(() => {
    async function loadCategories() {
      const result = await getIngredientCategories();
      if (result.success) {
        setCategories(result.categories);
      }
    }
    loadCategories();
  }, []);

  // Fetch ingredients when filters change
  useEffect(() => {
    async function loadIngredients() {
      setLoading(true);
      setError(null);

      const result = await getAllIngredients({
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        search: searchTerm,
        sort: sortBy,
        limit: 200, // Load more for client-side filtering
        offset: 0,
      });

      if (result.success) {
        setIngredients(result.ingredients);
        setTotalCount(result.totalCount);
      } else {
        setError(result.error || 'Failed to load ingredients');
      }

      setLoading(false);
    }

    loadIngredients();
  }, [selectedCategory, searchTerm, sortBy]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-amber-100 dark:bg-amber-900/30 p-3">
              <Package className="h-8 w-8 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Ingredients Directory
              </h1>
              <p className="mt-1 text-gray-600 dark:text-gray-400">
                Explore ingredients with Joanie&apos;s personal notes and cooking tips
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <IngredientFilters
        categories={categories}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        sortBy={sortBy}
        onSortChange={setSortBy}
        totalCount={totalCount}
      />

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-6 text-center">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Ingredients List */}
        {!loading && !error && <IngredientList ingredients={ingredients} />}

        {/* Empty State (no results after filtering) */}
        {!loading && !error && ingredients.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <Package className="h-16 w-16 text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
              No ingredients found
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-center max-w-md">
              Try adjusting your filters or search terms to find what you&apos;re looking for.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
