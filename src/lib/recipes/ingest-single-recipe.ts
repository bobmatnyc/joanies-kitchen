/**
 * Single-URL recipe ingestion for POST /api/ingest-recipe (#298: moved from
 * src/app/api/ingest-recipe/route.ts, which may export only route handlers).
 *
 * Validates the URL, skips a #135 duplicate before the paid scrape, scrapes with
 * Firecrawl, parses with the LLM, embeds, and inserts the recipe.
 * Test: `src/app/api/ingest-recipe/__tests__/route-dedup.test.ts`
 */

import {
  insertUnlessPendingDeletion,
  pendingDeletionRefusal,
} from '@/lib/account-deletion/guarded-insert';
import { generateRecipeEmbedding, type RecipeEmbeddingResult } from '@/lib/ai/embeddings';
import {
  type IngestedRecipe,
  type ParsedIngredient,
  parseRecipeForIngestion,
} from '@/lib/ai/recipe-ingestion-parser';
import { getUserAdminFlag } from '@/lib/auth-users';
import { saveRecipeEmbedding } from '@/lib/db/embeddings';
import { recipes } from '@/lib/db/schema';
import { scrapeRecipePage } from '@/lib/firecrawl';
import { paidCallRefusal } from '@/lib/rate-limit/refusal';
import { withCanonicalConflict } from '@/lib/recipes/canonical-url-conflict';
import {
  canonicalizeSourceUrl,
  type DuplicateMatch,
  duplicateRefusal,
  duplicateSkipReason,
  findDuplicateRecipe,
} from '@/lib/recipes/dedup';
import { toErrorMessage } from '@/lib/utils/error-handling';
import { metadataImageSources, pickRecipeImage } from '@/lib/utils/recipe-image-picker';
import { toRecipeInt } from '@/lib/utils/recipe-int';
import { generateUniqueSlug } from '@/lib/utils/slug';

