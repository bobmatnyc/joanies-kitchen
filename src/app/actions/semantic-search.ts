'use server';

import { and, eq, inArray, like, or, sql } from 'drizzle-orm';
import { generateQueryEmbedding, generateRecipeEmbedding } from '@/lib/ai/embeddings';
import { auth } from '@/lib/auth';
import {
  ENABLE_CACHE_STATS,
  generateSemanticSearchKey,
  generateSimilarRecipesKey,
  searchCaches,
} from '@/lib/cache';
import { isPaidCallBlocked } from '@/lib/costs';
import { db } from '@/lib/db';
import { findSimilarRecipes, getRecipeEmbedding } from '@/lib/db/embeddings';
import { type Recipe, recipes } from '@/lib/db/schema';
import { enforceRateLimit, type RateLimitBucket } from '@/lib/rate-limit';
import { publicRecipe, systemRecipe } from '@/lib/recipe-public';
import {
  canViewRecipe,
  getRecipeViewer,
  recipeViewerScope,
  recipeVisibilityCondition,
} from '@/lib/recipe-visibility';
import { type RankingMode, rankRecipes } from '@/lib/search';
import { rerankWithJina } from '@/lib/search/jina-rerank'; // #17: moved out for the 500-line cap
import {
  applySearchCutoff,
  RECIPE_SIMILAR_MIN_SIMILARITY,
  SEARCH_MIN_SIMILARITY,
  SEARCH_RELATIVE_DELTA,
} from '@/lib/search/similarity-cutoffs';
import { toErrorMessage } from '@/lib/utils/error-handling';

/**
 * Search options for semantic and hybrid search
 */
export interface SearchOptions {
  limit?: number;
  /**
   * #96 D57: omitted → SEARCH_MIN_SIMILARITY plus the top1 - SEARCH_RELATIVE_DELTA trim.
   * Set (including 0) → this value is the only cutoff; no relative trim.
   */
  minSimilarity?: number;
  cuisine?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  dietaryRestrictions?: string[];
  includePrivate?: boolean;
  /** Ranking mode to use (default: 'balanced') */
  rankingMode?: RankingMode;
  /** Include score breakdown for debugging */
  includeScoreBreakdown?: boolean;
}

/**
 * Recipe with similarity score
 */
export interface RecipeWithSimilarity extends Recipe {
  similarity: number;
}

/**
 * Semantic search result
 */
export interface SemanticSearchResult {
  success: boolean;
  recipes: RecipeWithSimilarity[];
  error?: string;
  /** #17/#57: set when the call was refused before any paid work. */
  errorCode?: SearchErrorCode;
  /** #17: seconds until the caller's rate-limit window resets. */
  retryAfterSec?: number;
}

/** #17/#57: typed refusal codes; the API route maps them to 429 and 503. */
export type SearchErrorCode =
  | 'RATE_LIMITED'
  | 'LIMITER_UNAVAILABLE'
  | 'COST_CAP_REACHED'
  | 'COST_GUARD_UNAVAILABLE';

/** #17: refusal result, or null when the caller is within its limit. */
async function rateLimitRefusal(
  bucket: RateLimitBucket,
  userId: string | null
): Promise<SemanticSearchResult | null> {
  const verdict = await enforceRateLimit(bucket, userId);
  if (verdict.allowed) return null;
  // #17: a limiter outage is not the caller's fault; report it apart from a 429.
  if (verdict.reason === 'unavailable') {
    return {
      success: false,
      recipes: [],
      error: 'Search is temporarily unavailable',
      errorCode: 'LIMITER_UNAVAILABLE',
    };
  }
  return {
    success: false,
    recipes: [],
    error: 'Too many searches; try again shortly',
    errorCode: 'RATE_LIMITED',
    retryAfterSec: verdict.retryAfterSec,
  };
}

/** #57: maps a thrown error to a result, keeping the cost-ceiling code typed. */
function searchFailure(error: unknown): SemanticSearchResult {
  if (isPaidCallBlocked(error)) {
    return { success: false, recipes: [], error: error.message, errorCode: error.code };
  }
  return { success: false, recipes: [], error: toErrorMessage(error) };
}

