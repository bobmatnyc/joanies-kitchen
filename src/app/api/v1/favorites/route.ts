/**
 * REST API v1 - Favorites Collection Endpoints
 *
 * GET    /api/v1/favorites - List user's favorite recipes
 *
 * Authentication: Requires Clerk session or API key
 * Authorization: Scope-based permissions (read:favorites)
 */

import type { NextRequest } from 'next/server';
import {
  apiError,
  apiSuccessPaginated,
  applyPagination,
  applySorting,
  parseQueryParams,
} from '@/lib/api';
import { requireScopes, SCOPES } from '@/lib/api-auth';
import { socialService } from '@/lib/services';
import { listFavoritesQuerySchema } from '@/lib/validations/favorites-api';

/**
 * GET /api/v1/favorites
 *
 * List all recipes favorited by the authenticated user
 *
 * Query Parameters:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 * - sortBy: Sort field (created_at, name, updated_at)
 * - order: Sort order (asc, desc)
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     items: Recipe[],
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
 * - 403: Insufficient permissions (missing read:favorites scope)
 * - 400: Invalid query parameters
 * - 500: Internal server error
 */
export const GET = requireScopes([SCOPES.READ_FAVORITES], async (request: NextRequest, auth) => {
  try {
    // Parse and validate query parameters
    const parsed = parseQueryParams(request, listFavoritesQuerySchema);
    if ('error' in parsed) return parsed.error;

    const { data: validatedQuery } = parsed;

    // Fetch user's favorites
    const favorites = await socialService.getFavorites(auth.userId!);

    // Apply sorting (defaults guaranteed by schema)
    let sortedFavorites = applySorting(
      favorites,
      validatedQuery.sortBy!,
      validatedQuery.order!
    );

    // Apply pagination (defaults guaranteed by schema)
    const { items: paginatedFavorites, total } = applyPagination(
      sortedFavorites,
      validatedQuery.page!,
      validatedQuery.limit!
    );

    return apiSuccessPaginated(
      paginatedFavorites,
      validatedQuery.page!,
      validatedQuery.limit!,
      total
    );
  } catch (error) {
    console.error('Error fetching favorites:', error);
    return apiError('Internal server error');
  }
});
