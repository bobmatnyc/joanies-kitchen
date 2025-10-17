'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Recipe } from '@/lib/db/schema';
import { BulkActionBar } from './BulkActionBar';
import { RecipeRow } from './RecipeRow';

interface RecipeDataTableProps {
  recipes: Recipe[];
}

export function RecipeDataTable({ recipes }: RecipeDataTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPublic, setFilterPublic] = useState<string>('all');
  const [filterSystem, setFilterSystem] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Filter recipes
  const filteredRecipes = recipes.filter((recipe) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        recipe.name.toLowerCase().includes(query) ||
        recipe.description?.toLowerCase().includes(query) ||
        recipe.cuisine?.toLowerCase().includes(query);

      if (!matchesSearch) return false;
    }

    // Public filter
    if (filterPublic !== 'all') {
      if (filterPublic === 'public' && !recipe.is_public) return false;
      if (filterPublic === 'private' && recipe.is_public) return false;
    }

    // System filter
    if (filterSystem !== 'all') {
      if (filterSystem === 'system' && !recipe.is_system_recipe) return false;
      if (filterSystem === 'user' && recipe.is_system_recipe) return false;
    }

    return true;
  });

  // Pagination
  const totalPages = Math.ceil(filteredRecipes.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedRecipes = filteredRecipes.slice(startIndex, startIndex + itemsPerPage);

  // Selection handlers
  const toggleAll = () => {
    if (selectedIds.size === paginatedRecipes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedRecipes.map((r) => r.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const clearSelection = () => setSelectedIds(new Set());

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Input
          placeholder="Search recipes..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
          className="flex-1"
        />

        <Select value={filterPublic} onValueChange={setFilterPublic}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Visibility" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Recipes</SelectItem>
            <SelectItem value="public">Public Only</SelectItem>
            <SelectItem value="private">Private Only</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterSystem} onValueChange={setFilterSystem}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="system">Shared Recipes</SelectItem>
            <SelectItem value="user">User Recipes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          selectedIds={Array.from(selectedIds)}
          onClearSelection={clearSelection}
          onSuccess={clearSelection}
        />
      )}

      {/* Results count */}
      <div className="text-sm text-gray-600">
        Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredRecipes.length)} of{' '}
        {filteredRecipes.length} recipes
        {selectedIds.size > 0 && ` (${selectedIds.size} selected)`}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-12 px-6 py-3">
                  <Checkbox
                    checked={
                      paginatedRecipes.length > 0 && selectedIds.size === paginatedRecipes.length
                    }
                    onCheckedChange={toggleAll}
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Recipe
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Public
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  System
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedRecipes.map((recipe) => (
                <RecipeRow
                  key={recipe.id}
                  recipe={recipe}
                  isSelected={selectedIds.has(recipe.id)}
                  onToggleSelect={toggleSelect}
                />
              ))}
            </tbody>
          </table>
        </div>

        {paginatedRecipes.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No recipes found matching your filters.
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            variant="outline"
          >
            Previous
          </Button>

          <div className="text-sm text-gray-600">
            Page {currentPage} of {totalPages}
          </div>

          <Button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            variant="outline"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
