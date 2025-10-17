'use client';

import { memo, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { NewMealRecipe, Recipe } from '@/lib/db/schema';
import { COURSE_CATEGORY_CONFIGS } from '@/lib/meals/type-guards';
import { MealRecipeCard } from './MealRecipeCard';

const COURSE_CATEGORIES = COURSE_CATEGORY_CONFIGS;

export interface MealRecipeWithDetails extends NewMealRecipe {
  recipe: Recipe;
  id?: string;
}

export interface SelectedRecipesListProps {
  selectedRecipes: MealRecipeWithDetails[];
  onRemove: (recipeId: string) => void;
  onUpdateMultiplier: (recipeId: string, multiplier: string) => void;
  onUpdateCourse: (recipeId: string, courseCategory: string) => void;
  searchDialogTrigger: React.ReactNode;
}

export const SelectedRecipesList = memo(function SelectedRecipesList({
  selectedRecipes,
  onRemove,
  onUpdateMultiplier,
  onUpdateCourse,
  searchDialogTrigger,
}: SelectedRecipesListProps) {
  // Group recipes by course
  const recipesByCourse = useMemo(() => {
    return selectedRecipes.reduce(
      (acc, mr) => {
        const course = mr.course_category || 'other';
        if (!acc[course]) {
          acc[course] = [];
        }
        acc[course].push(mr);
        return acc;
      },
      {} as Record<string, MealRecipeWithDetails[]>
    );
  }, [selectedRecipes]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="font-heading text-jk-olive text-2xl">
            Recipes ({selectedRecipes.length})
          </CardTitle>
          {searchDialogTrigger}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {COURSE_CATEGORIES.map((course) => {
            const courseRecipes = recipesByCourse[course.value] || [];
            if (courseRecipes.length === 0) return null;

            return (
              <div key={course.value} className="space-y-3">
                <h3 className="font-heading text-lg text-jk-olive border-b border-jk-sage/30 pb-2">
                  {course.label}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {courseRecipes.map((mealRecipe) => (
                    <MealRecipeCard
                      key={mealRecipe.recipe_id}
                      mealRecipe={mealRecipe}
                      onRemove={onRemove}
                      onUpdateMultiplier={onUpdateMultiplier}
                      onUpdateCourse={onUpdateCourse}
                      courses={COURSE_CATEGORIES}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
});
