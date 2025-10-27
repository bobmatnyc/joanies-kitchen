/**
 * REST API v1 - Meals Collection Endpoints
 *
 * GET    /api/v1/meals - List user's meals with filters
 * POST   /api/v1/meals - Create new meal
 *
 * Authentication: Requires Clerk session or API key
 * Authorization: Scope-based permissions
 */

import { type NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { addRecipeToMeal, createMeal, getUserMeals } from '@/app/actions/meals';
import { requireScopes, SCOPES } from '@/lib/api-auth';
import {
  createMealSchema,
  listMealsQuerySchema,
  type CreateMealInput,
  type ListMealsQuery,
} from '@/lib/validations/meal-api';

/**
 * GET /api/v1/meals
 *
 * List meals for the authenticated user with optional filtering
 *
 * Query Parameters:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 * - sortBy: Sort field (created_at, updated_at, name)
 * - order: Sort order (asc, desc)
 * - mealType: Filter by meal type (breakfast, lunch, dinner, etc.)
 * - isTemplate: Filter by template status (true, false)
 * - isPublic: Filter by public status (true, false)
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     meals: Meal[],
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
    let validatedQuery: ListMealsQuery;
    try {
      validatedQuery = listMealsQuerySchema.parse(queryParams);
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

    // Fetch meals using server action
    const result = await getUserMeals({
      mealType: validatedQuery.mealType || 'all',
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to fetch meals',
        },
        { status: 500 }
      );
    }

    let meals = result.data || [];

    // Apply additional filters
    if (validatedQuery.isTemplate !== undefined) {
      meals = meals.filter((meal) => meal.is_template === validatedQuery.isTemplate);
    }

    if (validatedQuery.isPublic !== undefined) {
      meals = meals.filter((meal) => meal.is_public === validatedQuery.isPublic);
    }

    // Apply sorting
    meals.sort((a, b) => {
      const aValue = a[validatedQuery.sortBy] || '';
      const bValue = b[validatedQuery.sortBy] || '';
      const comparison = aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      return validatedQuery.order === 'asc' ? comparison : -comparison;
    });

    // Apply pagination
    const total = meals.length;
    const startIndex = (validatedQuery.page - 1) * validatedQuery.limit;
    const endIndex = startIndex + validatedQuery.limit;
    const paginatedMeals = meals.slice(startIndex, endIndex);

    return NextResponse.json({
      success: true,
      data: {
        meals: paginatedMeals,
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
    console.error('Error fetching meals:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
});

/**
 * POST /api/v1/meals
 *
 * Create a new meal for the authenticated user
 *
 * Request Body:
 * {
 *   name: string,
 *   description: string,
 *   meal_type?: 'breakfast' | 'lunch' | 'dinner' | ...,
 *   occasion?: string,
 *   serves?: number,
 *   tags?: string[],
 *   is_template?: boolean,
 *   is_public?: boolean,
 *   estimated_total_cost?: string,
 *   estimated_cost_per_serving?: string,
 *   recipes?: Array<{
 *     recipeId: string,
 *     servingMultiplier?: number,
 *     courseCategory?: 'appetizer' | 'main' | 'side' | ...,
 *     displayOrder?: number,
 *     preparationNotes?: string
 *   }>
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
 * - 403: Insufficient permissions (missing write:meals scope)
 * - 400: Invalid request body
 * - 500: Internal server error
 */
export const POST = requireScopes([SCOPES.WRITE_MEALS], async (request: NextRequest, auth) => {
  try {
    // Parse request body
    const body = await request.json();

    // Validate request body
    let validatedData: CreateMealInput;
    try {
      validatedData = createMealSchema.parse(body);
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

    // Extract recipes from request (if provided)
    const recipesToAdd = validatedData.recipes || [];
    const { recipes, ...mealData } = validatedData;

    // Convert tags array to JSON string
    const mealCreateData = {
      ...mealData,
      tags: mealData.tags ? JSON.stringify(mealData.tags) : undefined,
    };

    // Create meal using server action
    const result = await createMeal(mealCreateData);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to create meal',
        },
        { status: 500 }
      );
    }

    const createdMeal = result.data;

    // Add recipes to meal if provided
    if (recipesToAdd.length > 0 && createdMeal) {
      for (const recipe of recipesToAdd) {
        await addRecipeToMeal({
          meal_id: createdMeal.id,
          recipe_id: recipe.recipeId,
          course_category: recipe.courseCategory,
          serving_multiplier: recipe.servingMultiplier.toFixed(2),
          display_order: recipe.displayOrder,
          preparation_notes: recipe.preparationNotes,
        });
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: createdMeal,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating meal:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
});
