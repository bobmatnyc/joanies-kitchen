/**
 * REST API v1 - Inventory Recipe Matching Endpoint
 *
 * GET /api/v1/inventory/matches - Get recipes matching current inventory
 *
 * Authentication: Requires Clerk session or API key
 * Authorization: Scope-based permissions
 */

import type { NextRequest } from 'next/server';
import { apiError, apiSuccess, parseQueryParams } from '@/lib/api';
import { requireScopes, SCOPES } from '@/lib/api-auth';
import { inventoryService } from '@/lib/services/inventory-service';
import { matchRecipesQuerySchema } from '@/lib/validations/inventory-api';

/**
 * GET /api/v1/inventory/matches
 *
 * Find recipes that can be made with user's current inventory
 *
 * Query Parameters:
 * - limit: Maximum recipes to return (default: 20, max: 50)
 * - minMatchPercentage: Minimum % of ingredients matched (default: 50, range: 0-100)
 * - prioritizeExpiring: Prioritize recipes using expiring ingredients (default: false)
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     recipes: Array<{
 *       id: string,
 *       name: string,
 *       slug: string,
 *       description: string,
 *       image_url: string,
 *       images: string[],
 *       prep_time: number,
 *       cook_time: number,
 *       servings: number,
 *       difficulty: string,
 *       cuisine: string,
 *       match_percentage: number,
 *       total_ingredients: number,
 *       matched_ingredients: number,
 *       missing_ingredients: Array<{
 *         ingredient_id: string,
 *         ingredient_name: string,
 *         amount: string,
 *         unit: string
 *       }>
 *     }>
 *   }
 * }
 *
 * Errors:
 * - 401: Not authenticated
 * - 403: Insufficient permissions (missing read:inventory or read:recipes scope)
 * - 400: Invalid query parameters
 * - 500: Internal server error
 */
export const GET = requireScopes(
  [SCOPES.READ_INVENTORY, SCOPES.READ_RECIPES],
  async (request: NextRequest, auth) => {
    try {
      // Parse and validate query parameters
      const parsed = parseQueryParams(request, matchRecipesQuerySchema);
      if ('error' in parsed) return parsed.error;

      const { data: validatedQuery } = parsed;

      // Ensure user is authenticated
      if (!auth.userId) {
        return apiError('User not authenticated', 401);
      }

      // Match recipes using service
      const recipes = await inventoryService.matchRecipes(auth.userId, {
        minMatchPercentage: validatedQuery.minMatchPercentage,
        prioritizeExpiring: validatedQuery.prioritizeExpiring,
        limit: validatedQuery.limit,
      });

      return apiSuccess({ recipes });
    } catch (error) {
      console.error('Error matching recipes to inventory:', error);
      return apiError('Internal server error');
    }
  }
);
