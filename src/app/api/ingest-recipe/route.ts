/**
 * Recipe Ingestion API Endpoint
 *
 * POST /api/ingest-recipe
 *
 * Automatically ingests recipes from URLs:
 * 1. Fetches content using Firecrawl
 * 2. Parses with LLM (Claude Sonnet 4.5)
 * 3. Generates unique slug
 * 4. Saves to database with default settings
 *
 * Authentication:
 * - API Key: Authorization: Bearer <API_KEY>
 * - Admin: Session-based authentication
 *
 * Request Body:
 * - Single URL: { "url": "https://..." }
 * - Multiple URLs: { "urls": ["https://...", "https://..."] }
 *
 * Default Recipe Settings:
 * - is_public: true (shared/public by default)
 * - is_system_recipe: true
 * - license: 'PUBLIC_DOMAIN'
 * - chef_id: null (unless detected)
 */

import { type NextRequest, NextResponse } from 'next/server';
import { generateRecipeEmbedding, type RecipeEmbeddingResult } from '@/lib/ai/embeddings';
import {
  type IngestedRecipe,
  type ParsedIngredient,
  parseRecipeForIngestion,
} from '@/lib/ai/recipe-ingestion-parser';
import { requireScopes } from '@/lib/api-auth/require-auth';
import { SCOPES } from '@/lib/api-auth/scopes';
import { db } from '@/lib/db';
import { saveRecipeEmbedding } from '@/lib/db/embeddings';
import { recipes } from '@/lib/db/schema';
import { scrapeRecipePage } from '@/lib/firecrawl';
import { checkRateLimit } from '@/lib/rate-limit';
import { paidCallRefusal, refusalFor, refusalResponse } from '@/lib/rate-limit/refusal';
import {
  type DuplicateMatch,
  duplicateRefusal,
  duplicateSkipReason,
  findDuplicateRecipe,
} from '@/lib/recipes/dedup';
import { toErrorMessage } from '@/lib/utils/error-handling';
import { metadataImageSources, pickRecipeImage } from '@/lib/utils/recipe-image-picker';
import { toRecipeInt } from '@/lib/utils/recipe-int';
import { generateUniqueSlug } from '@/lib/utils/slug';

// ============================================================================
// TYPES
// ============================================================================

interface SingleUrlRequest {
  url: string;
}

interface BatchUrlRequest {
  urls: string[];
}

type IngestRequest = SingleUrlRequest | BatchUrlRequest;

