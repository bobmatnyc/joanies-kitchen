/**
 * REST API v1 - Individual Recipe Endpoints
 *
 * GET    /api/v1/recipes/:id - Get single recipe by ID or slug
 * PATCH  /api/v1/recipes/:id - Update recipe
 * DELETE /api/v1/recipes/:id - Delete recipe
 *
 * Authentication: Requires Clerk session or API key
 * Authorization: Scope-based permissions + ownership verification
 */

import type { NextRequest } from 'next/server';
import { deleteRecipe, getRecipe, updateRecipe } from '@/app/actions/recipes';
import { requireScopes, SCOPES } from '@/lib/api-auth';
import type { RouteContext } from '@/lib/api-auth/types';
import {
  updateRecipeSchema,
  type UpdateRecipeInput,
} from '@/lib/validations/recipe-api';
import {
  apiSuccess,
  apiError,
  getRequiredParam,
  parseParamAndBody,
  verifyResourceOwnership,
  handleActionResult,
} from '@/lib/api';

/**
 * GET /api/v1/recipes/:id
 *
 * Get a single recipe by ID or slug
 *
 * Path Parameters:
 * - id: Recipe ID or slug
 *
 * Response:
 * {
 *   success: true,
 *   data: Recipe
 * }
 *
 * Errors:
 * - 401: Not authenticated
 * - 403: Insufficient permissions or access denied
 * - 404: Recipe not found
 * - 500: Internal server error
 */
export const GET = requireScopes(
  [SCOPES.READ_RECIPES],
  async (request: NextRequest, auth, context: RouteContext) => {
    try {
      // Extract recipe ID from route params
      const idResult = await getRequiredParam(context, 'id');
      if ('error' in idResult) return idResult.error;

      const { data: id } = idResult;

      // Fetch recipe
      const result = await getRecipe(id);
      const handled = handleActionResult(result);
      if ('error' in handled) return handled.error;

      return apiSuccess(handled.data);
    } catch (error) {
      console.error('Error fetching recipe:', error);
      return apiError('Internal server error');
    }
  }
);

/**
 * PATCH /api/v1/recipes/:id
 *
 * Update a recipe (partial update)
 *
 * Path Parameters:
 * - id: Recipe ID or slug
 *
 * Request Body: (all fields optional)
 * {
 *   name?: string,
 *   description?: string,
 *   ingredients?: string[],
 *   instructions?: string[],
 *   prep_time?: number,
 *   cook_time?: number,
 *   servings?: number,
 *   difficulty?: 'easy' | 'medium' | 'hard',
 *   cuisine?: string,
 *   tags?: string[],
 *   images?: string[],
 *   is_public?: boolean,
 *   is_meal_prep_friendly?: boolean,
 *   nutrition_info?: object,
 *   video_url?: string,
 *   source?: string,
 *   license?: 'PUBLIC_DOMAIN' | 'CC_BY' | ...
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: Recipe
 * }
 *
 * Errors:
 * - 401: Not authenticated
 * - 403: Insufficient permissions or not recipe owner
 * - 404: Recipe not found
 * - 400: Invalid request body
 * - 500: Internal server error
 */
export const PATCH = requireScopes(
  [SCOPES.WRITE_RECIPES],
  async (request: NextRequest, auth, context: RouteContext) => {
    try {
      // Extract route param and parse request body
      const parsed = await parseParamAndBody(context, request, 'id', updateRecipeSchema);
      if ('error' in parsed) return parsed.error;

      const { param: id, body: validatedData } = parsed.data;

      // Verify ownership (fetch recipe and check ownership)
      const existingRecipe = await getRecipe(id);
      const recipeCheck = handleActionResult(existingRecipe);
      if ('error' in recipeCheck) return recipeCheck.error;

      const ownershipCheck = verifyResourceOwnership(recipeCheck.data, auth, 'recipe');
      if ('error' in ownershipCheck) return ownershipCheck.error;

      // Update recipe using server action
      // Cast to any to work around type mismatch between our schema and internal types
      const result = await updateRecipe(ownershipCheck.resource.id, validatedData as any);
      const updateCheck = handleActionResult(result);
      if ('error' in updateCheck) return updateCheck.error;

      return apiSuccess(updateCheck.data);
    } catch (error) {
      console.error('Error updating recipe:', error);
      return apiError('Internal server error');
    }
  }
);

/**
 * DELETE /api/v1/recipes/:id
 *
 * Delete a recipe (hard delete)
 *
 * Path Parameters:
 * - id: Recipe ID or slug
 *
 * Response:
 * {
 *   success: true,
 *   data: DeletedRecipe
 * }
 *
 * Errors:
 * - 401: Not authenticated
 * - 403: Insufficient permissions or not recipe owner
 * - 404: Recipe not found
 * - 500: Internal server error
 */
export const DELETE = requireScopes(
  [SCOPES.DELETE_RECIPES],
  async (request: NextRequest, auth, context: RouteContext) => {
    try {
      // Extract recipe ID from route params
      const idResult = await getRequiredParam(context, 'id');
      if ('error' in idResult) return idResult.error;

      const { data: id } = idResult;

      // Verify ownership (fetch recipe and check ownership)
      const existingRecipe = await getRecipe(id);
      const recipeCheck = handleActionResult(existingRecipe);
      if ('error' in recipeCheck) return recipeCheck.error;

      const ownershipCheck = verifyResourceOwnership(recipeCheck.data, auth, 'recipe');
      if ('error' in ownershipCheck) return ownershipCheck.error;

      // Delete recipe using server action
      const result = await deleteRecipe(ownershipCheck.resource.id);
      const deleteCheck = handleActionResult(result);
      if ('error' in deleteCheck) return deleteCheck.error;

      return apiSuccess(deleteCheck.data);
    } catch (error) {
      console.error('Error deleting recipe:', error);
      return apiError('Internal server error');
    }
  }
);
