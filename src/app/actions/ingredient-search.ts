'use server';

import { and, asc, desc, eq, ilike, inArray, or, type SQL, sql } from 'drizzle-orm';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import {
  ENABLE_CACHE_STATS,
  generateIngredientSearchKey,
  generateIngredientSuggestionsKey,
  generatePopularIngredientsKey,
  searchCaches,
} from '@/lib/cache';
import { db } from '@/lib/db';
import {
  type IngredientWithStats,
  ingredientStatistics,
  ingredients,
  type RecipeIngredientWithDetails,
  recipeIngredients,
} from '@/lib/db/ingredients-schema';
import { type Recipe, recipes } from '@/lib/db/schema';
import { type RecipeWithSimilarity, rankRecipes } from '@/lib/search';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

/**
 * Match modes for ingredient-based recipe search
 */
export const MatchMode = z.enum(['all', 'any', 'exact']);
export type MatchModeType = z.infer<typeof MatchMode>;

/**
 * Search options schema for validation
 */
export const SearchOptionsSchema = z.object({
  matchMode: MatchMode.default('any'),
  cuisine: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  dietaryRestrictions: z.array(z.string()).optional(),
  minMatchPercentage: z.number().min(0).max(100).default(0),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
  includePrivate: z.boolean().default(false),
  /** Ranking mode to use (default: 'balanced') */
  rankingMode: z
    .enum(['balanced', 'semantic', 'quality', 'popular', 'trending', 'discovery'])
    .optional(),
  /** Include score breakdown for debugging */
  includeScoreBreakdown: z.boolean().default(false),
});

export type SearchOptions = z.infer<typeof SearchOptionsSchema>;

/**
 * Ingredient suggestion options
 */
export const SuggestionOptionsSchema = z.object({
  limit: z.number().min(1).max(50).default(10),
  category: z.string().optional(),
  commonOnly: z.boolean().default(false),
});

export type SuggestionOptions = z.infer<typeof SuggestionOptionsSchema>;

// ============================================================================
// RESPONSE TYPES
// ============================================================================

/**
 * Recipe with ingredient match information
 */
export interface RecipeWithMatch extends Recipe {
  matchedIngredients: string[];
  totalIngredients: number;
  matchPercentage: number;
  rankingScore: number;
}

/**
 * Search result response
 */
export interface IngredientSearchResult {
  success: boolean;
  recipes: RecipeWithMatch[];
  totalCount: number;
  error?: string;
}

/**
 * Ingredient suggestion response
 */
export interface IngredientSuggestion {
  id: string;
  name: string;
  displayName: string;
  category: string | null;
  isCommon: boolean;
  recipeCount?: number;
}

/**
 * Suggestion result response
 */
export interface SuggestionResult {
  success: boolean;
  suggestions: IngredientSuggestion[];
  error?: string;
}

/**
 * Popular ingredients response
 */
export interface PopularIngredientsResult {
  success: boolean;
  ingredients: IngredientWithStats[];
  error?: string;
}

/**
 * Recipe ingredients response
 */
export interface RecipeIngredientsResult {
  success: boolean;
  ingredients: RecipeIngredientWithDetails[];
  error?: string;
}

// ============================================================================
// MAIN SEARCH FUNCTION
// ============================================================================

/**
 * Search recipes by ingredients with advanced filtering and ranking
 *
 * Supports three match modes:
 * - 'all': Recipe must contain ALL specified ingredients (AND logic)
 * - 'any': Recipe must contain AT LEAST ONE ingredient (OR logic)
 * - 'exact': Recipe must contain ONLY the specified ingredients
 *
 * Ranking algorithm:
 * - Match percentage: 60% weight (how many ingredients match)
 * - System rating: 30% weight (AI quality score)
 * - User rating: 10% weight (community rating)
 *
 * @param ingredientNames - Array of ingredient names to search for
 * @param options - Search options including filters and pagination
 * @returns Ranked recipes with match information
 *
 * @example
 * // Find recipes with tomatoes OR basil
 * const result = await searchRecipesByIngredients(
 *   ['tomatoes', 'basil'],
 *   { matchMode: 'any', limit: 10 }
 * );
 *
 * @example
 * // Find Italian recipes with ALL specified ingredients
 * const result = await searchRecipesByIngredients(
 *   ['tomatoes', 'basil', 'mozzarella'],
 *   { matchMode: 'all', cuisine: 'Italian' }
 * );
 */
