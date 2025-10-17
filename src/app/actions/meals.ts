'use server';

import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import {
  meals,
  mealRecipes,
  mealOccasions,
  recipes,
  type NewMeal,
  type NewMealRecipe,
} from '@/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { aggregateMealPlan, type MealRecipe as MealPlanRecipe } from '@/lib/meal-planning/aggregator';

/**
 * Create a new meal
 */
export async function createMeal(data: {
  name: string;
  occasion: string;
  servings: number;
  description?: string;
  isPublic?: boolean;
}) {
  try {
    const { userId } = await auth();

    const [meal] = await db
      .insert(meals)
      .values({
        user_id: userId || null,
        name: data.name,
        occasion: data.occasion,
        servings: data.servings,
        description: data.description,
        is_public: data.isPublic || false,
      })
      .returning();

    revalidatePath('/meals');

    return {
      success: true,
      data: meal,
    };
  } catch (error) {
    console.error('[createMeal] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create meal',
    };
  }
}

/**
 * Add recipe to meal
 */
export async function addRecipeToMeal(data: {
  mealId: string;
  recipeId: string;
  courseType: 'appetizer' | 'main' | 'side' | 'dessert';
  servingsOverride?: number;
  displayOrder?: number;
}) {
  try {
    const [mealRecipe] = await db
      .insert(mealRecipes)
      .values({
        meal_id: data.mealId,
        recipe_id: data.recipeId,
        course_type: data.courseType,
        servings_override: data.servingsOverride,
        display_order: data.displayOrder || 0,
      })
      .returning();

    // Recalculate meal aggregates
    await recalculateMealAggregates(data.mealId);

    revalidatePath(`/meals/${data.mealId}`);
    revalidatePath('/meals');

    return {
      success: true,
      data: mealRecipe,
    };
  } catch (error) {
    console.error('[addRecipeToMeal] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add recipe to meal',
    };
  }
}

/**
 * Remove recipe from meal
 */
export async function removeRecipeFromMeal(mealRecipeId: string) {
  try {
    const mealRecipe = await db
      .select()
      .from(mealRecipes)
      .where(eq(mealRecipes.id, mealRecipeId))
      .limit(1);

    if (mealRecipe.length === 0) {
      return { success: false, error: 'Recipe not found in meal' };
    }

    await db.delete(mealRecipes).where(eq(mealRecipes.id, mealRecipeId));

    // Recalculate meal aggregates
    await recalculateMealAggregates(mealRecipe[0].meal_id);

    revalidatePath(`/meals/${mealRecipe[0].meal_id}`);
    revalidatePath('/meals');

    return { success: true };
  } catch (error) {
    console.error('[removeRecipeFromMeal] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove recipe',
    };
  }
}

/**
 * Get meal by ID with all recipes
 */
export async function getMealById(mealId: string) {
  try {
    const [meal] = await db.select().from(meals).where(eq(meals.id, mealId)).limit(1);

    if (!meal) {
      return { success: false, error: 'Meal not found', data: null };
    }

    // Get all recipes for this meal
    const recipesData = await db
      .select({
        mealRecipe: mealRecipes,
        recipe: recipes,
      })
      .from(mealRecipes)
      .innerJoin(recipes, eq(mealRecipes.recipe_id, recipes.id))
      .where(eq(mealRecipes.meal_id, mealId))
      .orderBy(mealRecipes.course_type, mealRecipes.display_order);

    return {
      success: true,
      data: {
        ...meal,
        recipes: recipesData,
      },
    };
  } catch (error) {
    console.error('[getMealById] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get meal',
      data: null,
    };
  }
}

/**
 * Get user's meals
 */
export async function getUserMeals() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return { success: false, error: 'Authentication required', data: [] };
    }

    const userMeals = await db
      .select()
      .from(meals)
      .where(eq(meals.user_id, userId))
      .orderBy(desc(meals.created_at));

    return {
      success: true,
      data: userMeals,
    };
  } catch (error) {
    console.error('[getUserMeals] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get meals',
      data: [],
    };
  }
}

/**
 * Get all meal occasions
 */
export async function getMealOccasions() {
  try {
    const occasions = await db.select().from(mealOccasions).orderBy(mealOccasions.display_name);

    return {
      success: true,
      data: occasions,
    };
  } catch (error) {
    console.error('[getMealOccasions] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get occasions',
      data: [],
    };
  }
}

/**
 * Generate meal plan (shopping list, timeline, etc.)
 */
export async function generateMealPlan(mealId: string) {
  try {
    // Get meal with all recipes
    const mealResult = await getMealById(mealId);

    if (!mealResult.success || !mealResult.data) {
      return {
        success: false,
        error: 'Meal not found',
        data: null,
      };
    }

    const meal = mealResult.data;

    // Transform to aggregator format
    const mealRecipesData: MealPlanRecipe[] = meal.recipes.map((r) => ({
      recipe: r.recipe,
      courseType: r.mealRecipe.course_type as 'appetizer' | 'main' | 'side' | 'dessert',
      servings: r.mealRecipe.servings_override || r.recipe.servings || meal.servings,
    }));

    // Generate aggregated meal plan
    const mealPlan = await aggregateMealPlan(mealRecipesData);

    return {
      success: true,
      data: {
        meal,
        plan: mealPlan,
      },
    };
  } catch (error) {
    console.error('[generateMealPlan] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate meal plan',
      data: null,
    };
  }
}

/**
 * Delete meal
 */
export async function deleteMeal(mealId: string) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return { success: false, error: 'Authentication required' };
    }

    // Check ownership
    const [meal] = await db.select().from(meals).where(eq(meals.id, mealId)).limit(1);

    if (!meal) {
      return { success: false, error: 'Meal not found' };
    }

    if (meal.user_id !== userId) {
      return { success: false, error: 'Unauthorized' };
    }

    await db.delete(meals).where(eq(meals.id, mealId));

    revalidatePath('/meals');

    return { success: true };
  } catch (error) {
    console.error('[deleteMeal] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete meal',
    };
  }
}

/**
 * Recalculate meal aggregates (time, cost)
 */
async function recalculateMealAggregates(mealId: string) {
  try {
    const mealResult = await getMealById(mealId);

    if (!mealResult.success || !mealResult.data) {
      return;
    }

    const meal = mealResult.data;

    // Calculate totals from recipes
    let totalTime = 0;
    let activeTime = 0;

    for (const r of meal.recipes) {
      totalTime += (r.recipe.prep_time || 0) + (r.recipe.cook_time || 0);
      activeTime += r.recipe.prep_time || 0;
    }

    // Update meal
    await db
      .update(meals)
      .set({
        estimated_total_time: totalTime,
        estimated_active_time: activeTime,
        updated_at: new Date(),
      })
      .where(eq(meals.id, mealId));
  } catch (error) {
    console.error('[recalculateMealAggregates] Error:', error);
  }
}
