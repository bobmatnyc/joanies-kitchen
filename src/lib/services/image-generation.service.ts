/**
 * Image Generation Service
 *
 * Adds images to recipes that currently have no images by:
 * 1. Querying DB for recipes with no images (images IS NULL and image_url IS NULL)
 * 2. Calling local Ollama (gemma3:4b) to generate a food photography prompt
 * 3. Fetching the image via DALL-E 3 (if OPENAI_API_KEY set) or Pollinations.ai (free fallback)
 * 4. Downloading the image and storing it in Vercel Blob
 * 5. Updating the recipe's `images` field in the DB
 */

import 'server-only';
import { and, isNull, or, sql } from 'drizzle-orm';
import { put } from '@vercel/blob';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { generateFoodPhotographyPrompt, checkOllamaHealth } from '@/lib/ai/ollama-client';

// ============================================================================
// TYPES
// ============================================================================

export interface ImageGenerationResult {
  processed: number;
  skipped: number;
  errors: string[];
}

interface RecipeRow {
  id: string;
  name: string;
  cuisine: string | null;
  ingredients: string | null;
  description: string | null;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DELAY_MS = 2000;
const POLLINATIONS_BASE = 'https://image.pollinations.ai/prompt';
const POLLINATIONS_PARAMS = 'width=800&height=600&nologo=true';

// ============================================================================
// HELPERS
// ============================================================================

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch an image URL from DALL-E 3 using the OpenAI API
 */
async function fetchDalleImageUrl(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      response_format: 'url',
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`DALL-E error ${response.status}: ${err}`);
  }

  const data = (await response.json()) as { data: Array<{ url: string }> };
  const url = data.data[0]?.url;
  if (!url) throw new Error('DALL-E returned no URL');
  return url;
}

/**
 * Build a Pollinations.ai URL for a given prompt (free, no key needed)
 */
function buildPollinationsUrl(prompt: string): string {
  const encoded = encodeURIComponent(prompt);
  return `${POLLINATIONS_BASE}/${encoded}?${POLLINATIONS_PARAMS}`;
}

/**
 * Download an image from a URL and upload it to Vercel Blob.
 * Returns the permanent Vercel Blob URL.
 */
async function downloadAndStoreImage(imageUrl: string, recipeId: string): Promise<string> {
  const fetchResponse = await fetch(imageUrl, {
    signal: AbortSignal.timeout(30_000),
  });

  if (!fetchResponse.ok) {
    throw new Error(`Failed to download image: HTTP ${fetchResponse.status}`);
  }

  const buffer = await fetchResponse.arrayBuffer();
  const contentType = fetchResponse.headers.get('content-type') || 'image/jpeg';
  const ext = contentType.includes('png') ? 'png' : 'jpg';
  const filename = `recipe-images/${recipeId}-${Date.now()}.${ext}`;

  const blob = await put(filename, buffer, {
    access: 'public',
    contentType,
  });

  return blob.url;
}

/**
 * Get the image URL for a recipe, preferring DALL-E then Pollinations.
 * Returns [storedUrl] — the final permanent URL after blob upload.
 */
async function generateAndStoreImage(recipe: RecipeRow, prompt: string): Promise<string> {
  const openAiKey = process.env.OPENAI_API_KEY;

  if (openAiKey) {
    // Try DALL-E 3 first
    try {
      const dalleUrl = await fetchDalleImageUrl(prompt);
      const storedUrl = await downloadAndStoreImage(dalleUrl, recipe.id);
      return storedUrl;
    } catch (err) {
      console.warn(
        `[ImageGen] DALL-E failed for recipe ${recipe.id}, falling back to Pollinations:`,
        err
      );
    }
  }

  // Fallback: Pollinations.ai (free, image served directly from URL)
  // We still download and store in Vercel Blob for reliability
  const pollinationsUrl = buildPollinationsUrl(prompt);
  const storedUrl = await downloadAndStoreImage(pollinationsUrl, recipe.id);
  return storedUrl;
}

// ============================================================================
// MAIN SERVICE
// ============================================================================

/**
 * Find recipes with no images and add generated images to them.
 *
 * @param limit - Maximum number of recipes to process in this batch
 * @returns Summary of what happened
 */
export async function addMissingRecipeImages(limit = 10): Promise<ImageGenerationResult> {
  const result: ImageGenerationResult = {
    processed: 0,
    skipped: 0,
    errors: [],
  };

  // Check Ollama is running before we start
  const ollamaOk = await checkOllamaHealth();
  if (!ollamaOk) {
    result.errors.push(
      'Ollama is not reachable at localhost:11434 or the model is not loaded. ' +
        'Run: ollama pull gemma3:4b'
    );
    return result;
  }

  // Query recipes with no images
  const recipesWithoutImages = await db
    .select({
      id: recipes.id,
      name: recipes.name,
      cuisine: recipes.cuisine,
      ingredients: recipes.ingredients,
      description: recipes.description,
    })
    .from(recipes)
    .where(
      and(
        isNull(recipes.deleted_at),
        or(isNull(recipes.images), sql`${recipes.images} = '[]'`, sql`${recipes.images} = ''`),
        isNull(recipes.image_url)
      )
    )
    .limit(limit);

  if (recipesWithoutImages.length === 0) {
    return result;
  }

  for (const recipe of recipesWithoutImages) {
    try {
      // 1. Generate a descriptive food photography prompt via Ollama
      const prompt = await generateFoodPhotographyPrompt({
        name: recipe.name,
        cuisine: recipe.cuisine,
        ingredients: recipe.ingredients,
        description: recipe.description,
      });

      console.log(`[ImageGen] Prompt for "${recipe.name}": ${prompt.slice(0, 80)}...`);

      // 2. Generate image and store in Vercel Blob
      const storedImageUrl = await generateAndStoreImage(recipe as RecipeRow, prompt);

      // 3. Update the recipe's images field in DB
      const imagesJson = JSON.stringify([storedImageUrl]);
      await db
        .update(recipes)
        .set({
          images: imagesJson,
          updated_at: new Date(),
        })
        .where(sql`${recipes.id} = ${recipe.id}`);

      result.processed++;
      console.log(`[ImageGen] Added image to recipe "${recipe.name}" (${recipe.id})`);

      // Rate-limit between requests
      await delay(DELAY_MS);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push(`Recipe "${recipe.name}" (${recipe.id}): ${message}`);
      result.skipped++;
      console.error(`[ImageGen] Error for recipe ${recipe.id}:`, err);
    }
  }

  return result;
}
