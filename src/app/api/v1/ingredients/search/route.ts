/**
 * REST API v1 - Ingredient Search Endpoint
 *
 * GET /api/v1/ingredients/search - Search ingredients by name
 *
 * Authentication: Requires Clerk session or API key
 * Authorization: Scope-based permissions
 */

import type { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api';
import { requireScopes, SCOPES } from '@/lib/api-auth';
import { ingredientService } from '@/lib/services';

/**
 * GET /api/v1/ingredients/search
 *
 * Search ingredients by name or alias
 *
 * Query Parameters:
 * - q: Search query (required, min 2 characters)
 * - limit: Maximum results to return (default: 20, max: 100)
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     ingredients: Ingredient[],
 *     query: string,
 *     total: number
 *   }
 * }
 *
 * Errors:
 * - 401: Not authenticated
 * - 403: Insufficient permissions (missing read:ingredients scope)
 * - 400: Missing or invalid query parameters
 * - 500: Internal server error
 */
export const GET = requireScopes([SCOPES.READ_INGREDIENTS], async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Get query parameter
    const query = searchParams.get('q');

    if (!query) {
      return apiError('Missing required query parameter: q', 400);
    }

    if (query.trim().length < 2) {
      return apiError('Query must be at least 2 characters long', 400);
    }

    // Parse limit parameter
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));

    // Search ingredients using service
    const ingredients = await ingredientService.search(query, limit);

    return apiSuccess({
      ingredients,
      query,
      total: ingredients.length,
    });
  } catch (error) {
    console.error('Error searching ingredients:', error);
    return apiError('Internal server error');
  }
});
