/**
 * #218: the recipe-row lock every `meal_recipes` insert opens its `db.batch` with.
 *
 * Why: the insert's FK checks take FOR KEY SHARE on the meal, then on the
 * recipe. The account purge locks recipes FOR UPDATE first and deletes the meal
 * (FOR UPDATE) later, so an insert holding the meal and waiting on the recipe
 * deadlocked with it (40P01). Locking the recipes first gives the insert the
 * project's recipes-first order (#158, #174, #189, #141, #211).
 * What: `SELECT id FROM recipes WHERE id IN (…) ORDER BY id FOR NO KEY UPDATE`.
 * FOR NO KEY UPDATE, as `lockRecipeForRating` (#141, #211): it queues behind the
 * purge's and #174's FOR UPDATE and beside #141/#189/#211's FOR NO KEY UPDATE,
 * none of which lock a meal afterwards. It does not conflict with the FOR KEY
 * SHARE other FK inserts take on the recipe. Id order keeps two multi-recipe
 * inserts from locking the same recipes in opposite orders. A missing id locks
 * nothing, so the insert then fails its FK check as before.
 * Test: `src/app/actions/__tests__/meal-recipes-lock-order.test.ts`
 */

import { asc, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';

/** #218: statement 0 of a `meal_recipes` insert batch; send the insert after it. */
export function lockRecipesForMealInsert(recipeIds: string[]) {
  return db
    .select({ id: recipes.id })
    .from(recipes)
    .where(inArray(recipes.id, recipeIds))
    .orderBy(asc(recipes.id))
    .for('no key update');
}
