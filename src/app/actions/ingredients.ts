'use server';

import { asc, count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  type Ingredient,
  ingredientStatistics,
  ingredients,
  type IngredientWithStats,
  recipeIngredients,
} from '@/lib/db/ingredients-schema';
import { joanieComments } from '@/lib/db/schema';
import { recipes } from '@/lib/db/schema';

/**
 * Ingredients Server Actions
 *
 * Provides server-side operations for:
 * - Fetching all ingredients with filtering and sorting
 * - Getting individual ingredient details by slug
 * - Finding recipes that use a specific ingredient
 * - Managing ingredient metadata (descriptions, storage tips, images)
 */

// ============================================================================
// RESPONSE TYPES
// ============================================================================

interface IngredientsListResult {
  success: boolean;
  ingredients: IngredientWithStats[];
  totalCount: number;
  error?: string;
}

interface IngredientDetailResult {
  success: boolean;
  ingredient?: Ingredient;
  joanieComment?: any;
  recipesUsingIngredient?: any[];
  error?: string;
}

interface RecipesUsingIngredientResult {
  success: boolean;
  recipes: any[];
  totalCount: number;
  error?: string;
}

// ============================================================================
// GET ALL INGREDIENTS
// ============================================================================

export type SortOption = 'alphabetical' | 'most-used' | 'recently-added';

/**
 * Get all ingredients with optional filtering and sorting
 *
 * @param options - Filter and sort options
 * @returns List of ingredients with statistics
 */
