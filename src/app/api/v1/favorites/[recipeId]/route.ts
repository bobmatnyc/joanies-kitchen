/**
 * REST API v1 - Favorites by Recipe ID Endpoints
 *
 * GET    /api/v1/favorites/:recipeId - Check if recipe is favorited
 * POST   /api/v1/favorites/:recipeId - Add recipe to favorites
 * DELETE /api/v1/favorites/:recipeId - Remove recipe from favorites
 *
 * Authentication: Requires Clerk session or API key
 * Authorization: Scope-based permissions
 */

import type { NextRequest } from 'next/server';
import { getRecipe } from '@/app/actions/recipes';
import {
  apiError,
  apiSuccess,
  getRequiredParam,
  handleActionResult,
} from '@/lib/api';
import { requireScopes, SCOPES } from '@/lib/api-auth';
import type { RouteContext } from '@/lib/api-auth/types';
import { socialService } from '@/lib/services';

/**
 * GET /api/v1/favorites/:recipeId
 *
 * Check if the authenticated user has favorited a specific recipe
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     isFavorite: boolean,
 *     recipeId: string
 *   }
 * }
 *
 * Errors:
 * - 401: Not authenticated
 * - 403: Insufficient permissions (missing read:favorites scope)
 * - 404: Recipe not found
 * - 500: Internal server error
 */
export const GET = requireScopes(
  [SCOPES.READ_FAVORITES],
  async (_request: NextRequest, auth, context: RouteContext) => {
    try {
      // Extract recipe ID from route params
      const idResult = await getRequiredParam(context, 'recipeId');
      if ('error' in idResult) return idResult.error;

      const { data: recipeId } = idResult;

      // Verify recipe exists
      const recipeResult = await getRecipe(recipeId);
      const handled = handleActionResult(recipeResult);
      if ('error' in handled) return handled.error;

      // Check if favorited
      const isFavorite = await socialService.isFavorite(auth.userId!, recipeId);

      return apiSuccess({
        isFavorite,
        recipeId,
      });
    } catch (error) {
      console.error('Error checking favorite status:', error);
      return apiError('Internal server error');
    }
  }
);

/**
 * POST /api/v1/favorites/:recipeId
 *
 * Add a recipe to the authenticated user's favorites
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     message: string,
 *     recipeId: string,
 *     isFavorite: true
 *   }
 * }
 *
 * Errors:
 * - 401: Not authenticated
 * - 403: Insufficient permissions (missing write:favorites scope)
 * - 404: Recipe not found
 * - 500: Internal server error
 */
export const POST = requireScopes(
  [SCOPES.WRITE_FAVORITES],
  async (_request: NextRequest, auth, context: RouteContext) => {
    try {
      // Extract recipe ID from route params
      const idResult = await getRequiredParam(context, 'recipeId');
      if ('error' in idResult) return idResult.error;

      const { data: recipeId } = idResult;

      // Verify recipe exists
      const recipeResult = await getRecipe(recipeId);
      const handled = handleActionResult(recipeResult);
      if ('error' in handled) return handled.error;

      // Add to favorites (idempotent operation)
      await socialService.addFavorite(auth.userId!, recipeId);

      return apiSuccess(
        {
          message: 'Recipe added to favorites',
          recipeId,
          isFavorite: true,
        },
        201
      );
    } catch (error) {
      console.error('Error adding favorite:', error);
      return apiError('Internal server error');
    }
  }
);

/**
 * DELETE /api/v1/favorites/:recipeId
 *
 * Remove a recipe from the authenticated user's favorites
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     message: string,
 *     recipeId: string,
 *     isFavorite: false
 *   }
 * }
 *
 * Errors:
 * - 401: Not authenticated
 * - 403: Insufficient permissions (missing write:favorites scope)
 * - 404: Recipe not found
 * - 500: Internal server error
 */
export const DELETE = requireScopes(
  [SCOPES.WRITE_FAVORITES],
  async (_request: NextRequest, auth, context: RouteContext) => {
    try {
      // Extract recipe ID from route params
      const idResult = await getRequiredParam(context, 'recipeId');
      if ('error' in idResult) return idResult.error;

      const { data: recipeId } = idResult;

      // Verify recipe exists
      const recipeResult = await getRecipe(recipeId);
      const handled = handleActionResult(recipeResult);
      if ('error' in handled) return handled.error;

      // Remove from favorites
      await socialService.removeFavorite(auth.userId!, recipeId);

      return apiSuccess({
        message: 'Recipe removed from favorites',
        recipeId,
        isFavorite: false,
      });
    } catch (error) {
      console.error('Error removing favorite:', error);
      return apiError('Internal server error');
    }
  }
);
