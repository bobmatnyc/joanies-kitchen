/**
 * #218: the recipe-row lock every `meal_recipes` insert opens its `db.batch` with.
 *
 * Why: the insert's FK checks take FOR KEY SHARE on the meal, then on the
 * recipe. The account purge locks recipes FOR UPDATE first and deletes the meal
 * (FOR UPDATE) later, so an insert holding the meal and waiting on the recipe
 * deadlocked with it (40P01). Locking the recipes first gives the insert the
 * project's recipes-first order (#158, #174).
 * What: `SELECT id FROM recipes WHERE id IN (…) ORDER BY id FOR KEY SHARE`.
 * FOR KEY SHARE is the lock the FK check takes anyway, taken earlier; the insert
 * never updates the recipe, so nothing stronger is needed. It conflicts only
 * with FOR UPDATE, which the purge (`account-purge/statements.ts`) and #174's
 * recipe deletes hold, so the insert queues there before it touches the meal.
 * It does not conflict with FOR NO KEY UPDATE or a plain recipe UPDATE (#141
 * ratings, #189, #211, the purge's later recipe UPDATEs), so an add never waits
 * on those and holds nothing they wait on: a stronger mode could hold a recipe
 * the purge UPDATEs after deleting the meal, while waiting on that meal. Id
 * order keeps two multi-recipe batches from locking recipes in opposite orders.
 * A missing id locks nothing, so the insert then fails its FK check as before.
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
    .for('key share');
}