/**
 * Performs semantic search on recipes using vector embeddings
 *
 * This function:
 * 1. Generates an embedding for the search query
 * 2. Finds similar recipes using vector similarity (cosine distance)
 * 3. Applies additional filters (cuisine, difficulty, dietary restrictions)
 * 4. Filters by visibility based on authentication
 *
 * @param query - Natural language search query (e.g., "spicy comfort food")
 * @param options - Search options including filters and limits
 * @returns Search results with recipes and similarity scores
 *
 * @example
 * const result = await semanticSearchRecipes("quick easy pasta", {
 *   limit: 10,
 *   cuisine: "Italian"
 * });
 */
export async function semanticSearchRecipes(
  query: string,
  options: SearchOptions = {}
): Promise<SemanticSearchResult> {
  return semanticSearchInternal(query, options, true);
}

/** #17: `rateLimited=false` lets hybrid search count one call, not two. */
async function semanticSearchInternal(
  query: string,
  options: SearchOptions,
  rateLimited: boolean
): Promise<SemanticSearchResult> {
  try {
    // Validate query
    if (!query || query.trim().length === 0) {
      return {
        success: false,
        recipes: [],
        error: 'Search query cannot be empty',
      };
    }

    const { userId } = await auth();

    // Default options
    const limit = options.limit || 20;
    // #96 D57: calibrated cutoff; `??` keeps an explicit 0.
    const minSimilarity = options.minSimilarity ?? SEARCH_MIN_SIMILARITY;

    // Generate cache key
    const cacheKey = generateSemanticSearchKey(query, {
      ...options,
      userId: userId || 'anonymous',
    });

    // Check cache
    const cached = searchCaches.semantic.get<SemanticSearchResult>(cacheKey);
    if (cached) {
      if (ENABLE_CACHE_STATS) {
        console.log(`[Cache HIT] Semantic search: ${query.substring(0, 50)}`);
      }
      return cached;
    }

    // #17: limit only cache misses; they are the calls that pay for an embedding.
    if (rateLimited) {
      const refusal = await rateLimitRefusal('semantic-search', userId ?? null);
      if (refusal) return refusal;
    }

    // #96 D57: queries carry the BGE retrieval instruction; stored recipe vectors do not.
    const queryEmbedding = await generateQueryEmbedding(query);

    // Search with vector similarity (get more results to allow filtering)
    const similarEmbeddings = await findSimilarRecipes(
      queryEmbedding,
      limit * 3, // Get 3x to account for filtering
      minSimilarity
    );

    // Extract recipe IDs from embeddings
    const recipeIds = similarEmbeddings.map((e) => e.recipe_id);

    if (recipeIds.length === 0) {
      return {
        success: true,
        recipes: [],
      };
    }

    // Build filter conditions
    const conditions = [inArray(recipes.id, recipeIds)];

    // Apply cuisine filter
    if (options.cuisine) {
      conditions.push(eq(recipes.cuisine, options.cuisine));
    }

    // Apply difficulty filter
    if (options.difficulty) {
      conditions.push(eq(recipes.difficulty, options.difficulty));
    }

    // Apply visibility filter
    if (!options.includePrivate || !userId) {
      // Only public or system recipes
      const visibilityCondition = or(publicRecipe, systemRecipe);
      if (visibilityCondition) {
        conditions.push(visibilityCondition);
      }
    } else {
      // Include user's private recipes + public/system recipes
      const visibilityCondition = or(publicRecipe, systemRecipe, eq(recipes.user_id, userId));
      if (visibilityCondition) {
        conditions.push(visibilityCondition);
      }
    }

    // Fetch filtered recipes
    const filteredRecipes = await db
      .select()
      .from(recipes)
      .where(and(...conditions));

    // Apply dietary restrictions filter (tags-based)
    let results = filteredRecipes;
    if (options.dietaryRestrictions && options.dietaryRestrictions.length > 0) {
      results = filteredRecipes.filter((recipe) => {
        if (!recipe.tags) return false;

        try {
          const tags = typeof recipe.tags === 'string' ? JSON.parse(recipe.tags) : recipe.tags;

          if (!Array.isArray(tags)) return false;

          // Recipe must have at least one of the dietary restrictions
          return options.dietaryRestrictions?.some((restriction) =>
            tags.some((tag: string) => tag.toLowerCase().includes(restriction.toLowerCase()))
          );
        } catch (_error) {
          return false;
        }
      });
    }

    // Map recipes to include similarity scores
    const recipesWithSimilarity: RecipeWithSimilarity[] = results.map((recipe) => {
      const embedding = similarEmbeddings.find((e) => e.recipe_id === recipe.id);
      return {
        ...recipe,
        similarity: embedding?.similarity || 0,
      };
    });

    // #96 D57: calibrated cutoff — with minSimilarity omitted, drop results below
    // max(floor, top1 - delta) over the recipes that survived the filters above.
    // An explicit minSimilarity is the only cutoff (an infinite delta disables the trim).
    const withinCutoff = applySearchCutoff(
      recipesWithSimilarity,
      minSimilarity,
      options.minSimilarity === undefined ? SEARCH_RELATIVE_DELTA : Number.POSITIVE_INFINITY
    );

    // Apply weighted ranking algorithm
    const rankedRecipes = rankRecipes(withinCutoff, {
      mode: options.rankingMode || 'balanced',
      includeScoreBreakdown: options.includeScoreBreakdown || false,
    });

    // Apply limit after ranking
    const finalRecipes = rankedRecipes.slice(0, limit);

    const result = {
      success: true,
      recipes: finalRecipes,
    };

    // Store in cache
    searchCaches.semantic.set(cacheKey, result);
    if (ENABLE_CACHE_STATS) {
      console.log(`[Cache MISS] Semantic search: ${query.substring(0, 50)}`);
    }

    return result;
  } catch (error: unknown) {
    console.error('Semantic search failed:', error);
    return searchFailure(error); // #57
  }
}

