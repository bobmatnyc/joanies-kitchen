'use server';

import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin';
import { deleteChefLockingRecipesFirst, recountChefRecipes } from '@/lib/chef-recipe-count';
import { db } from '@/lib/db';
import { chefRecipes, chefs, type NewChef } from '@/lib/db/chef-schema';
import { recipes } from '@/lib/db/schema';
import { getRecipeViewer, recipeVisibilityCondition } from '@/lib/recipe-visibility';
import { toErrorMessage } from '@/lib/utils/error-handling';

/**
 * Create a new chef profile
 * Admin only
 */
export async function createChef(data: NewChef) {
  await requireAdmin();

  try {
    const chef = await db
      .insert(chefs)
      .values({
        ...data,
        slug: data.slug.toLowerCase().replace(/\s+/g, '-'),
        updated_at: new Date(),
      })
      .returning();

    revalidatePath('/discover/chefs');
    revalidatePath('/admin/chefs');

    return { success: true, chef: chef[0] };
  } catch (error) {
    console.error('Error creating chef:', error);
    return {
      success: false,
      error: toErrorMessage(error),
    };
  }
}

/**
 * Update chef profile
 * Admin only
 */
export async function updateChef(id: string, data: Partial<NewChef>) {
  await requireAdmin();

  try {
    const chef = await db
      .update(chefs)
      .set({
        ...data,
        updated_at: new Date(),
      })
      .where(eq(chefs.id, id))
      .returning();

    if (!chef[0]) {
      return { success: false, error: 'Chef not found' };
    }

    revalidatePath('/discover/chefs');
    revalidatePath(`/chef/${chef[0].slug}`);
    revalidatePath('/admin/chefs');

    return { success: true, chef: chef[0] };
  } catch (error) {
    console.error('Error updating chef:', error);
    return {
      success: false,
      error: toErrorMessage(error),
    };
  }
}

/**
 * Delete chef profile
 * Admin only - also deletes all associated chef_recipes entries
 */
export async function deleteChef(id: string) {
  await requireAdmin();

  try {
    // #189: one batch locks the chef's recipes, then the chef, then deletes it
    // (the cascade drops chef_recipes; recipes.chef_id is set to NULL).
    const [chef] = await deleteChefLockingRecipesFirst(id);

    if (!chef) {
      return { success: false, error: 'Chef not found' };
    }

    revalidatePath('/discover/chefs');
    revalidatePath(`/chef/${chef.slug}`);
    revalidatePath('/admin/chefs');

    return { success: true };
  } catch (error) {
    console.error('Error deleting chef:', error);
    return {
      success: false,
      error: toErrorMessage(error),
    };
  }
}

/**
 * Get chef by slug (public)
 */
export async function getChefBySlug(slug: string) {
  try {
    const chef = await db.query.chefs.findFirst({
      where: and(eq(chefs.slug, slug), eq(chefs.is_active, true)),
    });

    if (!chef) {
      return { success: false, error: 'Chef not found' };
    }

    // Get chef's recipes
    const chefRecipesData = await db
      .select({
        recipe: recipes,
        chefRecipe: chefRecipes,
      })
      .from(chefRecipes)
      .innerJoin(recipes, eq(chefRecipes.recipe_id, recipes.id))
      .where(
        and(
          eq(chefRecipes.chef_id, chef.id),
          // #41: a chef page shows only recipes the viewer may read.
          recipeVisibilityCondition(await getRecipeViewer())
        )
      )
      .orderBy(desc(recipes.created_at))
      .limit(24);

    const recipesList = chefRecipesData.map((cr) => cr.recipe);

    return {
      success: true,
      chef: {
        ...chef,
        recipes: recipesList,
      },
    };
  } catch (error) {
    console.error('Error getting chef by slug:', error);
    return { success: false, error: 'Failed to get chef' };
  }
}

/**
 * Get chef by ID (internal use)
 */
export async function getChefById(id: string) {
  try {
    const chef = await db.query.chefs.findFirst({
      where: eq(chefs.id, id),
    });

    if (!chef) {
      return { success: false, error: 'Chef not found' };
    }

    return { success: true, chef };
  } catch (error) {
    console.error('Error getting chef by ID:', error);
    return { success: false, error: 'Failed to get chef' };
  }
}

/**
 * Get all active chefs (public)
 * Ordered alphabetically by name
 */
export async function getAllChefs() {
  try {
    const allChefs = await db.query.chefs.findMany({
      where: eq(chefs.is_active, true),
      orderBy: [asc(chefs.name)],
    });

    // Transform snake_case to camelCase for frontend
    const transformedChefs = allChefs.map((chef) => ({
      id: chef.id,
      name: chef.name,
      slug: chef.slug,
      displayName: chef.display_name,
      bio: chef.bio,
      profileImageUrl: chef.profile_image_url,
      specialties: chef.specialties,
      isVerified: chef.is_verified,
      recipeCount: chef.recipe_count,
      latitude: chef.latitude,
      longitude: chef.longitude,
      locationCity: chef.location_city,
      locationState: chef.location_state,
      locationCountry: chef.location_country,
    }));

    return { success: true, chefs: transformedChefs };
  } catch (error) {
    console.error('Error getting all chefs:', error);
    return { success: false, error: 'Failed to get chefs', chefs: [] };
  }
}

