'use client';

import { Clock, GripVertical, Users, X } from 'lucide-react';
import Image from 'next/image';
import { memo, useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { NewMealRecipe, Recipe } from '@/lib/db/schema';
import { parseRecipeImages } from '@/lib/meals/type-guards';
import { getPlaceholderImage } from '@/lib/utils/recipe-placeholders';

interface MealRecipeCardProps {
  mealRecipe: NewMealRecipe & { recipe: Recipe; id?: string };
  onRemove: (recipeId: string) => void;
  onUpdateMultiplier: (recipeId: string, multiplier: string) => void;
  onUpdateCourse: (recipeId: string, courseCategory: string) => void;
  courses: Array<{ value: string; label: string }>;
  showDragHandle?: boolean;
}

const COURSE_COLORS: Record<string, string> = {
  appetizer: 'bg-amber-100 text-amber-800 border-amber-300',
  main: 'bg-red-100 text-red-800 border-red-300',
  side: 'bg-green-100 text-green-800 border-green-300',
  salad: 'bg-lime-100 text-lime-800 border-lime-300',
  soup: 'bg-orange-100 text-orange-800 border-orange-300',
  bread: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  dessert: 'bg-pink-100 text-pink-800 border-pink-300',
  drink: 'bg-blue-100 text-blue-800 border-blue-300',
  other: 'bg-gray-100 text-gray-800 border-gray-300',
};

export const MealRecipeCard = memo(function MealRecipeCard({
  mealRecipe,
  onRemove,
  onUpdateMultiplier,
  onUpdateCourse,
  courses,
  showDragHandle = false,
}: MealRecipeCardProps) {
  const { recipe } = mealRecipe;
  const [multiplier, setMultiplier] = useState(mealRecipe.serving_multiplier || '1.00');

  const images = useMemo(() => parseRecipeImages(recipe.images), [recipe.images]);

  // Parse tags for placeholder selection
  const tags = useMemo(() => {
    try {
      return recipe.tags ? JSON.parse(recipe.tags as string) : [];
    } catch {
      return [];
    }
  }, [recipe.tags]);

  // Use themed placeholder if no image available
  const displayImage = images[0] || recipe.image_url || getPlaceholderImage(tags);
  const totalTime = (recipe.prep_time || 0) + (recipe.cook_time || 0);

  const _courseColor = COURSE_COLORS[mealRecipe.course_category || 'other'] || COURSE_COLORS.other;

  const handleMultiplierChange = useCallback(
    (value: string) => {
      setMultiplier(value);
      onUpdateMultiplier(recipe.id, value);
    },
    [recipe.id, onUpdateMultiplier]
  );

  const handleMultiplierBlur = useCallback(() => {
    // Ensure valid number
    const num = parseFloat(multiplier);
    if (Number.isNaN(num) || num <= 0) {
      setMultiplier('1.00');
      onUpdateMultiplier(recipe.id, '1.00');
    } else {
      const formatted = num.toFixed(2);
      setMultiplier(formatted);
      onUpdateMultiplier(recipe.id, formatted);
    }
  }, [multiplier, recipe.id, onUpdateMultiplier]);

  const adjustedServings = useMemo(
    () => (recipe.servings ? Math.round(recipe.servings * parseFloat(multiplier)) : null),
    [recipe.servings, multiplier]
  );

  const handleRemoveClick = useCallback(() => {
    onRemove(recipe.id);
  }, [recipe.id, onRemove]);

  const handleCourseChange = useCallback(
    (value: string) => {
      onUpdateCourse(recipe.id, value);
    },
    [recipe.id, onUpdateCourse]
  );

  return (
    <Card className="overflow-hidden border-jk-sage/50 hover:border-jk-sage transition-colors">
      <CardContent className="p-4">
        <div className="flex gap-3">
          {/* Drag handle (optional) */}
          {showDragHandle && (
            <div className="flex items-center cursor-grab active:cursor-grabbing touch-manipulation">
              <GripVertical className="w-5 h-5 text-jk-charcoal/30" />
            </div>
          )}

          {/* Recipe image - always show (placeholder if no image) */}
          <div className="relative w-20 h-20 rounded-jk overflow-hidden flex-shrink-0">
            <Image
              src={displayImage}
              alt={recipe.name}
              fill
              sizes="80px"
              className="object-cover"
              loading="lazy"
            />
          </div>

          {/* Recipe details */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Title and remove button */}
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-heading text-jk-olive text-base line-clamp-1 flex-1">
                {recipe.name}
              </h4>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemoveClick}
                className="h-8 w-8 p-0 text-jk-charcoal/50 hover:text-jk-tomato hover:bg-jk-tomato/10 min-h-[44px] min-w-[44px] touch-manipulation"
                aria-label="Remove recipe"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Course category */}
            <div className="space-y-2">
              <Label className="text-xs font-ui text-jk-charcoal/70">Course</Label>
              <Select
                value={mealRecipe.course_category || 'main'}
                onValueChange={handleCourseChange}
              >
                <SelectTrigger className="h-9 text-xs font-body">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((course) => (
                    <SelectItem
                      key={course.value}
                      value={course.value}
                      className="font-body text-xs"
                    >
                      {course.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Recipe stats */}
            <div className="flex flex-wrap gap-2 text-xs text-jk-charcoal/70">
              {totalTime > 0 && (
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-jk-clay" />
                  <span className="font-ui">{totalTime} min</span>
                </div>
              )}
              {adjustedServings && (
                <div className="flex items-center gap-1">
                  <Users className="w-3 h-3 text-jk-clay" />
                  <span className="font-ui">{adjustedServings} servings</span>
                </div>
              )}
            </div>

            {/* Serving multiplier */}
            <div className="space-y-1">
              <Label
                htmlFor={`multiplier-${recipe.id}`}
                className="text-xs font-ui text-jk-charcoal/70"
              >
                Serving Multiplier
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id={`multiplier-${recipe.id}`}
                  type="number"
                  step="0.25"
                  min="0.25"
                  max="10"
                  value={multiplier}
                  onChange={(e) => handleMultiplierChange(e.target.value)}
                  onBlur={handleMultiplierBlur}
                  className="h-9 w-20 text-sm font-body"
                />
                <span className="text-xs text-jk-charcoal/60 font-ui">
                  {multiplier === '1.00'
                    ? 'Standard'
                    : `${parseFloat(multiplier) > 1 ? 'More' : 'Less'} servings`}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
