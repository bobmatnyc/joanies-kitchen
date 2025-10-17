'use client';

import { Clock, DollarSign, Eye, ShoppingCart, Users, Utensils } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { memo, useCallback, useState } from 'react';
import { toast } from 'sonner';
import { generateShoppingList } from '@/app/actions/meals';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Meal } from '@/lib/db/schema';

interface MealCardProps {
  meal: Meal & {
    recipeCount?: number;
  };
}

const MEAL_TYPE_COLORS: Record<string, string> = {
  breakfast: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  brunch: 'bg-orange-100 text-orange-800 border-orange-300',
  lunch: 'bg-blue-100 text-blue-800 border-blue-300',
  dinner: 'bg-purple-100 text-purple-800 border-purple-300',
  snack: 'bg-green-100 text-green-800 border-green-300',
  dessert: 'bg-pink-100 text-pink-800 border-pink-300',
  party: 'bg-red-100 text-red-800 border-red-300',
  holiday: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  custom: 'bg-gray-100 text-gray-800 border-gray-300',
};

export const MealCard = memo(function MealCard({ meal }: MealCardProps) {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);

  const totalTime = (meal.total_prep_time || 0) + (meal.total_cook_time || 0);
  const mealTypeColor = MEAL_TYPE_COLORS[meal.meal_type || 'custom'] || MEAL_TYPE_COLORS.custom;

  const handleGenerateShoppingList = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      setIsGenerating(true);
      const result = await generateShoppingList(meal.id);

      if (result.success) {
        toast.success('Shopping list generated!');
        router.push(`/meals/${meal.id}#shopping-list`);
      } else {
        toast.error(result.error || 'Failed to generate shopping list');
      }
      setIsGenerating(false);
    },
    [meal.id, router]
  );

  return (
    <Card className="h-full flex flex-col hover:shadow-xl md:hover:-translate-y-1 transition-all duration-200 border-jk-sage">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <CardTitle className="font-heading text-jk-olive text-xl line-clamp-2 flex-1">
            {meal.name}
          </CardTitle>
          {meal.meal_type && (
            <Badge
              variant="outline"
              className={`${mealTypeColor} font-ui text-xs whitespace-nowrap`}
            >
              {meal.meal_type}
            </Badge>
          )}
        </div>
        {meal.description && (
          <CardDescription className="font-body text-jk-charcoal/70 line-clamp-2">
            {meal.description}
          </CardDescription>
        )}
        {meal.occasion && (
          <div className="flex items-center gap-2 mt-2">
            <Utensils className="w-3.5 h-3.5 text-jk-clay" />
            <span className="text-sm text-jk-clay font-ui">{meal.occasion}</span>
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-grow space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          {totalTime > 0 && (
            <div className="flex items-center gap-2 text-sm text-jk-charcoal/70">
              <Clock className="w-4 h-4 text-jk-clay" />
              <span className="font-ui">{totalTime} min</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-jk-charcoal/70">
            <Users className="w-4 h-4 text-jk-clay" />
            <span className="font-ui">{meal.serves} servings</span>
          </div>
        </div>

        {/* Recipe count */}
        {meal.recipeCount !== undefined && (
          <div className="flex items-center gap-2 text-sm text-jk-charcoal/70">
            <Utensils className="w-4 h-4 text-jk-sage" />
            <span className="font-ui">
              {meal.recipeCount} {meal.recipeCount === 1 ? 'recipe' : 'recipes'}
            </span>
          </div>
        )}

        {/* Cost estimation */}
        {meal.estimated_total_cost && (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-jk-charcoal/70">
              <DollarSign className="w-4 h-4 text-jk-clay" />
              <span className="font-ui font-semibold">
                ${parseFloat(meal.estimated_total_cost).toFixed(2)} total
              </span>
            </div>
            {meal.estimated_cost_per_serving && (
              <div className="text-xs text-jk-charcoal/60 ml-6 font-ui">
                ${parseFloat(meal.estimated_cost_per_serving).toFixed(2)} per serving
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <Link href={`/meals/${meal.id}`} className="flex-1">
            <Button
              variant="outline"
              className="w-full min-h-[44px] touch-manipulation border-jk-sage text-jk-olive hover:bg-jk-sage/10 font-ui"
            >
              <Eye className="w-4 h-4 mr-2" />
              View Details
            </Button>
          </Link>
          <Button
            variant="outline"
            onClick={handleGenerateShoppingList}
            disabled={isGenerating}
            className="min-h-[44px] touch-manipulation border-jk-tomato text-jk-tomato hover:bg-jk-tomato/10 font-ui"
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            {isGenerating ? 'Generating...' : 'Shop'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});
