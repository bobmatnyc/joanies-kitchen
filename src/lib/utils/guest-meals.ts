/**
 * Guest Meal Planning Utilities
 *
 * Provides localStorage-based meal planning for unauthenticated users.
 * Data is stored client-side and can be migrated to database after authentication.
 */

import type { Meal, MealRecipe, ShoppingList } from '@/lib/db/schema';

// localStorage keys
const GUEST_MEALS_KEY = 'guest_meals';
const GUEST_MEAL_RECIPES_KEY = 'guest_meal_recipes';
const GUEST_SHOPPING_LISTS_KEY = 'guest_shopping_lists';

// Guest data types (matches DB schema but with client-side IDs)
export type GuestMeal = Omit<Meal, 'user_id' | 'created_at' | 'updated_at' | 'slug'> & {
  id: string;
  created_at: string;
  updated_at: string;
  slug?: string | null; // Optional slug for guest meals
};

export type GuestMealRecipe = Omit<MealRecipe, 'created_at'> & {
  created_at: string;
};

export type GuestShoppingList = Omit<ShoppingList, 'user_id' | 'created_at' | 'updated_at'> & {
  id: string;
  created_at: string;
  updated_at: string;
};

export type GuestMealWithRecipes = GuestMeal & {
  recipes: (GuestMealRecipe & { recipe: any })[];
};

/**
 * Safely access localStorage (handles Safari private mode, SSR)
 */
function getLocalStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    const test = '__localStorage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return localStorage;
  } catch {
    return null;
  }
}

/**
 * Generate a client-side UUID
 */
