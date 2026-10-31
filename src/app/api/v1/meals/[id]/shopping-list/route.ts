/**
 * REST API v1 - Meal Shopping List Endpoints
 *
 * POST /api/v1/meals/:id/shopping-list - Generate shopping list from meal
 * GET  /api/v1/meals/:id/shopping-list - Get existing shopping list for meal
 *
 * Authentication: Requires a signed-in session or API key
 * Authorization: Scope-based permissions + ownership verification
 */

import { and, eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { generateShoppingList, getMealById } from '@/app/actions/meals';
import { isPendingDeletionRefusal } from '@/lib/account-deletion/guarded-insert';
import { requireScopes, SCOPES } from '@/lib/api-auth';
import type { RouteContext } from '@/lib/api-auth/types';
import { db } from '@/lib/db';
import { shoppingLists } from '@/lib/db/schema';
import { mealErrorMessage } from '../../error-body';

/**
 * GET /api/v1/meals/:id/shopping-list
 *
 * Get existing shopping list for a meal
 *
 * Path Parameters:
 * - id: Meal ID (UUID)
 *
 * Response:
 * {
 *   success: true,
 *   data: ShoppingList | null
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
  async (_request: NextRequest, auth, context: RouteContext) => {
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

      // Check ownership (users can only view their own meals)
      if (existingMeal.data.user_id !== auth.userId && !existingMeal.data.is_public) {
        return NextResponse.json(
          {
            success: false,
            error: 'You do not have permission to view this meal',
          },
          { status: 403 }
        );
      }

      // Query for shopping list associated with this meal
      const [shoppingList] = await db
        .select()
        .from(shoppingLists)
        .where(and(eq(shoppingLists.meal_id, mealId), eq(shoppingLists.user_id, auth.userId!)))
        .limit(1);

      // Parse items if found
      if (shoppingList && typeof shoppingList.items === 'string') {
        try {
          shoppingList.items = JSON.parse(shoppingList.items);
        } catch {
          // Keep as string if parsing fails
        }
      }

      return NextResponse.json({
        success: true,
        data: shoppingList || null,
      });
    } catch (error) {
      console.error('Error fetching shopping list:', error);
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
 * POST /api/v1/meals/:id/shopping-list
 *
 * Generate a shopping list from a meal's recipes
 *
 * Path Parameters:
 * - id: Meal ID (UUID)
 *
 * Request Body: (empty)
 * {}
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     id: string,
 *     mealId: string,
 *     name: string,
 *     items: Array<{
 *       name: string,
 *       quantity: number,
 *       unit: string,
 *       category: string,
 *       checked: boolean,
 *       from_recipes: string[],
 *       estimated_price?: string
 *     }>,
 *     status: 'draft' | 'active' | 'completed',
 *     createdAt: string,
 *     updatedAt: string
 *   }
 * }
 *
 * Features:
 * - Consolidates ingredients with smart quantity merging
 * - Filters out non-purchaseable items (water, ice)
 * - Groups by category (produce, proteins, dairy, etc.)
 * - Tracks which recipes each ingredient comes from
 *
 * Errors:
 * - 401: Not authenticated
 * - 403: Insufficient permissions, or the caller's account is pending deletion
 * - 404: Meal not found, or another user's private meal (#225)
 * - 500: Internal server error
 */
export const POST = requireScopes(
  [SCOPES.WRITE_MEALS],
  async (_request: NextRequest, _auth, context: RouteContext) => {
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

      // #225: no ownership check and no admin bypass. getMealById answers only
      // the caller's own meals and public ones (anything else is 404 above), and
      // the action writes the list to the caller, never to the meal owner.
      const result = await generateShoppingList({ mealId });

      if (!result.success) {
        // #225: a pending-deletion refusal is 403 (nothing was written); a meal
        // the caller cannot reach is 404; anything else stays 500.
        const status = isPendingDeletionRefusal(result)
          ? 403
          : result.error === 'Meal not found'
            ? 404
            : 500;
        return NextResponse.json(
          {
            success: false,
            // #241: a 500 carries a fixed message; the detail is logged only.
            error: mealErrorMessage(status, result.error, 'Failed to generate shopping list'),
          },
          { status }
        );
      }

      // Parse items if stored as JSON string
      const shoppingList = result.data;
      if (shoppingList && typeof shoppingList.items === 'string') {
        try {
          shoppingList.items = JSON.parse(shoppingList.items);
        } catch {
          // Keep as string if parsing fails
        }
      }

      return NextResponse.json(
        {
          success: true,
          data: shoppingList,
        },
        { status: 201 }
      );
    } catch (error) {
      console.error('Error generating shopping list:', error);
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
