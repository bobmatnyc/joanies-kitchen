/**
 * REST API v1 - Meal Recipes Endpoints
 *
 * POST   /api/v1/meals/:id/recipes - Add recipe to meal
 * DELETE /api/v1/meals/:id/recipes/:recipeId - Remove recipe from meal (via query param)
 *
 * Authentication: Requires a signed-in session or API key
 * Authorization: Scope-based permissions + ownership verification
 */

import { type NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { addRecipeToMeal, getMealById, removeRecipeFromMeal } from '@/app/actions/meals';
import { isPendingDeletionRefusal } from '@/lib/account-deletion/guarded-insert';
import { requireScopes, SCOPES } from '@/lib/api-auth';
import type { RouteContext } from '@/lib/api-auth/types';
import { isSessionRequiredRefusal } from '@/lib/meals/session-required';
import { type AddRecipeToMealInput, addRecipeToMealSchema } from '@/lib/validations/meal-api';
import { mealErrorMessage, mealSessionRequiredResponse } from '../../error-body';

/**
 * POST /api/v1/meals/:id/recipes
 *
 * Add a recipe to a meal
 *
 * Path Parameters:
 * - id: Meal ID (UUID)
 *
 * Request Body:
 * {
 *   recipeId: string,
 *   servingMultiplier?: number (default: 1),
 *   courseCategory?: 'appetizer' | 'main' | 'side' | ... (default: 'main'),
 *   displayOrder?: number (default: 0),
 *   preparationNotes?: string
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: MealRecipe
 * }
 *
 * Errors:
 * - 401: Not authenticated
 * - 403: Missing the write:meals scope, or the account has a pending
 *   deletion (#225)
 * - 404: Meal not found, or not the caller's own meal (admins included, #225);
 *   or the recipe is not found
 * - 400: Invalid request body
 * - 500: Internal server error
 */
export const POST = requireScopes(
  [SCOPES.WRITE_MEALS],
  async (request: NextRequest, auth, context: RouteContext) => {
    try {
      // Extract meal ID from route params (Next.js 15: params is a Promise)
      const params = await context.params;
      const mealId = params?.id as string;

      if (!mealId) {
        return NextResponse.json(
          {
            success: false,
            error: 'Meal ID is required',
          },
          { status: 400 }
        );
      }

      // Verify ownership first (getMealById checks access)
      const existingMeal = await getMealById(mealId);

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

      // #225: owner only, no admin bypass (addRecipeToMeal is scoped to the
      // caller's meals); another user's meal answers as not found, as DELETE does.
      if (existingMeal.data.user_id !== auth.userId) {
        return NextResponse.json({ success: false, error: 'Meal not found' }, { status: 404 });
      }

      // Parse request body
      const body = await request.json();

      // Validate request body
      let validatedData: AddRecipeToMealInput;
      try {
        validatedData = addRecipeToMealSchema.parse(body);
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

      // Add recipe to meal using server action
      const result = await addRecipeToMeal({
        meal_id: mealId,
        recipe_id: validatedData.recipeId,
        course_category: validatedData.courseCategory,
        serving_multiplier: validatedData.servingMultiplier.toFixed(2),
        display_order: validatedData.displayOrder,
        preparation_notes: validatedData.preparationNotes,
      });

      if (!result.success) {
        // #253: no session user (API-key-only caller) is 401, not 500.
        if (isSessionRequiredRefusal(result)) return mealSessionRequiredResponse();
        // #225: a pending-deletion refusal is 403 (nothing was written); a meal
        // or recipe the caller cannot reach is 404; anything else stays 500.
        const status = isPendingDeletionRefusal(result)
          ? 403
          : result.error === 'Meal not found' || result.error === 'Recipe not found'
            ? 404
            : 500;
        return NextResponse.json(
          {
            success: false,
            // #241: a 500 carries a fixed message; the detail is logged only.
            error: mealErrorMessage(status, result.error, 'Failed to add recipe to meal'),
          },
          { status }
        );
      }

      return NextResponse.json(
        {
          success: true,
          data: result.data,
        },
        { status: 201 }
      );
    } catch (error) {
      console.error('Error adding recipe to meal:', error);
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
 * DELETE /api/v1/meals/:id/recipes
 *
 * Remove a recipe from a meal
 *
 * Path Parameters:
 * - id: Meal ID (UUID)
 *
 * Query Parameters:
 * - mealRecipeId: Meal Recipe relationship ID (UUID) - the ID from meal_recipes table
 *
 * Response:
 * {
 *   success: true
 * }
 *
 * Errors:
 * - 401: Not authenticated
 * - 403: Missing the meals:write scope
 * - 404: Meal not found, or not the caller's own meal (admins included, #222);
 *        or the meal recipe is not in this meal
 * - 400: Missing mealRecipeId query parameter
 * - 500: Internal server error
 */
export const DELETE = requireScopes(
  [SCOPES.WRITE_MEALS],
  async (request: NextRequest, auth, context: RouteContext) => {
    try {
      // Extract meal ID from route params (Next.js 15: params is a Promise)
      const params = await context.params;
      const mealId = params?.id as string;

      if (!mealId) {
        return NextResponse.json(
          {
            success: false,
            error: 'Meal ID is required',
          },
          { status: 400 }
        );
      }

      // Get mealRecipeId from query params
      const searchParams = request.nextUrl.searchParams;
      const mealRecipeId = searchParams.get('mealRecipeId');

      if (!mealRecipeId) {
        return NextResponse.json(
          {
            success: false,
            error: 'mealRecipeId query parameter is required',
          },
          { status: 400 }
        );
      }

      // Verify ownership first (getMealById checks access)
      const existingMeal = await getMealById(mealId);

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

      // #222: owner only, no admin bypass (the action's DELETE is scoped to the
      // caller's meals); another user's meal answers as not found.
      if (existingMeal.data.user_id !== auth.userId) {
        return NextResponse.json({ success: false, error: 'Meal not found' }, { status: 404 });
      }

      // #222: pass :id so a row of a different meal is never deleted.
      const result = await removeRecipeFromMeal(mealRecipeId, mealId);

      if (!result.success) {
        // #253: no session user (API-key-only caller) is 401, not 500.
        if (isSessionRequiredRefusal(result)) return mealSessionRequiredResponse();
        const statusCode = result.error === 'Recipe not found in meal' ? 404 : 500;

        return NextResponse.json(
          {
            success: false,
            // #241: a 500 carries a fixed message; the detail is logged only.
            error: mealErrorMessage(statusCode, result.error, 'Failed to remove recipe from meal'),
          },
          { status: statusCode }
        );
      }

      return NextResponse.json({
        success: true,
      });
    } catch (error) {
      console.error('Error removing recipe from meal:', error);
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
