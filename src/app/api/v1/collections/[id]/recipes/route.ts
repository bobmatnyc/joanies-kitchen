/**
 * REST API v1 - Collection Recipes Endpoints
 *
 * GET  /api/v1/collections/:id/recipes - List recipes in collection
 * POST /api/v1/collections/:id/recipes - Add recipe to collection
 *
 * Authentication: Requires Clerk session or API key
 * Authorization: Owner-only for write operations
 */

import type { NextRequest } from 'next/server';
import {
  apiError,
  apiForbidden,
  apiNotFound,
  apiSuccess,
  apiSuccessPaginated,
  applyPagination,
  parseJsonBody,
  parseQueryParams,
  getRequiredParam,
} from '@/lib/api';
import { requireScopes, SCOPES } from '@/lib/api-auth';
import { collectionService } from '@/lib/services/collection-service';
import {
  addRecipeToCollectionSchema,
  listCollectionRecipesQuerySchema,
} from '@/lib/validations/collection-api';

/**
 * GET /api/v1/collections/:id/recipes
 *
 * Get all recipes in a collection with pagination
 *
 * Query Parameters:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
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
 * - 403: Insufficient permissions
 * - 404: Collection not found
 * - 500: Internal server error
 */
export const GET = requireScopes(
  [SCOPES.READ_COLLECTIONS],
  async (request: NextRequest, auth, context) => {
    try {
      const collectionId = await getRequiredParam(context, 'id');
      if ('error' in collectionId) return collectionId.error;

      // Parse and validate query parameters
      const parsed = parseQueryParams(request, listCollectionRecipesQuerySchema);
      if ('error' in parsed) return parsed.error;

      const { data: validatedQuery } = parsed;

      // Check collection exists
      const collection = await collectionService.findById(collectionId.data);

      if (!collection) {
        return apiNotFound('Collection not found');
      }

      // Check if user can access this collection
      if (!collection.is_public && collection.user_id !== auth.userId) {
        return apiForbidden('You do not have permission to view this collection');
      }

      // Get recipes in collection
      const recipes = await collectionService.getRecipes(collectionId.data);

      // Apply pagination
      const { items: paginatedRecipes, total } = applyPagination(
        recipes,
        validatedQuery.page!,
        validatedQuery.limit!
      );

      return apiSuccessPaginated(paginatedRecipes, validatedQuery.page!, validatedQuery.limit!, total);
    } catch (error) {
      console.error('Error fetching collection recipes:', error);
      return apiError('Internal server error');
    }
  }
);

/**
 * POST /api/v1/collections/:id/recipes
 *
 * Add a recipe to a collection (owner only)
 *
 * Request Body:
 * {
 *   recipeId: string,
 *   personalNote?: string
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: { added: true }
 * }
 *
 * Errors:
 * - 401: Not authenticated
 * - 403: Not the owner
 * - 404: Collection not found
 * - 400: Invalid request body or recipe already in collection
 * - 500: Internal server error
 */
export const POST = requireScopes(
  [SCOPES.WRITE_COLLECTIONS],
  async (request: NextRequest, auth, context) => {
    try {
      const collectionId = await getRequiredParam(context, 'id');
      if ('error' in collectionId) return collectionId.error;

      // Check collection exists and user owns it
      const collection = await collectionService.findById(collectionId.data);

      if (!collection) {
        return apiNotFound('Collection not found');
      }

      if (collection.user_id !== auth.userId) {
        return apiForbidden('You do not have permission to modify this collection');
      }

      // Parse and validate request body
      const parsed = await parseJsonBody(request, addRecipeToCollectionSchema);
      if ('error' in parsed) return parsed.error;

      const { data: validatedData } = parsed;

      // Check if recipe is already in collection
      const isAlreadyInCollection = await collectionService.isRecipeInCollection(
        validatedData.recipeId,
        collectionId.data
      );

      if (isAlreadyInCollection) {
        return apiError('Recipe is already in this collection', 400);
      }

      // Add recipe to collection
      await collectionService.addRecipe(
        collectionId.data,
        validatedData.recipeId,
        validatedData.personalNote
      );

      return apiSuccess({ added: true }, 201);
    } catch (error) {
      console.error('Error adding recipe to collection:', error);
      return apiError('Internal server error');
    }
  }
);
