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

import { type NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { deleteRecipe, getRecipe, updateRecipe } from '@/app/actions/recipes';
import { requireScopes, SCOPES } from '@/lib/api-auth';
import type { RouteContext } from '@/lib/api-auth/types';
import {
  updateRecipeSchema,
  type UpdateRecipeInput,
} from '@/lib/validations/recipe-api';

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
      // Extract recipe ID from route params (Next.js 15: params is a Promise)
      const params = context?.params ? await context.params : {};
      const id = params?.id as string;

      if (!id) {
        return NextResponse.json(
          {
            success: false,
            error: 'Recipe ID is required',
          },
          { status: 400 }
        );
      }

      // Fetch recipe
      const result = await getRecipe(id);

      if (!result.success) {
        // Check if it's a not found error or access denied
        const statusCode = result.error === 'Recipe not found' ? 404 :
                          result.error === 'Access denied' ? 403 : 500;

        return NextResponse.json(
          {
            success: false,
            error: result.error || 'Failed to fetch recipe',
          },
          { status: statusCode }
        );
      }

      return NextResponse.json({
        success: true,
        data: result.data,
      });
    } catch (error) {
      console.error('Error fetching recipe:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Internal server error',
        },
        { status: 500 }
      );
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
      // Extract recipe ID from route params (Next.js 15: params is a Promise)
      const params = context?.params ? await context.params : {};
      const id = params?.id as string;

      if (!id) {
        return NextResponse.json(
          {
            success: false,
            error: 'Recipe ID is required',
          },
          { status: 400 }
        );
      }

      // Verify ownership first (getRecipe checks access)
      const existingRecipe = await getRecipe(id);

      if (!existingRecipe.success || !existingRecipe.data) {
        const statusCode = existingRecipe.error === 'Recipe not found' ? 404 :
                          existingRecipe.error === 'Access denied' ? 403 : 500;

        return NextResponse.json(
          {
            success: false,
            error: existingRecipe.error || 'Failed to fetch recipe',
          },
          { status: statusCode }
        );
      }

      // Check ownership (users can only edit their own recipes)
      // Admin users can be checked via Clerk metadata
      if (existingRecipe.data.user_id !== auth.userId) {
        // Check if user is admin
        const isAdmin = auth.metadata?.isAdmin === true;

        if (!isAdmin) {
          return NextResponse.json(
            {
              success: false,
              error: 'You do not have permission to edit this recipe',
            },
            { status: 403 }
          );
        }
      }

      // Parse request body
      const body = await request.json();

      // Validate request body
      let validatedData: UpdateRecipeInput;
      try {
        validatedData = updateRecipeSchema.parse(body);
      } catch (error) {
        if (error instanceof ZodError) {
          return NextResponse.json(
            {
              success: false,
              error: 'Invalid request body',
              details: error.errors,
            },
            { status: 400 }
          );
        }
        throw error;
      }

      // Update recipe using server action
      // Cast to any to work around type mismatch between our schema and internal types
      const result = await updateRecipe(existingRecipe.data.id, validatedData as any);

      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            error: result.error || 'Failed to update recipe',
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: result.data,
      });
    } catch (error) {
      console.error('Error updating recipe:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Internal server error',
        },
        { status: 500 }
      );
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
      // Extract recipe ID from route params (Next.js 15: params is a Promise)
      const params = context?.params ? await context.params : {};
      const id = params?.id as string;

      if (!id) {
        return NextResponse.json(
          {
            success: false,
            error: 'Recipe ID is required',
          },
          { status: 400 }
        );
      }

      // Verify ownership first
      const existingRecipe = await getRecipe(id);

      if (!existingRecipe.success || !existingRecipe.data) {
        const statusCode = existingRecipe.error === 'Recipe not found' ? 404 :
                          existingRecipe.error === 'Access denied' ? 403 : 500;

        return NextResponse.json(
          {
            success: false,
            error: existingRecipe.error || 'Failed to fetch recipe',
          },
          { status: statusCode }
        );
      }

      // Check ownership (users can only delete their own recipes)
      if (existingRecipe.data.user_id !== auth.userId) {
        // Check if user is admin
        const isAdmin = auth.metadata?.isAdmin === true;

        if (!isAdmin) {
          return NextResponse.json(
            {
              success: false,
              error: 'You do not have permission to delete this recipe',
            },
            { status: 403 }
          );
        }
      }

      // Delete recipe using server action
      const result = await deleteRecipe(existingRecipe.data.id);

      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            error: result.error || 'Failed to delete recipe',
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: result.data,
      });
    } catch (error) {
      console.error('Error deleting recipe:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Internal server error',
        },
        { status: 500 }
      );
    }
  }
);
