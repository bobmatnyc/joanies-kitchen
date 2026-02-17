/**
 * REST API v1 - Collections Endpoints
 *
 * GET    /api/v1/collections - List user's collections with filters
 * POST   /api/v1/collections - Create new collection
 *
 * Authentication: Requires Clerk session or API key
 * Authorization: Scope-based permissions
 */

import type { NextRequest } from 'next/server';
import {
  apiError,
  apiSuccess,
  apiSuccessPaginated,
  applyFilters,
  applyPagination,
  applySorting,
  parseJsonBody,
  parseQueryParams,
} from '@/lib/api';
import { requireScopes, SCOPES } from '@/lib/api-auth';
import { collectionService } from '@/lib/services/collection-service';
import {
  createCollectionSchema,
  listCollectionsQuerySchema,
} from '@/lib/validations/collection-api';

/**
 * GET /api/v1/collections
 *
 * List collections for the authenticated user with optional filtering
 *
 * Query Parameters:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 * - sortBy: Sort field (created_at, updated_at, name, recipe_count)
 * - order: Sort order (asc, desc)
 * - isPublic: Filter by public/private status
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     collections: Collection[],
 *     pagination: {
 *       page: number,
 *       limit: number,
 *       total: number,
 *       totalPages: number,
 *       hasMore: boolean
 *     }
 *   }
 * }
 *
 * Errors:
 * - 401: Not authenticated
 * - 403: Insufficient permissions (missing read:collections scope)
 * - 400: Invalid query parameters
 * - 500: Internal server error
 */
export const GET = requireScopes([SCOPES.READ_COLLECTIONS], async (request: NextRequest, auth) => {
  try {
    // Parse and validate query parameters
    const parsed = parseQueryParams(request, listCollectionsQuerySchema);
    if ('error' in parsed) return parsed.error;

    const { data: validatedQuery } = parsed;

    // Fetch user's collections
    const collections = await collectionService.findByUserId(auth.userId!, {
      includePrivate: true,
    });

    let filteredCollections = collections;

    // Build filter criteria
    const filters: Record<string, unknown> = {};
    if (validatedQuery.isPublic !== undefined) {
      filters.is_public = validatedQuery.isPublic;
    }

    // Apply filters
    filteredCollections = applyFilters(filteredCollections, filters);

    // Apply sorting (defaults guaranteed by schema)
    filteredCollections = applySorting(
      filteredCollections,
      validatedQuery.sortBy!,
      validatedQuery.order!
    );

    // Apply pagination (defaults guaranteed by schema)
    const { items: paginatedCollections, total } = applyPagination(
      filteredCollections,
      validatedQuery.page!,
      validatedQuery.limit!
    );

    return apiSuccessPaginated(
      paginatedCollections,
      validatedQuery.page!,
      validatedQuery.limit!,
      total
    );
  } catch (error) {
    console.error('Error fetching collections:', error);
    return apiError('Internal server error');
  }
});

/**
 * POST /api/v1/collections
 *
 * Create a new collection for the authenticated user
 *
 * Request Body:
 * {
 *   name: string,
 *   description?: string,
 *   is_public?: boolean,
 *   cover_image_url?: string
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: Collection
 * }
 *
 * Errors:
 * - 401: Not authenticated
 * - 403: Insufficient permissions (missing write:collections scope)
 * - 400: Invalid request body
 * - 500: Internal server error
 */
export const POST = requireScopes(
  [SCOPES.WRITE_COLLECTIONS],
  async (request: NextRequest, auth) => {
    try {
      // Parse and validate request body
      const parsed = await parseJsonBody(request, createCollectionSchema);
      if ('error' in parsed) return parsed.error;

      const { data: validatedData } = parsed;

      // Create collection using service
      const newCollection = await collectionService.create(auth.userId!, validatedData);

      return apiSuccess(newCollection, 201);
    } catch (error) {
      console.error('Error creating collection:', error);
      return apiError('Internal server error');
    }
  }
);
