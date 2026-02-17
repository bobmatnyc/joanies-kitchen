/**
 * REST API v1 - Individual Ingredient Endpoints
 *
 * GET /api/v1/ingredients/:slug - Get single ingredient by slug
 *
 * Authentication: Requires Clerk session or API key
 * Authorization: Scope-based permissions
 */

import type { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRequiredParam } from '@/lib/api';
import { requireScopes, SCOPES } from '@/lib/api-auth';
import type { RouteContext } from '@/lib/api-auth/types';
import { ingredientService } from '@/lib/services';

/**
 * GET /api/v1/ingredients/:slug
 *
 * Get a single ingredient by slug
 *
 * Path Parameters:
 * - slug: Ingredient slug (e.g., 'tomato', 'olive-oil')
 *
 * Response:
 * {
 *   success: true,
 *   data: Ingredient
 * }
 *
 * Errors:
 * - 401: Not authenticated
 * - 403: Insufficient permissions (missing read:ingredients scope)
 * - 404: Ingredient not found
 * - 500: Internal server error
 */
export const GET = requireScopes(
  [SCOPES.READ_INGREDIENTS],
  async (_request: NextRequest, _auth, context: RouteContext) => {
    try {
      // Extract slug from route params
      const slugResult = await getRequiredParam(context, 'slug');
      if ('error' in slugResult) return slugResult.error;

      const { data: slug } = slugResult;

      // Fetch ingredient by slug
      const ingredient = await ingredientService.findBySlug(slug);

      if (!ingredient) {
        return apiError(`Ingredient not found: ${slug}`, 404);
      }

      return apiSuccess(ingredient);
    } catch (error) {
      console.error('Error fetching ingredient:', error);
      return apiError('Internal server error');
    }
  }
);
