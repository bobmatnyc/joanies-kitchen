'use client';

import { Package, TrendingUp } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import type { IngredientWithStats } from '@/lib/db/ingredients-schema';

interface IngredientCardProps {
  ingredient: IngredientWithStats;
  className?: string;
}

/**
 * IngredientCard - Card component for displaying an ingredient in the grid.
 *
 * Design: uses JK design tokens (jk-sage, jk-olive, jk-clay) rather than
 * generic Tailwind gray-* classes to stay consistent with the brand palette.
 */
export function IngredientCard({ ingredient, className = '' }: IngredientCardProps) {
  const usageCount = ingredient.statistics?.total_recipes || ingredient.usage_count || 0;
  const isTrending = (ingredient.statistics?.trending_score || 0) > 50;

  return (
    <Link
      href={`/ingredients/${ingredient.slug}`}
      className={`group block rounded-lg border border-jk-sage/30 bg-white shadow-sm transition-all hover:shadow-md hover:border-jk-sage overflow-hidden ${className}`}
      aria-label={`View ${ingredient.display_name} ingredient details`}
    >
      {/* Image Section */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-jk-sage/10">
        {ingredient.image_url ? (
          <Image
            src={ingredient.image_url}
            alt={ingredient.display_name}
            fill
            className="object-cover transition-transform group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          // Semantic: decorative fallback icon, hidden from screen readers
          <div className="flex h-full w-full items-center justify-center" aria-hidden="true">
            <Package className="h-12 w-12 text-jk-sage/40" />
          </div>
        )}

        {/* Trending Badge */}
        {isTrending && (
          <div className="absolute top-1.5 right-1.5 rounded-full bg-jk-clay px-1.5 py-0.5 text-xs font-semibold text-jk-linen flex items-center gap-0.5">
            <TrendingUp className="h-2.5 w-2.5" aria-hidden="true" />
            <span className="hidden sm:inline">Trending</span>
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="p-3">
        <h3 className="text-sm font-semibold text-jk-olive group-hover:text-jk-clay transition-colors line-clamp-1">
          {ingredient.display_name}
        </h3>

        <div className="mt-1 flex items-center justify-between text-xs">
          {ingredient.category && (
            <span className="text-jk-charcoal/60 capitalize">{ingredient.category}</span>
          )}
          {ingredient.is_common && (
            <span className="rounded-full bg-jk-sage/20 px-1.5 py-0.5 text-xs font-medium text-jk-olive">
              Popular
            </span>
          )}
        </div>

        <div className="mt-1.5 text-xs text-jk-charcoal/50">
          {usageCount} {usageCount === 1 ? 'recipe' : 'recipes'}
        </div>
      </div>
    </Link>
  );
}
