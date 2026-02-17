/**
 * REST API v1 - Ingredient Categories Endpoint
 *
 * GET /api/v1/ingredients/categories - Get all ingredient categories
 *
 * Authentication: Requires Clerk session or API key
 * Authorization: Scope-based permissions
 */

import type { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api';
import { requireScopes, SCOPES } from '@/lib/api-auth';
import { ingredientService } from '@/lib/services';

/**
 * GET /api/v1/ingredients/categories
 *
 * Get all ingredient categories with counts
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     categories: Array<{
 *       category: string,
 *       count: number
 *     }>,
 *     total: number
 *   }
 * }
 *
 * Errors:
 * - 401: Not authenticated
 * - 403: Insufficient permissions (missing read:ingredients scope)
 * - 500: Internal server error
 */
export const GET = requireScopes([SCOPES.READ_INGREDIENTS], async (_request: NextRequest) => {
  try {
    // Fetch categories from service
    const categories = await ingredientService.getCategories();

    return apiSuccess({
      categories,
      total: categories.length,
    });
  } catch (error) {
    console.error('Error fetching ingredient categories:', error);
    return apiError('Internal server error');
  }
});