export async function getAllIngredients(options: {
  category?: string;
  search?: string;
  sort?: SortOption;
  limit?: number;
  offset?: number;
} = {}): Promise<IngredientsListResult> {
  try {
    const {
      category,
      search,
      sort = 'alphabetical',
      limit = 100,
      offset = 0,
    } = options;

    // Build where conditions
    const conditions = [];

    if (category && category !== 'all') {
      conditions.push(eq(ingredients.category, category));
    }

    if (search && search.trim().length > 0) {
      const searchTerm = `%${search.trim().toLowerCase()}%`;
      conditions.push(
        or(
          ilike(ingredients.name, searchTerm),
          ilike(ingredients.display_name, searchTerm),
          sql`${ingredients.aliases}::text ILIKE ${searchTerm}`
        )
      );
    }

    // Build order by clause
    let orderBy;
    switch (sort) {
      case 'most-used':
        orderBy = [desc(ingredients.usage_count), asc(ingredients.display_name)];
        break;
      case 'recently-added':
        orderBy = [desc(ingredients.created_at), asc(ingredients.display_name)];
        break;
      case 'alphabetical':
      default:
        orderBy = [asc(ingredients.display_name)];
        break;
    }

    // Fetch ingredients with statistics
    const query = db
      .select({
        ingredient: ingredients,
        statistics: ingredientStatistics,
      })
      .from(ingredients)
      .leftJoin(ingredientStatistics, eq(ingredients.id, ingredientStatistics.ingredient_id))
      .orderBy(...orderBy)
      .limit(limit)
      .offset(offset);

    // Apply conditions if any
    const results = conditions.length > 0
      ? await query.where(sql`${sql.join(conditions, sql` AND `)})
      : await query;

    // Get total count for pagination
    const countQuery = db
      .select({ count: count() })
      .from(ingredients);

    const [countResult] = conditions.length > 0
      ? await countQuery.where(sql`${sql.join(conditions, sql` AND `)}`)
      : await countQuery;

    const ingredientsWithStats: IngredientWithStats[] = results.map((r) => ({
      ...r.ingredient,
      statistics: r.statistics || undefined,
    }));

    return {
      success: true,
      ingredients: ingredientsWithStats,
      totalCount: countResult.count,
    };
  } catch (error: any) {
    console.error('Failed to fetch ingredients:', error);
    return {
      success: false,
      ingredients: [],
      totalCount: 0,
      error: error.message || 'Failed to fetch ingredients',
    };
  }
}

// ============================================================================
// GET INGREDIENT BY SLUG
// ============================================================================

/**
 * Get detailed information about a specific ingredient by slug
 * Includes Joanie's comments and recipes using this ingredient
 *
 * @param slug - URL-friendly ingredient slug
 * @returns Ingredient details with related data
 */
export async function getIngredientBySlug(slug: string): Promise<IngredientDetailResult> {
  try {
    if (!slug) {
      return {
        success: false,
        error: 'Slug is required',
      };
    }

    // Fetch ingredient
    const [ingredient] = await db
      .select()
      .from(ingredients)
      .where(eq(ingredients.slug, slug))
      .limit(1);

    if (!ingredient) {
      return {
        success: false,
        error: 'Ingredient not found',
      };
    }

    // Fetch Joanie's comment for this ingredient (if exists)
    const [joanieComment] = await db
      .select()
      .from(joanieComments)
      .where(eq(joanieComments.ingredient_id, ingredient.id))
      .limit(1);

    // Fetch recipes using this ingredient (top 12, most popular)
    const recipesResult = await getRecipesUsingIngredient(ingredient.id, { limit: 12 });

    return {
      success: true,
      ingredient,
      joanieComment: joanieComment || undefined,
      recipesUsingIngredient: recipesResult.recipes,
    };
  } catch (error: any) {
    console.error('Failed to fetch ingredient:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch ingredient',
    };
  }
}

// ============================================================================
// GET RECIPES USING INGREDIENT
// ============================================================================

/**
 * Get all recipes that use a specific ingredient
 *
 * @param ingredientId - Ingredient UUID
 * @param options - Pagination and sorting options
 * @returns List of recipes using this ingredient
 */
export async function getRecipesUsingIngredient(
  ingredientId: string,
  options: {
    limit?: number;
    offset?: number;
    sortBy?: 'popular' | 'recent' | 'rating';
  } = {}
): Promise<RecipesUsingIngredientResult> {
  try {
    const { limit = 50, offset = 0, sortBy = 'popular' } = options;

    // Get recipe IDs using this ingredient
    const recipeLinks = await db
      .select({ recipeId: recipeIngredients.recipe_id })
      .from(recipeIngredients)
      .where(eq(recipeIngredients.ingredient_id, ingredientId));

    const recipeIds = recipeLinks.map((link) => link.recipeId);

    if (recipeIds.length === 0) {
      return {
        success: true,
        recipes: [],
        totalCount: 0,
      };
    }

    // Build order by clause
    let orderBy;
    switch (sortBy) {
      case 'recent':
        orderBy = [desc(recipes.created_at)];
        break;
      case 'rating':
        orderBy = [desc(recipes.avg_user_rating), desc(recipes.system_rating)];
        break;
      case 'popular':
      default:
        orderBy = [desc(recipes.like_count), desc(recipes.system_rating)];
        break;
    }

    // Fetch recipes
    const recipesList = await db
      .select()
      .from(recipes)
      .where(
        sql`${recipes.id} IN (${sql.join(recipeIds.map((id) => sql`${id}`), sql`, `)})`
      )
      .orderBy(...orderBy)
      .limit(limit)
      .offset(offset);

    // Get total count
    const [countResult] = await db
      .select({ count: count() })
      .from(recipes)
      .where(
        sql`${recipes.id} IN (${sql.join(recipeIds.map((id) => sql`${id}`), sql`, `)})`
      );

    return {
      success: true,
      recipes: recipesList,
      totalCount: countResult.count,
    };
  } catch (error: any) {
    console.error('Failed to fetch recipes using ingredient:', error);
    return {
      success: false,
      recipes: [],
      totalCount: 0,
      error: error.message || 'Failed to fetch recipes',
    };
  }
}

// ============================================================================
// GET INGREDIENTS BY CATEGORY
// ============================================================================

/**
 * Get all unique ingredient categories
 *
 * @returns List of unique categories with counts
 */
export async function getIngredientCategories() {
  try {
    const categoriesResult = await db
      .select({
        category: ingredients.category,
        count: count(),
      })
      .from(ingredients)
      .groupBy(ingredients.category)
      .orderBy(asc(ingredients.category));

    return {
      success: true,
      categories: categoriesResult.filter((c) => c.category !== null),
    };
  } catch (error: any) {
    console.error('Failed to fetch ingredient categories:', error);
    return {
      success: false,
      categories: [],
      error: error.message || 'Failed to fetch categories',
    };
  }
}