/**
 * Finds recipes similar to a given recipe
 * Uses the recipe's embedding to find nearest neighbors
 *
 * @param recipeId - ID of the recipe to find similar recipes for
 * @param limit - Maximum number of similar recipes to return
 * @returns Similar recipes with similarity scores
 *
 * @example
 * const result = await findSimilarToRecipe("recipe-123", 5);
 * console.log(result.recipes); // Array of 5 similar recipes
 */
export async function findSimilarToRecipe(
  recipeId: string,
  limit: number = 10
): Promise<SemanticSearchResult> {
  try {
    // #32: a private recipe is visible only to its owner or an admin.
    const viewer = await getRecipeViewer();

    // #32: a hidden source answers exactly like a nonexistent one, before any cache read or paid call.
    const recipe = await db.query.recipes.findFirst({
      where: eq(recipes.id, recipeId),
    });
    if (!recipe || !canViewRecipe(recipe, viewer)) {
      return {
        success: false,
        recipes: [],
        error: 'Recipe not found',
      };
    }

    // #32: results depend on the caller, so the cache key does too.
    const cacheKey = `${generateSimilarRecipesKey(recipeId, limit)}:${recipeViewerScope(viewer)}`;

    // Check cache
    const cached = searchCaches.similar.get<SemanticSearchResult>(cacheKey);
    if (cached) {
      if (ENABLE_CACHE_STATS) {
        console.log(`[Cache HIT] Similar recipes: ${recipeId}`);
      }
      return cached;
    }

    // #17: limit cache misses per caller.
    const refusal = await rateLimitRefusal('similar-recipes', viewer.userId);
    if (refusal) return refusal;

    // Get the recipe's embedding, generating and saving it when missing
    const embedding = await getRecipeEmbedding(recipeId);
    let embeddingVector: number[];
    if (embedding) {
      embeddingVector =
        typeof embedding.embedding === 'string'
          ? JSON.parse(embedding.embedding)
          : embedding.embedding;
    } else {
      const embeddingResult = await generateRecipeEmbedding(recipe);
      const { saveRecipeEmbedding } = await import('@/lib/db/embeddings');
      await saveRecipeEmbedding(
        recipeId,
        embeddingResult.embedding,
        embeddingResult.embeddingText,
        embeddingResult.modelName
      );
      embeddingVector = embeddingResult.embedding;
    }

    // #96: visibility and source exclusion run in SQL before LIMIT; post-filtering
    // a top-(limit+1) list left public recipes with no visible neighbours.
    // #96 D57: calibrated cutoff for recipe-to-recipe neighbours.
    const similar = await findSimilarRecipes(
      embeddingVector,
      limit + 1,
      RECIPE_SIMILAR_MIN_SIMILARITY,
      {
        visibility: recipeVisibilityCondition(viewer),
        excludeRecipeId: recipeId,
      }
    );

    // Get recipe details and exclude the original recipe
    const recipeIds = similar.map((e) => e.recipe_id).filter((id) => id !== recipeId);

    if (recipeIds.length === 0) {
      return { success: true, recipes: [] };
    }

    // #32: vector search ignores visibility; drop recipes the caller may not read.
    const similarRecipes = await db
      .select()
      .from(recipes)
      .where(and(inArray(recipes.id, recipeIds), recipeVisibilityCondition(viewer)));

    let recipesWithSimilarity: RecipeWithSimilarity[] = similarRecipes.map((r) => {
      const sim = similar.find((s) => s.recipe_id === r.id);
      return {
        ...r,
        similarity: sim?.similarity || 0,
      };
    });

    // Semantic rerank with Jina Reranker v2 (graceful fallback on failure)
    // #17: anonymous callers never trigger a paid Jina rerank.
    const rerankQuery = `${recipe.name}. ${recipe.description ?? ''}`.trim();
    const rerankedIndices =
      viewer.userId === null ? null : await rerankWithJina(rerankQuery, recipesWithSimilarity);
    if (rerankedIndices) {
      recipesWithSimilarity = rerankedIndices.map((i) => recipesWithSimilarity[i]);
    }

    // Apply ranking (use semantic mode for similar recipes)
    const rankedRecipes = rankRecipes(recipesWithSimilarity, {
      mode: 'semantic', // Prioritize similarity for similar recipe recommendations
    });

    const finalRecipes = rankedRecipes.slice(0, limit);

    const result = {
      success: true,
      recipes: finalRecipes,
    };

    // #96: never cache an empty list; a later embedding or publish must show up.
    if (finalRecipes.length > 0) searchCaches.similar.set(cacheKey, result);
    if (ENABLE_CACHE_STATS) {
      console.log(`[Cache MISS] Similar recipes: ${recipeId}`);
    }

    return result;
  } catch (error: unknown) {
    console.error('Find similar failed:', error);
    return searchFailure(error); // #57
  }
}

