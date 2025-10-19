import { Plus } from 'lucide-react';
import Link from 'next/link';
import { getPublicMeals } from '@/app/actions/meals';
import { MealsList } from '@/components/meals/MealsList';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface PageProps {
  searchParams: Promise<{ type?: string }>;
}

export default async function MealsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const mealType = params.type || 'all';

  // Fetch public meals (shared by users)
  let initialMeals: any[] = [];
  const result = await getPublicMeals(mealType !== 'all' ? { mealType: mealType as any } : undefined);
  if (result.success && result.data) {
    initialMeals = result.data;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-heading text-jk-olive mb-2">Browse Meals</h1>
          <p className="text-jk-charcoal/70 font-body">
            Discover complete meals shared by our community
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
      <MealsList initialMeals={initialMeals} mealType={mealType} isPublicView={true} />
    </div>
  );
}

export const metadata = {
  title: "Browse Meals | Joanie's Kitchen",
  description: 'Discover complete meals shared by our community',
};
