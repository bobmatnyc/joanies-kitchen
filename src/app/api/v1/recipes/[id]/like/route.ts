/**
 * REST API v1 - Recipe Like Endpoints
 *
 * GET    /api/v1/recipes/:id/like - Get like status and count
 * POST   /api/v1/recipes/:id/like - Like a recipe
 * DELETE /api/v1/recipes/:id/like - Unlike a recipe
 *
 * Authentication: Requires a signed-in session or API key
 * Authorization: Scope-based permissions
 *
 * Note: Likes and Favorites are the same in our system.
 * This endpoint provides an alternative semantic interface.
 *
 * #167 (D26): DEPRECATED alias of /api/v1/favorites/:recipeId. It reads and
 * writes the `favorites` table through the favorites core; `likeCount` is the
 * number of `favorites` rows. Every response carries `Deprecation: true` and a
 * `Link: </api/v1/favorites/:id>; rel="successor-version"` header. Bodies,
 * status codes and scopes are unchanged.
 */

import type { NextRequest, NextResponse } from 'next/server';
import { getRecipe } from '@/app/actions/recipes';
import {
  apiError,
  apiForbidden,
  apiNotFound,
  apiSuccess,
  getRequiredParam,
  handleActionResult,
} from '@/lib/api';
import { optionalAuth, requireScopes, SCOPES } from '@/lib/api-auth';
import type { RouteContext } from '@/lib/api-auth/types';
import { FavoritePendingDeletionError } from '@/lib/favorites';
import { findViewableRecipe } from '@/lib/recipe-visibility';
import { socialService } from '@/lib/services';

type RouteHandler = (request: NextRequest, context: RouteContext) => Promise<NextResponse>;

/**
 * #167 (D26): marks every response of this alias, including 401/403 from the
 * auth wrapper, as deprecated and names the favorites endpoint as successor.
 */
function deprecated(handler: RouteHandler): RouteHandler {
  return async (request, context) => {
    const response = await handler(request, context);
    const { id } = await context.params;
    const recipeId = typeof id === 'string' ? id : '';
    response.headers.set('Deprecation', 'true');
    response.headers.set(
      'Link',
      `</api/v1/favorites/${encodeURIComponent(recipeId)}>; rel="successor-version"`
    );
    return response;
  };
}

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
export const GET = deprecated(
  optionalAuth(async (_request: NextRequest, auth, context: RouteContext) => {
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
      // #167 (D26): count of `favorites` rows, via the favorites core.
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
  })
);

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
 * - 403: Insufficient permissions (missing write:favorites scope), or the
 *   account has a pending deletion (#208, reason `forbidden`)
 * - 404: Recipe not found
 * - 500: Internal server error
 */
export const POST = deprecated(
  requireScopes(
    [SCOPES.WRITE_FAVORITES],
    async (_request: NextRequest, auth, context: RouteContext) => {
      try {
        // Extract recipe ID from route params
        const idResult = await getRequiredParam(context, 'id');
        if ('error' in idResult) return idResult.error;

        const { data: recipeId } = idResult;

        // #41: a recipe the caller cannot see is answered as nonexistent.
        if (!(await findViewableRecipe(recipeId, { userId: auth.userId, isAdmin: false }))) {
          return apiNotFound('Recipe');
        }

        // Like the recipe (idempotent operation)
        // #167 (D26): writes `favorites` (was `recipe_likes`), creating the profile if missing.
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
        // #208: an account with a pending deletion may not like recipes.
        if (error instanceof FavoritePendingDeletionError) {
          return apiForbidden(error.message);
        }
        console.error('Error liking recipe:', error);
        return apiError('Internal server error');
      }
    }
  )
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
export const DELETE = deprecated(
  requireScopes(
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
        // #167 (D26): deletes from `favorites` and decrements like_count only if a row went.
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
  )
);
