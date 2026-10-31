'use server';

/**
 * Recipe Discovery Pipeline
 *
 * Complete 6-step pipeline for discovering, validating, and storing recipes:
 * 1. Brave Search API → Find recipe URLs
 * 2. LLM Validation → Extract & validate recipe data from URLs
 * 3. LLM Tagging → Generate tags, cuisine, difficulty, dietary info
 * 4. Generate Embeddings → Create 384-dimensional vector
 * 5. Save to DB → Store recipe with full provenance + embedding
 * 6. Return Results → Display validated recipes to user
 *
 * #142: steps 1-3 live in `src/lib/recipe-discovery-steps.ts`.
 */

import {
  AccountPendingDeletionError,
  insertUnlessPendingDeletion,
  pendingDeletionRefusal,
} from '@/lib/account-deletion/guarded-insert';
import { generateRecipeEmbedding } from '@/lib/ai/embeddings';
import { checkAuth, requireAuth } from '@/lib/auth-guard';
import { isPaidCallBlocked } from '@/lib/costs';
import { db } from '@/lib/db';
import { saveRecipeEmbedding } from '@/lib/db/embeddings';
import { type Recipe, recipes } from '@/lib/db/schema';
import { paidCallRefusal, rateLimitRefusal } from '@/lib/rate-limit/refusal';
import {
  discoverRecipeUrls,
  type ExtractedRecipe,
  extractAndValidateRecipe,
  generateRecipeMetadata,
  type RecipeDiscoveryOptions,
  type RecipeMetadata,
} from '@/lib/recipe-discovery-steps';
import {
  duplicateRefusal,
  duplicateSkipReason,
  findDuplicateRecipe,
  isDisclosableDuplicate,
} from '@/lib/recipes/dedup';
import { toErrorMessage } from '@/lib/utils/error-handling';
import { toRecipeInt } from '@/lib/utils/recipe-int';

// #142: moved; re-exported so importers of this module keep their types.
export type {
  ExtractedRecipe,
  RecipeDiscoveryOptions,
  RecipeMetadata,
} from '@/lib/recipe-discovery-steps';

export interface DiscoveryResult {
  success: boolean;
  recipes: Recipe[];
  stats: {
    searched: number;
    validated: number;
    saved: number;
    failed: number;
    skipped: number;
  };
  errors?: Array<{
    url: string;
    step: string;
    error: string;
  }>;
  error?: string;
  /** Rate-limit or cost-ceiling refusal code; see `@/lib/rate-limit/refusal`. */
  errorCode?: string;
  retryAfterSec?: number;
}

/** One discovery call pays per URL, so the caller's `maxResults` is capped. */
const MAX_DISCOVERY_RESULTS = 10;

/** #220: the refused action for a discovered recipe's save. */
const SAVE_ACTION = 'save discovered recipes';

// ============================================================================
// Steps 4 & 5: Generate Embedding & Save with Provenance
// ============================================================================

/**
 * Saves discovered recipe with embedding and full provenance tracking
 */
async function saveDiscoveredRecipe(
  recipe: ExtractedRecipe,
  metadata: RecipeMetadata,
  source: {
    url: string;
    title: string;
    searchQuery: string;
    confidenceScore: number;
  }
): Promise<string> {
  // Check authentication (required for saving discovered recipes)
  const { userId, isAuthenticated } = await checkAuth();

  // #220: `!userId` is the same test; it narrows the id the guarded insert takes.
  if (!isAuthenticated || !userId) {
    throw new Error('Authentication required to save discovered recipes');
  }

  // Create recipe object for embedding generation
  const recipeForEmbedding: Partial<Recipe> = {
    name: recipe.name,
    description: recipe.description,
    ingredients: JSON.stringify(recipe.ingredients),
    instructions: JSON.stringify(recipe.instructions),
    cuisine: metadata.cuisine,
    tags: JSON.stringify(metadata.tags),
    difficulty: metadata.difficulty,
  };

  // Step 4: Generate embedding
  let embeddingResult;
  try {
    embeddingResult = await generateRecipeEmbedding(recipeForEmbedding as Recipe);
  } catch (error) {
    console.error('Embedding generation error:', error);
    // Continue without embedding - will retry later
    embeddingResult = null;
  }

  // Step 5: Save recipe with provenance
  // #220: refused in the insert statement itself for an account pending deletion; the
  // embedding row below is written only when the recipe landed.
  const guarded = await insertUnlessPendingDeletion(
    recipes,
    {
      user_id: userId,
      chef_id: null,
      name: recipe.name,
      description: recipe.description,
      ingredients: JSON.stringify(recipe.ingredients),
      instructions: JSON.stringify(recipe.instructions),
      // #12: LLM JSON is unvalidated ("4 to 6", or a bare number that broke .match).
      prep_time: toRecipeInt(recipe.prepTime),
      cook_time: toRecipeInt(recipe.cookTime),
      servings: toRecipeInt(recipe.servings),
      cuisine: metadata.cuisine,
      tags: JSON.stringify(metadata.tags),
      difficulty: metadata.difficulty,
      source: source.url,
      search_query: source.searchQuery,
      discovery_date: new Date(),
      confidence_score: source.confidenceScore.toFixed(2),
      validation_model: 'anthropic/claude-3-haiku',
      // #96 D57: label from the embedder, not a stale MiniLM literal.
      embedding_model: embeddingResult?.modelName ?? null,
      is_ai_generated: false, // Discovered from web
      is_public: !userId, // Anonymous discoveries are public
      is_system_recipe: !userId, // Anonymous = system recipe
      nutrition_info: null,
      image_url: null,
      images: null,
    },
    userId
  );
  if (!guarded.allowed) throw new AccountPendingDeletionError(SAVE_ACTION);
  const savedRecipe = guarded.row as Recipe; // allowed with no onConflict: the row is set

  // Save embedding if generation succeeded
  if (embeddingResult && savedRecipe.id) {
    try {
      await saveRecipeEmbedding(
        savedRecipe.id,
        embeddingResult.embedding,
        embeddingResult.embeddingText,
        embeddingResult.modelName
      );
    } catch (error) {
      console.error('Failed to save embedding:', error);
      // Continue - embedding can be regenerated later
    }
  }

  return savedRecipe.id;
}

