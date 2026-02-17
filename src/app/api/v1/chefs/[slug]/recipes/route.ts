/**
 * REST API v1 - Chef Recipes Endpoints
 *
 * GET /api/v1/chefs/:slug/recipes - Get recipes by chef
 *
 * Authentication: Requires Clerk session or API key
 * Authorization: Scope-based permissions
 */

import type { NextRequest } from 'next/server';
import {
  apiError,
  apiNotFound,
  apiSuccessPaginated,
  getRequiredParam,
  parseQueryParams,
} from '@/lib/api';
import { requireScopes, SCOPES } from '@/lib/api-auth';
import type { RouteContext } from '@/lib/api-auth/types';
import { chefService } from '@/lib/services/chef-service';
import { listChefRecipesQuerySchema } from '@/lib/validations/chef-api';

/**
 * GET /api/v1/chefs/:slug/recipes
 *
 * Get recipes associated with a chef
 *
 * Path Parameters:
 * - slug: Chef slug
 *
 * Query Parameters:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 24, max: 100)
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     recipes: Recipe[],
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
 * - 403: Insufficient permissions (missing read:chefs or read:recipes scopes)
 * - 404: Chef not found
 * - 400: Invalid query parameters
 * - 500: Internal server error
 */
export const GET = requireScopes(
  [SCOPES.READ_CHEFS, SCOPES.READ_RECIPES],
  async (request: NextRequest, _auth, context: RouteContext) => {
    try {
      // Extract slug from route params
      const slugResult = await getRequiredParam(context, 'slug');
      if ('error' in slugResult) return slugResult.error;

      const { data: slug } = slugResult;

      // Parse and validate query parameters
      const parsed = parseQueryParams(request, listChefRecipesQuerySchema);
      if ('error' in parsed) return parsed.error;

      const { data: validatedQuery } = parsed;

      // Find chef by slug
      const chef = await chefService.findBySlug(slug);
      if (!chef) {
        return apiNotFound('Chef not found');
      }

      // Calculate offset from page and limit
      const offset = (validatedQuery.page! - 1) * validatedQuery.limit!;

      // Fetch recipes for this chef
      const recipes = await chefService.findRecipesByChef(chef.id, {
        limit: validatedQuery.limit!,
        offset,
      });

      // For pagination, we use the chef's recipe_count as total
      const total = chef.recipe_count || 0;

      return apiSuccessPaginated(recipes, validatedQuery.page!, validatedQuery.limit!, total);
    } catch (error) {
      console.error('Error fetching chef recipes:', error);
      return apiError('Internal server error');
    }
  }
);
