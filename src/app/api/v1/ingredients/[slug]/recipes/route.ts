/**
 * REST API v1 - Ingredient Recipes Endpoint
 *
 * GET /api/v1/ingredients/:slug/recipes - Get recipes using an ingredient
 *
 * Authentication: Requires Clerk session or API key
 * Authorization: Scope-based permissions
 */

import { NextResponse, type NextRequest } from 'next/server';
import { apiError, getRequiredParam } from '@/lib/api';
import { requireScopes, SCOPES } from '@/lib/api-auth';
import type { RouteContext } from '@/lib/api-auth/types';
import { ingredientService } from '@/lib/services';

/**
 * GET /api/v1/ingredients/:slug/recipes
 *
 * Get recipes that use a specific ingredient
 *
 * Path Parameters:
 * - slug: Ingredient slug (e.g., 'tomato', 'olive-oil')
 *
 * Query Parameters:
 * - sortBy: Sort order ('popular', 'recent', 'rating') - default: 'popular'
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 50, max: 100)
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     recipes: Recipe[],
 *     ingredient: Ingredient,
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
 * - 403: Insufficient permissions (missing read:ingredients and read:recipes scopes)
 * - 404: Ingredient not found
 * - 400: Invalid query parameters
 * - 500: Internal server error
 */
export const GET = requireScopes(
  [SCOPES.READ_INGREDIENTS, SCOPES.READ_RECIPES],
  async (request: NextRequest, _auth, context: RouteContext) => {
    try {
      // Extract slug from route params
      const slugResult = await getRequiredParam(context, 'slug');
      if ('error' in slugResult) return slugResult.error;

      const { data: slug } = slugResult;

      // Fetch ingredient by slug
      const ingredient = await ingredientService.findBySlug(slug);

      if (!ingredient) {
        return apiError(`Ingredient not found: ${slug}`, 404);
      }

      // Parse query parameters
      const searchParams = request.nextUrl.searchParams;
      const sortBy = (searchParams.get('sortBy') as 'popular' | 'recent' | 'rating') || 'popular';
      const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));

      // Validate sortBy parameter
      const validSortBy = ['popular', 'recent', 'rating'];
      if (!validSortBy.includes(sortBy)) {
        return apiError(`Invalid sortBy parameter. Must be one of: ${validSortBy.join(', ')}`, 400);
      }

      // Calculate offset
      const offset = (page - 1) * limit;

      // Fetch recipes using this ingredient
      const recipes = await ingredientService.getRecipesUsingIngredient(ingredient.id, {
        sortBy,
        limit: limit + 1, // Fetch one extra to check if there are more
        offset,
      });

      // Check if there are more results
      const hasMore = recipes.length > limit;
      const resultRecipes = hasMore ? recipes.slice(0, limit) : recipes;

      // Calculate total (approximation based on hasMore)
      const total = hasMore ? offset + limit + 1 : offset + resultRecipes.length;

      // Calculate pagination metadata
      const totalPages = Math.ceil(total / limit);

      // Return response with recipes, ingredient, and pagination
      return NextResponse.json({
        success: true,
        data: {
          recipes: resultRecipes,
          ingredient,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasMore,
        },
      });
    } catch (error) {
      console.error('Error fetching recipes for ingredient:', error);
      return apiError('Internal server error');
    }
  }
);
