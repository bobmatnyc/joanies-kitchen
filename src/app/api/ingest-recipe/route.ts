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
 * Authentication (admin-only, #233):
 * - API Key: Authorization: Bearer <API_KEY>, owned by an admin
 * - Session: a signed-in admin
 * Admin status is the caller's (or the key owner's) `users.is_admin`. A non-admin,
 * or a failed lookup, gets 403 before any scrape, LLM call, rate-limit count or insert.
 *
 * Request Body:
 * - Single URL: { "url": "https://..." }
 * - Multiple URLs: { "urls": ["https://...", "https://..."] }
 *
 * Default Recipe Settings:
 * - is_public: true (shared/public by default)
 * - is_system_recipe: true (only admins reach the insert, #233)
 * - license: 'PUBLIC_DOMAIN'
 * - chef_id: null (unless detected)
 */

import { type NextRequest, NextResponse } from 'next/server';
import { isPendingDeletionRefusal } from '@/lib/account-deletion/guarded-insert';
import { apiForbidden } from '@/lib/api/responses';
import { requireScopes } from '@/lib/api-auth/require-auth';
import { SCOPES } from '@/lib/api-auth/scopes';
import { checkRateLimit } from '@/lib/rate-limit';
import { refusalFor, refusalResponse } from '@/lib/rate-limit/refusal';
import {
  ingestSingleRecipe,
  isAdminUser,
  type RecipeIngestionResult,
} from '@/lib/recipes/ingest-single-recipe';
import { toErrorMessage } from '@/lib/utils/error-handling';

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

// ============================================================================
// API ROUTE HANDLER
// ============================================================================

/**
 * POST /api/ingest-recipe
 *
 * Requires: write:recipes scope, and an admin caller (session or API-key owner)
 */
export const POST = requireScopes(
  [SCOPES.WRITE_RECIPES],
  async (request: NextRequest, auth, _context) => {
    // #233: admin-only route; refuse a non-admin before any scrape, LLM, rate-limit or insert.
    if (!auth.userId || !(await isAdminUser(auth.userId))) {
      return apiForbidden('Admin access required');
    }
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
        if (isPendingDeletionRefusal(result)) {
          // #220: the account has a pending deletion; nothing was written.
          return NextResponse.json(
            { success: false, error: result.error, errorCode: result.errorCode },
            { status: 403 }
          );
        }
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
          // #220: every later URL would be refused too. Nothing ran yet: answer 403 like a
          // single request; else stop and report (the `break` below).
          if (isPendingDeletionRefusal(result) && results.length === 0) {
            return NextResponse.json(
              { success: false, error: result.error, errorCode: result.errorCode },
              { status: 403 }
            );
          }
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
      adminOnly: true, // #233
      methods: ['API Key (Bearer token) owned by an admin', 'Admin Session'],
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
      is_system_recipe: true, // #233: admin-only route
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
