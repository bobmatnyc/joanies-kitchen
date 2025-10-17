'use client';

import { ChefHat, Clock, Globe2, Leaf, Tag, Utensils, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TagFilterProps {
  availableTags: string[];
  selectedTags: string[];
  onTagToggle: (tag: string) => void;
  onClearAll: () => void;
  tagCounts?: Record<string, number>;
  showCounts?: boolean;
  className?: string;
}

// Tag categorization based on common recipe tag types
const getTagCategory = (tag: string): string => {
  const lowerTag = tag.toLowerCase();

  // Dietary restrictions
  if (
    [
      'vegetarian',
      'vegan',
      'gluten-free',
      'dairy-free',
      'keto',
      'paleo',
      'low-carb',
      'sugar-free',
      'nut-free',
    ].some((diet) => lowerTag.includes(diet))
  ) {
    return 'dietary';
  }

  // Meal types
  if (
    [
      'breakfast',
      'lunch',
      'dinner',
      'brunch',
      'dessert',
      'appetizer',
      'snack',
      'beverage',
      'cocktail',
    ].some((meal) => lowerTag.includes(meal))
  ) {
    return 'meal';
  }

  // Cooking time
  if (
    ['quick', 'fast', 'slow', '15-minute', '30-minute', 'overnight', 'instant'].some((time) =>
      lowerTag.includes(time)
    )
  ) {
    return 'time';
  }

  // Difficulty
  if (
    ['easy', 'simple', 'beginner', 'intermediate', 'advanced', 'expert'].some((diff) =>
      lowerTag.includes(diff)
    )
  ) {
    return 'difficulty';
  }

  // Cuisines
  if (
    [
      'italian',
      'mexican',
      'chinese',
      'japanese',
      'thai',
      'indian',
      'french',
      'greek',
      'spanish',
      'american',
      'mediterranean',
      'asian',
      'european',
      'african',
      'middle-eastern',
    ].some((cuisine) => lowerTag.includes(cuisine))
  ) {
    return 'cuisine';
  }

  return 'other';
};

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'dietary':
      return <Leaf className="w-3 h-3" />;
    case 'meal':
      return <Utensils className="w-3 h-3" />;
    case 'time':
      return <Clock className="w-3 h-3" />;
    case 'cuisine':
      return <Globe2 className="w-3 h-3" />;
    case 'difficulty':
      return <ChefHat className="w-3 h-3" />;
    default:
      return <Tag className="w-3 h-3" />;
  }
};

const getCategoryColor = (category: string, isSelected: boolean) => {
  if (isSelected) {
    switch (category) {
      case 'dietary':
        return 'bg-green-600 hover:bg-green-700 text-white border-green-700';
      case 'meal':
        return 'bg-blue-600 hover:bg-blue-700 text-white border-blue-700';
      case 'time':
        return 'bg-orange-600 hover:bg-orange-700 text-white border-orange-700';
      case 'cuisine':
        return 'bg-purple-600 hover:bg-purple-700 text-white border-purple-700';
      case 'difficulty':
        return 'bg-yellow-600 hover:bg-yellow-700 text-white border-yellow-700';
      default:
        return 'bg-gray-600 hover:bg-gray-700 text-white border-gray-700';
    }
  }

  switch (category) {
    case 'dietary':
      return 'bg-green-50 hover:bg-green-100 text-green-700 border-green-200';
    case 'meal':
      return 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200';
    case 'time':
      return 'bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200';
    case 'cuisine':
      return 'bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200';
    case 'difficulty':
      return 'bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border-yellow-200';
    default:
      return 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200';
  }
};

export function TagFilter({
  availableTags,
  selectedTags,
  onTagToggle,
  onClearAll,
  tagCounts,
  showCounts = true,
  className,
}: TagFilterProps) {
  // Group tags by category
  const categorizedTags = availableTags.reduce(
    (acc, tag) => {
      const category = getTagCategory(tag);
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(tag);
      return acc;
    },
    {} as Record<string, string[]>
  );

  // Define category order
  const categoryOrder = ['cuisine', 'meal', 'dietary', 'time', 'difficulty', 'other'];
  const sortedCategories = categoryOrder.filter((cat) => categorizedTags[cat]?.length > 0);

  const normalizedSelectedTags = selectedTags.map((t) => t.toLowerCase());

  return (
    <div className={cn('space-y-4', className)}>
      {selectedTags.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {selectedTags.length} filter{selectedTags.length !== 1 ? 's' : ''} applied
          </div>
          <Button variant="ghost" size="sm" onClick={onClearAll} className="h-8 px-2 text-xs">
            <X className="w-3 h-3 mr-1" />
            Clear all
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {sortedCategories.map((category) => {
          const categoryTags = categorizedTags[category];
          const categoryLabel = category.charAt(0).toUpperCase() + category.slice(1);

          return (
            <div key={category} className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {getCategoryIcon(category)}
                <span>{categoryLabel}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {categoryTags.map((tag) => {
                  const isSelected = normalizedSelectedTags.includes(tag.toLowerCase());
                  const count = tagCounts?.[tag.toLowerCase()] || 0;

                  return (
                    <Badge
                      key={tag}
                      variant="outline"
                      className={cn(
                        'cursor-pointer transition-all duration-200 border',
                        getCategoryColor(category, isSelected),
                        'hover:shadow-sm'
                      )}
                      onClick={() => onTagToggle(tag)}
                    >
                      <span className="capitalize">{tag}</span>
                      {showCounts && count > 0 && (
                        <span
                          className={cn('ml-1.5 text-xs', isSelected ? 'opacity-90' : 'opacity-60')}
                        >
                          ({count})
                        </span>
                      )}
                      {isSelected && <X className="w-3 h-3 ml-1.5 -mr-0.5" />}
                    </Badge>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