/**
 * Performs hybrid search combining semantic (vector) and text search
 * Merges results using a weighted ranking algorithm
 *
 * @param query - Search query text
 * @param options - Search options including filters
 * @returns Combined and ranked search results
 *
 * @example
 * const result = await hybridSearchRecipes("spicy pasta", { limit: 10 });
 * // Returns recipes matching both semantically and by text
 */
export async function hybridSearchRecipes(
  query: string,
  options: SearchOptions = {}
): Promise<SemanticSearchResult & { mergedCount?: number }> {
  try {
    if (!query || query.trim().length === 0) {
      return {
        success: false,
        recipes: [],
        error: 'Search query cannot be empty',
      };
    }

    const { userId } = await auth();
    const limit = options.limit || 20;

    // Generate cache key (use semantic cache with 'hybrid' prefix)
    const cacheKey = `hybrid:${generateSemanticSearchKey(query, {
      ...options,
      userId: userId || 'anonymous',
    })}`;

    // Check cache
    const cached = searchCaches.hybrid.get<SemanticSearchResult & { mergedCount?: number }>(
      cacheKey
    );
    if (cached) {
      if (ENABLE_CACHE_STATS) {
        console.log(`[Cache HIT] Hybrid search: ${query.substring(0, 50)}`);
      }
      return cached;
    }

    // #17: one limit check for the hybrid call; the inner semantic call skips it.
    const refusal = await rateLimitRefusal('semantic-search', userId ?? null);
    if (refusal) return refusal;

    // 1. Get semantic search results
    // #96 D57: calibrated cutoff — semanticSearchInternal applies max(floor, top1 - delta).
    const semanticResults = await semanticSearchInternal(
      query,
      { ...options, limit: limit * 2 }, // Get more for merging
      false
    );

    if (!semanticResults.success) {
      return semanticResults;
    }

    // 2. Get text search results
    const searchPattern = `%${query}%`;

    // Build text search conditions
    const textConditions = [
      or(
        like(recipes.name, searchPattern),
        like(recipes.description, searchPattern),
        like(recipes.tags, searchPattern),
        like(recipes.cuisine, searchPattern)
      ),
    ];

    // Apply visibility filter for text search
    if (!options.includePrivate || !userId) {
      textConditions.push(or(publicRecipe, systemRecipe));
    } else {
      textConditions.push(or(publicRecipe, systemRecipe, eq(recipes.user_id, userId)));
    }

    const textResults = await db
      .select()
      .from(recipes)
      .where(and(...textConditions))
      .limit(limit * 2);

    // 3. Merge and rank results
    const merged = new Map<
      string,
      RecipeWithSimilarity & {
        semanticRank?: number;
        textRank?: number;
        combinedRank: number;
      }
    >();

    // Add semantic results with high weight (0.7)
    semanticResults.recipes.forEach((recipe, index) => {
      merged.set(recipe.id, {
        ...recipe,
        semanticRank: index,
        textRank: undefined,
        combinedRank: index * 0.7, // Weight semantic higher
      });
    });

    // Add text results with lower weight (0.3)
    textResults.forEach((recipe, index) => {
      if (merged.has(recipe.id)) {
        // Recipe appears in both - boost its rank
        const existing = merged.get(recipe.id)!;
        merged.set(recipe.id, {
          ...existing,
          textRank: index,
          combinedRank: existing.semanticRank! * 0.7 + index * 0.3,
        });
      } else {
        // Text-only result - lower priority
        merged.set(recipe.id, {
          ...recipe,
          similarity: 0,
          semanticRank: undefined,
          textRank: index,
          combinedRank: 1000 + index, // Much lower priority
        });
      }
    });

    // 4. Sort by combined rank and limit
    const sorted = Array.from(merged.values())
      .sort((a, b) => a.combinedRank - b.combinedRank)
      .slice(0, limit);

    const result = {
      success: true,
      recipes: sorted,
      mergedCount: merged.size,
    };

    // Store in cache
    searchCaches.hybrid.set(cacheKey, result);
    if (ENABLE_CACHE_STATS) {
      console.log(`[Cache MISS] Hybrid search: ${query.substring(0, 50)}`);
    }

    return result;
  } catch (error: unknown) {
    console.error('Hybrid search failed:', error);
    return searchFailure(error); // #57
  }
}

