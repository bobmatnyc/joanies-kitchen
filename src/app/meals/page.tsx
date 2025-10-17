import { Plus, Utensils } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getUserMeals } from '@/app/actions/meals';
import { MealCard } from '@/components/meals/MealCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { auth } from '@/lib/auth';

interface PageProps {
  searchParams: Promise<{ type?: string }>;
}

async function MealsList({ mealType }: { mealType?: string }) {
  const result = await getUserMeals(mealType ? { mealType: mealType as any } : undefined);

  if (!result.success || !result.data) {
    return (
      <Card className="border-dashed border-jk-sage/50">
        <CardContent className="text-center py-12">
          <p className="text-jk-charcoal/60 font-body">Failed to load meals</p>
        </CardContent>
      </Card>
    );
  }

  const meals = result.data;

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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {meals.map((meal) => (
        <MealCard key={meal.id} meal={meal} />
      ))}
    </div>
  );
}

function MealsListSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[...Array(6)].map((_, i) => (
        <Card key={i} className="h-64 animate-pulse bg-jk-sage/5 border-jk-sage/30" />
      ))}
    </div>
  );
}

export default async function MealsPage({ searchParams }: PageProps) {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const params = await searchParams;
  const mealType = params.type || 'all';

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-heading text-jk-olive mb-2">My Meals</h1>
          <p className="text-jk-charcoal/70 font-body">
            Plan your meals and generate shopping lists
          </p>
        </div>
        <Link href="/meals/new">
          <Button className="bg-jk-tomato hover:bg-jk-tomato/90 text-white min-h-[44px] touch-manipulation font-ui">
            <Plus className="w-4 h-4 mr-2" />
            Create New Meal
          </Button>
        </Link>
      </div>

      {/* Filter */}
      <div className="mb-6">
        <form action="/meals" method="get">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <label htmlFor="typeFilter" className="font-ui text-jk-charcoal whitespace-nowrap">
              Filter by Type:
            </label>
            <Select name="type" defaultValue={mealType}>
              <SelectTrigger id="typeFilter" className="w-full sm:w-48 font-body">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="breakfast">Breakfast</SelectItem>
                <SelectItem value="brunch">Brunch</SelectItem>
                <SelectItem value="lunch">Lunch</SelectItem>
                <SelectItem value="dinner">Dinner</SelectItem>
                <SelectItem value="snack">Snack</SelectItem>
                <SelectItem value="dessert">Dessert</SelectItem>
                <SelectItem value="party">Party</SelectItem>
                <SelectItem value="holiday">Holiday</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </form>
      </div>

      {/* Meals list */}
      <Suspense fallback={<MealsListSkeleton />}>
        <MealsList mealType={mealType === 'all' ? undefined : mealType} />
      </Suspense>
    </div>
  );
}

export const metadata = {
  title: "My Meals | Joanie's Kitchen",
  description: 'Plan your meals and generate shopping lists',
};
