'use server';

import { and, eq, like, or, sql } from 'drizzle-orm';
import { generateEmbedding, generateRecipeEmbedding } from '@/lib/ai/embeddings';
import { auth } from '@/lib/auth';
import {
  ENABLE_CACHE_STATS,
  generateSemanticSearchKey,
  generateSimilarRecipesKey,
  searchCaches,
} from '@/lib/cache';
import { db } from '@/lib/db';
import { findSimilarRecipes, getRecipeEmbedding } from '@/lib/db/embeddings';
import { type Recipe, recipes } from '@/lib/db/schema';
import { type RankingMode, rankRecipes } from '@/lib/search';

/**
 * Search options for semantic and hybrid search
 */
export interface SearchOptions {
  limit?: number;
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
 *   minSimilarity: 0.5,
 *   cuisine: "Italian"
 * });
 */
export async function semanticSearchRecipes(
  query: string,
  options: SearchOptions = {}
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
    const minSimilarity = options.minSimilarity || 0.3;

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

    // Generate embedding for query
    const queryEmbedding = await generateEmbedding(query);

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
    const conditions = [sql`${recipes.id} IN ${recipeIds}`];

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
      const visibilityCondition = or(
        eq(recipes.is_public, true),
        eq(recipes.is_system_recipe, true)
      );
      if (visibilityCondition) {
        conditions.push(visibilityCondition);
      }
    } else {
      // Include user's private recipes + public/system recipes
      const visibilityCondition = or(
        eq(recipes.is_public, true),
        eq(recipes.is_system_recipe, true),
        eq(recipes.user_id, userId)
      );
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

    // Apply weighted ranking algorithm
    const rankedRecipes = rankRecipes(recipesWithSimilarity, {
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
  } catch (error: any) {
    console.error('Semantic search failed:', error);
    return {
      success: false,
      recipes: [],
      error: error.message || 'Failed to perform semantic search',
    };
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
    // Generate cache key
    const cacheKey = generateSimilarRecipesKey(recipeId, limit);

    // Check cache
    const cached = searchCaches.similar.get<SemanticSearchResult>(cacheKey);
    if (cached) {
      if (ENABLE_CACHE_STATS) {
        console.log(`[Cache HIT] Similar recipes: ${recipeId}`);
      }
      return cached;
    }

    // Get the recipe's embedding
    const embedding = await getRecipeEmbedding(recipeId);

    if (!embedding) {
      // Generate embedding if missing
      const recipe = await db.query.recipes.findFirst({
        where: eq(recipes.id, recipeId),
      });

      if (!recipe) {
        return {
          success: false,
          recipes: [],
          error: 'Recipe not found',
        };
      }

      // Generate and save embedding
      const embeddingResult = await generateRecipeEmbedding(recipe);
      const { saveRecipeEmbedding } = await import('@/lib/db/embeddings');
      await saveRecipeEmbedding(
        recipeId,
        embeddingResult.embedding,
        embeddingResult.embeddingText,
        embeddingResult.modelName
      );

      // Use the newly generated embedding
      const embeddingVector = embeddingResult.embedding;
      const similar = await findSimilarRecipes(embeddingVector, limit + 1, 0.5);

      // Get recipe details and exclude the original recipe
      const recipeIds = similar.map((e) => e.recipe_id).filter((id) => id !== recipeId);

      if (recipeIds.length === 0) {
        return { success: true, recipes: [] };
      }

      const similarRecipes = await db
        .select()
        .from(recipes)
        .where(sql`${recipes.id} IN ${recipeIds}`);

      const recipesWithSimilarity: RecipeWithSimilarity[] = similarRecipes.map((r) => {
        const sim = similar.find((s) => s.recipe_id === r.id);
        return {
          ...r,
          similarity: sim?.similarity || 0,
        };
      });

      // Apply ranking (use semantic mode for similar recipes)
      const rankedRecipes = rankRecipes(recipesWithSimilarity, {
        mode: 'semantic', // Prioritize similarity for similar recipe recommendations
      });

      const finalRecipes = rankedRecipes.slice(0, limit);

      const result = {
        success: true,
        recipes: finalRecipes,
      };

      // Store in cache
      searchCaches.similar.set(cacheKey, result);
      if (ENABLE_CACHE_STATS) {
        console.log(`[Cache MISS] Similar recipes: ${recipeId}`);
      }

      return result;
    }

    // Use existing embedding
    const embeddingVector =
      typeof embedding.embedding === 'string'
        ? JSON.parse(embedding.embedding)
        : embedding.embedding;

    const similar = await findSimilarRecipes(embeddingVector, limit + 1, 0.5);

    // Get recipe details and exclude the original recipe
    const recipeIds = similar.map((e) => e.recipe_id).filter((id) => id !== recipeId);

    if (recipeIds.length === 0) {
      return { success: true, recipes: [] };
    }

    const similarRecipes = await db
      .select()
      .from(recipes)
      .where(sql`${recipes.id} IN ${recipeIds}`);

    const recipesWithSimilarity: RecipeWithSimilarity[] = similarRecipes.map((r) => {
      const sim = similar.find((s) => s.recipe_id === r.id);
      return {
        ...r,
        similarity: sim?.similarity || 0,
      };
    });

    // Apply ranking (use semantic mode for similar recipes)
    const rankedRecipes = rankRecipes(recipesWithSimilarity, {
      mode: 'semantic', // Prioritize similarity for similar recipe recommendations
    });

    const finalRecipes = rankedRecipes.slice(0, limit);

    const result = {
      success: true,
      recipes: finalRecipes,
    };

    // Store in cache
    searchCaches.similar.set(cacheKey, result);
    if (ENABLE_CACHE_STATS) {
      console.log(`[Cache MISS] Similar recipes: ${recipeId}`);
    }

    return result;
  } catch (error: any) {
    console.error('Find similar failed:', error);
    return {
      success: false,
      recipes: [],
      error: error.message || 'Failed to find similar recipes',
    };
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

    // 1. Get semantic search results
    const semanticResults = await semanticSearchRecipes(query, {
      ...options,
      limit: limit * 2, // Get more for merging
    });

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
      textConditions.push(or(eq(recipes.is_public, true), eq(recipes.is_system_recipe, true)));
    } else {
      textConditions.push(
        or(
          eq(recipes.is_public, true),
          eq(recipes.is_system_recipe, true),
          eq(recipes.user_id, userId)
        )
      );
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
  } catch (error: any) {
    console.error('Hybrid search failed:', error);
    return {
      success: false,
      recipes: [],
      error: error.message || 'Failed to perform hybrid search',
    };
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
      ? or(
          eq(recipes.is_public, true),
          eq(recipes.is_system_recipe, true),
          eq(recipes.user_id, userId)
        )
      : or(eq(recipes.is_public, true), eq(recipes.is_system_recipe, true));

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
  } catch (error: any) {
    console.error('Get suggestions failed:', error);
    return {
      success: false,
      suggestions: [],
    };
  }
}
