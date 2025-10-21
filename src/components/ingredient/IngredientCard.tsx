'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Package, TrendingUp } from 'lucide-react';
import type { IngredientWithStats } from '@/lib/db/ingredients-schema';

interface IngredientCardProps {
  ingredient: IngredientWithStats;
  className?: string;
}

/**
 * IngredientCard - Card component for displaying ingredient in grid view
 *
 * Features:
 * - Ingredient image with fallback
 * - Name and category badge
 * - Usage count/popularity
 * - Click to navigate to detail page
 *
 * Design:
 * - Card-based layout for modern feel
 * - Hover effects for interactivity
 * - Mobile-responsive
 */
export function IngredientCard({ ingredient, className = '' }: IngredientCardProps) {
  const usageCount = ingredient.statistics?.total_recipes || ingredient.usage_count || 0;
  const isTrending = (ingredient.statistics?.trending_score || 0) > 50;

  return (
    <Link
      href={`/ingredients/${ingredient.slug}`}
      className={`group block rounded-lg border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600 overflow-hidden ${className}`}
    >
      {/* Image Section */}
      <div className="relative aspect-square w-full overflow-hidden bg-gray-100 dark:bg-gray-700">
        {ingredient.image_url ? (
          <Image
            src={ingredient.image_url}
            alt={ingredient.display_name}
            fill
            className="object-cover transition-transform group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Package className="h-16 w-16 text-gray-300 dark:text-gray-600" />
          </div>
        )}

        {/* Trending Badge */}
        {isTrending && (
          <div className="absolute top-2 right-2 rounded-full bg-amber-500 px-2 py-1 text-xs font-semibold text-white flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            Trending
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="p-4">
        {/* Ingredient Name */}
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
          {ingredient.display_name}
        </h3>

        {/* Category */}
        {ingredient.category && (
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 capitalize">
            {ingredient.category}
          </p>
        )}

        {/* Usage Stats */}
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">
            Used in {usageCount} {usageCount === 1 ? 'recipe' : 'recipes'}
          </span>

          {ingredient.is_common && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
              Popular
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
