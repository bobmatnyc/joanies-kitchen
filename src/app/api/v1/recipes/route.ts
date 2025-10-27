/**
 * REST API v1 - Recipes Collection Endpoints
 *
 * GET    /api/v1/recipes - List user's recipes with filters
 * POST   /api/v1/recipes - Create new recipe
 *
 * Authentication: Requires Clerk session or API key
 * Authorization: Scope-based permissions
 */

import { type NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { createRecipe, getRecipes, searchRecipes } from '@/app/actions/recipes';
import { requireAuth, requireScopes, SCOPES } from '@/lib/api-auth';
import {
  createRecipeSchema,
  listRecipesQuerySchema,
  type CreateRecipeInput,
  type ListRecipesQuery,
} from '@/lib/validations/recipe-api';

/**
 * GET /api/v1/recipes
 *
 * List recipes for the authenticated user with optional filtering
 *
 * Query Parameters:
 * - tags: Comma-separated list of tags to filter by
 * - search: Text search query
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 * - sortBy: Sort field (created_at, updated_at, name)
 * - order: Sort order (asc, desc)
 * - cuisine: Filter by cuisine type
 * - difficulty: Filter by difficulty (easy, medium, hard)
 * - isPublic: Filter by public/private status
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
 * - 403: Insufficient permissions (missing read:recipes scope)
 * - 400: Invalid query parameters
 * - 500: Internal server error
 */
export const GET = requireScopes([SCOPES.READ_RECIPES], async (request: NextRequest, auth) => {
  try {
    // Parse and validate query parameters
    const searchParams = request.nextUrl.searchParams;
    const queryParams: Record<string, any> = {};

    // Extract all query parameters
    searchParams.forEach((value, key) => {
      queryParams[key] = value;
    });

    // Validate query parameters
    let validatedQuery: ListRecipesQuery;
    try {
      validatedQuery = listRecipesQuerySchema.parse(queryParams);
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

    // If search query is provided, use search function
    if (validatedQuery.search) {
      const result = await searchRecipes(validatedQuery.search);

      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            error: result.error || 'Failed to search recipes',
          },
          { status: 500 }
        );
      }

      // Apply additional filters manually for search results
      let filteredRecipes = result.data || [];

      // Filter by cuisine
      if (validatedQuery.cuisine) {
        filteredRecipes = filteredRecipes.filter(
          (recipe) => recipe.cuisine?.toLowerCase() === validatedQuery.cuisine?.toLowerCase()
        );
      }

      // Filter by difficulty
      if (validatedQuery.difficulty) {
        filteredRecipes = filteredRecipes.filter(
          (recipe) => recipe.difficulty === validatedQuery.difficulty
        );
      }

      // Filter by public status
      if (validatedQuery.isPublic !== undefined) {
        filteredRecipes = filteredRecipes.filter(
          (recipe) => recipe.is_public === validatedQuery.isPublic
        );
      }

      // Apply sorting
      filteredRecipes.sort((a, b) => {
        const aValue = a[validatedQuery.sortBy] || '';
        const bValue = b[validatedQuery.sortBy] || '';
        const comparison = aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
        return validatedQuery.order === 'asc' ? comparison : -comparison;
      });

      // Apply pagination
      const total = filteredRecipes.length;
      const startIndex = (validatedQuery.page - 1) * validatedQuery.limit;
      const endIndex = startIndex + validatedQuery.limit;
      const paginatedRecipes = filteredRecipes.slice(startIndex, endIndex);

      return NextResponse.json({
        success: true,
        data: {
          recipes: paginatedRecipes,
          pagination: {
            page: validatedQuery.page,
            limit: validatedQuery.limit,
            total,
            totalPages: Math.ceil(total / validatedQuery.limit),
            hasMore: endIndex < total,
          },
        },
      });
    }

    // Parse tags if provided
    const tags = validatedQuery.tags ? validatedQuery.tags.split(',').map((t) => t.trim()) : undefined;

    // Use getRecipes with tag filtering
    const result = await getRecipes(tags);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to fetch recipes',
        },
        { status: 500 }
      );
    }

    let recipes = result.data || [];

    // Apply additional filters
    if (validatedQuery.cuisine) {
      recipes = recipes.filter(
        (recipe) => recipe.cuisine?.toLowerCase() === validatedQuery.cuisine?.toLowerCase()
      );
    }

    if (validatedQuery.difficulty) {
      recipes = recipes.filter((recipe) => recipe.difficulty === validatedQuery.difficulty);
    }

    if (validatedQuery.isPublic !== undefined) {
      recipes = recipes.filter((recipe) => recipe.is_public === validatedQuery.isPublic);
    }

    // Apply sorting
    recipes.sort((a, b) => {
      const aValue = a[validatedQuery.sortBy] || '';
      const bValue = b[validatedQuery.sortBy] || '';
      const comparison = aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      return validatedQuery.order === 'asc' ? comparison : -comparison;
    });

    // Apply pagination
    const total = recipes.length;
    const startIndex = (validatedQuery.page - 1) * validatedQuery.limit;
    const endIndex = startIndex + validatedQuery.limit;
    const paginatedRecipes = recipes.slice(startIndex, endIndex);

    return NextResponse.json({
      success: true,
      data: {
        recipes: paginatedRecipes,
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
    console.error('Error fetching recipes:', error);
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
 * POST /api/v1/recipes
 *
 * Create a new recipe for the authenticated user
 *
 * Request Body:
 * {
 *   name: string,
 *   description?: string,
 *   ingredients: string[],
 *   instructions: string[],
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
 *   license?: 'PUBLIC_DOMAIN' | 'CC_BY' | ... (see schema)
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
 * - 403: Insufficient permissions (missing write:recipes scope)
 * - 400: Invalid request body
 * - 500: Internal server error
 */
export const POST = requireScopes([SCOPES.WRITE_RECIPES], async (request: NextRequest, auth) => {
  try {
    // Parse request body
    const body = await request.json();

    // Validate request body
    let validatedData: CreateRecipeInput;
    try {
      validatedData = createRecipeSchema.parse(body);
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

    // Create recipe using server action
    // Cast to any to work around type mismatch between our schema and internal types
    const result = await createRecipe(validatedData as any);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to create recipe',
        },
        { status: 500 }
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
    console.error('Error creating recipe:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
});
