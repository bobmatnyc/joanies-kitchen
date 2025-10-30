/**
 * REST API v1 - Shopping Lists Collection Endpoints
 *
 * GET /api/v1/shopping-lists - List user's shopping lists with filters
 *
 * Authentication: Requires Clerk session or API key
 * Authorization: Scope-based permissions
 */

import { and, asc, desc, eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { requireScopes, SCOPES } from '@/lib/api-auth';
import { db } from '@/lib/db';
import { shoppingLists } from '@/lib/db/schema';
import {
  type ListShoppingListsQuery,
  listShoppingListsQuerySchema,
} from '@/lib/validations/meal-api';

/**
 * GET /api/v1/shopping-lists
 *
 * List shopping lists for the authenticated user with optional filtering
 *
 * Query Parameters:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 * - sortBy: Sort field (created_at, updated_at, name)
 * - order: Sort order (asc, desc)
 * - mealId: Filter by meal ID (UUID)
 * - status: Filter by status (draft, active, shopping, completed, archived)
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     shoppingLists: ShoppingList[],
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
 * - 403: Insufficient permissions (missing read:meals scope)
 * - 400: Invalid query parameters
 * - 500: Internal server error
 */
export const GET = requireScopes([SCOPES.READ_MEALS], async (request: NextRequest, auth) => {
  try {
    // Parse and validate query parameters
    const searchParams = request.nextUrl.searchParams;
    const queryParams: Record<string, any> = {};

    // Extract all query parameters
    searchParams.forEach((value, key) => {
      queryParams[key] = value;
    });

    // Validate query parameters
    let validatedQuery: ListShoppingListsQuery;
    try {
      validatedQuery = listShoppingListsQuerySchema.parse(queryParams);
    } catch (error) {
      if (error instanceof ZodError) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid query parameters',
            details: error.errors,
          },
          { status: 400 }
        );
      }
      throw error;
    }

    // Build query conditions
    const conditions = [eq(shoppingLists.user_id, auth.userId!)];

    if (validatedQuery.mealId) {
      conditions.push(eq(shoppingLists.meal_id, validatedQuery.mealId));
    }

    if (validatedQuery.status) {
      conditions.push(eq(shoppingLists.status, validatedQuery.status));
    }

    // Determine sort order
    const sortColumn = shoppingLists[validatedQuery.sortBy];
    const orderFn = validatedQuery.order === 'asc' ? asc : desc;

    // Fetch shopping lists with pagination
    const allLists = await db
      .select()
      .from(shoppingLists)
      .where(and(...conditions))
      .orderBy(orderFn(sortColumn));

    // Parse items for all shopping lists
    const parsedLists = allLists.map((list) => {
      if (typeof list.items === 'string') {
        try {
          return { ...list, items: JSON.parse(list.items) };
        } catch {
          return list;
        }
      }
      return list;
    });

    // Apply pagination
    const total = parsedLists.length;
    const startIndex = (validatedQuery.page - 1) * validatedQuery.limit;
    const endIndex = startIndex + validatedQuery.limit;
    const paginatedLists = parsedLists.slice(startIndex, endIndex);

    return NextResponse.json({
      success: true,
      data: {
        shoppingLists: paginatedLists,
        pagination: {
          page: validatedQuery.page,
          limit: validatedQuery.limit,
          total,
          totalPages: Math.ceil(total / validatedQuery.limit),
          hasMore: endIndex < total,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching shopping lists:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
});