function generateId(): string {
  return `guest_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get all guest meals from localStorage
 */
export function getGuestMeals(): GuestMeal[] {
  const storage = getLocalStorage();
  if (!storage) return [];

  try {
    const data = storage.getItem(GUEST_MEALS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to load guest meals:', error);
    return [];
  }
}

/**
 * Get guest meal recipes from localStorage
 */
export function getGuestMealRecipes(): GuestMealRecipe[] {
  const storage = getLocalStorage();
  if (!storage) return [];

  try {
    const data = storage.getItem(GUEST_MEAL_RECIPES_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to load guest meal recipes:', error);
    return [];
  }
}

/**
 * Get a single guest meal with its recipes
 */
export function getGuestMealById(id: string): GuestMealWithRecipes | null {
  const meals = getGuestMeals();
  const meal = meals.find((m) => m.id === id);
  if (!meal) return null;

  const allMealRecipes = getGuestMealRecipes();
  const mealRecipesList = allMealRecipes.filter((mr) => mr.meal_id === id);

  // Note: In guest mode, we don't have full recipe data joined
  // The UI will need to fetch recipes separately
  return {
    ...meal,
    recipes: mealRecipesList.map((mr) => ({
      ...mr,
      recipe: null as any, // Will be populated by UI
    })),
  };
}

/**
 * Create a new guest meal
 */
export function createGuestMeal(
  mealData: Omit<GuestMeal, 'id' | 'created_at' | 'updated_at'>
): GuestMeal {
  const storage = getLocalStorage();
  if (!storage) throw new Error('localStorage not available');

  const meals = getGuestMeals();
  const now = new Date().toISOString();

  const newMeal: GuestMeal = {
    ...mealData,
    id: generateId(),
    created_at: now,
    updated_at: now,
  };

  meals.push(newMeal);
  storage.setItem(GUEST_MEALS_KEY, JSON.stringify(meals));

  return newMeal;
}

/**
 * Update a guest meal
 */
export function updateGuestMeal(id: string, updates: Partial<GuestMeal>): GuestMeal | null {
  const storage = getLocalStorage();
  if (!storage) throw new Error('localStorage not available');

  const meals = getGuestMeals();
  const index = meals.findIndex((m) => m.id === id);

  if (index === -1) return null;

  const updatedMeal = {
    ...meals[index],
    ...updates,
    id, // Ensure ID doesn't change
    updated_at: new Date().toISOString(),
  };

  meals[index] = updatedMeal;
  storage.setItem(GUEST_MEALS_KEY, JSON.stringify(meals));

  return updatedMeal;
}

/**
 * Delete a guest meal and its associated recipes
 */
export function deleteGuestMeal(id: string): boolean {
  const storage = getLocalStorage();
  if (!storage) throw new Error('localStorage not available');

  const meals = getGuestMeals();
  const filteredMeals = meals.filter((m) => m.id !== id);

  if (filteredMeals.length === meals.length) return false;

  // Also delete associated meal recipes
  const mealRecipes = getGuestMealRecipes();
  const filteredMealRecipes = mealRecipes.filter((mr) => mr.meal_id !== id);

  storage.setItem(GUEST_MEALS_KEY, JSON.stringify(filteredMeals));
  storage.setItem(GUEST_MEAL_RECIPES_KEY, JSON.stringify(filteredMealRecipes));

  return true;
}

/**
 * Add a recipe to a guest meal
 */
export function addRecipeToGuestMeal(
  mealRecipeData: Omit<GuestMealRecipe, 'id' | 'created_at'>
): GuestMealRecipe {
  const storage = getLocalStorage();
  if (!storage) throw new Error('localStorage not available');

  const mealRecipes = getGuestMealRecipes();

  // Check for duplicates
  const exists = mealRecipes.some(
    (mr) => mr.meal_id === mealRecipeData.meal_id && mr.recipe_id === mealRecipeData.recipe_id
  );

  if (exists) {
    throw new Error('Recipe already added to this meal');
  }

  const newMealRecipe: GuestMealRecipe = {
    ...mealRecipeData,
    id: generateId(),
    created_at: new Date().toISOString(),
  };

  mealRecipes.push(newMealRecipe);
  storage.setItem(GUEST_MEAL_RECIPES_KEY, JSON.stringify(mealRecipes));

  return newMealRecipe;
}

/**
 * Remove a recipe from a guest meal
 */
export function removeRecipeFromGuestMeal(mealRecipeId: string): boolean {
  const storage = getLocalStorage();
  if (!storage) throw new Error('localStorage not available');

  const mealRecipes = getGuestMealRecipes();
  const filteredMealRecipes = mealRecipes.filter((mr) => mr.id !== mealRecipeId);

  if (filteredMealRecipes.length === mealRecipes.length) return false;

  storage.setItem(GUEST_MEAL_RECIPES_KEY, JSON.stringify(filteredMealRecipes));
  return true;
}

/**
 * Update a guest meal recipe (serving multiplier, etc.)
 */
export function updateGuestMealRecipe(
  id: string,
  updates: Partial<GuestMealRecipe>
): GuestMealRecipe | null {
  const storage = getLocalStorage();
  if (!storage) throw new Error('localStorage not available');

  const mealRecipes = getGuestMealRecipes();
  const index = mealRecipes.findIndex((mr) => mr.id === id);

  if (index === -1) return null;

  const updatedMealRecipe = {
    ...mealRecipes[index],
    ...updates,
    id, // Ensure ID doesn't change
  };

  mealRecipes[index] = updatedMealRecipe;
  storage.setItem(GUEST_MEAL_RECIPES_KEY, JSON.stringify(mealRecipes));

  return updatedMealRecipe;
}

/**
 * Get all guest shopping lists
 */
export function getGuestShoppingLists(): GuestShoppingList[] {
  const storage = getLocalStorage();
  if (!storage) return [];

  try {
    const data = storage.getItem(GUEST_SHOPPING_LISTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to load guest shopping lists:', error);
    return [];
  }
}

/**
 * Get a single guest shopping list by ID
 */
export function getGuestShoppingListById(id: string): GuestShoppingList | null {
  const lists = getGuestShoppingLists();
  return lists.find((list) => list.id === id) || null;
}

/**
 * Create a guest shopping list
 */
export function createGuestShoppingList(
  listData: Omit<GuestShoppingList, 'id' | 'created_at' | 'updated_at'>
): GuestShoppingList {
  const storage = getLocalStorage();
  if (!storage) throw new Error('localStorage not available');

  const lists = getGuestShoppingLists();
  const now = new Date().toISOString();

  const newList: GuestShoppingList = {
    ...listData,
    id: generateId(),
    created_at: now,
    updated_at: now,
  };

  lists.push(newList);
  storage.setItem(GUEST_SHOPPING_LISTS_KEY, JSON.stringify(lists));

  return newList;
}

/**
 * Update a guest shopping list
 */
export function updateGuestShoppingList(
  id: string,
  updates: Partial<GuestShoppingList>
): GuestShoppingList | null {
  const storage = getLocalStorage();
  if (!storage) throw new Error('localStorage not available');

  const lists = getGuestShoppingLists();
  const index = lists.findIndex((list) => list.id === id);

  if (index === -1) return null;

  const updatedList = {
    ...lists[index],
    ...updates,
    id, // Ensure ID doesn't change
    updated_at: new Date().toISOString(),
  };

  lists[index] = updatedList;
  storage.setItem(GUEST_SHOPPING_LISTS_KEY, JSON.stringify(lists));

  return updatedList;
}

/**
 * Delete a guest shopping list
 */
export function deleteGuestShoppingList(id: string): boolean {
  const storage = getLocalStorage();
  if (!storage) throw new Error('localStorage not available');

  const lists = getGuestShoppingLists();
  const filteredLists = lists.filter((list) => list.id !== id);

  if (filteredLists.length === lists.length) return false;

  storage.setItem(GUEST_SHOPPING_LISTS_KEY, JSON.stringify(filteredLists));
  return true;
}

/**
 * Check if user has any guest data
 */
export function hasGuestData(): boolean {
  const meals = getGuestMeals();
  const shoppingLists = getGuestShoppingLists();
  return meals.length > 0 || shoppingLists.length > 0;
}

/**
 * Clear all guest data from localStorage
 */
export function clearGuestData(): void {
  const storage = getLocalStorage();
  if (!storage) return;

  storage.removeItem(GUEST_MEALS_KEY);
  storage.removeItem(GUEST_MEAL_RECIPES_KEY);
  storage.removeItem(GUEST_SHOPPING_LISTS_KEY);
}

/**
 * Export guest data for migration (returns JSON-serializable object)
 */
export function exportGuestData() {
  return {
    meals: getGuestMeals(),
    mealRecipes: getGuestMealRecipes(),
    shoppingLists: getGuestShoppingLists(),
  };
}

/**
 * Get count of guest items for display
 */
export function getGuestDataCount() {
  return {
    meals: getGuestMeals().length,
    shoppingLists: getGuestShoppingLists().length,
  };
}