export interface RecipeIngestionResult {
  success: boolean;
  recipe?: {
    id: string;
    name: string;
    slug: string;
    url: string;
  };
  error?: string;
  /** Cost-ceiling code when the daily cap refused a paid call. */
  errorCode?: string;
  /** #135: true when this URL duplicates a stored recipe; nothing was inserted. */
  duplicate?: boolean;
  /** #135: id of that stored recipe, only when the caller may see it. */
  duplicateOf?: string;
  url: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

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
 * #135: the result for a candidate that duplicates a stored recipe. A recipe
 * the caller may not see is not named.
 */
function duplicateResult(
  url: string,
  match: DuplicateMatch,
  userId: string
): RecipeIngestionResult {
  console.log(`[Ingest API] ${duplicateSkipReason(match)} (${match.reason}): ${url}`);
  return { success: false, url, duplicate: true, ...duplicateRefusal(match, userId) };
}

/**
 * #233: the route is admin-only. Reads `users.is_admin` for the caller (a
 * session user or an API key's owner); a missing user or a failed lookup
 * counts as non-admin.
 * Test: `src/app/api/ingest-recipe/__tests__/route-admin-only.test.ts`
 */
export async function isAdminUser(userId: string): Promise<boolean> {
  try {
    return (await getUserAdminFlag(userId)) === true;
  } catch (error: unknown) {
    console.error('[Ingest API] users.is_admin lookup failed; treating as non-admin:', error);
    return false;
  }
}

/**
 * Ingest a single recipe from a URL
 */
export async function ingestSingleRecipe(
  url: string,
  userId: string
): Promise<RecipeIngestionResult> {
  try {
    console.log(`[Ingest API] Processing URL: ${url}`);

    // Step 1: Validate URL
    const urlValidation = isValidRecipeUrl(url);
    if (!urlValidation.valid) {
      return {
        success: false,
        url,
        error: urlValidation.error || 'Invalid URL',
      };
    }

    // #135: a URL variant of a stored source is skipped before the paid scrape. A user
    // import applies the canonical-URL rule only, never title+host. This replaces the
    // old slug check, which ran after `generateUniqueSlug` and so never fired.
    const duplicate = await findDuplicateRecipe(
      { sourceUrl: url },
      { ownerId: userId, titleRule: false }
    );
    if (duplicate) return duplicateResult(url, duplicate, userId);

    // Step 2: Fetch content with Firecrawl
    console.log(`[Ingest API] Fetching content from ${url}`);
    const scrapeResult = await scrapeRecipePage(url);

    if (!scrapeResult.success || !scrapeResult.markdown) {
      return {
        success: false,
        url,
        error: scrapeResult.error || 'Failed to fetch content',
      };
    }

    // Step 3: Parse content with LLM
    console.log(`[Ingest API] Parsing recipe content`);
    const parsedRecipe: IngestedRecipe = await parseRecipeForIngestion(scrapeResult.markdown, url);

    console.log(`[Ingest API] Successfully parsed recipe: ${parsedRecipe.name}`);

    // #185: og:image first, then the parser's pick; a site logo or icon is stored as NULL.
    const imageUrl = pickRecipeImage(
      { ...metadataImageSources(scrapeResult.metadata), contentImages: parsedRecipe.image_url },
      url
    );
    const imagesJson = imageUrl ? JSON.stringify([imageUrl]) : null;

    // Step 4: Generate unique slug
    const slug = await generateUniqueSlug(parsedRecipe.name);
    console.log(`[Ingest API] Generated slug: ${slug}`);

    // Step 6: Prepare recipe data
    const ingredientsJson = JSON.stringify(
      parsedRecipe.ingredients.map((ing: ParsedIngredient) => ({
        quantity: ing.quantity,
        unit: ing.unit,
        name: ing.name,
        notes: ing.notes,
        preparation: ing.preparation,
      }))
    );

    const instructionsJson = JSON.stringify(parsedRecipe.instructions);
    const tagsJson = JSON.stringify(parsedRecipe.tags || []);

    // Step 7: Generate embedding (non-blocking)
    let embeddingResult: RecipeEmbeddingResult | null = null; // #96 D57: carries modelName
    try {
      console.log(`[Ingest API] Generating embedding for: ${parsedRecipe.name}`);
      embeddingResult = await generateRecipeEmbedding({
        id: '',
        user_id: userId,
        chef_id: null,
        source_id: null,
        name: parsedRecipe.name,
        description: parsedRecipe.description || '',
        ingredients: ingredientsJson,
        instructions: instructionsJson,
        cuisine: parsedRecipe.cuisine || null,
        tags: tagsJson,
        difficulty: parsedRecipe.difficulty || null,
        // #12: the parser accepts any number (4.5 fails an integer column).
        prep_time: toRecipeInt(parsedRecipe.prep_time),
        cook_time: toRecipeInt(parsedRecipe.cook_time),
        servings: toRecipeInt(parsedRecipe.servings),
        image_url: imageUrl, // #185
        images: imagesJson,
        is_ai_generated: false,
        is_public: true,
        is_system_recipe: true, // #233: only admins reach this
        nutrition_info: parsedRecipe.nutritionInfo
          ? JSON.stringify(parsedRecipe.nutritionInfo)
          : null,
        model_used: null,
        source: url,
        canonical_source_url: null, // #142: the Recipe type requires it; this row is never stored
        license: 'PUBLIC_DOMAIN',
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
        slug,
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
        weight_score: null,
        richness_score: null,
        acidity_score: null,
        sweetness_level: null,
        dominant_textures: null,
        dominant_flavors: null,
        serving_temperature: null,
        pairing_rationale: null,
        video_url: parsedRecipe.video_url || null,
        resourcefulness_score: null,
        waste_reduction_tags: null,
        scrap_utilization_notes: null,
        environmental_notes: null,
        qa_status: null,
        qa_timestamp: null,
        qa_method: null,
        qa_confidence: null,
        qa_notes: null,
        qa_issues_found: null,
        qa_fixes_applied: null,
        moderation_status: 'pending',
        moderation_notes: null,
        moderated_by: null,
        moderated_at: null,
        submission_notes: null,
        last_cleaned_at: null,
        last_cleaned_model: null,
      });
      console.log(`[Ingest API] Embedding generated successfully`);
    } catch (error: unknown) {
      console.error(`[Ingest API] Failed to generate embedding:`, toErrorMessage(error));
      embeddingResult = null;
    }

    // Step 8: Save to database
    console.log(`[Ingest API] Saving recipe to database`);
    // #220: refused in the insert statement itself for an account pending deletion;
    // the embedding below is saved only when the recipe landed.
    // #142: a URL another live recipe holds answers as a #135 duplicate (409); under
    // another name (a roundup page) the recipe is stored with a NULL key.
    const candidate = { sourceUrl: url, name: parsedRecipe.name };
    const inserted = await withCanonicalConflict(candidate, (key) =>
      insertUnlessPendingDeletion(
        recipes,
        {
          user_id: userId,
          chef_id: null,
          source_id: null,
          name: parsedRecipe.name,
          description: parsedRecipe.description || '',
          ingredients: ingredientsJson,
          instructions: instructionsJson,
          // #12: the parser accepts any number (4.5 fails an integer column).
          prep_time: toRecipeInt(parsedRecipe.prep_time),
          cook_time: toRecipeInt(parsedRecipe.cook_time),
          servings: toRecipeInt(parsedRecipe.servings),
          difficulty: parsedRecipe.difficulty || null,
          cuisine: parsedRecipe.cuisine || null,
          tags: tagsJson,
          image_url: imageUrl, // #185
          images: imagesJson,
          video_url: parsedRecipe.video_url || null,
          nutrition_info: parsedRecipe.nutritionInfo
            ? JSON.stringify(parsedRecipe.nutritionInfo)
            : null,
          is_ai_generated: false,
          is_public: true, // PUBLIC by default
          is_system_recipe: true, // #233: the route is admin-only
          license: 'PUBLIC_DOMAIN', // PUBLIC_DOMAIN by default
          source: url,
          canonical_source_url: canonicalizeSourceUrl(url), // #142: indexed dedup key
          slug,
          model_used: 'anthropic/claude-sonnet-4.5',
          // #96 D57: label from the embedder, not a stale MiniLM literal.
          embedding_model: embeddingResult?.modelName ?? null,
          created_at: new Date(),
          updated_at: new Date(),
          ...key,
        },
        userId
      )
    );
    if (!inserted.ok) return duplicateResult(url, inserted.duplicate, userId);
    const guarded = inserted.value;
    if (!guarded.allowed) {
      return { url, ...pendingDeletionRefusal('import recipes') };
    }
    const savedRecipe = guarded.row as typeof recipes.$inferSelect; // allowed: the row is set

    // Step 9: Save embedding if generated
    if (embeddingResult) {
      try {
        await saveRecipeEmbedding(
          savedRecipe.id,
          embeddingResult.embedding,
          embeddingResult.embeddingText,
          embeddingResult.modelName // #96 D57: was a stale MiniLM literal
        );
        console.log(`[Ingest API] Embedding saved successfully`);
      } catch (error: unknown) {
        console.error(`[Ingest API] Failed to save embedding:`, toErrorMessage(error));
      }
    }

    console.log(`[Ingest API] Recipe saved successfully: ${savedRecipe.id}`);

    return {
      success: true,
      url,
      recipe: {
        id: savedRecipe.id,
        name: savedRecipe.name,
        slug: savedRecipe.slug!,
        url: `/recipes/${savedRecipe.slug}`,
      },
    };
  } catch (error: unknown) {
    console.error(`[Ingest API] Error ingesting recipe from ${url}:`, error);
    const blocked = paidCallRefusal(error); // #57: typed cost-ceiling code
    return {
      success: false,
      url,
      error: blocked?.error ?? toErrorMessage(error),
      errorCode: blocked?.errorCode,
    };
  }
}
