/**
 * Recipe crawl step 4: store a crawled recipe with its embedding.
 *
 * Why: `storeRecipe` (search crawl) and `storeRecipeWithWeek` (weekly crawl)
 * were two near-identical copies in `src/lib/recipe-crawl.ts`, which had grown
 * past the 500-line cap (#142).
 * What: one `storeCrawledRecipe` for both crawls; the weekly crawl adds its
 * `week`, the search crawl its `searchQuery`. `src/lib/recipe-crawl.ts`
 * re-exports `storeRecipe`.
 * Test: `src/lib/services/__tests__/recipe-crawl-dedup.test.ts`,
 * `src/lib/__tests__/recipe-crawl-store.test.ts`
 *
 * #13: server-internal and deliberately NOT 'use server'.
 */

import { generateRecipeEmbedding, type RecipeEmbeddingResult } from '@/lib/ai/embeddings';
import { evaluateRecipeQuality } from '@/lib/ai/recipe-quality-evaluator';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { saveRecipeEmbedding } from '@/lib/db/embeddings';
import { type Recipe, recipes } from '@/lib/db/schema';
import type { ExtractedRecipe } from '@/lib/recipe-crawl-steps';
import { type DuplicateMatch, duplicateSkipReason, findDuplicateRecipe } from '@/lib/recipes/dedup';
import { describeDbError, toErrorMessage } from '@/lib/utils/error-handling';
import { pickRecipeImages } from '@/lib/utils/recipe-image-picker';
import { toRecipeInt } from '@/lib/utils/recipe-int';
import type { WeekInfo } from '@/lib/week-utils';

export interface StoreRecipeResult {
  success: boolean;
  recipeId?: string;
  error?: string;
  duplicate?: DuplicateMatch; // #135
}

export interface StoreRecipeMetadata {
  sourceUrl: string;
  /** Search crawl: the query that found the URL. */
  searchQuery?: string;
  /** Weekly crawl: the discovery week, and the page's published date if known. */
  week?: { info: WeekInfo; publishedDate?: string };
}

/**
 * Downloads and stores recipe images
 * For now, just validates and returns URLs (at most 6)
 */
function downloadAndStoreImages(imageUrls: string[], pageUrl: string): string[] {
  // In production, you would download the images, upload them to cloud
  // storage (Vercel Blob, S3, etc.) and return the new URLs.
  // #185: absolute http(s) URLs only, and never a site logo or icon.
  return pickRecipeImages({ contentImages: imageUrls }, pageUrl, 6);
}

/**
 * Parses time strings to minutes
 */
export function parseTimeToMinutes(timeStr?: unknown): number | null {
  // #12: the LLM sometimes returns a bare number; route both shapes through the
  // shared integer coercion so the column only ever gets an integer or null.
  const value = toRecipeInt(timeStr);
  if (value === null) return null;

  // Check for hours
  if (typeof timeStr === 'string' && timeStr.toLowerCase().includes('hour')) {
    return toRecipeInt(value * 60);
  }

  // Default to minutes
  return value;
}

/**
 * Validates and parses date strings to Date objects
 * Returns null for invalid dates instead of throwing errors
 */
export function validateAndParseDate(dateString: string | undefined | null): Date | null {
  if (!dateString) return null;

  // Reject known invalid values
  if (['approximate', 'unknown', 'n/a'].includes(dateString.toLowerCase())) {
    console.warn(`[Store] Invalid date string: "${dateString}" - using null`);
    return null;
  }

  const date = new Date(dateString);

  // Check if date is valid
  if (Number.isNaN(date.getTime())) {
    console.warn(`[Store] Invalid date string: "${dateString}" - parsed to Invalid Date`);
    return null;
  }

  // Sanity check: reject dates too far in past or future
  const year = date.getFullYear();
  if (year < 1900 || year > 2100) {
    console.warn(`[Store] Date out of reasonable range: "${dateString}" (year: ${year})`);
    return null;
  }

  return date;
}

