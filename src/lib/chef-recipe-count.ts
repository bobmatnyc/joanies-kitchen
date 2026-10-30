/**
 * #13: server-internal, deliberately NOT 'use server'. The chef actions and
 * the background scraping job call this after their own admin check; the
 * client-callable `updateChefRecipeCount` action wraps it behind requireAdmin.
 */

import { asc, eq, inArray, type SQLWrapper, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chefRecipes, chefs } from '@/lib/db/chef-schema';
import { recipes } from '@/lib/db/schema';

/** Recounts `chef_recipes` rows for a chef and stores it in `chefs.recipe_count`. */
export async function recountChefRecipes(chefId: string) {
  try {
    const count = await db
      .select({ count: sql<number>`count(*)` })
      .from(chefRecipes)
      .where(eq(chefRecipes.chef_id, chefId));

    const recipeCount = Number(count[0]?.count || 0);

    await db
      .update(chefs)
      .set({ recipe_count: recipeCount, updated_at: new Date() })
      .where(eq(chefs.id, chefId));

    return { success: true, recipeCount };
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