interface StoredDuplicate {
  refusal: { error: string; duplicateOf?: string };
  recipe?: Recipe;
}

/**
 * #135: the stored recipe `url` duplicates, if any. A user import applies the
 * canonical-URL rule only, never title+host. `refusal` names the recipe only
 * when the caller may see it; `recipe` is set for linking only on a
 * `source-url` match the caller may see.
 */
async function storedDuplicate(url: string, userId: string): Promise<StoredDuplicate | null> {
  const match = await findDuplicateRecipe(
    { sourceUrl: url },
    { ownerId: userId, titleRule: false }
  );
  if (!match) return null;
  console.log(`${duplicateSkipReason(match)} (${match.reason}): ${url}`);
  const refusal = duplicateRefusal(match, userId);
  if (match.reason !== 'source-url' || !isDisclosableDuplicate(match, userId)) return { refusal };
  const recipe = await db.query.recipes.findFirst({
    where: (recipes, { eq }) => eq(recipes.id, match.id),
  });
  return { refusal, recipe };
}

// ============================================================================
// Step 6: Main Discovery Function
// ============================================================================

/**
 * Main recipe discovery pipeline
 * Orchestrates all 6 steps with error handling and rate limiting
 */
export async function discoverRecipes(
  query: string,
  options: RecipeDiscoveryOptions = {}
): Promise<DiscoveryResult> {
  // Require authentication for recipe discovery pipeline
  const { userId } = await requireAuth('recipe discovery');

  const { minConfidence = 0.6 } = options;
  const maxResults = Math.min(options.maxResults ?? 5, MAX_DISCOVERY_RESULTS);
  const emptyStats = { searched: 0, validated: 0, saved: 0, failed: 0, skipped: 0 };
  // Per-user limit before Brave and the LLM calls; fails closed when the limiter is down.
  const refusal = await rateLimitRefusal('recipe-discovery', userId, 'recipe discovery');
  if (refusal) return { ...refusal, recipes: [], stats: emptyStats };

  const errors: Array<{ url: string; step: string; error: string }> = [];
  let searched = 0;
  let validated = 0;
  let saved = 0;
  let failed = 0;
  let skipped = 0;
  // #220: declared outside the try, so a mid-batch refusal still returns earlier saves.
  const discoveredRecipes: Recipe[] = [];

  try {
    // Step 1: Search for recipe URLs
    console.log('Step 1: Searching for recipes...');
    const searchResults = await discoverRecipeUrls(query, { ...options, maxResults });
    searched = searchResults.length;

    if (searchResults.length === 0) {
      return {
        success: true,
        recipes: [],
        stats: { searched: 0, validated: 0, saved: 0, failed: 0, skipped: 0 },
      };
    }

    // #135: a skipped duplicate is counted, reported, and linked when the caller may see it.
    const skipAsDuplicate = (url: string, dup: StoredDuplicate) => {
      skipped++;
      errors.push({ url, step: 'dedup', error: dup.refusal.error });
      if (dup.recipe) discoveredRecipes.push(dup.recipe);
    };

    // Process each URL sequentially to avoid rate limits
    for (let i = 0; i < searchResults.length; i++) {
      const result = searchResults[i];
      console.log(`Processing ${i + 1}/${searchResults.length}: ${result.url}`);

      try {
        // #135: a URL variant of a stored source is linked, not extracted again.
        const urlDup = await storedDuplicate(result.url, userId);
        if (urlDup) {
          skipAsDuplicate(result.url, urlDup);
          continue;
        }

        // Step 2: Extract & validate recipe
        const extraction = await extractAndValidateRecipe(result.url, result.title);

        if (!extraction.success || !extraction.recipe) {
          failed++;
          errors.push({
            url: result.url,
            step: 'extraction',
            error: extraction.error || 'Unknown extraction error',
          });
          console.log(`Failed to extract: ${extraction.error}`);
          continue;
        }

        validated++;

        // Check confidence threshold
        if (extraction.confidenceScore && extraction.confidenceScore < minConfidence) {
          skipped++;
          errors.push({
            url: result.url,
            step: 'validation',
            error: `Low confidence: ${extraction.confidenceScore.toFixed(2)} < ${minConfidence}`,
          });
          console.log(`Skipped: confidence ${extraction.confidenceScore.toFixed(2)} too low`);
          continue;
        }

        // Step 3: Generate metadata
        console.log('Generating metadata...');
        const metadata = await generateRecipeMetadata(extraction.recipe);

        // Steps 4 & 5: Generate embedding & save
        console.log('Saving recipe with embedding...');
        const recipeId = await saveDiscoveredRecipe(extraction.recipe, metadata, {
          url: result.url,
          title: result.title,
          searchQuery: query,
          confidenceScore: extraction.confidenceScore || 0.7,
        });

        saved++;

        // Fetch saved recipe for return
        const savedRecipe = await db.query.recipes.findFirst({
          where: (recipes, { eq }) => eq(recipes.id, recipeId),
        });

        if (savedRecipe) {
          discoveredRecipes.push(savedRecipe);
        }

        console.log(`Successfully saved: ${extraction.recipe.name}`);

        // Rate limiting: 2 second delay between requests
        if (i < searchResults.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      } catch (error) {
        if (isPaidCallBlocked(error)) throw error; // #57: stop the loop; the outer catch maps it
        if (error instanceof AccountPendingDeletionError) throw error; // #220: as above
        failed++;
        errors.push({
          url: result.url,
          step: 'pipeline',
          error: toErrorMessage(error),
        });
        console.error(`Pipeline error for ${result.url}:`, error);
      }
    }

    return {
      success: true,
      recipes: discoveredRecipes,
      stats: { searched, validated, saved, failed, skipped },
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('Discovery pipeline error:', error);
    if (error instanceof AccountPendingDeletionError) {
      // #220: the loop stops at the first refused save; earlier saves are returned.
      return {
        ...pendingDeletionRefusal(SAVE_ACTION),
        recipes: discoveredRecipes,
        stats: { searched, validated, saved, failed, skipped },
      };
    }
    const blocked = paidCallRefusal(error); // #57: typed cost-ceiling code
    return {
      ...blocked,
      success: false,
      recipes: [],
      stats: { searched, validated, saved, failed, skipped },
      errors: [
        {
          url: 'pipeline',
          step: 'initialization',
          error: toErrorMessage(error),
        },
      ],
    };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Quick discovery for single URL
 */
export async function discoverRecipeFromUrl(url: string): Promise<{
  success: boolean;
  recipe?: Recipe;
  error?: string;
  errorCode?: string;
  /** #135: set when `recipe` is the stored recipe this URL duplicates; nothing was inserted. */
  duplicateOf?: string;
}> {
  // Require authentication for URL-based recipe discovery
  const { userId } = await requireAuth('recipe import from URL');
  const refusal = await rateLimitRefusal('recipe-url-import', userId, 'recipe import');
  if (refusal) return refusal;

  try {
    // #135: link to a stored duplicate the caller may see instead of inserting one.
    const dup = await storedDuplicate(url, userId);
    if (dup) {
      return dup.recipe
        ? { success: true, recipe: dup.recipe, duplicateOf: dup.recipe.id }
        : { success: false, ...dup.refusal };
    }

    // Extract and validate
    const extraction = await extractAndValidateRecipe(url, 'Manual URL');

    if (!extraction.success || !extraction.recipe) {
      return {
        success: false,
        error: extraction.error || 'Failed to extract recipe',
      };
    }

    // Generate metadata
    const metadata = await generateRecipeMetadata(extraction.recipe);

    // Save recipe
    const recipeId = await saveDiscoveredRecipe(extraction.recipe, metadata, {
      url,
      title: 'Manual Import',
      searchQuery: '',
      confidenceScore: extraction.confidenceScore || 0.7,
    });

    // Fetch saved recipe
    const savedRecipe = await db.query.recipes.findFirst({
      where: (recipes, { eq }) => eq(recipes.id, recipeId),
    });

    return {
      success: true,
      recipe: savedRecipe,
    };
  } catch (error) {
    console.error('Single URL discovery error:', error);
    if (error instanceof AccountPendingDeletionError) return pendingDeletionRefusal(SAVE_ACTION); // #220
    const blocked = paidCallRefusal(error); // #57: typed cost-ceiling code
    if (blocked) return blocked;
    return {
      success: false,
      error: toErrorMessage(error),
    };
  }
}
