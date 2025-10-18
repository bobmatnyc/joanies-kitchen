import { desc, eq } from 'drizzle-orm';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { getMealById } from '@/app/actions/meals';
import { MealDetailContent } from '@/components/meals/MealDetailContent';
import { Card } from '@/components/ui/card';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { shoppingLists } from '@/lib/db/schema';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function MealDetailPage({ params }: PageProps) {
  const resolvedParams = await params;
  const { userId } = await auth();

  // For authenticated users, fetch meal and shopping list from database
  let initialMeal: any = null;
  let initialShoppingList: any = null;

  if (userId) {
    const [mealResult, shoppingListResults] = await Promise.all([
      getMealById(resolvedParams.id),
      db
        .select()
        .from(shoppingLists)
        .where(eq(shoppingLists.meal_id, resolvedParams.id))
        .orderBy(desc(shoppingLists.created_at))
        .limit(1),
    ]);

    if (mealResult.success && mealResult.data) {
      initialMeal = mealResult.data;
    }

    if (shoppingListResults.length > 0) {
      initialShoppingList = shoppingListResults[0];
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Back button */}
      <Link
        href="/meals"
        className="inline-flex items-center gap-2 text-jk-olive hover:text-jk-clay mb-6 font-ui"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Meals
      </Link>

      <MealDetailContent
        mealId={resolvedParams.id}
        initialMeal={initialMeal}
        initialShoppingList={initialShoppingList}
      />
    </div>
  );
}

export async function generateMetadata({ params }: PageProps) {
  const resolvedParams = await params;
  const result = await getMealById(resolvedParams.id);

  if (!result.success || !result.data) {
    return {
      title: "Meal Not Found | Joanie's Kitchen",
    };
  }

  return {
    title: `${result.data.name} | Joanie's Kitchen`,
    description: result.data.description || 'View meal details and recipes',
  };
}
