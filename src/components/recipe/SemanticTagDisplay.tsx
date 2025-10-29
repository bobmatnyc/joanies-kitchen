'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import type { TagCategory } from '@/lib/tag-ontology';
import { categorizeTags, getCategoryColor, getCategoryIcon } from '@/lib/tag-ontology';
import { getTagLabel, type Locale, normalizeTagToId } from '@/lib/tags';
import { getSemanticTag } from '@/lib/tags/semantic-tags';
import { cn } from '@/lib/utils';

interface SemanticTagDisplayProps {
  tags: string[];
  layout?: 'grouped' | 'inline';
  showCategoryLabels?: boolean;
  showDescriptions?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onTagClick?: (tag: string) => void;
  locale?: Locale; // Localization support
  excludeCategories?: TagCategory[]; // Categories to exclude from display
}

/**
 * User-friendly category label mapping
 */
const CATEGORY_LABELS: Record<string, string> = {
  Cuisine: 'Cuisine',
  Difficulty: 'Difficulty',
  'Meal Type': 'Meal Type',
  'Main Ingredient': 'Main Ingredient',
  Dietary: 'Dietary Preferences',
  'Cooking Method': 'Cooking Method',
  Course: 'Course',
  Season: 'Season',
  Occasion: 'Occasion',
  Equipment: 'Equipment',
  Technique: 'Technique',
  'Flavor Profile': 'Flavor Profile',
  Texture: 'Texture',
  Temperature: 'Temperature',
  'Prep Style': 'Prep Style',
  Time: 'Time',
  Other: 'Other Tags',
};

/**
 * Get user-friendly category label
 */
function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] || category;
}

/**
 * Display tags with semantic grouping and visual hierarchy
 * Now supports ID-based tags with localization
 */
