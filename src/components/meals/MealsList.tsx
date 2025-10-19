'use client';

import { Plus, Utensils } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import type { Meal } from '@/lib/db/schema';
import { getGuestMeals, type GuestMeal } from '@/lib/utils/guest-meals';
import { MealCard } from './MealCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { GuestMealBanner } from './SignInToSaveDialog';

interface MealsListProps {
  initialMeals?: Meal[];
  mealType?: string;
  isPublicView?: boolean;
}

export function MealsList({ initialMeals = [], mealType, isPublicView = false }: MealsListProps) {
  const { userId } = useAuth();
  const [meals, setMeals] = useState<(Meal | GuestMeal)[]>(initialMeals);
  const [isLoading, setIsLoading] = useState(false);

  // Load guest meals when not authenticated and not in public view
  useEffect(() => {
    if (!userId && !isPublicView) {
      const guestMeals = getGuestMeals();

      // Filter by meal type if specified
      const filteredMeals = mealType && mealType !== 'all'
        ? guestMeals.filter((meal) => meal.meal_type === mealType)
        : guestMeals;

      setMeals(filteredMeals);
      setIsLoading(false);
    } else {
      setMeals(initialMeals);
      setIsLoading(false);
    }
  }, [userId, initialMeals, mealType, isPublicView]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="h-64 animate-pulse bg-jk-sage/5 border-jk-sage/30" />
        ))}
      </div>
    );
  }

  if (meals.length === 0) {
    return (
      <Card className="border-dashed border-jk-sage/50">
        <CardContent className="text-center py-12">
          <Utensils className="w-16 h-16 mx-auto mb-4 text-jk-sage" />
          <h3 className="text-xl font-heading text-jk-olive mb-2">No meals yet</h3>
          <p className="text-jk-charcoal/60 font-body mb-6">
            Create your first meal to start planning!
          </p>
          <Link href="/meals/new">
            <Button className="bg-jk-tomato hover:bg-jk-tomato/90 text-white min-h-[44px] font-ui">
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Meal
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {!userId && <GuestMealBanner />}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {meals.map((meal) => (
          <MealCard key={meal.id} meal={meal as any} />
        ))}
      </div>
    </>
  );
}
