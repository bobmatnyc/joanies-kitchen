/**
 * REST API v1 - Similar Recipes Endpoint
 *
 * GET /api/v1/recipes/:id/similar - Get similar recipes using semantic search
 *
 * Authentication: Requires a signed-in session or API key
 * Authorization: Scope-based permissions
 */

import { and, inArray, isNull } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { getRecipe } from '@/app/actions/recipes';
import {
  apiError,
  apiNotFound,
  apiSuccess,
  getRequiredParam,
  handleActionResult,
  parseQueryParams,
} from '@/lib/api';
import { requireScopes, SCOPES } from '@/lib/api-auth';
import type { RouteContext } from '@/lib/api-auth/types';
import { db } from '@/lib/db';
import { findSimilarRecipes, getRecipeEmbedding } from '@/lib/db/embeddings';
import { recipes } from '@/lib/db/schema';
import { apiRecipeRedirect } from '@/lib/recipe-redirects';
import { getRecipeViewer, recipeVisibilityCondition } from '@/lib/recipe-visibility';
import { similarRecipesQuerySchema } from '@/lib/validations/recipe-api';

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
 * - minSimilarity: Minimum similarity threshold 0-1 (default: RECIPE_SIMILAR_MIN_SIMILARITY, 0.72)
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
  async (request: NextRequest, _authContext, context: RouteContext) => {
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
      // #135: miss path only — an old duplicate's id or slug redirects to the survivor's
      // similar URL (307 by default, 308 when RECIPE_REDIRECT_STATUS=308).
      if (sourceRecipeResult.error === 'Recipe not found') {
        const moved = await apiRecipeRedirect(request.url, id, '/similar');
        if (moved) return moved;
      }
      const recipeCheck = handleActionResult(sourceRecipeResult);
      if ('error' in recipeCheck) return recipeCheck.error;

      const sourceRecipe = recipeCheck.data;

      // Get the recipe's embedding
      const embedding = await getRecipeEmbedding(sourceRecipe.id);

      if (!embedding) {
        return apiNotFound('No embedding available for this recipe. Semantic search not possible');
      }

      // #131: visibility, soft-delete and the source run inside the kNN query,
      // before its LIMIT, so hidden neighbours cannot leave the list short.
      const viewer = await getRecipeViewer();
      const visibility = recipeVisibilityCondition(viewer);
      const similarResults = await findSimilarRecipes(
        embedding.embedding,
        validatedQuery.limit!, // defaults guaranteed by schema
        validatedQuery.minSimilarity!,
        { visibility, excludeRecipeId: sourceRecipe.id }
      );

      const similarRecipeIds = similarResults.map((result) => result.recipe_id);
      if (similarRecipeIds.length === 0) {
        return apiSuccess({ sourceRecipe, similarRecipes: [] });
      }

      // #131: one query for the full rows (was one per id); the visibility
      // condition repeats so a recipe hidden in between is still dropped.
      const rows = await db
        .select()
        .from(recipes)
        .where(and(inArray(recipes.id, similarRecipeIds), isNull(recipes.deleted_at), visibility));
      const similarity = new Map(similarResults.map((r) => [r.recipe_id, Number(r.similarity)]));
      const filteredSimilarRecipes = rows
        .map((recipe) => ({ ...recipe, similarity: similarity.get(recipe.id) ?? 0 }))
        .sort((a, b) => b.similarity - a.similarity);

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