/** The unsaved recipe row the embedder reads; only the content fields carry data. */
function embeddingInput(recipe: ExtractedRecipe, userId: string | null): Recipe {
  return {
    id: '', // Temporary ID, will be replaced
    user_id: userId || '',
    chef_id: null,
    source_id: null,
    name: recipe.name,
    description: recipe.description || '',
    ingredients: JSON.stringify(recipe.ingredients),
    instructions: JSON.stringify(recipe.instructions),
    cuisine: recipe.cuisine || null,
    tags: JSON.stringify(recipe.tags || []),
    difficulty: recipe.difficulty || null,
    prep_time: null,
    cook_time: null,
    servings: null,
    image_url: null,
    images: null,
    is_ai_generated: false,
    is_public: true,
    is_system_recipe: !userId,
    nutrition_info: null,
    model_used: null,
    source: null,
    license: 'ALL_RIGHTS_RESERVED', // Default license for crawled recipes
    created_at: new Date(),
    updated_at: new Date(),
    search_query: null,
    discovery_date: null,
    confidence_score: null,
    validation_model: null,
    embedding_model: null,
    discovery_week: null,
    discovery_year: null,
    published_date: null,
    system_rating: null,
    system_rating_reason: null,
    avg_user_rating: null,
    total_user_ratings: null,
    slug: null,
    is_meal_prep_friendly: false,
    image_flagged_for_regeneration: false,
    image_regeneration_requested_at: null,
    image_regeneration_requested_by: null,
    like_count: 0,
    fork_count: 0,
    collection_count: 0,
    instruction_metadata: null,
    instruction_metadata_version: null,
    instruction_metadata_generated_at: null,
    instruction_metadata_model: null,
    content_flagged_for_cleanup: false,
    ingredients_need_cleanup: false,
    instructions_need_cleanup: false,
    deleted_at: null,
    deleted_by: null,
    // Meal pairing metadata (v0.65.0)
    weight_score: null,
    richness_score: null,
    acidity_score: null,
    sweetness_level: null,
    dominant_textures: null,
    dominant_flavors: null,
    serving_temperature: null,
    pairing_rationale: null,
    video_url: null,
    // Waste-reduction and resourcefulness fields (v0.45.0)
    resourcefulness_score: null,
    waste_reduction_tags: null,
    scrap_utilization_notes: null,
    environmental_notes: null,
    // QA tracking fields (v0.7.1)
    qa_status: null,
    qa_timestamp: null,
    qa_method: null,
    qa_confidence: null,
    qa_notes: null,
    qa_issues_found: null,
    qa_fixes_applied: null,
    // Moderation fields (v0.7.4)
    moderation_status: 'pending',
    moderation_notes: null,
    moderated_by: null,
    moderated_at: null,
    submission_notes: null,
    // Text cleanup tracking
    last_cleaned_at: null,
    last_cleaned_model: null,
  };
}

/**
 * IMPORTANT: an embedding failure must not block recipe storage, so this
 * returns null instead of throwing.
 */
async function tryEmbedding(
  recipe: ExtractedRecipe,
  userId: string | null
): Promise<RecipeEmbeddingResult | null> {
  try {
    console.log(`[Store] Generating embedding for: ${recipe.name}`);
    const result = await generateRecipeEmbedding(embeddingInput(recipe, userId));
    console.log(`[Store] Successfully generated embedding (${result.embedding.length} dimensions)`);
    return result;
  } catch (error: unknown) {
    console.error(
      `[Store] Failed to generate embedding for "${recipe.name}":`,
      toErrorMessage(error)
    );
    console.error(
      `[Store] Error details:`,
      JSON.stringify((error as { details?: unknown }).details || {}).substring(0, 300)
    );
    console.warn(
      `[Store] Continuing without embedding - recipe will be saved but won't be searchable`
    );
    return null;
  }
}

/** Saves the embedding when one was generated; a failed save is logged, never thrown. */
async function trySaveEmbedding(recipeId: string, embedding: RecipeEmbeddingResult | null) {
  if (!embedding) {
    console.warn(`[Store] Recipe saved WITHOUT embedding - will need manual embedding generation`);
    return;
  }
  try {
    await saveRecipeEmbedding(
      recipeId,
      embedding.embedding,
      embedding.embeddingText,
      embedding.modelName // #96 D57: was a stale MiniLM literal
    );
    console.log(`[Store] Successfully saved embedding to database`);
  } catch (error: unknown) {
    console.error(`[Store] Failed to save embedding to database:`, toErrorMessage(error));
    console.warn(`[Store] Recipe saved but embedding not stored - can be regenerated later`);
  }
}

/**
 * Why: both crawls store a recipe the same way; only their provenance differs (#142).
 * What: skips a duplicate (#135), rates the recipe, embeds it, inserts it, and
 * saves the embedding. An embedding failure stores the recipe without one; a
 * DB failure returns `success: false` with the Postgres error (#12).
 * `searchQuery` fills `search_query`; `week` fills `discovery_week`,
 * `discovery_year` and `published_date`.
 * Test: `src/lib/__tests__/recipe-crawl-store.test.ts`
 */