interface RecipeIngestionResult {
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
 * Ingest a single recipe from a URL
 */
async function ingestSingleRecipe(url: string, userId: string): Promise<RecipeIngestionResult> {
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
        is_system_recipe: true,
        nutrition_info: parsedRecipe.nutritionInfo
          ? JSON.stringify(parsedRecipe.nutritionInfo)
          : null,
        model_used: null,
        source: url,
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
    const [savedRecipe] = await db
      .insert(recipes)
      .values({
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
        is_system_recipe: true, // SYSTEM recipe by default
        license: 'PUBLIC_DOMAIN', // PUBLIC_DOMAIN by default
        source: url,
        slug,
        model_used: 'anthropic/claude-sonnet-4.5',
        // #96 D57: label from the embedder, not a stale MiniLM literal.
        embedding_model: embeddingResult?.modelName ?? null,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning();

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

// ============================================================================
// API ROUTE HANDLER
// ============================================================================

/**
 * POST /api/ingest-recipe
 *
 * Requires: write:recipes scope (API key or admin auth)
 */
export const POST = requireScopes(
  [SCOPES.WRITE_RECIPES],
  async (request: NextRequest, auth, _context) => {
    // Each URL is a Firecrawl scrape + LLM parse, so every URL counts once against the
    // caller's bucket: keyed by API key (one key cannot spend the whole cap), else by user.
    const limiterKey = auth.apiKeyId ? `apikey:${auth.apiKeyId}` : `user:${auth.userId}`;
    const urlRefusal = async () =>
      refusalFor(await checkRateLimit('recipe-ingest-api', limiterKey), 'recipe ingest');
    try {
      // Parse request body
      const body: IngestRequest = await request.json();

      // Validate request
      if (!body) {
        return NextResponse.json(
          {
            success: false,
            error: 'Request body is required',
          },
          { status: 400 }
        );
      }

      // Handle single URL
      if ('url' in body) {
        console.log(`[Ingest API] Single URL request: ${body.url}`);

        if (!body.url || typeof body.url !== 'string') {
          return NextResponse.json(
            {
              success: false,
              error: 'URL is required and must be a string',
            },
            { status: 400 }
          );
        }

        const refusal = await urlRefusal();
        if (refusal) return refusalResponse(refusal);

        const result = await ingestSingleRecipe(body.url, auth.userId!);
        if (result.errorCode) {
          return NextResponse.json(
            { success: false, error: result.error, errorCode: result.errorCode },
            { status: 503 }
          );
        }

        if (result.success) {
          return NextResponse.json(
            {
              success: true,
              recipe: result.recipe,
            },
            { status: 201 }
          );
        } else if (result.duplicate) {
          // #135: a duplicate is a conflict with a stored recipe, not a bad request.
          // `duplicateOf` is undefined, so absent from the JSON, for a hidden recipe.
          return NextResponse.json(
            { success: false, error: result.error, duplicateOf: result.duplicateOf },
            { status: 409 }
          );
        } else {
          return NextResponse.json(
            {
              success: false,
              error: result.error,
            },
            { status: 400 }
          );
        }
      }

      // Handle batch URLs
      if ('urls' in body) {
        console.log(`[Ingest API] Batch request: ${body.urls.length} URLs`);

        if (!Array.isArray(body.urls) || body.urls.length === 0) {
          return NextResponse.json(
            {
              success: false,
              error: 'URLs must be a non-empty array',
            },
            { status: 400 }
          );
        }

        // Process all URLs
        const results: RecipeIngestionResult[] = [];
        for (const url of body.urls) {
          if (typeof url !== 'string') {
            results.push({
              success: false,
              url: String(url),
              error: 'URL must be a string',
            });
            continue;
          }

          const refusal = await urlRefusal();
          if (refusal) {
            // Nothing ran yet: answer 429/503 like a single request; else stop and report.
            if (results.length === 0) return refusalResponse(refusal);
            results.push({
              success: false,
              url,
              error: refusal.error,
              errorCode: refusal.errorCode,
            });
            break;
          }

          const result = await ingestSingleRecipe(url, auth.userId!);
          results.push(result);
          if (result.errorCode) break; // #57: the cost ceiling refuses every later URL too

          // Rate limiting: 1 second between requests
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        // Calculate statistics
        const successCount = results.filter((r) => r.success).length;
        const failedCount = results.filter((r) => !r.success).length;

        return NextResponse.json(
          {
            success: true,
            stats: {
              total: results.length,
              success: successCount,
              failed: failedCount,
              successRate: `${((successCount / results.length) * 100).toFixed(1)}%`,
            },
            results: results.map((r) => ({
              url: r.url,
              success: r.success,
              recipe: r.recipe,
              error: r.error,
              errorCode: r.errorCode,
              duplicateOf: r.duplicateOf, // #135
            })),
          },
          { status: 200 }
        );
      }

      // Invalid request format
      return NextResponse.json(
        {
          success: false,
          error: 'Request must include either "url" or "urls" field',
        },
        { status: 400 }
      );
    } catch (error: unknown) {
      console.error('[Ingest API] Fatal error:', error);
      return NextResponse.json(
        {
          success: false,
          error: toErrorMessage(error),
        },
        { status: 500 }
      );
    }
  }
);

/**
 * GET /api/ingest-recipe
 *
 * Returns API information
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/ingest-recipe',
    method: 'POST',
    description: 'Automatically ingest recipes from URLs',
    authentication: {
      required: true,
      methods: ['API Key (Bearer token)', 'Admin Session'],
      scope: 'write:recipes',
    },
    requestBody: {
      singleUrl: {
        url: 'https://example.com/recipe',
      },
      batchUrls: {
        urls: ['https://example.com/recipe1', 'https://example.com/recipe2'],
      },
    },
    responseFormat: {
      single: {
        success: true,
        recipe: {
          id: 'uuid',
          name: 'Recipe Name',
          slug: 'recipe-slug',
          url: '/recipes/recipe-slug',
        },
      },
      batch: {
        success: true,
        stats: {
          total: 2,
          success: 1,
          failed: 1,
          successRate: '50.0%',
        },
        results: [
          {
            url: 'https://example.com/recipe1',
            success: true,
            recipe: {
              id: 'uuid',
              name: 'Recipe Name',
              slug: 'recipe-slug',
              url: '/recipes/recipe-slug',
            },
          },
          {
            url: 'https://example.com/recipe2',
            success: false,
            error: 'Error message',
          },
        ],
      },
    },
    defaultSettings: {
      is_public: true,
      is_system_recipe: true,
      license: 'PUBLIC_DOMAIN',
      chef_id: null,
    },
    example: {
      curl: `curl -X POST http://localhost:3002/api/ingest-recipe \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{"url": "https://www.sanaacooks.com/blog/tag/Dan+Barber"}'`,
    },
  });
}