/**
 * Gets search suggestions based on recipe names and tags
 * Useful for autocomplete functionality
 *
 * @param partial - Partial query text
 * @param limit - Maximum number of suggestions
 * @returns Array of suggestion strings
 */
export async function getSearchSuggestions(
  partial: string,
  limit: number = 10
): Promise<{ success: boolean; suggestions: string[] }> {
  try {
    if (!partial || partial.length < 2) {
      return { success: true, suggestions: [] };
    }

    const pattern = `%${partial}%`;
    const { userId } = await auth();

    // Build visibility conditions
    const visibilityConditions = userId
      ? or(publicRecipe, systemRecipe, eq(recipes.user_id, userId))
      : or(publicRecipe, systemRecipe);

    // Get matching recipes
    const matches = await db
      .select({
        name: recipes.name,
        tags: recipes.tags,
        cuisine: recipes.cuisine,
      })
      .from(recipes)
      .where(
        and(
          or(
            like(recipes.name, pattern),
            like(recipes.tags, pattern),
            like(recipes.cuisine, pattern)
          ),
          visibilityConditions
        )
      )
      .limit(limit * 2);

    // Extract unique suggestions
    const suggestions = new Set<string>();

    matches.forEach((match) => {
      // Add recipe name if it matches
      if (match.name.toLowerCase().includes(partial.toLowerCase())) {
        suggestions.add(match.name);
      }

      // Add cuisine if it matches
      if (match.cuisine?.toLowerCase().includes(partial.toLowerCase())) {
        suggestions.add(match.cuisine);
      }

      // Add matching tags
      if (match.tags) {
        try {
          const tags = typeof match.tags === 'string' ? JSON.parse(match.tags) : match.tags;

          if (Array.isArray(tags)) {
            tags.forEach((tag: string) => {
              if (tag.toLowerCase().includes(partial.toLowerCase())) {
                suggestions.add(tag);
              }
            });
          }
        } catch (_error) {
          // Ignore parse errors
        }
      }
    });

    return {
      success: true,
      suggestions: Array.from(suggestions).slice(0, limit),
    };
  } catch (error: unknown) {
    console.error('Get suggestions failed:', error);
    return {
      success: false,
      suggestions: [],
    };
  }
}
