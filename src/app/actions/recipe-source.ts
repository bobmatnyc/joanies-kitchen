'use server';

import { and, asc, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chefRecipes, chefs } from '@/lib/db/chef-schema';
import { recipeSources, recipes } from '@/lib/db/schema';
import { userProfiles } from '@/lib/db/user-discovery-schema';
import { isPublicRecipe } from '@/lib/recipe-public';
import type {
  RecipeSourceAuthor,
  RecipeSourceChef,
  RecipeSourceContext,
} from '@/lib/recipes/recipe-source';
import { getSessionUserId } from '@/lib/session-user';

/**
 * Tdb: show recipe source (Bob 2026-11-09)
 *
 * Why: the recipe page resolves its "Source" line from the chef, the `recipe_sources` row
 * and the owner's profile; `getRecipe` selects only from `recipes`.
 * What: companion query for ONE recipe (the single-recipe page only, so no N+1 on lists).
 * Applies the same visibility rule as `getRecipe`, returns only active chefs (the chef page
 * 404s otherwise), and reduces the profile to username/display_name when public. It never
 * selects an email. Returns null for a missing or hidden recipe, or on error.
 * Test: src/app/recipes/[slug]/__tests__/recipe-source.test.ts (resolver over this shape)
 */
export async function getRecipeSourceContext(
  recipeId: string
): Promise<RecipeSourceContext | null> {
  try {
    const userId = await getSessionUserId();
    const [row] = await db
      .select({
        user_id: recipes.user_id,
        is_public: recipes.is_public,
        moderation_status: recipes.moderation_status,
        deleted_at: recipes.deleted_at,
        is_system_recipe: recipes.is_system_recipe,
        chef_slug: chefs.slug,
        chef_name: chefs.name,
        chef_display_name: chefs.display_name,
        chef_active: chefs.is_active,
        site_name: recipeSources.name,
        site_slug: recipeSources.slug,
        site_website_url: recipeSources.website_url,
      })
      .from(recipes)
      .leftJoin(chefs, eq(recipes.chef_id, chefs.id))
      .leftJoin(recipeSources, eq(recipes.source_id, recipeSources.id))
      .where(and(eq(recipes.id, recipeId), isNull(recipes.deleted_at)))
      .limit(1);

    // Same rule as getRecipe (#134): a hidden recipe answers like a missing one.
    if (!row || (!isPublicRecipe(row) && row.user_id !== userId)) return null;

    const [links, profile] = await Promise.all([
      db
        .select({
          slug: chefs.slug,
          name: chefs.name,
          display_name: chefs.display_name,
          original_url: chefRecipes.original_url,
        })
        .from(chefRecipes)
        .innerJoin(chefs, eq(chefRecipes.chef_id, chefs.id))
        .where(and(eq(chefRecipes.recipe_id, recipeId), eq(chefs.is_active, true)))
        .orderBy(asc(chefRecipes.created_at))
        .limit(5),
      row.is_system_recipe
        ? Promise.resolve([])
        : db
            .select({
              username: userProfiles.username,
              display_name: userProfiles.display_name,
              is_public: userProfiles.is_public,
            })
            .from(userProfiles)
            .where(eq(userProfiles.user_id, row.user_id))
            .limit(1),
    ]);

    let chef: RecipeSourceChef | null =
      row.chef_slug && row.chef_name && row.chef_active !== false
        ? { slug: row.chef_slug, name: row.chef_name, display_name: row.chef_display_name }
        : null;
    // chef_id wins; otherwise the first chef_recipes link (40 prod recipes link only there).
    const link = (chef && links.find((l) => l.slug === chef?.slug)) || (chef ? null : links[0]);
    if (!chef && link) {
      chef = { slug: link.slug, name: link.name, display_name: link.display_name };
    }

    const [owner] = profile;
    const author: RecipeSourceAuthor | null = owner
      ? owner.is_public
        ? { isPublic: true, username: owner.username, display_name: owner.display_name }
        : { isPublic: false }
      : null;

    return {
      chef,
      chefOriginalUrl: link?.original_url ?? null,
      site:
        row.site_name && row.site_slug
          ? { name: row.site_name, slug: row.site_slug, website_url: row.site_website_url }
          : null,
      author,
    };
  } catch (error) {
    console.error('Failed to fetch recipe source context:', error);
    return null;
  }
}
