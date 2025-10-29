import { eq, isNotNull, or } from 'drizzle-orm';
import type { MetadataRoute } from 'next';
import { db } from '@/lib/db';
import { ingredients, recipes } from '@/lib/db/schema';

/**
 * Dynamic Sitemap Generation for Joanie's Kitchen
 *
 * Generates a comprehensive sitemap including:
 * - Static pages (homepage, fridge, learn, rescue, philosophy, etc.)
 * - All public recipe pages (4,644+ recipes)
 * - Ingredient pages (for ingredients with slugs)
 *
 * Updates automatically as content is added to the database.
 *
 * SEO Impact:
 * - Helps search engines discover all content
 * - Provides lastModified dates for crawl prioritization
 * - Sets priority and changeFrequency hints
 *
 * Sitemap is regenerated on each request.
 * For production, consider using ISR with revalidation.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://recipes.help';

  try {
    // Fetch all public recipes (include both public and system recipes)
    // Use slug if available, fallback to ID for recipes without slugs
    const publicRecipes = await db
      .select({
        id: recipes.id,
        slug: recipes.slug,
        updated_at: recipes.updated_at,
        is_system_recipe: recipes.is_system_recipe,
      })
      .from(recipes)
      .where(or(eq(recipes.is_public, true), eq(recipes.is_system_recipe, true)));

    // Map recipes to sitemap entries (prefer slug over ID)
    const recipeEntries: MetadataRoute.Sitemap = publicRecipes.map((recipe) => ({
      url: `${baseUrl}/recipes/${recipe.slug || recipe.id}`,
      lastModified: recipe.updated_at || new Date(),
      changeFrequency: 'weekly' as const,
      priority: recipe.is_system_recipe ? 0.9 : 0.8, // System recipes get higher priority
    }));

    // Fetch all ingredients with slugs (only those with dedicated pages)
    const allIngredients = await db
      .select({
        slug: ingredients.slug,
        updated_at: ingredients.updated_at,
      })
      .from(ingredients)
      .where(isNotNull(ingredients.slug));

    const ingredientEntries: MetadataRoute.Sitemap = allIngredients.map((ing) => ({
      url: `${baseUrl}/ingredients/${ing.slug}`,
      lastModified: ing.updated_at || new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    }));

    // Static pages - core site structure
    const staticPages: MetadataRoute.Sitemap = [
      {
        url: baseUrl,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 1.0,
      },
      {
        url: `${baseUrl}/fridge`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 0.9,
      },
      {
        url: `${baseUrl}/recipes`,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 0.9,
      },
      // NOTE: Removed /recipes/new from sitemap (requires authentication)
      {
        url: `${baseUrl}/recipes/top-50`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 0.8,
      },
      {
        url: `${baseUrl}/recipes/zero-waste`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 0.8,
      },
      {
        url: `${baseUrl}/shared`,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 0.7,
      },
      {
        url: `${baseUrl}/discover`,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 0.7,
      },
      {
        url: `${baseUrl}/learn`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.7,
      },
      {
        url: `${baseUrl}/learn/zero-waste-kitchen`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.7,
      },
      {
        url: `${baseUrl}/learn/fifo-management`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.7,
      },
      {
        url: `${baseUrl}/learn/substitution-guide`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.7,
      },
      {
        url: `${baseUrl}/learn/stock-from-scraps`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.7,
      },
      {
        url: `${baseUrl}/rescue`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.7,
      },
      {
        url: `${baseUrl}/rescue/wilting-greens`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.6,
      },
      {
        url: `${baseUrl}/rescue/aging-vegetables`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.6,
      },
      {
        url: `${baseUrl}/rescue/leftover-proteins`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.6,
      },
      {
        url: `${baseUrl}/rescue/excess-herbs`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.6,
      },
      {
        url: `${baseUrl}/philosophy`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.6,
      },
      {
        url: `${baseUrl}/about`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.5,
      },
    ];

    // Combine and return all entries
    return [...staticPages, ...recipeEntries, ...ingredientEntries];
  } catch (error) {
    console.error('Error generating sitemap:', error);

    // Return static pages only if database query fails
    return [
      {
        url: baseUrl,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 1.0,
      },
      {
        url: `${baseUrl}/recipes`,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 0.9,
      },
    ];
  }
}
