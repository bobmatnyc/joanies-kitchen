import { and, asc, eq, gte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chefRecipes, chefs } from '@/lib/db/chef-schema';
import { recipes } from '@/lib/db/schema';
import { publicRecipe } from '@/lib/recipe-public';

/** A chef appears on public chef lists only with at least this many public recipes. */
export const MIN_PUBLIC_CHEF_RECIPES = 3;

/**
 * Why: the owner limited public chef lists to chefs with a real body of work.
 * `chefs.recipe_count` counts every `chef_recipes` link, including private,
 * rejected and soft-deleted recipes, so it cannot decide public listing.
 * What: active chefs with at least `minRecipes` linked recipes that satisfy
 * `publicRecipe` (the site's one "public recipe" rule), ordered by name. Each
 * row carries `publicRecipeCount`. Profile pages (`getChefBySlug`) do not use
 * this, so a chef below the bar keeps a reachable profile URL.
 * Test: `src/lib/__tests__/chef-public-list.test.ts`
 */
export async function listPublicChefs(minRecipes = MIN_PUBLIC_CHEF_RECIPES) {
  const counts = db
    .select({
      chefId: chefRecipes.chef_id,
      n: sql<number>`count(distinct ${recipes.id})::int`.as('public_recipe_count'),
    })
    .from(chefRecipes)
    .innerJoin(recipes, eq(chefRecipes.recipe_id, recipes.id))
    .where(publicRecipe)
    .groupBy(chefRecipes.chef_id)
    .as('public_counts');

  const rows = await db
    .select({ chef: chefs, publicRecipeCount: counts.n })
    .from(chefs)
    .innerJoin(counts, eq(counts.chefId, chefs.id))
    .where(and(eq(chefs.is_active, true), gte(counts.n, minRecipes)))
    .orderBy(asc(chefs.name));

  return rows.map((r) => ({ ...r.chef, publicRecipeCount: Number(r.publicRecipeCount) }));
}