export async function storeCrawledRecipe(
  recipe: ExtractedRecipe,
  metadata: StoreRecipeMetadata
): Promise<StoreRecipeResult> {
  const { week } = metadata;
  try {
    console.log(`[Store] Storing recipe: ${recipe.name}`);

    const { userId } = await auth();

    // #135: never insert a duplicate (same canonical URL, or same title on the same host).
    const duplicate = await findDuplicateRecipe(
      { sourceUrl: metadata.sourceUrl, title: recipe.name },
      { ownerId: userId || 'system', titleRule: true }
    );
    if (duplicate) return { success: false, error: duplicateSkipReason(duplicate), duplicate };

    // #185: relative candidates resolve against the source page.
    const storedImages = downloadAndStoreImages(recipe.images || [], metadata.sourceUrl);

    // Evaluate recipe quality with AI
    console.log(`[Store] Evaluating recipe quality for "${recipe.name}"`);
    const qualityEval = await evaluateRecipeQuality({
      name: recipe.name,
      description: recipe.description,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      prepTime: recipe.prepTime,
      cookTime: recipe.cookTime,
      servings: recipe.servings,
    });
    console.log(`[Store] Quality rating: ${qualityEval.rating}/5 - ${qualityEval.reasoning}`);

    const embeddingResult = await tryEmbedding(recipe, userId ?? null);

    const publishedDate = week ? validateAndParseDate(week.publishedDate) : null;
    if (week) {
      console.log(
        `[Store] Week: ${week.info.week}, Year: ${week.info.year}, Published: ${publishedDate ? publishedDate.toISOString() : 'null'}`
      );
    }

    const [savedRecipe] = await db
      .insert(recipes)
      .values({
        user_id: userId || 'system',
        chef_id: null,
        name: recipe.name,
        description: recipe.description || '',
        ingredients: JSON.stringify(recipe.ingredients),
        instructions: JSON.stringify(recipe.instructions),
        prep_time: parseTimeToMinutes(recipe.prepTime),
        cook_time: parseTimeToMinutes(recipe.cookTime),
        // #12: LLM output may be a range string ("4 to 6"); write an integer or null.
        servings: toRecipeInt(recipe.servings),
        cuisine: recipe.cuisine || null,
        tags: JSON.stringify(recipe.tags || []),
        difficulty: recipe.difficulty || null,
        images: JSON.stringify(storedImages),
        source: metadata.sourceUrl,
        search_query: metadata.searchQuery,
        discovery_date: new Date(),
        discovery_week: week?.info.week,
        discovery_year: week?.info.year,
        published_date: publishedDate,
        confidence_score: recipe.confidenceScore.toString(),
        validation_model: 'anthropic/claude-3-haiku',
        // #96 D57: label from the embedder, not a stale MiniLM literal.
        embedding_model: embeddingResult?.modelName ?? null,
        is_ai_generated: false,
        is_public: true,
        is_system_recipe: !userId,
        // Quality rating fields
        system_rating: qualityEval.rating.toFixed(1),
        system_rating_reason: qualityEval.reasoning,
        avg_user_rating: null,
        total_user_ratings: 0,
      })
      .returning();

    await trySaveEmbedding(savedRecipe.id, embeddingResult);

    const weekNote = week ? ` (Week ${week.info.week}, ${week.info.year})` : '';
    console.log(`[Store] Successfully stored recipe with ID: ${savedRecipe.id}${weekNote}`);

    return { success: true, recipeId: savedRecipe.id };
  } catch (error: unknown) {
    // #12: report the Postgres error on err.cause, not the Drizzle wrapper.
    const errorMsg = describeDbError(error);
    console.error(`[Store] Error storing recipe:`, errorMsg);
    if (week) {
      console.error(`[Store] Error details:`, {
        recipeName: recipe.name,
        publishedDateInput: week.publishedDate,
        weekInfo: week.info,
        errorStack: (error as Error).stack?.substring(0, 500),
      });
    }
    return { success: false, error: errorMsg };
  }
}

/**
 * Stores a recipe found by the search crawl.
 *
 * @param recipe - Recipe to store
 * @param metadata - Source URL and the search query that found it
 * @returns Result with recipe ID
 */
export async function storeRecipe(
  recipe: ExtractedRecipe,
  metadata: { sourceUrl: string; searchQuery: string }
): Promise<StoreRecipeResult> {
  return storeCrawledRecipe(recipe, metadata);
}
