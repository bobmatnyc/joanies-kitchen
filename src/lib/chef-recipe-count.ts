/**
 * #13: server-internal, deliberately NOT 'use server'. The chef actions and
 * the background scraping job call this after their own admin check; the
 * client-callable `updateChefRecipeCount` action wraps it behind requireAdmin.
 */

import { asc, eq, inArray, or, type SQLWrapper, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chefRecipes, chefs } from '@/lib/db/chef-schema';
import { recipes } from '@/lib/db/schema';

/**
 * Why: `linkRecipeToChef`, `unlinkRecipeFromChef` and chef scraping keep
 * `chefs.recipe_count` in step with `chef_recipes`.
 * What: recounts the chef's `chef_recipes` rows into `chefs.recipe_count` and
 * returns `{ success: true, recipeCount }` (0 for an unknown chef), or
 * `{ success: false, error }`. #174: one UPDATE that counts in place; a SELECT
 * then a separate UPDATE let a delete committed between them leave a stale count.
 * Test: `src/app/actions/__tests__/chef-recipe-delete-count.test.ts`
 */
export async function recountChefRecipes(chefId: string) {
  try {
    const [row] = await db
      .update(chefs)
      .set({
        // Raw column names: drizzle renders bare names inside an UPDATE's SET.
        recipe_count: sql`(SELECT count(*)::int FROM "chef_recipes" cr WHERE cr."chef_id" = "chefs"."id")`,
        updated_at: new Date(),
      })
      .where(eq(chefs.id, chefId))
      .returning({ recipeCount: chefs.recipe_count });

    return { success: true, recipeCount: Number(row?.recipeCount ?? 0) };
  } catch (error) {
    console.error('Error updating chef recipe count:', error);
    return { success: false, error: 'Failed to update recipe count' };
  }
}

/**
 * Why: deleting recipes cascades their `chef_recipes` rows away, so each linked
 * chef's `recipe_count` must drop by the same amount (#165). #174: the delete
 * and the recount used to be separate statements; a failed recount left the
 * recipe deleted but reported as failed, and a link added between the
 * capture and the delete cascaded away without a recount.
 * What: the two batch statements that recount every chef linked to a recipe
 * in `deletedIds` (a select of the ids about to be deleted) as the
 * count of its links to recipes outside that set. The first locks those chefs
 * in id order (FOR NO KEY UPDATE, so link inserts are not blocked); the
 * second writes the count. Send them in the same `db.batch` as the delete,
 * BEFORE it: once the delete runs, the cascade has removed the links that
 * name the affected chefs.
 * Test: `src/app/actions/__tests__/chef-recipe-delete-count.test.ts`,
 * `src/lib/account-purge/__tests__/account-purge.test.ts`
 */
export function chefRecountBeforeDelete(deletedIds: SQLWrapper) {
  const linkedChefIds = db
    .select({ id: chefRecipes.chef_id })
    .from(chefRecipes)
    .where(inArray(chefRecipes.recipe_id, deletedIds));
  return [
    db
      .select({ id: chefs.id })
      .from(chefs)
      .where(inArray(chefs.id, linkedChefIds))
      .orderBy(asc(chefs.id))
      .for('no key update'),
    db
      .update(chefs)
      .set({
        // Raw column names: drizzle renders bare names inside an UPDATE's SET.
        recipe_count: sql`(SELECT count(*)::int FROM "chef_recipes" cr WHERE cr."chef_id" = "chefs"."id" AND cr."recipe_id" NOT IN ${deletedIds})`,
        updated_at: new Date(),
      })
      .where(inArray(chefs.id, linkedChefIds)),
  ] as const;
}

/**
 * Why: #174, the delete and the chef recount must commit or fail together.
 * What: one `db.batch` (one transaction on neon-http): an id-ordered FOR
 * UPDATE lock on the recipes rows, then `chefRecountBeforeDelete`, then the
 * delete. The recipes lock waits out any in-flight `chef_recipes` insert for
 * these recipes (it holds FOR KEY SHARE on the row) and blocks new ones, so
 * the recount sees every link the delete will cascade away. Returns the
 * deleted rows; throws, deleting nothing, when any statement fails.
 * Test: `src/app/actions/__tests__/chef-recipe-delete-count.test.ts`
 */
export async function deleteRecipesWithChefRecount(recipeIds: string[]) {
  if (recipeIds.length === 0) return [];
  const ids = db.select({ id: recipes.id }).from(recipes).where(inArray(recipes.id, recipeIds));
  const [, , , deleted] = await db.batch([
    db
      .select({ id: recipes.id })
      .from(recipes)
      .where(inArray(recipes.id, recipeIds))
      .orderBy(asc(recipes.id))
      .for('update'),
    ...chefRecountBeforeDelete(ids),
    db.delete(recipes).where(inArray(recipes.id, recipeIds)).returning(),
  ]);
  return deleted;
}

/**
 * Why: #189, `DELETE FROM chefs` locks the chef row and then its FK actions
 * update the chef's recipes (`recipes.chef_id` SET NULL), which is chefs →
 * recipes. Every recipe delete locks recipes → chefs, so the two deadlocked.
 * What: one `db.batch`: an id-ordered FOR NO KEY UPDATE lock on every recipe
 * that names the chef (`recipes.chef_id`) or links to it (`chef_recipes`),
 * then FOR UPDATE on the chef row, then the delete. The SET NULL and the
 * `chef_recipes` cascade run under locks already held. Recipes are kept.
 * Returns the deleted chef's `{ id, slug }` (empty for an unknown chef).
 * FOR NO KEY UPDATE is what the SET NULL itself takes (`chef_id` is no key
 * column); it still queues behind #174's recipes FOR UPDATE, and unlike FOR
 * UPDATE it does not block a `chef_recipes` insert's FOR KEY SHARE, which
 * could otherwise hold the chef and wait on a recipe locked here.
 * Test: `src/app/actions/__tests__/chef-delete-lock-order.test.ts`
 */
export async function deleteChefLockingRecipesFirst(chefId: string) {
  const linkedRecipeIds = db
    .select({ id: chefRecipes.recipe_id })
    .from(chefRecipes)
    .where(eq(chefRecipes.chef_id, chefId));
  const [, , deleted] = await db.batch([
    db
      .select({ id: recipes.id })
      .from(recipes)
      .where(or(eq(recipes.chef_id, chefId), inArray(recipes.id, linkedRecipeIds)))
      .orderBy(asc(recipes.id))
      .for('no key update'),
    db.select({ id: chefs.id }).from(chefs).where(eq(chefs.id, chefId)).for('update'),
    db.delete(chefs).where(eq(chefs.id, chefId)).returning({ id: chefs.id, slug: chefs.slug }),
  ]);
  return deleted;
}
