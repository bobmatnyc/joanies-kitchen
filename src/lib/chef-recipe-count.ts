/**
 * #13: server-internal, deliberately NOT 'use server'. The chef actions and
 * the background scraping job call this after their own admin check; the
 * client-callable `updateChefRecipeCount` action wraps it behind requireAdmin.
 */

import { eq, sql } from 'drizzle-orm';
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
