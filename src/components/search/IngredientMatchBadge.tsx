'use client';

import { CheckCircle2, Circle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface IngredientMatchBadgeProps {
  matchedCount: number;
  totalCount: number;
  matchedIngredients?: string[]; // Array of ingredient names for tooltip
  className?: string;
  showTooltip?: boolean;
}

export function IngredientMatchBadge({
  matchedCount,
  totalCount,
  matchedIngredients = [],
  className,
  showTooltip = true,
}: IngredientMatchBadgeProps) {
  // Calculate match percentage
  const matchPercentage = totalCount > 0 ? Math.round((matchedCount / totalCount) * 100) : 0;

  // Determine badge color based on match percentage
  const getBadgeVariant = () => {
    if (matchPercentage >= 80) return 'high'; // Green
    if (matchPercentage >= 50) return 'medium'; // Yellow
    return 'low'; // Gray
  };

  const variant = getBadgeVariant();

  // Color classes based on variant
  const colorClasses = {
    high: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300',
    medium:
      'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300',
    low: 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300',
  };

  const badgeContent = (
    <Badge
      variant="outline"
      className={cn('gap-1.5 font-ui font-medium', colorClasses[variant], className)}
      aria-label={`${matchPercentage}% ingredient match`}
    >
      <div className="flex items-center gap-1">
        <CheckCircle2 className="h-3 w-3" />
        <span className="text-xs font-semibold">{matchPercentage}%</span>
      </div>
      <span className="text-xs opacity-80">
        {matchedCount}/{totalCount}
      </span>
    </Badge>
  );

  // If no tooltip needed or no ingredient names, return badge only
  if (!showTooltip || matchedIngredients.length === 0) {
    return badgeContent;
  }

  // Return badge with tooltip showing matched ingredients
  return (
    <Popover>
      <PopoverTrigger asChild>
        <div className="cursor-help inline-flex">{badgeContent}</div>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" side="top" align="start">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-jk-olive font-heading">Ingredient Match</h4>
            <Badge variant="outline" className={cn('text-xs', colorClasses[variant])}>
              {matchPercentage}%
            </Badge>
          </div>
          <div className="text-xs text-jk-charcoal/70 mb-2">
            {matchedCount} of {totalCount} ingredients matched
          </div>
          {matchedIngredients.length > 0 && (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              <p className="text-xs font-semibold text-jk-olive">Matched Ingredients:</p>
              <ul className="space-y-1">
                {matchedIngredients.map((ingredient, index) => (
                  <li key={index} className="flex items-start gap-1.5 text-xs">
                    <CheckCircle2 className="h-3 w-3 text-green-600 mt-0.5 shrink-0" />
                    <span className="font-ui">{ingredient}</span>
                  </li>
                ))}
              </ul>
              {totalCount > matchedCount && (
                <div className="pt-2 border-t border-jk-sage/30 mt-2">
                  <p className="text-xs text-jk-charcoal/60">
                    {totalCount - matchedCount} additional ingredient
                    {totalCount - matchedCount !== 1 ? 's' : ''} required
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Compact version for use in card headers or tight spaces
 */
export function CompactIngredientMatchBadge({
  matchedCount,
  totalCount,
  className,
}: Omit<IngredientMatchBadgeProps, 'matchedIngredients' | 'showTooltip'>) {
  const matchPercentage = totalCount > 0 ? Math.round((matchedCount / totalCount) * 100) : 0;

  const getColorClass = () => {
    if (matchPercentage >= 80) return 'text-green-600 bg-green-50 border-green-200';
    if (matchPercentage >= 50) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-gray-600 bg-gray-50 border-gray-200';
  };

  return (
    <Badge
      variant="outline"
      className={cn('text-xs font-ui font-semibold gap-1', getColorClass(), className)}
      aria-label={`${matchPercentage}% match`}
    >
      <Circle className="h-2.5 w-2.5 fill-current" />
      {matchPercentage}%
    </Badge>
  );
}

/**
 * Detailed badge for recipe detail pages
 */
export function DetailedIngredientMatchBadge({
  matchedCount,
  totalCount,
  matchedIngredients = [],
  className,
}: IngredientMatchBadgeProps) {
  const matchPercentage = totalCount > 0 ? Math.round((matchedCount / totalCount) * 100) : 0;

  const getColorClasses = () => {
    if (matchPercentage >= 80)
      return {
        container: 'bg-green-50 border-green-200 dark:bg-green-900/20',
        text: 'text-green-800 dark:text-green-300',
        badge: 'bg-green-600 text-white',
      };
    if (matchPercentage >= 50)
      return {
        container: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20',
        text: 'text-yellow-800 dark:text-yellow-300',
        badge: 'bg-yellow-600 text-white',
      };
    return {
      container: 'bg-gray-50 border-gray-200 dark:bg-gray-800',
      text: 'text-gray-700 dark:text-gray-300',
      badge: 'bg-gray-600 text-white',
    };
  };

  const colors = getColorClasses();

  return (
    <div className={cn('rounded-md border p-4', colors.container, className)}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={cn('text-sm font-semibold font-heading', colors.text)}>Ingredient Match</h3>
        <Badge className={cn('font-semibold', colors.badge)}>{matchPercentage}%</Badge>
      </div>
      <div className={cn('text-sm mb-3 font-ui', colors.text)}>
        You have {matchedCount} of {totalCount} ingredients
      </div>
      {matchedIngredients.length > 0 && (
        <div className="space-y-1">
          {matchedIngredients.slice(0, 5).map((ingredient, index) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
              <span className={cn('font-ui', colors.text)}>{ingredient}</span>
            </div>
          ))}
          {matchedIngredients.length > 5 && (
            <p className="text-xs text-jk-charcoal/60 ml-5 mt-1">
              +{matchedIngredients.length - 5} more ingredients matched
            </p>
          )}
        </div>
      )}
    </div>
  );
}
