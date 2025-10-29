'use client';

import type { IngredientWithStats } from '@/lib/db/ingredients-schema';
import { IngredientCard } from './IngredientCard';

interface IngredientListProps {
  ingredients: IngredientWithStats[];
  viewMode?: 'grid' | 'list';
  className?: string;
}

/**
 * IngredientList - Container component for displaying ingredients
 *
 * Features:
 * - Grid or list view modes
 * - Responsive layout (1-4 columns based on screen size)
 * - Empty state handling
 *
 * Design:
 * - Grid layout for visual browsing
 * - Mobile-first responsive design
 */
export function IngredientList({
  ingredients,
  viewMode = 'grid',
  className = '',
}: IngredientListProps) {
  if (ingredients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <p className="text-lg text-gray-500 dark:text-gray-400 text-center">No ingredients found</p>
        <p className="mt-2 text-sm text-gray-400 dark:text-gray-500 text-center max-w-md">
          Try adjusting your filters or search terms
        </p>
      </div>
    );
  }

  if (viewMode === 'list') {
    return (
      <div className={`space-y-3 ${className}`}>
        {ingredients.map((ingredient) => (
          <IngredientCard key={ingredient.id} ingredient={ingredient} />
        ))}
      </div>
    );
  }

  // Grid view (default)
  return (
    <div
      className={`grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 ${className}`}
    >
      {ingredients.map((ingredient) => (
        <IngredientCard key={ingredient.id} ingredient={ingredient} />
      ))}
    </div>
  );
}
