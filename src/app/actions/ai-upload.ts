'use server';

import { revalidatePath } from 'next/cache';
import { MODELS } from '@/lib/ai/openrouter';
import { parseRecipeFromImage, parseRecipeWithAI } from '@/lib/ai/recipe-parser';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';

/**
 * Upload and parse recipe using AI
 * Supports text, markdown, or images
 */
export async function uploadRecipeWithAI(params: {
  text?: string;
  markdown?: string;
  images?: string[]; // URLs to uploaded images
  parseFromImage?: boolean; // Use vision model for image-only parsing
}) {
  const { userId } = await auth();

  if (!userId) {
    return { success: false, error: 'Authentication required' };
  }

  try {
    let parsed;

    if (params.parseFromImage && params.images && params.images.length > 0) {
      // Use vision model for image parsing
      parsed = await parseRecipeFromImage(params.images[0]);
    } else {
      // Use text-based parsing
      parsed = await parseRecipeWithAI({
        text: params.text,
        markdown: params.markdown,
        images: params.images,
      });
    }

    // Create recipe in database
    const recipe = await db
      .insert(recipes)
      .values({
        user_id: userId,
        name: parsed.name,
        description: parsed.description || '',
        ingredients: JSON.stringify(parsed.ingredients),
        instructions: JSON.stringify(parsed.instructions),
        prep_time: parsed.prepTime || null,
        cook_time: parsed.cookTime || null,
        servings: parsed.servings || null,
        difficulty: parsed.difficulty || null,
        cuisine: parsed.cuisine || null,
        tags: parsed.tags ? JSON.stringify(parsed.tags) : null,
        images: params.images
          ? JSON.stringify(params.images)
          : parsed.imageUrl
            ? JSON.stringify([parsed.imageUrl])
            : null,
        image_url: params.images?.[0] || parsed.imageUrl || null,
        nutrition_info: parsed.nutritionInfo ? JSON.stringify(parsed.nutritionInfo) : null,
        is_ai_generated: true,
        is_public: false, // User can change this later
        model_used: params.parseFromImage ? MODELS.GPT_4O : MODELS.CLAUDE_SONNET_4_5,
        source: 'AI Upload',
      })
      .returning();

    revalidatePath('/recipes');

    return { success: true, recipe: recipe[0] };
  } catch (error) {
    console.error('Error uploading recipe with AI:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse and upload recipe',
    };
  }
}

/**
 * Upload recipe from URL
 * Fetches and parses the recipe page
 */
export async function uploadRecipeFromUrl(url: string) {
  const { userId } = await auth();

  if (!userId) {
    return { success: false, error: 'Authentication required' };
  }

  try {
    // Import firecrawl here to avoid circular dependencies
    const { scrapeRecipePage } = await import('@/lib/firecrawl');

    // Scrape the page
    const scraped = await scrapeRecipePage(url);

    if (!scraped.markdown && !scraped.html) {
      throw new Error('Failed to scrape recipe content from URL');
    }

    // Parse with AI
    const parsed = await parseRecipeWithAI({
      markdown: scraped.markdown,
      html: scraped.html,
      images: scraped.metadata?.ogImage
        ? Array.isArray(scraped.metadata.ogImage)
          ? scraped.metadata.ogImage
          : [scraped.metadata.ogImage]
        : undefined,
    });

    // Create recipe
    const recipe = await db
      .insert(recipes)
      .values({
        user_id: userId,
        name: parsed.name,
        description: parsed.description || '',
        ingredients: JSON.stringify(parsed.ingredients),
        instructions: JSON.stringify(parsed.instructions),
        prep_time: parsed.prepTime || null,
        cook_time: parsed.cookTime || null,
        servings: parsed.servings || null,
        difficulty: parsed.difficulty || null,
        cuisine: parsed.cuisine || null,
        tags: parsed.tags ? JSON.stringify(parsed.tags) : null,
        images: parsed.imageUrl ? JSON.stringify([parsed.imageUrl]) : null,
        image_url: parsed.imageUrl || null,
        nutrition_info: parsed.nutritionInfo ? JSON.stringify(parsed.nutritionInfo) : null,
        is_ai_generated: true,
        is_public: false,
        model_used: MODELS.CLAUDE_SONNET_4_5,
        source: url,
      })
      .returning();

    revalidatePath('/recipes');

    return { success: true, recipe: recipe[0] };
  } catch (error) {
    console.error('Error uploading recipe from URL:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to import recipe from URL',
    };
  }
}

/**
 * Parse recipe preview without saving
 * Useful for showing user what will be created before saving
 */
export async function previewRecipeParse(params: {
  text?: string;
  markdown?: string;
  images?: string[];
  parseFromImage?: boolean;
}) {
  const { userId } = await auth();

  if (!userId) {
    return { success: false, error: 'Authentication required' };
  }

  try {
    let parsed;

    if (params.parseFromImage && params.images && params.images.length > 0) {
      parsed = await parseRecipeFromImage(params.images[0]);
    } else {
      parsed = await parseRecipeWithAI({
        text: params.text,
        markdown: params.markdown,
        images: params.images,
      });
    }

    return { success: true, recipe: parsed };
  } catch (error) {
    console.error('Error previewing recipe parse:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse recipe',
    };
  }
}