/**
 * Get all chefs (admin only)
 * Includes inactive chefs
 */
export async function getAllChefsAdmin() {
  await requireAdmin();

  try {
    const allChefs = await db.query.chefs.findMany({
      orderBy: [desc(chefs.created_at)],
    });

    return { success: true, chefs: allChefs };
  } catch (error) {
    console.error('Error getting all chefs (admin):', error);
    return { success: false, error: 'Failed to get chefs', chefs: [] };
  }
}

/**
 * Update chef recipe count
 * Admin only. Server code calls `recountChefRecipes` from `@/lib/chef-recipe-count`.
 */
export async function updateChefRecipeCount(chefId: string) {
  await requireAdmin(); // See #13: client-callable DB write, admin only
  return recountChefRecipes(chefId);
}

/**
 * Why: a recipe appears on a chef's page only through a `chef_recipes` row.
 * Chef scraping also links a stored duplicate it skips, which may already be
 * linked or belong to another chef (#142).
 * What: admin only. Returns `{ success: false, error: 'Chef not found: <id>' }`
 * and writes nothing when the chef does not exist. Otherwise writes the link
 * row and `recipes.chef_id` in one `db.batch`; an existing link is a no-op
 * (`link` is then undefined). `keepExistingRecipeChef` sets `chef_id` only
 * where it is null, so another chef keeps the recipe.
 * Test: `src/app/actions/__tests__/chef-scraping-link.test.ts`
 */
export async function linkRecipeToChef(params: {
  chefId: string;
  recipeId: string;
  originalUrl?: string;
  keepExistingRecipeChef?: boolean;
}) {
  await requireAdmin();

  try {
    // #142: look the chef up before any write, so an unknown chef writes nothing.
    const chef = await db.query.chefs.findFirst({
      where: eq(chefs.id, params.chefId),
    });
    if (!chef) return { success: false, error: `Chef not found: ${params.chefId}` };

    const recipeTarget = params.keepExistingRecipeChef
      ? and(eq(recipes.id, params.recipeId), isNull(recipes.chef_id))
      : eq(recipes.id, params.recipeId);
    // #142: link and chef_id in one transaction; re-linking a linked pair is not an error.
    const [link] = await db.batch([
      db
        .insert(chefRecipes)
        .values({
          chef_id: params.chefId,
          recipe_id: params.recipeId,
          original_url: params.originalUrl,
          scraped_at: params.originalUrl ? new Date() : undefined,
        })
        .onConflictDoNothing({ target: [chefRecipes.chef_id, chefRecipes.recipe_id] })
        .returning(),
      db.update(recipes).set({ chef_id: params.chefId }).where(recipeTarget),
    ]);

    // Update chef recipe count
    await recountChefRecipes(params.chefId);

    revalidatePath(`/chef/${chef.slug}`);
    revalidatePath('/discover/chefs');

    return { success: true, link: link[0] };
  } catch (error) {
    console.error('Error linking recipe to chef:', error);
    return {
      success: false,
      error: toErrorMessage(error),
    };
  }
}

/**
 * Unlink recipe from chef
 * Admin only
 */
export async function unlinkRecipeFromChef(params: { chef_id: string; recipeId: string }) {
  await requireAdmin();

  try {
    await db
      .delete(chefRecipes)
      .where(
        and(eq(chefRecipes.chef_id, params.chef_id), eq(chefRecipes.recipe_id, params.recipeId))
      );

    // Update chef recipe count
    await recountChefRecipes(params.chef_id);

    // Remove chef reference from recipe
    await db.update(recipes).set({ chef_id: null }).where(eq(recipes.id, params.recipeId));

    // Get chef slug for revalidation
    const chef = await db.query.chefs.findFirst({
      where: eq(chefs.id, params.chef_id),
    });

    if (chef) {
      revalidatePath(`/chef/${chef.slug}`);
    }
    revalidatePath('/discover/chefs');

    return { success: true };
  } catch (error) {
    console.error('Error unlinking recipe from chef:', error);
    return { success: false, error: 'Failed to unlink recipe' };
  }
}

/**
 * Search chefs by name or specialty
 */
export async function searchChefs(query: string) {
  try {
    const results = await db.query.chefs.findMany({
      where: and(
        eq(chefs.is_active, true),
        sql`(
          ${chefs.name} ILIKE ${`%${query}%`} OR
          ${chefs.display_name} ILIKE ${`%${query}%`} OR
          ${chefs.bio} ILIKE ${`%${query}%`} OR
          EXISTS (
            SELECT 1 FROM unnest(${chefs.specialties}) AS specialty
            WHERE specialty ILIKE ${`%${query}%`}
          )
        )`
      ),
      orderBy: [desc(chefs.recipe_count)],
      limit: 20,
    });

    return { success: true, chefs: results };
  } catch (error) {
    console.error('Error searching chefs:', error);
    return { success: false, error: 'Failed to search chefs', chefs: [] };
  }
}
