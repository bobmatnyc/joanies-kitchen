'use client';

import { useEffect, useState } from 'react';
import { Wrench, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { getAllTools, type Tool, type SortOption } from '@/app/actions/tools';
import { ToolFilters } from '@/components/tool/ToolFilters';
import { ToolList } from '@/components/tool/ToolList';

/**
 * Kitchen Tools Directory Page
 *
 * Browse all kitchen tools with:
 * - Search functionality
 * - Sort by usage, alphabetical, category, or essential first
 * - Grid view with category badges
 * - Usage statistics from recipe_tools table
 *
 * Design mirrors /ingredients page for consistency
 */
export default function ToolsPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('usage');

  // Pagination
  const [totalCount, setTotalCount] = useState(0);

  // Fetch tools when filters change
  useEffect(() => {
    async function loadTools() {
      setLoading(true);
      setError(null);

      const result = await getAllTools({
        search: searchTerm,
        sort: sortBy,
        limit: 100, // Load all tools for client-side filtering
        offset: 0,
      });

      if (result.success) {
        setTools(result.tools);
        setTotalCount(result.totalCount);
      } else {
        setError(result.error || 'Failed to load tools');
      }

      setLoading(false);
    }

    loadTools();
  }, [searchTerm, sortBy]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-4 py-8">
          {/* Back to Ingredients */}
          <Link
            href="/ingredients"
            className="inline-flex items-center gap-2 text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Ingredients</span>
          </Link>

          <div className="flex items-center gap-4">
            <div className="rounded-full bg-amber-100 dark:bg-amber-900/30 p-3">
              <Wrench className="h-8 w-8 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Kitchen Tools Directory
              </h1>
              <p className="mt-1 text-gray-600 dark:text-gray-400">
                Essential tools and equipment mentioned in Joanie&apos;s recipes
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <ToolFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        sortBy={sortBy}
        onSortChange={setSortBy}
        totalCount={totalCount}
      />

      {/* Content */}
      <div className="container mx-auto px-4 py-6">
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

        {/* Tools List */}
        {!loading && !error && <ToolList tools={tools} />}
      </div>

      {/* Footer Note */}
      <div className="container mx-auto px-4 py-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>New:</strong> Kitchen tools have been migrated to a dedicated tools table with
            rich ontology support (5 types, 48 subtypes). This enables better categorization,
            essential/specialized flags, alternative suggestions, and accurate usage tracking across
            all recipes.
          </p>
        </div>
      </div>
    </div>
  );
}
