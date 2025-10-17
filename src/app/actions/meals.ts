'use server';

import { and, desc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  mealRecipes,
  meals,
  mealTemplates,
  recipes,
  type ShoppingListItem,
  shoppingLists,
} from '@/lib/db/schema';
import {
  addRecipeToMealSchema,
  createMealFromTemplateSchema,
  createMealSchema,
  generateShoppingListSchema,
  getMealTemplatesSchema,
  getUserMealsSchema,
  mealIdSchema,
  mealRecipeIdSchema,
  shoppingListIdSchema,
  updateMealRecipeSchema,
  updateMealSchema,
  updateShoppingListSchema,
  validateInput,
} from '@/lib/meals/validation';

/**
 * Create a new meal
 *
 * @param data - Meal creation data (validated against createMealSchema)
 * @returns Success response with created meal or error message
 */
export async function createMeal(data: unknown) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'Unauthorized' };
    }

    // Validate input with Zod schema
    const validatedData = validateInput(createMealSchema, data);

    const [newMeal] = await db
      .insert(meals)
      .values({
        ...validatedData,
        user_id: userId,
      })
      .returning();

    revalidatePath('/meals');
    return { success: true, data: newMeal };
  } catch (error) {
    console.error('Failed to create meal:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create meal';
    return { success: false, error: errorMessage };
  }
}

/**
 * Update an existing meal
 *
 * @param id - Meal ID (validated as UUID)
 * @param updates - Partial meal updates (validated against updateMealSchema)
 * @returns Success response with updated meal or error message
 */
export async function updateMeal(id: unknown, updates: unknown) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'Unauthorized' };
    }

    // Validate ID
    const { id: validatedId } = validateInput(mealIdSchema, { id });

    // Validate updates
    const validatedUpdates = validateInput(updateMealSchema, updates);

    const [updatedMeal] = await db
      .update(meals)
      .set({
        ...validatedUpdates,
        updated_at: new Date(),
      })
      .where(and(eq(meals.id, validatedId), eq(meals.user_id, userId)))
      .returning();

    if (!updatedMeal) {
      return { success: false, error: 'Meal not found' };
    }

    revalidatePath('/meals');
    revalidatePath(`/meals/${validatedId}`);
    return { success: true, data: updatedMeal };
  } catch (error) {
    console.error('Failed to update meal:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update meal';
    return { success: false, error: errorMessage };
  }
}

/**
 * Delete a meal
 *
 * @param id - Meal ID (validated as UUID)
 * @returns Success response or error message
 */
export async function deleteMeal(id: unknown) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'Unauthorized' };
    }

    // Validate ID
    const { id: validatedId } = validateInput(mealIdSchema, { id });

    await db.delete(meals).where(and(eq(meals.id, validatedId), eq(meals.user_id, userId)));

    revalidatePath('/meals');
    return { success: true };
  } catch (error) {
    console.error('Failed to delete meal:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete meal';
    return { success: false, error: errorMessage };
  }
}

/**
 * Get all meals for the current user
 *
 * @param params - Query parameters (mealType filter, validated)
 * @returns Success response with meals array or error message
 */
export async function getUserMeals(params?: unknown) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'Unauthorized' };
    }

    // Validate query parameters (optional)
    const validatedParams = params
      ? validateInput(getUserMealsSchema, params)
      : { mealType: 'all' as const };

    const conditions = [eq(meals.user_id, userId)];
    if (validatedParams.mealType && validatedParams.mealType !== 'all') {
      conditions.push(eq(meals.meal_type, validatedParams.mealType));
    }

    const userMeals = await db
      .select()
      .from(meals)
      .where(and(...conditions))
      .orderBy(desc(meals.created_at));

    return { success: true, data: userMeals };
  } catch (error) {
    console.error('Failed to fetch meals:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch meals';
    return { success: false, error: errorMessage };
  }
}

/**
 * Get a single meal with all its recipes
 *
 * @param id - Meal ID (validated as UUID)
 * @returns Success response with meal and recipes or error message
 */
