/**
 * REST API v1 - Recipes Collection Endpoints
 *
 * GET    /api/v1/recipes - List user's recipes with filters
 * POST   /api/v1/recipes - Create new recipe
 *
 * Authentication: Requires Clerk session or API key
 * Authorization: Scope-based permissions
 */

import type { NextRequest } from 'next/server';
import { createRecipe, getRecipes, searchRecipes } from '@/app/actions/recipes';
import {
  apiError,
  apiSuccess,
  apiSuccessPaginated,
  applyFilters,
  applyPagination,
  applySorting,
  parseJsonBody,
  parseQueryParams,
} from '@/lib/api';
import { requireScopes, SCOPES } from '@/lib/api-auth';
import { createRecipeSchema, listRecipesQuerySchema } from '@/lib/validations/recipe-api';

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
export const GET = requireScopes([SCOPES.READ_RECIPES], async (request: NextRequest, _auth) => {
  try {
    // Parse and validate query parameters
    const parsed = parseQueryParams(request, listRecipesQuerySchema);
    if ('error' in parsed) return parsed.error;

    const { data: validatedQuery } = parsed;

    // Fetch recipes (search or regular listing)
    const result = validatedQuery.search
      ? await searchRecipes(validatedQuery.search)
      : await getRecipes(
          validatedQuery.tags ? validatedQuery.tags.split(',').map((t) => t.trim()) : undefined
        );

    if (!result.success) {
      return apiError(result.error || 'Failed to fetch recipes', 500);
    }

    let recipes = result.data || [];

    // Build filter criteria
    const filters: Record<string, unknown> = {};
    if (validatedQuery.cuisine) filters.cuisine = validatedQuery.cuisine;
    if (validatedQuery.difficulty) filters.difficulty = validatedQuery.difficulty;
    if (validatedQuery.isPublic !== undefined) filters.is_public = validatedQuery.isPublic;

    // Apply filters
    recipes = applyFilters(recipes, filters);

    // Apply sorting (defaults guaranteed by schema)
    recipes = applySorting(recipes, validatedQuery.sortBy!, validatedQuery.order!);

    // Apply pagination (defaults guaranteed by schema)
    const { items: paginatedRecipes, total } = applyPagination(
      recipes,
      validatedQuery.page!,
      validatedQuery.limit!
    );

    return apiSuccessPaginated(
      paginatedRecipes,
      validatedQuery.page!,
      validatedQuery.limit!,
      total
    );
  } catch (error) {
    console.error('Error fetching recipes:', error);
    return apiError('Internal server error');
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
export const POST = requireScopes([SCOPES.WRITE_RECIPES], async (request: NextRequest, _auth) => {
  try {
    // Parse and validate request body
    const parsed = await parseJsonBody(request, createRecipeSchema);
    if ('error' in parsed) return parsed.error;

    const { data: validatedData } = parsed;

    // Create recipe using server action
    // Cast to any to work around type mismatch between our schema and internal types
    const result = await createRecipe(validatedData as any);

    if (!result.success) {
      return apiError(result.error || 'Failed to create recipe', 500);
    }

    return apiSuccess(result.data, 201);
  } catch (error) {
    console.error('Error creating recipe:', error);
    return apiError('Internal server error');
  }
});
