/**
 * REST API v1 - Collection Recipe Endpoints
 *
 * DELETE /api/v1/collections/:id/recipes/:recipeId - Remove recipe from collection
 *
 * Authentication: Requires Clerk session or API key
 * Authorization: Owner-only
 */

import type { NextRequest } from 'next/server';
import {
  apiError,
  apiForbidden,
  apiNotFound,
  apiSuccess,
  getRequiredParam,
} from '@/lib/api';
import { requireScopes, SCOPES } from '@/lib/api-auth';
import { collectionService } from '@/lib/services/collection-service';

/**
 * DELETE /api/v1/collections/:id/recipes/:recipeId
 *
 * Remove a recipe from a collection (owner only)
 *
 * Response:
 * {
 *   success: true,
 *   data: { removed: true }
 * }
 *
 * Errors:
 * - 401: Not authenticated
 * - 403: Not the owner
 * - 404: Collection or recipe not found in collection
 * - 500: Internal server error
 */
export const DELETE = requireScopes(
  [SCOPES.WRITE_COLLECTIONS],
  async (request: NextRequest, auth, context) => {
    try {
      const collectionId = await getRequiredParam(context, 'id');
      if ('error' in collectionId) return collectionId.error;

      const recipeIdParsed = await getRequiredParam(context, 'recipeId');
      if ('error' in recipeIdParsed) return recipeIdParsed.error;

      // Check collection exists and user owns it
      const collection = await collectionService.findById(collectionId.data);

      if (!collection) {
        return apiNotFound('Collection not found');
      }

      if (collection.user_id !== auth.userId) {
        return apiForbidden('You do not have permission to modify this collection');
      }

      // Check if recipe is in collection
      const isInCollection = await collectionService.isRecipeInCollection(
        recipeIdParsed.data,
        collectionId.data
      );

      if (!isInCollection) {
        return apiNotFound('Recipe not found in this collection');
      }

      // Remove recipe from collection
      await collectionService.removeRecipe(collectionId.data, recipeIdParsed.data);

      return apiSuccess({ removed: true });
    } catch (error) {
      console.error('Error removing recipe from collection:', error);
      return apiError('Internal server error');
    }
  }
);