export function SemanticTagDisplay({
  tags,
  layout = 'grouped',
  showCategoryLabels = true,
  showDescriptions = false,
  size = 'md',
  className,
  onTagClick,
  locale = 'en',
  excludeCategories = [],
}: SemanticTagDisplayProps) {
  const [isOtherExpanded, setIsOtherExpanded] = useState(false);

  if (!tags || tags.length === 0) {
    return null;
  }

  // Normalize tags to ID format (supports both old and new formats)
  const normalizedTags = tags.map((tag) => normalizeTagToId(tag));

  const categorizedTags = categorizeTags(normalizedTags);

  // Filter out excluded categories
  const filteredCategorizedTags = Object.fromEntries(
    Object.entries(categorizedTags).filter(
      ([category]) => !excludeCategories.includes(category as TagCategory)
    )
  ) as Record<TagCategory, string[]>;

  // Define category display order
  const categoryOrder: TagCategory[] = [
    'Cuisine',
    'Meal Type',
    'Dietary',
    'Course',
    'Main Ingredient',
    'Cooking Method',
    'Difficulty',
    'Time',
    'Season',
    'Other',
  ];

  // Filter and sort categories by order (using filtered tags)
  const sortedCategories = categoryOrder.filter(
    (cat) => filteredCategorizedTags[cat] && filteredCategorizedTags[cat].length > 0
  );

  // Size-based styling
  const sizeClasses = {
    sm: 'text-xs gap-1',
    md: 'text-sm gap-1.5',
    lg: 'text-base gap-2',
  };

  const badgeSizeClasses = {
    sm: 'py-0.5 px-1.5 text-xs',
    md: 'py-1 px-2 text-sm',
    lg: 'py-1.5 px-3 text-base',
  };

  if (layout === 'inline') {
    return (
      <div className={cn('flex flex-wrap', sizeClasses[size], className)}>
        {normalizedTags.map((tagId, index) => {
          const semanticTag = getSemanticTag(tagId);
          const category = semanticTag?.category || 'Other';

          // Get localized label
          const label = getTagLabel(tagId, locale);

          return (
            <Badge
              key={`${tagId}-${index}`}
              variant="secondary"
              className={cn(
                badgeSizeClasses[size],
                getCategoryColor(category),
                onTagClick && 'cursor-pointer hover:opacity-80 transition-opacity'
              )}
              onClick={onTagClick ? () => onTagClick(tagId) : undefined}
            >
              <span className="capitalize">{label}</span>
            </Badge>
          );
        })}
      </div>
    );
  }

  // Grouped layout
  return (
    <div className={cn('space-y-3', className)}>
      {sortedCategories.map((category) => {
        const categoryTags = filteredCategorizedTags[category];
        if (!categoryTags || categoryTags.length === 0) return null;

        const isOther = category === 'Other';

        // Skip "Other" if collapsed and it has tags
        if (isOther && !isOtherExpanded && categoryTags.length > 0) {
          return (
            <div key={category} className="space-y-1.5">
              <button
                onClick={() => setIsOtherExpanded(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground uppercase tracking-wide transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
                <span>
                  {getCategoryLabel(category)} ({categoryTags.length})
                </span>
              </button>
            </div>
          );
        }

        return (
          <div key={category} className="space-y-1.5">
            {showCategoryLabels && (
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {isOther ? (
                  <button
                    onClick={() => setIsOtherExpanded(false)}
                    className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                    <span>{getCategoryLabel(category)}</span>
                  </button>
                ) : (
                  <>
                    {getCategoryIcon(category)}
                    <span>{getCategoryLabel(category)}</span>
                  </>
                )}
              </div>
            )}
            <div className={cn('flex flex-wrap', sizeClasses[size])}>
              {categoryTags.map((tagId, index) => {
                const semanticTag = getSemanticTag(tagId);

                // Get localized label
                const label = getTagLabel(tagId, locale);

                return (
                  <div key={`${tagId}-${index}`} className="group relative">
                    <Badge
                      variant="secondary"
                      className={cn(
                        badgeSizeClasses[size],
                        getCategoryColor(category),
                        onTagClick && 'cursor-pointer hover:opacity-80 transition-opacity'
                      )}
                      onClick={onTagClick ? () => onTagClick(tagId) : undefined}
                    >
                      <span className="capitalize">{label}</span>
                    </Badge>

                    {/* Tooltip with description (only if descriptions enabled and tag has one) */}
                    {showDescriptions && semanticTag?.description && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                        {semanticTag.description}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-popover" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Compact tag list (single line with ellipsis)
 */
interface CompactTagListProps {
  tags: string[];
  maxVisible?: number;
  size?: 'sm' | 'md';
  onTagClick?: (tag: string) => void;
  className?: string;
}

export function CompactTagList({
  tags,
  maxVisible = 5,
  size = 'sm',
  onTagClick,
  className,
}: CompactTagListProps) {
  if (!tags || tags.length === 0) return null;

  // Normalize tags to ID format
  const normalizedTags = tags.map((tag) => normalizeTagToId(tag));
  const visibleTags = normalizedTags.slice(0, maxVisible);
  const remainingCount = normalizedTags.length - maxVisible;

  const badgeSizeClasses = {
    sm: 'py-0.5 px-1.5 text-xs',
    md: 'py-1 px-2 text-sm',
  };

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {visibleTags.map((tagId, index) => {
        const semanticTag = getSemanticTag(tagId);
        const category = semanticTag?.category || 'Other';

        // Get localized label
        const label = getTagLabel(tagId, 'en');

        return (
          <Badge
            key={`${tagId}-${index}`}
            variant="secondary"
            className={cn(
              badgeSizeClasses[size],
              getCategoryColor(category),
              onTagClick && 'cursor-pointer hover:opacity-80 transition-opacity'
            )}
            onClick={onTagClick ? () => onTagClick(tagId) : undefined}
          >
            <span className="capitalize">{label}</span>
          </Badge>
        );
      })}
      {remainingCount > 0 && (
        <Badge variant="outline" className={badgeSizeClasses[size]}>
          +{remainingCount} more
        </Badge>
      )}
    </div>
  );
}

/**
 * Tag pill with icon (for individual tag display)
 */
interface TagPillProps {
  tag: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  onClick?: () => void;
  className?: string;
}

export function TagPill({ tag, size = 'md', showIcon = true, onClick, className }: TagPillProps) {
  // Normalize tag to ID format
  const tagId = normalizeTagToId(tag);
  const semanticTag = getSemanticTag(tagId);
  const category = semanticTag?.category || 'Other';

  // Get localized label
  const label = getTagLabel(tagId, 'en');

  const sizeClasses = {
    sm: 'py-0.5 px-1.5 text-xs',
    md: 'py-1 px-2 text-sm',
    lg: 'py-1.5 px-3 text-base',
  };

  return (
    <Badge
      variant="secondary"
      className={cn(
        sizeClasses[size],
        getCategoryColor(category),
        onClick && 'cursor-pointer hover:opacity-80 transition-opacity',
        className
      )}
      onClick={onClick}
    >
      {showIcon && <span className="mr-1">{getCategoryIcon(category)}</span>}
      <span className="capitalize">{label}</span>
    </Badge>
  );
}
