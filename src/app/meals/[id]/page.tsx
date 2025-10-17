import { desc, eq } from 'drizzle-orm';
import { ArrowLeft, Clock, DollarSign, Edit, ShoppingCart, Users, Utensils } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { generateShoppingList, getMealById } from '@/app/actions/meals';
import { ShoppingListView } from '@/components/meals/ShoppingListView';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { shoppingLists } from '@/lib/db/schema';

interface PageProps {
  params: Promise<{ id: string }>;
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

const COURSE_CATEGORIES = [
  'appetizer',
  'soup',
  'salad',
  'main',
  'side',
  'bread',
  'dessert',
  'drink',
  'other',
];

const COURSE_LABELS: Record<string, string> = {
  appetizer: 'Appetizers',
  soup: 'Soups',
  salad: 'Salads',
  main: 'Main Courses',
  side: 'Side Dishes',
  bread: 'Breads',
  dessert: 'Desserts',
  drink: 'Drinks',
  other: 'Other',
};

async function MealDetails({ mealId }: { mealId: string }) {
  const { userId } = await auth();
  if (!userId) {
    redirect('/sign-in');
  }

  // Parallel data fetching - meal data and shopping list are independent
  const [result, shoppingListResults] = await Promise.all([
    getMealById(mealId),
    db
      .select()
      .from(shoppingLists)
      .where(eq(shoppingLists.meal_id, mealId))
      .orderBy(desc(shoppingLists.created_at))
      .limit(1),
  ]);

  if (!result.success || !result.data) {
    notFound();
  }

  const meal = result.data;
  const [shoppingList] = shoppingListResults;
  const totalTime = (meal.total_prep_time || 0) + (meal.total_cook_time || 0);
  const mealTypeColor = MEAL_TYPE_COLORS[meal.meal_type || 'custom'] || MEAL_TYPE_COLORS.custom;

  // Group recipes by course
  const recipesByCourse = meal.recipes.reduce(
    (acc, { mealRecipe, recipe }) => {
      const course = mealRecipe.course_category || 'other';
      if (!acc[course]) {
        acc[course] = [];
      }
      acc[course].push({ mealRecipe, recipe });
      return acc;
    },
    {} as Record<string, any[]>
  );

  return (
    <div className="space-y-8">
      {/* Meal header */}
      <Card className="border-jk-sage">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl md:text-4xl font-heading text-jk-olive">{meal.name}</h1>
                {meal.meal_type && (
                  <Badge variant="outline" className={`${mealTypeColor} font-ui`}>
                    {meal.meal_type}
                  </Badge>
                )}
              </div>
              {meal.description && (
                <CardDescription className="font-body text-jk-charcoal/70 text-base">
                  {meal.description}
                </CardDescription>
              )}
              {meal.occasion && (
                <div className="flex items-center gap-2 mt-3">
                  <Utensils className="w-4 h-4 text-jk-clay" />
                  <span className="text-sm text-jk-clay font-ui">{meal.occasion}</span>
                </div>
              )}
            </div>
            <Link href={`/meals/${mealId}/edit`}>
              <Button
                variant="outline"
                className="min-h-[44px] touch-manipulation border-jk-sage text-jk-olive hover:bg-jk-sage/10 font-ui"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-jk-sage/30">
            {totalTime > 0 && (
              <div className="flex items-center gap-2 text-jk-charcoal/70">
                <Clock className="w-5 h-5 text-jk-clay" />
                <div>
                  <div className="text-sm font-ui text-jk-charcoal/60">Total Time</div>
                  <div className="font-semibold font-ui">{totalTime} min</div>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 text-jk-charcoal/70">
              <Users className="w-5 h-5 text-jk-clay" />
              <div>
                <div className="text-sm font-ui text-jk-charcoal/60">Serves</div>
                <div className="font-semibold font-ui">{meal.serves}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-jk-charcoal/70">
              <Utensils className="w-5 h-5 text-jk-clay" />
              <div>
                <div className="text-sm font-ui text-jk-charcoal/60">Recipes</div>
                <div className="font-semibold font-ui">{meal.recipes.length}</div>
              </div>
            </div>
            {meal.estimated_total_cost && (
              <div className="flex items-center gap-2 text-jk-charcoal/70">
                <DollarSign className="w-5 h-5 text-jk-clay" />
                <div>
                  <div className="text-sm font-ui text-jk-charcoal/60">Est. Cost</div>
                  <div className="font-semibold font-ui">
                    ${parseFloat(meal.estimated_total_cost).toFixed(2)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Recipes by course */}
      <div className="space-y-6">
        <h2 className="text-2xl font-heading text-jk-olive">Recipes</h2>

        {COURSE_CATEGORIES.map((course) => {
          const courseRecipes = recipesByCourse[course];
          if (!courseRecipes || courseRecipes.length === 0) return null;

          return (
            <Card key={course} className="border-jk-sage/50">
              <CardHeader>
                <CardTitle className="font-heading text-jk-olive text-xl">
                  {COURSE_LABELS[course]}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {courseRecipes.map(({ mealRecipe, recipe }) => {
                    const images = recipe.images ? JSON.parse(recipe.images as string) : [];
                    const displayImage = images[0] || recipe.image_url;
                    const totalTime = (recipe.prep_time || 0) + (recipe.cook_time || 0);
                    const multiplier = parseFloat(mealRecipe.serving_multiplier || '1');
                    const adjustedServings = recipe.servings
                      ? Math.round(recipe.servings * multiplier)
                      : null;

                    return (
                      <Link
                        key={recipe.id}
                        href={`/recipes/${recipe.slug || recipe.id}`}
                        className="group"
                      >
                        <Card className="overflow-hidden border-jk-sage/30 hover:border-jk-sage hover:shadow-md transition-all">
                          <CardContent className="p-4">
                            <div className="flex gap-3">
                              {displayImage && (
                                <div className="relative w-24 h-24 rounded-jk overflow-hidden flex-shrink-0">
                                  <Image
                                    src={displayImage}
                                    alt={recipe.name}
                                    fill
                                    sizes="96px"
                                    className="object-cover group-hover:scale-105 transition-transform"
                                  />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <h4 className="font-heading text-jk-olive text-lg line-clamp-2 group-hover:text-jk-clay transition-colors">
                                  {recipe.name}
                                </h4>
                                <div className="flex flex-wrap gap-3 mt-2 text-sm text-jk-charcoal/70">
                                  {totalTime > 0 && (
                                    <div className="flex items-center gap-1">
                                      <Clock className="w-3.5 h-3.5 text-jk-clay" />
                                      <span className="font-ui">{totalTime} min</span>
                                    </div>
                                  )}
                                  {adjustedServings && (
                                    <div className="flex items-center gap-1">
                                      <Users className="w-3.5 h-3.5 text-jk-clay" />
                                      <span className="font-ui">{adjustedServings} servings</span>
                                    </div>
                                  )}
                                </div>
                                {multiplier !== 1 && (
                                  <Badge
                                    variant="outline"
                                    className="mt-2 text-xs border-jk-sage text-jk-olive font-ui"
                                  >
                                    {multiplier}x servings
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Shopping list section */}
      <div id="shopping-list" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-heading text-jk-olive">Shopping List</h2>
          {!shoppingList && (
            <form
              action={async () => {
                'use server';
                await generateShoppingList({ mealId });
              }}
            >
              <Button
                type="submit"
                className="min-h-[44px] touch-manipulation bg-jk-tomato hover:bg-jk-tomato/90 text-white font-ui"
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                Generate Shopping List
              </Button>
            </form>
          )}
        </div>

        {shoppingList ? (
          <ShoppingListView shoppingList={shoppingList} />
        ) : (
          <Card className="border-dashed border-jk-sage/50">
            <CardContent className="text-center py-12">
              <ShoppingCart className="w-12 h-12 mx-auto mb-4 text-jk-sage" />
              <p className="text-jk-charcoal/60 font-body">
                No shopping list generated yet. Click "Generate Shopping List" to create one.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      <Card className="h-64 animate-pulse bg-jk-sage/5 border-jk-sage/30" />
      <Card className="h-96 animate-pulse bg-jk-sage/5 border-jk-sage/30" />
    </div>
  );
}

export default async function MealDetailPage({ params }: PageProps) {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const resolvedParams = await params;

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

      <Suspense fallback={<LoadingSkeleton />}>
        <MealDetails mealId={resolvedParams.id} />
      </Suspense>
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