export async function getMealById(id: unknown) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'Unauthorized' };
    }

    // Validate ID
    const { id: validatedId } = validateInput(mealIdSchema, { id });

    const [meal] = await db
      .select()
      .from(meals)
      .where(and(eq(meals.id, validatedId), eq(meals.user_id, userId)));

    if (!meal) {
      return { success: false, error: 'Meal not found' };
    }

    // Get all recipes for this meal
    const mealRecipesList = await db
      .select({
        mealRecipe: mealRecipes,
        recipe: recipes,
      })
      .from(mealRecipes)
      .innerJoin(recipes, eq(mealRecipes.recipe_id, recipes.id))
      .where(eq(mealRecipes.meal_id, validatedId))
      .orderBy(mealRecipes.display_order);

    const mealWithRecipes = {
      ...meal,
      recipes: mealRecipesList,
    };

    return { success: true, data: mealWithRecipes };
  } catch (error) {
    console.error('Failed to fetch meal:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch meal';
    return { success: false, error: errorMessage };
  }
}

/**
 * Add a recipe to a meal
 *
 * @param data - Meal recipe relationship data (validated against addRecipeToMealSchema)
 * @returns Success response with created relationship or error message
 */
export async function addRecipeToMeal(data: unknown) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'Unauthorized' };
    }

    // Validate input
    const validatedData = validateInput(addRecipeToMealSchema, data);

    // Verify the meal belongs to the user
    const [meal] = await db
      .select()
      .from(meals)
      .where(and(eq(meals.id, validatedData.meal_id), eq(meals.user_id, userId)));

    if (!meal) {
      return { success: false, error: 'Meal not found' };
    }

    const [newMealRecipe] = await db.insert(mealRecipes).values(validatedData).returning();

    // Update meal times
    await updateMealTimes(validatedData.meal_id);

    revalidatePath('/meals');
    revalidatePath(`/meals/${validatedData.meal_id}`);
    return { success: true, data: newMealRecipe };
  } catch (error) {
    console.error('Failed to add recipe to meal:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to add recipe to meal';
    return { success: false, error: errorMessage };
  }
}

/**
 * Remove a recipe from a meal
 *
 * @param id - Meal recipe relationship ID (validated as UUID)
 * @returns Success response or error message
 */
