'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import {
  type IngestedRecipe,
  parseRecipeForIngestion,
  serializeIngredients,
  serializeInstructions,
  serializeTags,
} from '@/lib/ai/recipe-ingestion-parser';
import { auth } from '@/lib/auth';
import { invalidateRecipeCaches } from '@/lib/cache';
import { db } from '@/lib/db';
import { chefs } from '@/lib/db/chef-schema';
import { type NewRecipe, recipes } from '@/lib/db/schema';
import { scrapeRecipePage } from '@/lib/firecrawl';
import { generateUniqueSlug } from '@/lib/utils/slug';
import { toErrorMessage } from '@/lib/utils/error-handling';

/**
 * Check if a URL is valid and scrapeable
 */
function isValidRecipeUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);

    // Must be HTTP or HTTPS
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'URL must use HTTP or HTTPS protocol' };
    }

    // Check for common blocked domains
    const blockedDomains = ['localhost', '127.0.0.1', '0.0.0.0'];
    if (blockedDomains.some((domain) => parsed.hostname.includes(domain))) {
      return { valid: false, error: 'Local URLs are not allowed' };
    }

    return { valid: true };
  } catch (_error) {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Fetch recipe content from URL using Firecrawl
 */
export async function fetchRecipeFromUrl(url: string): Promise<{
  success: boolean;
  data?: {
    markdown: string;
    html?: string;
    title?: string;
    description?: string;
    sourceUrl: string;
  };
  error?: string;
}> {
  try {
    // Check admin permissions
    const { sessionClaims } = await auth();
    const metadata = sessionClaims?.metadata as { isAdmin?: string } | undefined;
    if (metadata?.isAdmin !== 'true') {
      return { success: false, error: 'Admin access required' };
    }

    // Validate URL
    const validation = isValidRecipeUrl(url);
    if (!validation.valid) {
      return { success: false, error: validation.error || 'Invalid URL' };
    }

    // Scrape URL with Firecrawl
    const scrapeResult = await scrapeRecipePage(url);

    if (!scrapeResult.success || !scrapeResult.markdown) {
      return {
        success: false,
        error: scrapeResult.error || 'Failed to fetch recipe content',
      };
    }

    return {
      success: true,
      data: {
        markdown: scrapeResult.markdown,
        html: scrapeResult.html,
        title: scrapeResult.metadata?.title,
        description: scrapeResult.metadata?.description,
        sourceUrl: url,
      },
    };
  } catch (error) {
    console.error('Error fetching recipe from URL:', error);
    return {
      success: false,
      error: toErrorMessage(error),
    };
  }
}

/**
 * Parse recipe content using LLM
 */
export async function parseRecipeContent(
  content: string,
  sourceUrl?: string
): Promise<{
  success: boolean;
  data?: IngestedRecipe;
  error?: string;
}> {
  try {
    // Check admin permissions
    const { sessionClaims } = await auth();
    const metadata = sessionClaims?.metadata as { isAdmin?: string } | undefined;
    if (metadata?.isAdmin !== 'true') {
      return { success: false, error: 'Admin access required' };
    }

    // Parse with LLM
    const parsed = await parseRecipeForIngestion(content, sourceUrl);

    return {
      success: true,
      data: parsed,
    };
  } catch (error) {
    console.error('Error parsing recipe content:', error);
    return {
      success: false,
      error: toErrorMessage(error),
    };
  }
}

/**
 * Save ingested recipe to database
 */
export async function saveIngestedRecipe(recipeData: {
  name: string;
  description: string | null;
  ingredients: any[];
  instructions: string[];
  prep_time: number | null;
  cook_time: number | null;
  servings: number | null;
  difficulty: 'easy' | 'medium' | 'hard' | null;
  cuisine: string | null;
  tags: string[];
  image_url?: string | null;
  video_url?: string | null;
  source: string;
  chef_id?: string | null;
  license?: string;
  is_public?: boolean;
  is_system_recipe?: boolean;
}): Promise<{
  success: boolean;
  data?: { id: string; slug: string };
  error?: string;
}> {
  try {
    // Check admin permissions
    const { userId, sessionClaims } = await auth();
    const metadata = sessionClaims?.metadata as { isAdmin?: string } | undefined;
    if (metadata?.isAdmin !== 'true' || !userId) {
      return { success: false, error: 'Admin access required' };
    }

    // Validate required fields
    if (!recipeData.name || !recipeData.ingredients || !recipeData.instructions) {
      return { success: false, error: 'Missing required fields' };
    }

    if (recipeData.ingredients.length === 0) {
      return { success: false, error: 'Recipe must have at least one ingredient' };
    }

    if (recipeData.instructions.length === 0) {
      return { success: false, error: 'Recipe must have at least one instruction' };
    }

    // Generate unique slug
    const slug = await generateUniqueSlug(recipeData.name);

    // Prepare recipe for database insertion
    const newRecipe: NewRecipe = {
      user_id: userId,
      name: recipeData.name,
      description: recipeData.description,
      ingredients: serializeIngredients(recipeData.ingredients),
      instructions: serializeInstructions(recipeData.instructions),
      prep_time: recipeData.prep_time,
      cook_time: recipeData.cook_time,
      servings: recipeData.servings,
      difficulty: recipeData.difficulty,
      cuisine: recipeData.cuisine,
      tags: serializeTags(recipeData.tags),
      image_url: recipeData.image_url,
      video_url: recipeData.video_url,
      source: recipeData.source,
      chef_id: recipeData.chef_id || null,
      slug,
      is_public: recipeData.is_public ?? true,
      is_system_recipe: recipeData.is_system_recipe ?? true,
      license: (recipeData.license as any) || 'ALL_RIGHTS_RESERVED',
      is_ai_generated: false, // Ingested from external source
    };

    // Insert recipe into database
    const result = await db.insert(recipes).values(newRecipe).returning();

    if (!result || result.length === 0) {
      return { success: false, error: 'Failed to save recipe to database' };
    }

    const savedRecipe = result[0];

    // Invalidate caches
    invalidateRecipeCaches();
    revalidatePath('/recipes');
    revalidatePath('/admin/recipes');
    revalidatePath('/');

    return {
      success: true,
      data: {
        id: savedRecipe.id,
        slug: savedRecipe.slug || savedRecipe.id,
      },
    };
  } catch (error) {
    console.error('Error saving ingested recipe:', error);
    return {
      success: false,
      error: toErrorMessage(error),
    };
  }
}

/**
 * Get all chefs for chef selection dropdown
 */
export async function getChefsList(): Promise<{
  success: boolean;
  data?: Array<{ id: string; name: string; slug: string }>;
  error?: string;
}> {
  try {
    // Check admin permissions
    const { sessionClaims } = await auth();
    const metadata = sessionClaims?.metadata as { isAdmin?: string } | undefined;
    if (metadata?.isAdmin !== 'true') {
      return { success: false, error: 'Admin access required' };
    }

    const allChefs = await db
      .select({
        id: chefs.id,
        name: chefs.name,
        slug: chefs.slug,
      })
      .from(chefs)
      .where(eq(chefs.is_active, true))
      .orderBy(chefs.name);

    return {
      success: true,
      data: allChefs,
    };
  } catch (error) {
    console.error('Error fetching chefs list:', error);
    return {
      success: false,
      error: toErrorMessage(error),
    };
  }
}

/**
 * Complete recipe ingestion workflow: fetch, parse, and prepare for save
 */
export async function ingestRecipeFromUrl(url: string): Promise<{
  success: boolean;
  data?: {
    recipe: IngestedRecipe;
    sourceUrl: string;
    metadata?: {
      title?: string;
      description?: string;
    };
  };
  error?: string;
}> {
  try {
    // Check admin permissions
    const { sessionClaims } = await auth();
    const metadata = sessionClaims?.metadata as { isAdmin?: string } | undefined;
    if (metadata?.isAdmin !== 'true') {
      return { success: false, error: 'Admin access required' };
    }

    // Step 1: Fetch content
    const fetchResult = await fetchRecipeFromUrl(url);
    if (!fetchResult.success || !fetchResult.data) {
      return { success: false, error: fetchResult.error || 'Failed to fetch recipe' };
    }

    // Step 2: Parse content
    const parseResult = await parseRecipeContent(fetchResult.data.markdown, url);
    if (!parseResult.success || !parseResult.data) {
      return { success: false, error: parseResult.error || 'Failed to parse recipe' };
    }

    return {
      success: true,
      data: {
        recipe: parseResult.data,
        sourceUrl: url,
        metadata: {
          title: fetchResult.data.title,
          description: fetchResult.data.description,
        },
      },
    };
  } catch (error) {
    console.error('Error in recipe ingestion workflow:', error);
    return {
      success: false,
      error: toErrorMessage(error),
    };
  }
}
