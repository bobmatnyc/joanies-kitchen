/**
 * REST API v1 - Recipe Like Endpoints
 *
 * GET    /api/v1/recipes/:id/like - Get like status and count
 * POST   /api/v1/recipes/:id/like - Like a recipe
 * DELETE /api/v1/recipes/:id/like - Unlike a recipe
 *
 * Authentication: Requires Clerk session or API key
 * Authorization: Scope-based permissions
 *
 * Note: Likes and Favorites are the same in our system.
 * This endpoint provides an alternative semantic interface.
 */

import type { NextRequest } from 'next/server';
import { getRecipe } from '@/app/actions/recipes';
import {
  apiError,
  apiSuccess,
  getRequiredParam,
  handleActionResult,
} from '@/lib/api';
import { optionalAuth, requireScopes, SCOPES } from '@/lib/api-auth';
import type { RouteContext } from '@/lib/api-auth/types';
import { socialService } from '@/lib/services';

/**
 * GET /api/v1/recipes/:id/like
 *
 * Get like status and count for a recipe
 * - Public endpoint (no auth required for like count)
 * - Returns user's like status if authenticated
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     recipeId: string,
 *     likeCount: number,
 *     isLiked: boolean  // Only if authenticated
 *   }
 * }
 *
 * Errors:
 * - 404: Recipe not found
 * - 500: Internal server error
 */
export const GET = optionalAuth(async (_request: NextRequest, auth, context: RouteContext) => {
  try {
    // Extract recipe ID from route params
    const idResult = await getRequiredParam(context, 'id');
    if ('error' in idResult) return idResult.error;

    const { data: recipeId } = idResult;

    // Verify recipe exists
    const recipeResult = await getRecipe(recipeId);
    const handled = handleActionResult(recipeResult);
    if ('error' in handled) return handled.error;

    // Get like count (public)
    const likeCount = await socialService.getLikeCount(recipeId);

    // Get user's like status if authenticated
    const data: {
      recipeId: string;
      likeCount: number;
      isLiked?: boolean;
    } = {
      recipeId,
      likeCount,
    };

    if (auth.authenticated && auth.userId) {
      data.isLiked = await socialService.isLiked(auth.userId, recipeId);
    }

    return apiSuccess(data);
  } catch (error) {
    console.error('Error getting like status:', error);
    return apiError('Internal server error');
  }
});

/**
 * POST /api/v1/recipes/:id/like
 *
 * Like a recipe (same as adding to favorites)
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     message: string,
 *     recipeId: string,
 *     isLiked: true,
 *     likeCount: number
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
      const idResult = await getRequiredParam(context, 'id');
      if ('error' in idResult) return idResult.error;

      const { data: recipeId } = idResult;

      // Verify recipe exists
      const recipeResult = await getRecipe(recipeId);
      const handled = handleActionResult(recipeResult);
      if ('error' in handled) return handled.error;

      // Like the recipe (idempotent operation)
      await socialService.likeRecipe(auth.userId!, recipeId);

      // Get updated like count
      const likeCount = await socialService.getLikeCount(recipeId);

      return apiSuccess(
        {
          message: 'Recipe liked',
          recipeId,
          isLiked: true,
          likeCount,
        },
        201
      );
    } catch (error) {
      console.error('Error liking recipe:', error);
      return apiError('Internal server error');
    }
  }
);

/**
 * DELETE /api/v1/recipes/:id/like
 *
 * Unlike a recipe (remove from favorites)
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     message: string,
 *     recipeId: string,
 *     isLiked: false,
 *     likeCount: number
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
      const idResult = await getRequiredParam(context, 'id');
      if ('error' in idResult) return idResult.error;

      const { data: recipeId } = idResult;

      // Verify recipe exists
      const recipeResult = await getRecipe(recipeId);
      const handled = handleActionResult(recipeResult);
      if ('error' in handled) return handled.error;

      // Unlike the recipe
      await socialService.unlikeRecipe(auth.userId!, recipeId);

      // Get updated like count
      const likeCount = await socialService.getLikeCount(recipeId);

      return apiSuccess({
        message: 'Recipe unliked',
        recipeId,
        isLiked: false,
        likeCount,
      });
    } catch (error) {
      console.error('Error unliking recipe:', error);
      return apiError('Internal server error');
    }
  }
);