export async function searchRecipesByIngredients(
  ingredientNames: string[],
  options: Partial<SearchOptions> = {}
): Promise<IngredientSearchResult> {
  try {
    // Validate inputs
    if (!ingredientNames || ingredientNames.length === 0) {
      return {
        success: false,
        recipes: [],
        totalCount: 0,
        error: 'At least one ingredient must be specified',
      };
    }

    const validatedOptions = SearchOptionsSchema.parse(options);
    const { userId } = await auth();

    // Generate cache key
    const cacheKey = generateIngredientSearchKey(ingredientNames, {
      ...validatedOptions,
      userId: userId || 'anonymous',
    });

    // Check cache
    const cached = searchCaches.ingredient.get<IngredientSearchResult>(cacheKey);
    if (cached) {
      if (ENABLE_CACHE_STATS) {
        console.log(`[Cache HIT] Ingredient search: ${ingredientNames.slice(0, 3).join(', ')}`);
      }
      return cached;
    }

    // Normalize ingredient names (lowercase, trim)
    const normalizedNames = ingredientNames.map((name) => name.toLowerCase().trim());

    // Step 1: Find ingredient IDs from names (fuzzy match using aliases)
    const foundIngredients = await db
      .select()
      .from(ingredients)
      .where(
        or(
          ...normalizedNames.map((name) =>
            or(
              eq(ingredients.name, name),
              ilike(ingredients.display_name, name),
              sql`${ingredients.aliases}::text ILIKE ${`%${name}%`}`
            )
          )
        )
      );

    if (foundIngredients.length === 0) {
      return {
        success: true,
        recipes: [],
        totalCount: 0,
      };
    }

    const ingredientIds = foundIngredients.map((ing) => ing.id);

    // Step 2: Find recipes containing these ingredients
    const recipeIngredientLinks = await db
      .select({
        recipeId: recipeIngredients.recipe_id,
        ingredientId: recipeIngredients.ingredient_id,
        ingredientName: ingredients.name,
      })
      .from(recipeIngredients)
      .innerJoin(ingredients, eq(recipeIngredients.ingredient_id, ingredients.id))
      .where(inArray(recipeIngredients.ingredient_id, ingredientIds));

    // Group by recipe ID and calculate matches
    const recipeMatches = new Map<string, Set<string>>();
    recipeIngredientLinks.forEach((link) => {
      if (!recipeMatches.has(link.recipeId)) {
        recipeMatches.set(link.recipeId, new Set());
      }
      recipeMatches.get(link.recipeId)?.add(link.ingredientName);
    });

    // Apply match mode filtering
    let matchedRecipeIds: string[] = [];

    if (validatedOptions.matchMode === 'all') {
      // Recipe must have ALL ingredients
      matchedRecipeIds = Array.from(recipeMatches.entries())
        .filter(([_, matchedSet]) => {
          return normalizedNames.every((name) => matchedSet.has(name));
        })
        .map(([recipeId]) => recipeId);
    } else if (validatedOptions.matchMode === 'any') {
      // Recipe must have AT LEAST ONE ingredient
      matchedRecipeIds = Array.from(recipeMatches.keys());
    } else if (validatedOptions.matchMode === 'exact') {
      // Recipe must have ONLY these ingredients (no more, no less)
      // This requires checking total ingredient count per recipe
      const recipeTotalCounts = await db
        .select({
          recipeId: recipeIngredients.recipe_id,
          totalCount: sql<number>`COUNT(DISTINCT ${recipeIngredients.ingredient_id})::int`,
        })
        .from(recipeIngredients)
        .where(inArray(recipeIngredients.recipe_id, Array.from(recipeMatches.keys())))
        .groupBy(recipeIngredients.recipe_id);

      matchedRecipeIds = recipeTotalCounts
        .filter(({ recipeId, totalCount }) => {
          const matched = recipeMatches.get(recipeId);
          return (
            matched &&
            matched.size === ingredientNames.length &&
            totalCount === ingredientNames.length
          );
        })
        .map(({ recipeId }) => recipeId);
    }

    if (matchedRecipeIds.length === 0) {
      return {
        success: true,
        recipes: [],
        totalCount: 0,
      };
    }

    // Step 3: Build recipe query with filters
    const conditions: SQL[] = [inArray(recipes.id, matchedRecipeIds)];

    // Access control filter
    if (!validatedOptions.includePrivate || !userId) {
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

    // Apply additional filters
    if (validatedOptions.cuisine) {
      conditions.push(eq(recipes.cuisine, validatedOptions.cuisine));
    }

    if (validatedOptions.difficulty) {
      conditions.push(eq(recipes.difficulty, validatedOptions.difficulty));
    }

    // Fetch matching recipes
    const matchedRecipes = await db
      .select()
      .from(recipes)
      .where(and(...conditions));

    // Step 4: Apply dietary restrictions filter (tag-based)
    let filteredRecipes = matchedRecipes;
    if (validatedOptions.dietaryRestrictions && validatedOptions.dietaryRestrictions.length > 0) {
      filteredRecipes = matchedRecipes.filter((recipe) => {
        if (!recipe.tags) return false;

        try {
          const tags = typeof recipe.tags === 'string' ? JSON.parse(recipe.tags) : recipe.tags;

          if (!Array.isArray(tags)) return false;

          // Recipe must have at least one of the dietary restrictions
          return validatedOptions.dietaryRestrictions?.some((restriction) =>
            tags.some((tag: string) => tag.toLowerCase().includes(restriction.toLowerCase()))
          );
        } catch (_error) {
          return false;
        }
      });
    }

    // Step 5: Get total ingredient counts for each recipe
    const recipeTotalCounts = await db
      .select({
        recipeId: recipeIngredients.recipe_id,
        totalCount: sql<number>`COUNT(DISTINCT ${recipeIngredients.ingredient_id})::int`,
      })
      .from(recipeIngredients)
      .where(
        inArray(
          recipeIngredients.recipe_id,
          filteredRecipes.map((r) => r.id)
        )
      )
      .groupBy(recipeIngredients.recipe_id);

    const totalCountMap = new Map(
      recipeTotalCounts.map(({ recipeId, totalCount }) => [recipeId, totalCount])
    );

    // Step 6: Calculate match percentage and prepare for ranking
    const recipesWithSimilarity: (RecipeWithSimilarity & {
      matchedIngredients: string[];
      totalIngredients: number;
      matchPercentage: number;
    })[] = filteredRecipes.map((recipe) => {
      const matchedSet = recipeMatches.get(recipe.id) || new Set();
      const totalIngredients = totalCountMap.get(recipe.id) || 1;
      const matchPercentage = (matchedSet.size / totalIngredients) * 100;

      return {
        ...recipe,
        matchedIngredients: Array.from(matchedSet),
        totalIngredients,
        matchPercentage,
        // Use match percentage as similarity score for ranking
        similarity: matchPercentage / 100,
      };
    });

    // Step 7: Filter by minimum match percentage
    const filteredByMatch = recipesWithSimilarity.filter(
      (recipe) => recipe.matchPercentage >= validatedOptions.minMatchPercentage
    );

    // Step 8: Apply weighted ranking algorithm
    const rankedRecipes = rankRecipes(filteredByMatch, {
      mode: validatedOptions.rankingMode || 'balanced',
      similarityKey: 'matchPercentage', // Use match percentage as similarity
      includeScoreBreakdown: validatedOptions.includeScoreBreakdown,
    });

    // Map to RecipeWithMatch format (includes rankingScore)
    const sortedRecipes: RecipeWithMatch[] = rankedRecipes.map((r) => {
      // Find the original recipe with match data
      const originalRecipe = recipesWithSimilarity.find((orig) => orig.id === r.id);
      const { scoreComponents, similarity, rankingScore, ...recipeData } = r;
      // Cast to Recipe type to satisfy RecipeWithMatch
      const recipe = recipeData as unknown as Recipe;
      return {
        ...recipe,
        matchedIngredients: originalRecipe?.matchedIngredients || [],
        totalIngredients: originalRecipe?.totalIngredients || 0,
        matchPercentage: originalRecipe?.matchPercentage || 0,
        rankingScore: rankingScore * 100, // Scale to 0-100 for consistency
      };
    });

    // Step 9: Apply pagination
    const totalCount = sortedRecipes.length;
    const paginatedRecipes = sortedRecipes.slice(
      validatedOptions.offset,
      validatedOptions.offset + validatedOptions.limit
    );

    const result = {
      success: true,
      recipes: paginatedRecipes,
      totalCount,
    };

    // Store in cache
    searchCaches.ingredient.set(cacheKey, result);
    if (ENABLE_CACHE_STATS) {
      console.log(`[Cache MISS] Ingredient search: ${ingredientNames.slice(0, 3).join(', ')}`);
    }

    return result;
  } catch (error: any) {
    console.error('Ingredient search failed:', error);
    return {
      success: false,
      recipes: [],
      totalCount: 0,
      error: error.message || 'Failed to search recipes by ingredients',
    };
  }
}

// ============================================================================
// INGREDIENT AUTOCOMPLETE
// ============================================================================

/**
 * Get ingredient suggestions for autocomplete
 * Uses fuzzy search (pg_trgm) for typo tolerance
 *
 * @param query - Partial ingredient name
 * @param options - Suggestion options
 * @returns Array of matching ingredient suggestions
 *
 * @example
 * const result = await getIngredientSuggestions('toma', { limit: 5 });
 * // Returns: ['tomato', 'tomatoes', 'cherry tomatoes', ...]
 */
export async function getIngredientSuggestions(
  query: string,
  options: Partial<SuggestionOptions> = {}
): Promise<SuggestionResult> {
  try {
    if (!query || query.trim().length < 2) {
      return {
        success: true,
        suggestions: [],
      };
    }

    const validatedOptions = SuggestionOptionsSchema.parse(options);
    const normalizedQuery = query.toLowerCase().trim();

    // Generate cache key
    const cacheKey = generateIngredientSuggestionsKey(query, validatedOptions);

    // Check cache
    const cached = searchCaches.ingredientSuggestions.get<SuggestionResult>(cacheKey);
    if (cached) {
      if (ENABLE_CACHE_STATS) {
        console.log(`[Cache HIT] Ingredient suggestions: ${query}`);
      }
      return cached;
    }

    // Build search conditions
    const conditions: SQL[] = [
      or(
        ilike(ingredients.name, `%${normalizedQuery}%`),
        ilike(ingredients.display_name, `%${normalizedQuery}%`),
        sql`${ingredients.aliases}::text ILIKE ${`%${normalizedQuery}%`}`
      ) as SQL,
    ];

    // Filter by category if specified
    if (validatedOptions.category) {
      conditions.push(eq(ingredients.category, validatedOptions.category));
    }

    // Filter by common ingredients only
    if (validatedOptions.commonOnly) {
      conditions.push(eq(ingredients.is_common, true));
    }

    // Fetch suggestions with statistics
    const suggestions = await db
      .select({
        id: ingredients.id,
        name: ingredients.name,
        displayName: ingredients.display_name,
        category: ingredients.category,
        isCommon: ingredients.is_common,
        recipeCount: ingredientStatistics.total_recipes,
      })
      .from(ingredients)
      .leftJoin(ingredientStatistics, eq(ingredients.id, ingredientStatistics.ingredient_id))
      .where(and(...conditions))
      .orderBy(
        desc(ingredients.is_common), // Common ingredients first
        desc(ingredientStatistics.total_recipes), // Then by popularity
        asc(ingredients.name) // Then alphabetically
      )
      .limit(validatedOptions.limit);

    const result = {
      success: true,
      suggestions: suggestions.map((s) => ({
        id: s.id,
        name: s.name,
        displayName: s.displayName,
        category: s.category,
        isCommon: s.isCommon,
        recipeCount: s.recipeCount || 0,
      })),
    };

    // Store in cache
    searchCaches.ingredientSuggestions.set(cacheKey, result);
    if (ENABLE_CACHE_STATS) {
      console.log(`[Cache MISS] Ingredient suggestions: ${query}`);
    }

    return result;
  } catch (error: any) {
    console.error('Get ingredient suggestions failed:', error);
    return {
      success: false,
      suggestions: [],
      error: error.message || 'Failed to get ingredient suggestions',
    };
  }
}

// ============================================================================
// CATEGORY-BASED SEARCH
// ============================================================================

/**
 * Get all ingredients in a specific category or categories
 * Sorted by popularity (recipe count)
 *
 * @param categories - Single category or array of categories
 * @returns Ingredients in the specified categories
 *
 * @example
 * const result = await getIngredientsByCategory('vegetables');
 * const result = await getIngredientsByCategory(['vegetables', 'herbs']);
 */
export async function getIngredientsByCategory(categories: string | string[]): Promise<{
  success: boolean;
  ingredients: IngredientWithStats[];
  error?: string;
}> {
  try {
    const categoryArray = Array.isArray(categories) ? categories : [categories];

    if (categoryArray.length === 0) {
      return {
        success: false,
        ingredients: [],
        error: 'At least one category must be specified',
      };
    }

    const results = await db
      .select({
        ingredient: ingredients,
        statistics: ingredientStatistics,
      })
      .from(ingredients)
      .leftJoin(ingredientStatistics, eq(ingredients.id, ingredientStatistics.ingredient_id))
      .where(
        categoryArray.length === 1
          ? eq(ingredients.category, categoryArray[0])
          : inArray(ingredients.category, categoryArray)
      )
      .orderBy(desc(ingredientStatistics.total_recipes), asc(ingredients.name));

    const ingredientsWithStats: IngredientWithStats[] = results.map((r) => ({
      ...r.ingredient,
      statistics: r.statistics || undefined,
    }));

    return {
      success: true,
      ingredients: ingredientsWithStats,
    };
  } catch (error: any) {
    console.error('Get ingredients by category failed:', error);
    return {
      success: false,
      ingredients: [],
      error: error.message || 'Failed to get ingredients by category',
    };
  }
}

// ============================================================================
// RECIPE INGREDIENTS
// ============================================================================

/**
 * Get the full ingredient list for a specific recipe
 * Includes amounts, units, preparations, and maintains proper ordering
 *
 * @param recipeId - ID of the recipe
 * @returns Ordered list of recipe ingredients with full details
 *
 * @example
 * const result = await getRecipeIngredients('recipe-123');
 * // Returns detailed ingredients with amounts, units, preparations
 */
export async function getRecipeIngredients(recipeId: string): Promise<RecipeIngredientsResult> {
  try {
    if (!recipeId) {
      return {
        success: false,
        ingredients: [],
        error: 'Recipe ID is required',
      };
    }

    const { userId } = await auth();

    // Check if user has access to this recipe
    const recipe = await db.select().from(recipes).where(eq(recipes.id, recipeId)).limit(1);

    if (recipe.length === 0) {
      return {
        success: false,
        ingredients: [],
        error: 'Recipe not found',
      };
    }

    // Check access permissions
    if (!recipe[0].is_public && recipe[0].user_id !== userId) {
      return {
        success: false,
        ingredients: [],
        error: 'Access denied',
      };
    }

    // Fetch ingredients with full details
    const results = await db
      .select({
        recipeIngredient: recipeIngredients,
        ingredient: ingredients,
      })
      .from(recipeIngredients)
      .innerJoin(ingredients, eq(recipeIngredients.ingredient_id, ingredients.id))
      .where(eq(recipeIngredients.recipe_id, recipeId))
      .orderBy(asc(recipeIngredients.ingredient_group), asc(recipeIngredients.position));

    const ingredientsWithDetails: RecipeIngredientWithDetails[] = results.map((r) => ({
      ...r.recipeIngredient,
      ingredient: r.ingredient,
    }));

    return {
      success: true,
      ingredients: ingredientsWithDetails,
    };
  } catch (error: any) {
    console.error('Get recipe ingredients failed:', error);
    return {
      success: false,
      ingredients: [],
      error: error.message || 'Failed to get recipe ingredients',
    };
  }
}

// ============================================================================
// POPULAR INGREDIENTS
// ============================================================================

/**
 * Get the most popular ingredients based on usage statistics
 * Useful for displaying trending ingredients or suggestions
 *
 * @param limit - Maximum number of ingredients to return (default: 20)
 * @returns Most popular ingredients with statistics
 *
 * @example
 * const result = await getPopularIngredients(10);
 * // Returns top 10 most-used ingredients
 */
export async function getPopularIngredients(
  limit: number = 20,
  category?: string
): Promise<PopularIngredientsResult> {
  try {
    const validLimit = Math.min(Math.max(limit, 1), 100);

    // Generate cache key
    const cacheKey = generatePopularIngredientsKey(category, validLimit);

    // Check cache
    const cached = searchCaches.popularIngredients.get<PopularIngredientsResult>(cacheKey);
    if (cached) {
      if (ENABLE_CACHE_STATS) {
        console.log(`[Cache HIT] Popular ingredients: ${category || 'all'}`);
      }
      return cached;
    }

    // Build query with optional category filter
    const query = category
      ? db
          .select({
            ingredient: ingredients,
            statistics: ingredientStatistics,
          })
          .from(ingredients)
          .innerJoin(ingredientStatistics, eq(ingredients.id, ingredientStatistics.ingredient_id))
          .where(eq(ingredients.category, category))
          .orderBy(
            desc(ingredientStatistics.total_recipes),
            desc(ingredientStatistics.trending_score),
            asc(ingredients.name)
          )
          .limit(validLimit)
      : db
          .select({
            ingredient: ingredients,
            statistics: ingredientStatistics,
          })
          .from(ingredients)
          .innerJoin(ingredientStatistics, eq(ingredients.id, ingredientStatistics.ingredient_id))
          .orderBy(
            desc(ingredientStatistics.total_recipes),
            desc(ingredientStatistics.trending_score),
            asc(ingredients.name)
          )
          .limit(validLimit);

    const results = await query;

    const popularIngredients: IngredientWithStats[] = results.map((r) => ({
      ...r.ingredient,
      statistics: r.statistics,
    }));

    const result = {
      success: true,
      ingredients: popularIngredients,
    };

    // Store in cache
    searchCaches.popularIngredients.set(cacheKey, result);
    if (ENABLE_CACHE_STATS) {
      console.log(`[Cache MISS] Popular ingredients: ${category || 'all'}`);
    }

    return result;
  } catch (error: any) {
    console.error('Get popular ingredients failed:', error);
    return {
      success: false,
      ingredients: [],
      error: error.message || 'Failed to get popular ingredients',
    };
  }
}
