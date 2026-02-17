/**
 * REST API v1 - Ingredients Collection Endpoints
 *
 * GET /api/v1/ingredients - List ingredients with filters
 *
 * Authentication: Requires Clerk session or API key
 * Authorization: Scope-based permissions
 */

import type { NextRequest } from 'next/server';
import { apiError, apiSuccessPaginated, applyPagination } from '@/lib/api';
import { requireScopes, SCOPES } from '@/lib/api-auth';
import { ingredientService } from '@/lib/services';

/**
 * GET /api/v1/ingredients
 *
 * List ingredients with optional filtering and pagination
 *
 * Query Parameters:
 * - category: Filter by category (e.g., 'vegetable', 'meat', 'dairy')
 * - search: Text search query (searches name, display_name, aliases)
 * - sort: Sort order ('alphabetical', 'most-used', 'recently-added') - default: 'alphabetical'
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 100, max: 200)
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     ingredients: Ingredient[],
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
 * - 403: Insufficient permissions (missing read:ingredients scope)
 * - 400: Invalid query parameters
 * - 500: Internal server error
 */
export const GET = requireScopes([SCOPES.READ_INGREDIENTS], async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse query parameters
    const category = searchParams.get('category') || undefined;
    const search = searchParams.get('search') || undefined;
    const sort = (searchParams.get('sort') as 'alphabetical' | 'most-used' | 'recently-added') || 'alphabetical';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '100', 10)));

    // Validate sort parameter
    const validSorts = ['alphabetical', 'most-used', 'recently-added'];
    if (!validSorts.includes(sort)) {
      return apiError(`Invalid sort parameter. Must be one of: ${validSorts.join(', ')}`, 400);
    }

    // Calculate offset for pagination
    const offset = (page - 1) * limit;

    // Fetch ingredients using service
    const ingredients = await ingredientService.findAll({
      category,
      search,
      sort,
      limit: limit + 1, // Fetch one extra to check if there are more
      offset,
    });

    // Check if there are more results
    const hasMore = ingredients.length > limit;
    const resultIngredients = hasMore ? ingredients.slice(0, limit) : ingredients;

    // Calculate total (approximation based on hasMore)
    const total = hasMore ? offset + limit + 1 : offset + resultIngredients.length;

    return apiSuccessPaginated(resultIngredients, page, limit, total);
  } catch (error) {
    console.error('Error fetching ingredients:', error);
    return apiError('Internal server error');
  }
});
