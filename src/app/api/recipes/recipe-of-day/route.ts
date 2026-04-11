/**
 * GET /api/recipes/recipe-of-day
 *
 * Returns today's featured "Recipe of the Day" with chef info.
 *
 * Resolution order:
 *   1. recipe_of_the_day row for today's date
 *   2. Fallback: most recently added public recipe with a no-waste/zero-waste tag
 *
 * Response includes: recipe fields + chef name + chef profile_image_url
 */

import { and, desc, eq, isNull, like, or } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { recipeOfTheDay } from '@/lib/db/autonomous-scraper-schema';
import { chefs } from '@/lib/db/chef-schema';
import { recipes } from '@/lib/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface RecipeOfTheDayResponse {
  recipe_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  images: string | null;
  prep_time: number | null;
  cook_time: number | null;
  servings: number | null;
  tags: string | null;
  cuisine: string | null;
  difficulty: string | null;
  slug: string | null;
  ingredients_count: number;
  total_time: number;
  chef_name: string | null;
  chef_image_url: string | null;
  chef_slug: string | null;
  featured_date: string;
  theme: string | null;
  source_url: string | null;
}

function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

function countIngredients(ingredientsJson: string | null): number {
  if (!ingredientsJson) return 0;
  try {
    const parsed = JSON.parse(ingredientsJson);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

export async function GET() {
  const today = getTodayDateString();

  try {
    // 1. Try to find today's featured recipe from the recipe_of_the_day table
    const [featuredRow] = await db
      .select()
      .from(recipeOfTheDay)
      .where(eq(recipeOfTheDay.date, today))
      .limit(1);

    if (featuredRow?.recipe_id) {
      // Fetch the recipe + chef in one query
      const [row] = await db
        .select({
          recipe: recipes,
          chef: chefs,
        })
        .from(recipes)
        .leftJoin(chefs, eq(recipes.chef_id, chefs.id))
        .where(and(eq(recipes.id, featuredRow.recipe_id), isNull(recipes.deleted_at)))
        .limit(1);

      if (row) {
        const { recipe, chef } = row;
        const totalTime = (recipe.prep_time || 0) + (recipe.cook_time || 0);

        return NextResponse.json<RecipeOfTheDayResponse>({
          recipe_id: recipe.id,
          title: recipe.name,
          description: recipe.description,
          image_url: recipe.image_url,
          images: recipe.images,
          prep_time: recipe.prep_time,
          cook_time: recipe.cook_time,
          servings: recipe.servings,
          tags: recipe.tags,
          cuisine: recipe.cuisine,
          difficulty: recipe.difficulty,
          slug: recipe.slug,
          ingredients_count: countIngredients(recipe.ingredients),
          total_time: totalTime,
          chef_name: chef?.name ?? null,
          chef_image_url: chef?.profile_image_url ?? null,
          chef_slug: chef?.slug ?? null,
          featured_date: today,
          theme: featuredRow.theme,
          source_url: featuredRow.source_url,
        });
      }
    }

    // 2. Fallback: most recent public no-waste recipe with an image
    const noWasteConditions = ['no-waste', 'zero-waste', 'zero waste', 'scraped']
      .map((tag) => or(like(recipes.tags, `%"${tag}"%`), like(recipes.tags, `%${tag}%`)))
      .filter((c): c is NonNullable<typeof c> => c !== undefined);

    const [fallbackRow] = await db
      .select({
        recipe: recipes,
        chef: chefs,
      })
      .from(recipes)
      .leftJoin(chefs, eq(recipes.chef_id, chefs.id))
      .where(
        and(
          eq(recipes.is_public, true),
          isNull(recipes.deleted_at),
          or(
            ...noWasteConditions,
            // Also accept any scraped system recipe
            eq(recipes.is_system_recipe, true)
          )
        )
      )
      .orderBy(desc(recipes.created_at))
      .limit(1);

    if (!fallbackRow) {
      return NextResponse.json({ error: 'No recipe of the day available' }, { status: 404 });
    }

    const { recipe, chef } = fallbackRow;
    const totalTime = (recipe.prep_time || 0) + (recipe.cook_time || 0);

    return NextResponse.json<RecipeOfTheDayResponse>({
      recipe_id: recipe.id,
      title: recipe.name,
      description: recipe.description,
      image_url: recipe.image_url,
      images: recipe.images,
      prep_time: recipe.prep_time,
      cook_time: recipe.cook_time,
      servings: recipe.servings,
      tags: recipe.tags,
      cuisine: recipe.cuisine,
      difficulty: recipe.difficulty,
      slug: recipe.slug,
      ingredients_count: countIngredients(recipe.ingredients),
      total_time: totalTime,
      chef_name: chef?.name ?? null,
      chef_image_url: chef?.profile_image_url ?? null,
      chef_slug: chef?.slug ?? null,
      featured_date: today,
      theme: 'no-waste',
      source_url: recipe.source,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[RecipeOfDay] Failed to fetch:', msg);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
