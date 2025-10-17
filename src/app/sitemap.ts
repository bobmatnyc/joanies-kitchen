import { and, eq, isNotNull } from 'drizzle-orm';
import type { MetadataRoute } from 'next';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';

/**
 * Generate XML sitemap for SEO
 *
 * Includes:
 * - All public recipes with slugs
 * - Static pages (home, recipes, discover, etc.)
 *
 * Sitemap is regenerated on each request.
 * For production, consider using ISR with revalidation.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3004';

  try {
    // Fetch all public recipes with slugs
    const publicRecipes = await db
      .select({
        slug: recipes.slug,
        updated_at: recipes.updated_at,
        is_system_recipe: recipes.is_system_recipe,
      })
      .from(recipes)
      .where(and(eq(recipes.is_public, true), isNotNull(recipes.slug)));

    // Map recipes to sitemap entries
    const recipeEntries: MetadataRoute.Sitemap = publicRecipes.map((recipe) => ({
      url: `${baseUrl}/recipes/${recipe.slug}`,
      lastModified: recipe.updated_at || new Date(),
      changeFrequency: 'weekly' as const,
      priority: recipe.is_system_recipe ? 0.9 : 0.8, // System recipes get higher priority
    }));

    // Static pages
    const staticPages: MetadataRoute.Sitemap = [
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
      {
        url: `${baseUrl}/recipes/new`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.7,
      },
      {
        url: `${baseUrl}/recipes/top-50`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 0.9,
      },
      {
        url: `${baseUrl}/shared`,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 0.8,
      },
      {
        url: `${baseUrl}/discover`,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 0.8,
      },
    ];

    // Combine and return all entries
    return [...staticPages, ...recipeEntries];
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
