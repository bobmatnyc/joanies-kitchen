/**
 * #13: server-internal, deliberately NOT 'use server'. The chef actions and
 * the background scraping job call this after their own admin check; the
 * client-callable `updateChefRecipeCount` action wraps it behind requireAdmin.
 */

import { eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chefRecipes, chefs } from '@/lib/db/chef-schema';

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
 * #165: distinct chef ids linked to any of `recipeIds`. Call BEFORE deleting the
 * recipes: `chef_recipes.recipe_id` cascades on delete, so the rows are gone after.
 */
export async function chefIdsLinkedToRecipes(recipeIds: string[]): Promise<string[]> {
  if (recipeIds.length === 0) return [];
  const rows = await db
    .selectDistinct({ chefId: chefRecipes.chef_id })
    .from(chefRecipes)
    .where(inArray(chefRecipes.recipe_id, recipeIds));
  return rows.map((row) => row.chefId);
}

/**
 * #165: recounts each chef after a recipe delete. Throws on the first failed
 * recount, so the caller's error handling reports it instead of leaving a stale count.
 */
export async function recountChefsAfterDelete(chefIds: string[]): Promise<void> {
  for (const chefId of chefIds) {
    const res = await recountChefRecipes(chefId);
    if (!res.success) {
      throw new Error(`failed to recount recipes for chef ${chefId}: ${res.error}`);
    }
  }
}
