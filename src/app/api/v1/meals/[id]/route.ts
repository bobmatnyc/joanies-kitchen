/**
 * REST API v1 - Individual Meal Endpoints
 *
 * GET    /api/v1/meals/:id - Get single meal by ID
 * PATCH  /api/v1/meals/:id - Update meal
 * DELETE /api/v1/meals/:id - Delete meal
 *
 * Authentication: Requires a signed-in session or API key
 * Authorization: Scope-based permissions + ownership verification
 */

import { type NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { deleteMeal, getMealById, updateMeal } from '@/app/actions/meals';
import { isPendingDeletionRefusal } from '@/lib/account-deletion/guarded-insert';
import { requireScopes, SCOPES } from '@/lib/api-auth';
import type { RouteContext } from '@/lib/api-auth/types';
import { isSessionRequiredRefusal } from '@/lib/meals/session-required';
import { type UpdateMealInput, updateMealSchema } from '@/lib/validations/meal-api';
import { mealErrorMessage, mealSessionRequiredResponse } from '../error-body';

/**
 * GET /api/v1/meals/:id
 *
 * Get a single meal by ID with all recipes
 *
 * Path Parameters:
 * - id: Meal ID (UUID)
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     ...meal,
 *     recipes: Array<{
 *       mealRecipe: MealRecipe,
 *       recipe: Recipe
 *     }>
 *   }
 * }
 *
 * Errors:
 * - 401: Not authenticated
 * - 403: Insufficient permissions or access denied
 * - 404: Meal not found
 * - 500: Internal server error
 */
export const GET = requireScopes(
  [SCOPES.READ_MEALS],
  async (_request: NextRequest, _auth, context: RouteContext) => {
    try {
      // Extract meal ID from route params (Next.js 15: params is a Promise)
      const params = await context.params;
      const id = params?.id as string;

      if (!id) {
        return NextResponse.json(
          {
            success: false,
            error: 'Meal ID is required',
          },
          { status: 400 }
        );
      }

      // Fetch meal
      const result = await getMealById(id);

      if (!result.success) {
        // Check if it's a not found error or access denied
        const statusCode = result.error === 'Meal not found' ? 404 : 500;

        return NextResponse.json(
          {
            success: false,
            // #241: a 500 carries a fixed message; the detail is logged only.
            error: mealErrorMessage(statusCode, result.error, 'Failed to fetch meal'),
          },
          { status: statusCode }
        );
      }

      // Parse tags if stored as JSON string
      const meal = result.data;
      if (meal && typeof meal.tags === 'string') {
        try {
          meal.tags = JSON.parse(meal.tags);
        } catch {
          // Keep as string if parsing fails
        }
      }

      return NextResponse.json({
        success: true,
        data: meal,
      });
    } catch (error) {
      console.error('Error fetching meal:', error);
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
 * PATCH /api/v1/meals/:id
 *
 * Update a meal (partial update)
 *
 * Path Parameters:
 * - id: Meal ID (UUID)
 *
 * Request Body: (all fields optional)
 * {
 *   name?: string,
 *   description?: string,
 *   meal_type?: 'breakfast' | 'lunch' | 'dinner' | ...,
 *   occasion?: string,
 *   serves?: number,
 *   tags?: string[],
 *   is_template?: boolean,
 *   is_public?: boolean,
 *   estimated_total_cost?: string,
 *   estimated_cost_per_serving?: string,
 *   image_url?: string
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: Meal
 * }
 *
 * Errors:
 * - 401: Not authenticated
 * - 403: Missing the write:meals scope, or the account has a pending
 *   deletion (#217)
 * - 404: Meal not found, or not the caller's own meal (admins included, #225)
 * - 400: Invalid request body
 * - 500: Internal server error
 */
export const PATCH = requireScopes(
  [SCOPES.WRITE_MEALS],
  async (request: NextRequest, auth, context: RouteContext) => {
    try {
      // Extract meal ID from route params (Next.js 15: params is a Promise)
      const params = await context.params;
      const id = params?.id as string;

      if (!id) {
        return NextResponse.json(
          {
            success: false,
            error: 'Meal ID is required',
          },
          { status: 400 }
        );
      }

      // Verify ownership first (getMealById checks access)
      const existingMeal = await getMealById(id);

      if (!existingMeal.success || !existingMeal.data) {
        const statusCode = existingMeal.error === 'Meal not found' ? 404 : 500;

        return NextResponse.json(
          {
            success: false,
            // #241: a 500 carries a fixed message; the detail is logged only.
            error: mealErrorMessage(statusCode, existingMeal.error, 'Failed to fetch meal'),
          },
          { status: statusCode }
        );
      }

      // #225: owner only, no admin bypass (updateMeal is scoped to the caller's
      // meals); another user's meal answers as not found.
      if (existingMeal.data.user_id !== auth.userId) {
        return NextResponse.json({ success: false, error: 'Meal not found' }, { status: 404 });
      }

      // Parse request body
      const body = await request.json();

      // Validate request body
      let validatedData: UpdateMealInput;
      try {
        validatedData = updateMealSchema.parse(body);
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

      // Convert tags array to JSON string if provided
      const updateData = {
        ...validatedData,
        tags: validatedData.tags ? JSON.stringify(validatedData.tags) : undefined,
      };

      // Update meal using server action
      const result = await updateMeal(existingMeal.data.id, updateData);

      if (!result.success) {
        // #253: no session user (API-key-only caller) is 401, not 500.
        if (isSessionRequiredRefusal(result)) return mealSessionRequiredResponse();
        // #217: the account has a pending deletion; nothing was written.
        // #225: a meal the update no longer finds is 404, not 500.
        const status = isPendingDeletionRefusal(result)
          ? 403
          : result.error === 'Meal not found'
            ? 404
            : 500;
        return NextResponse.json(
          {
            success: false,
            // #241: a 500 carries a fixed message; the detail is logged only.
            error: mealErrorMessage(status, result.error, 'Failed to update meal'),
          },
          { status }
        );
      }

      return NextResponse.json({
        success: true,
        data: result.data,
      });
    } catch (error) {
      console.error('Error updating meal:', error);
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
 * DELETE /api/v1/meals/:id
 *
 * Delete a meal (hard delete)
 *
 * Path Parameters:
 * - id: Meal ID (UUID)
 *
 * Response:
 * {
 *   success: true
 * }
 *
 * Errors:
 * - 401: Not authenticated
 * - 403: Missing the delete:meals scope
 * - 404: Meal not found, or not the caller's own meal (admins included, #225)
 * - 500: Internal server error
 */
export const DELETE = requireScopes(
  [SCOPES.DELETE_MEALS],
  async (_request: NextRequest, auth, context: RouteContext) => {
    try {
      // Extract meal ID from route params (Next.js 15: params is a Promise)
      const params = await context.params;
      const id = params?.id as string;

      if (!id) {
        return NextResponse.json(
          {
            success: false,
            error: 'Meal ID is required',
          },
          { status: 400 }
        );
      }

      // Verify ownership first
      const existingMeal = await getMealById(id);

      if (!existingMeal.success || !existingMeal.data) {
        const statusCode = existingMeal.error === 'Meal not found' ? 404 : 500;

        return NextResponse.json(
          {
            success: false,
            // #241: a 500 carries a fixed message; the detail is logged only.
            error: mealErrorMessage(statusCode, existingMeal.error, 'Failed to fetch meal'),
          },
          { status: statusCode }
        );
      }

      // #225: owner only, no admin bypass (deleteMeal is scoped to the caller's
      // meals, so a bypassed admin deleted nothing and got a false 200).
      if (existingMeal.data.user_id !== auth.userId) {
        return NextResponse.json({ success: false, error: 'Meal not found' }, { status: 404 });
      }

      // Delete meal using server action
      const result = await deleteMeal(existingMeal.data.id);

      if (!result.success) {
        // #253: no session user (API-key-only caller) is 401, not 500.
        if (isSessionRequiredRefusal(result)) return mealSessionRequiredResponse();
        // #225: deleteMeal reports a delete that matched no row as not found.
        const status = result.error === 'Meal not found' ? 404 : 500;
        return NextResponse.json(
          {
            success: false,
            // #241: a 500 carries a fixed message; the detail is logged only.
            error: mealErrorMessage(status, result.error, 'Failed to delete meal'),
          },
          { status }
        );
      }

      return NextResponse.json({
        success: true,
      });
    } catch (error) {
      console.error('Error deleting meal:', error);
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
