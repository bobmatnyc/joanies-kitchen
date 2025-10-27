/**
 * REST API v1 - Similar Recipes Endpoint
 *
 * GET /api/v1/recipes/:id/similar - Get similar recipes using semantic search
 *
 * Authentication: Requires Clerk session or API key
 * Authorization: Scope-based permissions
 */

import type { NextRequest } from 'next/server';
import { getRecipe } from '@/app/actions/recipes';
import { requireScopes, SCOPES } from '@/lib/api-auth';
import type { RouteContext } from '@/lib/api-auth/types';
import { findSimilarRecipes, getRecipeEmbedding } from '@/lib/db/embeddings';
import { similarRecipesQuerySchema, type SimilarRecipesQuery } from '@/lib/validations/recipe-api';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { eq, isNull, or } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import {
  apiSuccess,
  apiError,
  apiNotFound,
  getRequiredParam,
  parseQueryParams,
  handleActionResult,
} from '@/lib/api';

/**
 * GET /api/v1/recipes/:id/similar
 *
 * Find similar recipes using semantic vector search
 *
 * Path Parameters:
 * - id: Recipe ID or slug
 *
 * Query Parameters:
 * - limit: Maximum number of results (default: 10, max: 50)
 * - minSimilarity: Minimum similarity threshold 0-1 (default: 0.5)
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     sourceRecipe: Recipe,
 *     similarRecipes: Array<Recipe & { similarity: number }>
 *   }
 * }
 *
 * Errors:
 * - 401: Not authenticated
 * - 403: Insufficient permissions or access denied
 * - 404: Recipe not found or no embedding available
 * - 400: Invalid query parameters
 * - 500: Internal server error
 */
export const GET = requireScopes(
  [SCOPES.READ_RECIPES],
  async (request: NextRequest, authContext, context: RouteContext) => {
    try {
      // Extract recipe ID and parse query parameters
      const idResult = await getRequiredParam(context, 'id');
      if ('error' in idResult) return idResult.error;

      const { data: id } = idResult;

      const parsed = parseQueryParams(request, similarRecipesQuerySchema);
      if ('error' in parsed) return parsed.error;

      const { data: validatedQuery } = parsed;

      // Fetch the source recipe
      const sourceRecipeResult = await getRecipe(id);
      const recipeCheck = handleActionResult(sourceRecipeResult);
      if ('error' in recipeCheck) return recipeCheck.error;

      const sourceRecipe = recipeCheck.data;

      // Get the recipe's embedding
      const embedding = await getRecipeEmbedding(sourceRecipe.id);

      if (!embedding) {
        return apiNotFound('No embedding available for this recipe. Semantic search not possible');
      }

      // Find similar recipes using vector similarity (defaults guaranteed by schema)
      const similarResults = await findSimilarRecipes(
        embedding.embedding,
        validatedQuery.limit! + 1, // +1 to exclude source recipe
        validatedQuery.minSimilarity!
      );

      // Filter out the source recipe and recipes user doesn't have access to
      const { userId } = await auth();

      // Fetch full recipe details for similar recipes
      const similarRecipeIds = similarResults
        .map((result) => result.recipe_id)
        .filter((recipeId) => recipeId !== sourceRecipe.id); // Exclude source recipe

      if (similarRecipeIds.length === 0) {
        return apiSuccess({
          sourceRecipe,
          similarRecipes: [],
        });
      }

      // Build access condition
      const accessCondition = userId
        ? or(eq(recipes.user_id, userId), eq(recipes.is_public, true))
        : eq(recipes.is_public, true);

      // Fetch similar recipes with proper access control
      const similarRecipesData = await db
        .select()
        .from(recipes)
        .where(
          eq(recipes.id, similarRecipeIds[0])
        );

      // Fetch all similar recipes
      const allSimilarRecipes = await Promise.all(
        similarRecipeIds.map(async (recipeId) => {
          const recipeResult = await db
            .select()
            .from(recipes)
            .where(eq(recipes.id, recipeId))
            .limit(1);

          if (recipeResult.length === 0) {
            return null;
          }

          const recipe = recipeResult[0];

          // Check access
          if (!recipe.is_public && recipe.user_id !== userId) {
            return null; // User doesn't have access
          }

          // Exclude soft-deleted recipes
          if (recipe.deleted_at) {
            return null;
          }

          // Find similarity score
          const similarResult = similarResults.find((r) => r.recipe_id === recipeId);
          const similarity = similarResult?.similarity || 0;

          return {
            ...recipe,
            similarity,
          };
        })
      );

      // Filter out null values and sort by similarity (limit guaranteed by schema)
      const filteredSimilarRecipes = allSimilarRecipes
        .filter((recipe): recipe is NonNullable<typeof recipe> => recipe !== null)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, validatedQuery.limit!);

      return apiSuccess({
        sourceRecipe,
        similarRecipes: filteredSimilarRecipes,
      });
    } catch (error) {
      console.error('Error finding similar recipes:', error);
      return apiError('Internal server error');
    }
  }
);