export async function removeRecipeFromMeal(id: unknown) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'Unauthorized' };
    }

    // Validate ID
    const { id: validatedId } = validateInput(mealRecipeIdSchema, { id });

    // Get the meal_id before deleting
    const [mealRecipe] = await db.select().from(mealRecipes).where(eq(mealRecipes.id, validatedId));

    if (!mealRecipe) {
      return { success: false, error: 'Recipe not found in meal' };
    }

    await db.delete(mealRecipes).where(eq(mealRecipes.id, validatedId));

    // Update meal times
    await updateMealTimes(mealRecipe.meal_id);

    revalidatePath('/meals');
    revalidatePath(`/meals/${mealRecipe.meal_id}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to remove recipe from meal:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to remove recipe from meal';
    return { success: false, error: errorMessage };
  }
}

/**
 * Update meal recipe (serving multiplier, display order, etc.)
 *
 * @param id - Meal recipe relationship ID (validated as UUID)
 * @param updates - Partial updates (validated against updateMealRecipeSchema)
 * @returns Success response with updated relationship or error message
 */
export async function updateMealRecipe(id: unknown, updates: unknown) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'Unauthorized' };
    }

    // Validate ID
    const { id: validatedId } = validateInput(mealRecipeIdSchema, { id });

    // Validate updates
    const validatedUpdates = validateInput(updateMealRecipeSchema, updates);

    const [updatedMealRecipe] = await db
      .update(mealRecipes)
      .set(validatedUpdates)
      .where(eq(mealRecipes.id, validatedId))
      .returning();

    if (!updatedMealRecipe) {
      return { success: false, error: 'Meal recipe not found' };
    }

    revalidatePath('/meals');
    revalidatePath(`/meals/${updatedMealRecipe.meal_id}`);
    return { success: true, data: updatedMealRecipe };
  } catch (error) {
    console.error('Failed to update meal recipe:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update meal recipe';
    return { success: false, error: errorMessage };
  }
}

/**
 * Generate a shopping list from a meal
 *
 * @param data - Object with mealId (validated as UUID)
 * @returns Success response with generated shopping list or error message
 */
export async function generateShoppingList(data: unknown) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'Unauthorized' };
    }

    // Validate input
    const { mealId } = validateInput(generateShoppingListSchema, data);

    // Get the meal with all recipes
    const mealResult = await getMealById(mealId);
    if (!mealResult.success || !mealResult.data) {
      return { success: false, error: 'Meal not found' };
    }

    const meal = mealResult.data;

    // Consolidate ingredients from all recipes
    const consolidatedItems: Map<string, ShoppingListItem> = new Map();

    for (const { mealRecipe, recipe } of meal.recipes) {
      const ingredients = JSON.parse(recipe.ingredients);
      const multiplier = parseFloat(mealRecipe.serving_multiplier || '1');

      for (const ingredient of ingredients) {
        // Parse ingredient string (format: "quantity unit name")
        const match = ingredient.match(/^(\d+\.?\d*)\s*([a-zA-Z]*)\s+(.+)$/);
        if (!match) {
          // If no quantity, just add as-is
          const key = ingredient.toLowerCase();
          if (consolidatedItems.has(key)) {
            const item = consolidatedItems.get(key)!;
            item.from_recipes.push(recipe.id);
          } else {
            consolidatedItems.set(key, {
              name: ingredient,
              quantity: 0,
              unit: '',
              category: 'other',
              checked: false,
              from_recipes: [recipe.id],
            });
          }
          continue;
        }

        const [, qty, unit, name] = match;
        const quantity = parseFloat(qty) * multiplier;
        const key = `${name.toLowerCase()}-${unit.toLowerCase()}`;

        if (consolidatedItems.has(key)) {
          const item = consolidatedItems.get(key)!;
          item.quantity += quantity;
          if (!item.from_recipes.includes(recipe.id)) {
            item.from_recipes.push(recipe.id);
          }
        } else {
          consolidatedItems.set(key, {
            name,
            quantity,
            unit,
            category: categorizeIngredient(name),
            checked: false,
            from_recipes: [recipe.id],
          });
        }
      }
    }

    // Create shopping list
    const [newShoppingList] = await db
      .insert(shoppingLists)
      .values({
        user_id: userId,
        meal_id: mealId,
        name: `${meal.name} - Shopping List`,
        items: JSON.stringify(Array.from(consolidatedItems.values())),
        status: 'draft',
      })
      .returning();

    revalidatePath('/meals');
    revalidatePath(`/meals/${mealId}`);
    return { success: true, data: newShoppingList };
  } catch (error) {
    console.error('Failed to generate shopping list:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to generate shopping list';
    return { success: false, error: errorMessage };
  }
}

/**
 * Get shopping list by ID
 *
 * @param id - Shopping list ID (validated as UUID)
 * @returns Success response with shopping list or error message
 */
export async function getShoppingListById(id: unknown) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'Unauthorized' };
    }

    // Validate ID
    const { id: validatedId } = validateInput(shoppingListIdSchema, { id });

    const [shoppingList] = await db
      .select()
      .from(shoppingLists)
      .where(and(eq(shoppingLists.id, validatedId), eq(shoppingLists.user_id, userId)));

    if (!shoppingList) {
      return { success: false, error: 'Shopping list not found' };
    }

    return { success: true, data: shoppingList };
  } catch (error) {
    console.error('Failed to fetch shopping list:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch shopping list';
    return { success: false, error: errorMessage };
  }
}

/**
 * Update shopping list items
 *
 * @param id - Shopping list ID (validated as UUID)
 * @param updates - Partial shopping list updates (validated against updateShoppingListSchema)
 * @returns Success response with updated shopping list or error message
 */
export async function updateShoppingList(id: unknown, updates: unknown) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'Unauthorized' };
    }

    // Validate ID
    const { id: validatedId } = validateInput(shoppingListIdSchema, { id });

    // Validate updates
    const validatedUpdates = validateInput(updateShoppingListSchema, updates);

    const [updatedList] = await db
      .update(shoppingLists)
      .set({
        ...validatedUpdates,
        updated_at: new Date(),
      })
      .where(and(eq(shoppingLists.id, validatedId), eq(shoppingLists.user_id, userId)))
      .returning();

    if (!updatedList) {
      return { success: false, error: 'Shopping list not found' };
    }

    revalidatePath('/meals');
    return { success: true, data: updatedList };
  } catch (error) {
    console.error('Failed to update shopping list:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update shopping list';
    return { success: false, error: errorMessage };
  }
}

/**
 * Get meal templates
 *
 * @param params - Query parameters (mealType filter, validated)
 * @returns Success response with templates array or error message
 */
export async function getMealTemplates(params?: unknown) {
  try {
    // Validate query parameters (optional)
    const validatedParams = params
      ? validateInput(getMealTemplatesSchema, params)
      : { mealType: 'all' as const };

    const conditions = [];
    if (validatedParams.mealType && validatedParams.mealType !== 'all') {
      conditions.push(eq(mealTemplates.meal_type, validatedParams.mealType));
    }

    const templates = await db
      .select()
      .from(mealTemplates)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(mealTemplates.times_used));

    return { success: true, data: templates };
  } catch (error) {
    console.error('Failed to fetch meal templates:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch meal templates';
    return { success: false, error: errorMessage };
  }
}

/**
 * Create a meal from a template
 *
 * @param data - Object with templateId and mealName (validated)
 * @returns Success response with created meal or error message
 */
export async function createMealFromTemplate(data: unknown) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'Unauthorized' };
    }

    // Validate input
    const { templateId, mealName } = validateInput(createMealFromTemplateSchema, data);

    const [template] = await db
      .select()
      .from(mealTemplates)
      .where(eq(mealTemplates.id, templateId));

    if (!template) {
      return { success: false, error: 'Template not found' };
    }

    // Create the meal
    const [newMeal] = await db
      .insert(meals)
      .values({
        user_id: userId,
        name: mealName || template.name,
        description: template.description,
        meal_type: template.meal_type,
        serves: template.default_serves,
      })
      .returning();

    // Increment template usage
    await db
      .update(mealTemplates)
      .set({
        times_used: (template.times_used || 0) + 1,
      })
      .where(eq(mealTemplates.id, templateId));

    revalidatePath('/meals');
    return { success: true, data: newMeal };
  } catch (error) {
    console.error('Failed to create meal from template:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to create meal from template';
    return { success: false, error: errorMessage };
  }
}

// Helper functions

/**
 * Update meal's total prep and cook times based on recipes
 */
async function updateMealTimes(mealId: string) {
  const mealRecipesList = await db
    .select({
      recipe: recipes,
    })
    .from(mealRecipes)
    .innerJoin(recipes, eq(mealRecipes.recipe_id, recipes.id))
    .where(eq(mealRecipes.meal_id, mealId));

  const totalPrepTime = mealRecipesList.reduce(
    (sum, { recipe }) => sum + (recipe.prep_time || 0),
    0
  );
  const totalCookTime = mealRecipesList.reduce(
    (sum, { recipe }) => sum + (recipe.cook_time || 0),
    0
  );

  await db
    .update(meals)
    .set({
      total_prep_time: totalPrepTime,
      total_cook_time: totalCookTime,
      updated_at: new Date(),
    })
    .where(eq(meals.id, mealId));
}

/**
 * Categorize ingredient for shopping list
 */
function categorizeIngredient(ingredientName: string): string {
  const name = ingredientName.toLowerCase();

  // Proteins
  if (
    name.includes('chicken') ||
    name.includes('beef') ||
    name.includes('pork') ||
    name.includes('fish') ||
    name.includes('turkey') ||
    name.includes('lamb') ||
    name.includes('egg')
  ) {
    return 'proteins';
  }

  // Dairy
  if (
    name.includes('milk') ||
    name.includes('cheese') ||
    name.includes('butter') ||
    name.includes('cream') ||
    name.includes('yogurt')
  ) {
    return 'dairy';
  }

  // Vegetables
  if (
    name.includes('tomato') ||
    name.includes('onion') ||
    name.includes('garlic') ||
    name.includes('pepper') ||
    name.includes('carrot') ||
    name.includes('lettuce') ||
    name.includes('spinach') ||
    name.includes('broccoli') ||
    name.includes('celery')
  ) {
    return 'vegetables';
  }

  // Fruits
  if (
    name.includes('apple') ||
    name.includes('banana') ||
    name.includes('orange') ||
    name.includes('lemon') ||
    name.includes('lime') ||
    name.includes('berry')
  ) {
    return 'fruits';
  }

  // Grains
  if (
    name.includes('flour') ||
    name.includes('rice') ||
    name.includes('pasta') ||
    name.includes('bread') ||
    name.includes('oat')
  ) {
    return 'grains';
  }

  // Spices
  if (
    name.includes('salt') ||
    name.includes('pepper') ||
    name.includes('spice') ||
    name.includes('herb') ||
    name.includes('oregano') ||
    name.includes('basil') ||
    name.includes('thyme')
  ) {
    return 'spices';
  }

  // Condiments
  if (
    name.includes('oil') ||
    name.includes('vinegar') ||
    name.includes('sauce') ||
    name.includes('ketchup') ||
    name.includes('mustard')
  ) {
    return 'condiments';
  }

  return 'other';
}
