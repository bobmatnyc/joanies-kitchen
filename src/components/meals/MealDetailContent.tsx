'use client';

import { useAuth } from '@clerk/nextjs';
import { Clock, DollarSign, Edit, ShoppingCart, Users, Utensils } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { generateShoppingList } from '@/app/actions/meals';
import { getRecipes } from '@/app/actions/recipes';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { MealWithRecipes, Recipe, ShoppingList } from '@/lib/db/schema';
import {
  createGuestShoppingList,
  type GuestMealWithRecipes,
  type GuestShoppingList,
  getGuestMealById,
  getGuestShoppingLists,
} from '@/lib/utils/guest-meals';
import { parseIngredientString } from '@/lib/utils/ingredient-consolidation';
import { ShoppingListView } from './ShoppingListView';
import { GuestMealBanner } from './SignInToSaveDialog';

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

interface MealDetailContentProps {
  mealSlug: string;
  initialMeal?: MealWithRecipes | null;
  initialShoppingList?: ShoppingList | null;
}

export function MealDetailContent({
  mealSlug,
  initialMeal,
  initialShoppingList,
}: MealDetailContentProps) {
  const { userId } = useAuth();
  const [meal, setMeal] = useState<MealWithRecipes | GuestMealWithRecipes | null>(
    initialMeal || null
  );
  const [shoppingList, setShoppingList] = useState<ShoppingList | GuestShoppingList | null>(
    initialShoppingList || null
  );
  const [_recipes, setRecipes] = useState<Map<string, Recipe>>(new Map());
  const [isGeneratingList, setIsGeneratingList] = useState(false);

  // Extract meal ID for guest mode (slug might be guest ID)
  const mealId = meal?.id || mealSlug;

  // Load guest data if not authenticated
  useEffect(() => {
    async function loadGuestData() {
      if (!userId) {
        const guestMeal = getGuestMealById(mealSlug);
        if (guestMeal) {
          setMeal(guestMeal);

          // Load shopping lists for this meal
          const guestLists = getGuestShoppingLists();
          const mealList = guestLists.find((list) => list.meal_id === mealSlug);
          if (mealList) {
            setShoppingList(mealList);
          }

          // Fetch full recipe data
          const recipesResult = await getRecipes();
          if (recipesResult.success && recipesResult.data) {
            const recipeMap = new Map(recipesResult.data.map((r) => [r.id, r]));
            setRecipes(recipeMap);

            // Update meal with full recipe data
            const updatedMeal = {
              ...guestMeal,
              recipes: guestMeal.recipes.map((mr) => ({
                ...mr,
                recipe: recipeMap.get(mr.recipe_id),
              })),
            };
            setMeal(updatedMeal as any);
          }
        }
      }
    }

    loadGuestData();
  }, [userId, mealSlug]);

  if (!meal) {
    return (
      <Card className="border-jk-sage/50">
        <CardContent className="text-center py-12">
          <p className="text-jk-charcoal/60 font-body">Meal not found</p>
        </CardContent>
      </Card>
    );
  }

  const totalTime = (meal.total_prep_time || 0) + (meal.total_cook_time || 0);
  const mealTypeColor = MEAL_TYPE_COLORS[meal.meal_type || 'custom'] || MEAL_TYPE_COLORS.custom;

  // Group recipes by course
  const recipesByCourse = meal.recipes.reduce(
    (acc, item) => {
      // Handle both authenticated and guest meal recipe structures
      const mealRecipe = 'mealRecipe' in item ? item.mealRecipe : item;
      const recipe = 'recipe' in item ? item.recipe : null;
      const course = (mealRecipe as any).course_category || 'other';

      if (!acc[course]) {
        acc[course] = [];
      }
      acc[course].push({ mealRecipe, recipe });
      return acc;
    },
    {} as Record<string, any[]>
  );

  const handleGenerateShoppingList = async () => {
    if (!userId) {
      // Generate guest shopping list
      setIsGeneratingList(true);
      try {
        const items: any[] = [];

        for (const item of meal.recipes) {
          const mealRecipe = 'mealRecipe' in item ? item.mealRecipe : item;
          const recipe = 'recipe' in item ? item.recipe : null;
          if (!recipe) continue;

          const ingredients = JSON.parse(recipe.ingredients);
          const multiplier = parseFloat((mealRecipe as any).serving_multiplier || '1');

          for (const ingredientStr of ingredients) {
            const parsed = parseIngredientString(ingredientStr);
            if (parsed) {
              items.push({
                name: parsed.name,
                quantity: parsed.quantity * multiplier,
                unit: parsed.unit,
                category: 'other',
                checked: false,
                from_recipes: [recipe.id],
              });
            } else {
              items.push({
                name: ingredientStr,
                quantity: 0,
                unit: '',
                category: 'other',
                checked: false,
                from_recipes: [recipe.id],
              });
            }
          }
        }

        const newList = createGuestShoppingList({
          meal_id: mealId,
          name: `${meal.name} - Shopping List`,
          items: JSON.stringify(items),
          status: 'draft',
          notes: null,
          estimated_total_cost: null,
          estimated_cost_breakdown: null,
          completed_at: null,
        });

        setShoppingList(newList);
        toast.success('Shopping list generated!');
      } catch (error) {
        console.error('Failed to generate shopping list:', error);
        toast.error('Failed to generate shopping list');
      } finally {
        setIsGeneratingList(false);
      }
      return;
    }

    // For authenticated users, call the server action
    setIsGeneratingList(true);
    try {
      const result = await generateShoppingList({ mealId });

      if (result.success && result.data) {
        setShoppingList(result.data);
        toast.success('Shopping list generated!');
      } else {
        toast.error(result.error || 'Failed to generate shopping list');
      }
    } catch (error) {
      console.error('Failed to generate shopping list:', error);
      toast.error('Failed to generate shopping list');
    } finally {
      setIsGeneratingList(false);
    }
  };

  return (
    <div className="space-y-8">
      {!userId && <GuestMealBanner />}

      {/* Meal header with hero image */}
      <Card className="border-jk-sage overflow-hidden">
        {/* Hero image section */}
        {'image_url' in meal && meal.image_url && (
          <div className="relative h-64 md:h-80 w-full">
            <Image
              src={meal.image_url}
              alt={meal.name}
              fill
              sizes="(max-width: 768px) 100vw, 1200px"
              className="object-cover"
              priority
            />
            {/* Gradient overlay for text legibility */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-black/20" />

            {/* Meal title overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl md:text-4xl font-heading text-white drop-shadow-lg">
                  {meal.name}
                </h1>
                {meal.meal_type && (
                  <Badge variant="outline" className="bg-white/90 backdrop-blur-sm text-jk-olive border-white/50 font-ui">
                    {meal.meal_type}
                  </Badge>
                )}
              </div>
              {meal.description && (
                <p className="font-body text-white/90 text-base drop-shadow-md max-w-3xl">
                  {meal.description}
                </p>
              )}
              {meal.occasion && (
                <div className="flex items-center gap-2 mt-3">
                  <Utensils className="w-4 h-4 text-white/90" />
                  <span className="text-sm text-white/90 font-ui drop-shadow-md">{meal.occasion}</span>
                </div>
              )}
            </div>

            {/* Edit button overlay */}
            {userId && meal.slug && 'user_id' in meal && meal.user_id === userId && (
              <div className="absolute top-4 right-4">
                <Link href={`/meals/${meal.slug}/edit`}>
                  <Button
                    variant="outline"
                    className="min-h-[44px] touch-manipulation bg-white/90 backdrop-blur-sm border-white/50 text-jk-olive hover:bg-white font-ui"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Fallback header without image */}
        {(!('image_url' in meal) || !meal.image_url) && (
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
              {userId && meal.slug && 'user_id' in meal && meal.user_id === userId && (
                <Link href={`/meals/${meal.slug}/edit`}>
                  <Button
                    variant="outline"
                    className="min-h-[44px] touch-manipulation border-jk-sage text-jk-olive hover:bg-jk-sage/10 font-ui"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                </Link>
              )}
            </div>
          </CardHeader>
        )}

        {/* Stats section - always visible */}
        <CardHeader className="pt-0">
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
                    if (!recipe) return null;

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
            <Button
              onClick={handleGenerateShoppingList}
              disabled={isGeneratingList}
              className="min-h-[44px] touch-manipulation bg-jk-tomato hover:bg-jk-tomato/90 text-white font-ui"
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              {isGeneratingList ? 'Generating...' : 'Generate Shopping List'}
            </Button>
          )}
        </div>

        {shoppingList ? (
          <ShoppingListView shoppingList={shoppingList as any} />
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
