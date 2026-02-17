import { and, asc, count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  type Ingredient,
  ingredientStatistics,
  ingredients,
  recipeIngredients,
} from '@/lib/db/ingredients-schema';
import { recipes } from '@/lib/db/schema';

/**
 * IngredientService - Business logic for ingredient operations
 *
 * Responsibilities:
 * - Browsing and searching ingredients
 * - Ingredient details and metadata
 * - Recipe-ingredient relationships
 *
 * Note: This service is read-only for most operations.
 * Ingredient creation/modification is typically admin-only.
 */
export class IngredientService {
  /**
   * Get all ingredients with optional filtering
   */
  async findAll(options?: {
    category?: string;
    search?: string;
    sort?: 'alphabetical' | 'most-used' | 'recently-added';
    limit?: number;
    offset?: number;
  }): Promise<Ingredient[]> {
    const {
      category,
      search,
      sort = 'alphabetical',
      limit = 100,
      offset = 0,
    } = options || {};

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
      default:
        orderBy = [asc(ingredients.display_name)];
        break;
    }

    const query = db
      .select()
      .from(ingredients)
      .orderBy(...orderBy)
      .limit(limit)
      .offset(offset);

    if (conditions.length > 0) {
      return query.where(sql`${sql.join(conditions, sql` AND `)}`);
    }

    return query;
  }

  /**
   * Find ingredient by slug
   */
  async findBySlug(slug: string): Promise<Ingredient | null> {
    const [ingredient] = await db
      .select()
      .from(ingredients)
      .where(eq(ingredients.slug, slug))
      .limit(1);

    return ingredient || null;
  }

  /**
   * Find ingredient by ID
   */
  async findById(id: string): Promise<Ingredient | null> {
    const [ingredient] = await db
      .select()
      .from(ingredients)
      .where(eq(ingredients.id, id))
      .limit(1);

    return ingredient || null;
  }

  /**
   * Search ingredients by name or alias
   */
  async search(query: string, limit = 20): Promise<Ingredient[]> {
    const searchTerm = `%${query.trim().toLowerCase()}%`;

    return db
      .select()
      .from(ingredients)
      .where(
        or(
          ilike(ingredients.name, searchTerm),
          ilike(ingredients.display_name, searchTerm),
          sql`${ingredients.aliases}::text ILIKE ${searchTerm}`
        )
      )
      .orderBy(desc(ingredients.is_common), asc(ingredients.display_name))
      .limit(limit);
  }

  /**
   * Get all unique ingredient categories
   */
  async getCategories(): Promise<Array<{ category: string; count: number }>> {
    const categoriesResult = await db
      .select({
        category: ingredients.category,
        count: count(),
      })
      .from(ingredients)
      .groupBy(ingredients.category)
      .orderBy(asc(ingredients.category));

    return categoriesResult
      .filter((c) => c.category !== null)
      .map((c) => ({
        category: c.category!,
        count: c.count,
      }));
  }

  /**
   * Get recipes using a specific ingredient
   */
  async getRecipesUsingIngredient(
    ingredientId: string,
    options?: {
      limit?: number;
      offset?: number;
      sortBy?: 'popular' | 'recent' | 'rating';
    }
  ): Promise<typeof recipes.$inferSelect[]> {
    const { limit = 50, offset = 0, sortBy = 'popular' } = options || {};

    // Get recipe IDs using this ingredient
    const recipeLinks = await db
      .select({ recipeId: recipeIngredients.recipe_id })
      .from(recipeIngredients)
      .where(eq(recipeIngredients.ingredient_id, ingredientId));

    const recipeIds = recipeLinks.map((link) => link.recipeId);

    if (recipeIds.length === 0) {
      return [];
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
      default:
        orderBy = [desc(recipes.like_count), desc(recipes.system_rating)];
        break;
    }

    // Fetch recipes
    return db
      .select()
      .from(recipes)
      .where(
        sql`${recipes.id} IN (${sql.join(
          recipeIds.map((id) => sql`${id}`),
          sql`, `
        )})`
      )
      .orderBy(...orderBy)
      .limit(limit)
      .offset(offset);
  }

  /**
   * Get count of recipes using an ingredient
   */
  async getRecipeCount(ingredientId: string): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(recipeIngredients)
      .where(eq(recipeIngredients.ingredient_id, ingredientId));

    return result?.count || 0;
  }

  /**
   * Get common/frequently used ingredients
   */
  async getCommonIngredients(limit = 50): Promise<Ingredient[]> {
    return db
      .select()
      .from(ingredients)
      .where(eq(ingredients.is_common, true))
      .orderBy(desc(ingredients.usage_count), asc(ingredients.display_name))
      .limit(limit);
  }

  /**
   * Get allergen ingredients
   */
  async getAllergens(): Promise<Ingredient[]> {
    return db
      .select()
      .from(ingredients)
      .where(eq(ingredients.is_allergen, true))
      .orderBy(asc(ingredients.display_name));
  }

  /**
   * Get ingredients by type (ontology)
   */
  async findByType(
    type: string,
    subtype?: string,
    limit = 100
  ): Promise<Ingredient[]> {
    const conditions = [eq(ingredients.type, type)];

    if (subtype) {
      conditions.push(eq(ingredients.subtype, subtype));
    }

    return db
      .select()
      .from(ingredients)
      .where(and(...conditions))
      .orderBy(asc(ingredients.display_name))
      .limit(limit);
  }

  /**
   * Get ingredient statistics
   */
  async getStatistics(ingredientId: string): Promise<typeof ingredientStatistics.$inferSelect | null> {
    const [stats] = await db
      .select()
      .from(ingredientStatistics)
      .where(eq(ingredientStatistics.ingredient_id, ingredientId))
      .limit(1);

    return stats || null;
  }
}

// Export singleton instance
export const ingredientService = new IngredientService();
