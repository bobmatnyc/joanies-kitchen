/**
 * REST API v1 - Individual Shopping List Endpoints
 *
 * GET    /api/v1/shopping-lists/:id - Get single shopping list by ID
 * PATCH  /api/v1/shopping-lists/:id - Update shopping list
 * DELETE /api/v1/shopping-lists/:id - Delete shopping list
 *
 * Authentication: Requires Clerk session or API key
 * Authorization: Scope-based permissions + ownership verification
 */

import { and, eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getShoppingListById, updateShoppingList } from '@/app/actions/meals';
import { requireScopes, SCOPES } from '@/lib/api-auth';
import type { RouteContext } from '@/lib/api-auth/types';
import { db } from '@/lib/db';
import { shoppingLists } from '@/lib/db/schema';
import { type UpdateShoppingListInput, updateShoppingListSchema } from '@/lib/validations/meal-api';

/**
 * GET /api/v1/shopping-lists/:id
 *
 * Get a single shopping list by ID
 *
 * Path Parameters:
 * - id: Shopping List ID (UUID)
 *
 * Response:
 * {
 *   success: true,
 *   data: ShoppingList
 * }
 *
 * Errors:
 * - 401: Not authenticated
 * - 403: Insufficient permissions or access denied
 * - 404: Shopping list not found
 * - 500: Internal server error
 */
export const GET = requireScopes(
  [SCOPES.READ_MEALS],
  async (_request: NextRequest, _auth, context: RouteContext) => {
    try {
      // Extract shopping list ID from route params (Next.js 15: params is a Promise)
      const params = context?.params ? await context.params : {};
      const id = params?.id as string;

      if (!id) {
        return NextResponse.json(
          {
            success: false,
            error: 'Shopping list ID is required',
          },
          { status: 400 }
        );
      }

      // Fetch shopping list
      const result = await getShoppingListById(id);

      if (!result.success) {
        // Check if it's a not found error
        const statusCode = result.error === 'Shopping list not found' ? 404 : 500;

        return NextResponse.json(
          {
            success: false,
            error: result.error || 'Failed to fetch shopping list',
          },
          { status: statusCode }
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

      return NextResponse.json({
        success: true,
        data: shoppingList,
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
 * PATCH /api/v1/shopping-lists/:id
 *
 * Update a shopping list (partial update)
 *
 * Path Parameters:
 * - id: Shopping List ID (UUID)
 *
 * Request Body: (all fields optional)
 * {
 *   name?: string,
 *   notes?: string,
 *   items?: Array<{
 *     name: string,
 *     quantity: number,
 *     unit: string,
 *     category: string,
 *     checked: boolean,
 *     from_recipes?: string[],
 *     estimated_price?: string,
 *     notes?: string
 *   }>,
 *   status?: 'draft' | 'active' | 'shopping' | 'completed' | 'archived',
 *   estimated_total_cost?: string
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: ShoppingList
 * }
 *
 * Errors:
 * - 401: Not authenticated
 * - 403: Insufficient permissions or not shopping list owner
 * - 404: Shopping list not found
 * - 400: Invalid request body
 * - 500: Internal server error
 */
export const PATCH = requireScopes(
  [SCOPES.WRITE_MEALS],
  async (request: NextRequest, auth, context: RouteContext) => {
    try {
      // Extract shopping list ID from route params (Next.js 15: params is a Promise)
      const params = context?.params ? await context.params : {};
      const id = params?.id as string;

      if (!id) {
        return NextResponse.json(
          {
            success: false,
            error: 'Shopping list ID is required',
          },
          { status: 400 }
        );
      }

      // Verify ownership first (getShoppingListById checks access)
      const existingList = await getShoppingListById(id);

      if (!existingList.success || !existingList.data) {
        const statusCode = existingList.error === 'Shopping list not found' ? 404 : 500;

        return NextResponse.json(
          {
            success: false,
            error: existingList.error || 'Failed to fetch shopping list',
          },
          { status: statusCode }
        );
      }

      // Check ownership (users can only edit their own shopping lists)
      if (existingList.data.user_id !== auth.userId) {
        // Check if user is admin
        const isAdmin = auth.metadata?.isAdmin === true;

        if (!isAdmin) {
          return NextResponse.json(
            {
              success: false,
              error: 'You do not have permission to edit this shopping list',
            },
            { status: 403 }
          );
        }
      }

      // Parse request body
      const body = await request.json();

      // Validate request body
      let validatedData: UpdateShoppingListInput;
      try {
        validatedData = updateShoppingListSchema.parse(body);
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

      // Convert items array to JSON string if provided
      const updateData = {
        ...validatedData,
        items: validatedData.items ? JSON.stringify(validatedData.items) : undefined,
      };

      // Update shopping list using server action
      const result = await updateShoppingList(existingList.data.id, updateData);

      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            error: result.error || 'Failed to update shopping list',
          },
          { status: 500 }
        );
      }

      // Parse items in response
      const updatedList = result.data;
      if (updatedList && typeof updatedList.items === 'string') {
        try {
          updatedList.items = JSON.parse(updatedList.items);
        } catch {
          // Keep as string if parsing fails
        }
      }

      return NextResponse.json({
        success: true,
        data: updatedList,
      });
    } catch (error) {
      console.error('Error updating shopping list:', error);
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
 * DELETE /api/v1/shopping-lists/:id
 *
 * Delete a shopping list (hard delete)
 *
 * Path Parameters:
 * - id: Shopping List ID (UUID)
 *
 * Response:
 * {
 *   success: true
 * }
 *
 * Errors:
 * - 401: Not authenticated
 * - 403: Insufficient permissions or not shopping list owner
 * - 404: Shopping list not found
 * - 500: Internal server error
 */
export const DELETE = requireScopes(
  [SCOPES.DELETE_MEALS],
  async (_request: NextRequest, auth, context: RouteContext) => {
    try {
      // Extract shopping list ID from route params (Next.js 15: params is a Promise)
      const params = context?.params ? await context.params : {};
      const id = params?.id as string;

      if (!id) {
        return NextResponse.json(
          {
            success: false,
            error: 'Shopping list ID is required',
          },
          { status: 400 }
        );
      }

      // Verify ownership first
      const existingList = await getShoppingListById(id);

      if (!existingList.success || !existingList.data) {
        const statusCode = existingList.error === 'Shopping list not found' ? 404 : 500;

        return NextResponse.json(
          {
            success: false,
            error: existingList.error || 'Failed to fetch shopping list',
          },
          { status: statusCode }
        );
      }

      // Check ownership (users can only delete their own shopping lists)
      if (existingList.data.user_id !== auth.userId) {
        // Check if user is admin
        const isAdmin = auth.metadata?.isAdmin === true;

        if (!isAdmin) {
          return NextResponse.json(
            {
              success: false,
              error: 'You do not have permission to delete this shopping list',
            },
            { status: 403 }
          );
        }
      }

      // Delete shopping list directly
      await db
        .delete(shoppingLists)
        .where(
          and(eq(shoppingLists.id, existingList.data.id), eq(shoppingLists.user_id, auth.userId!))
        );

      return NextResponse.json({
        success: true,
      });
    } catch (error) {
      console.error('Error deleting shopping list:', error);
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
