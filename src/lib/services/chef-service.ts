import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chefRecipes, chefs, type Chef, type NewChef } from '@/lib/db/chef-schema';
import { recipes } from '@/lib/db/schema';

/**
 * ChefService - Business logic for chef operations
 *
 * Responsibilities:
 * - CRUD operations for chefs
 * - Recipe-chef associations
 * - Chef discovery and search
 *
 * Note: This service is stateless and authentication-free.
 * Authentication and authorization are handled by the caller (API routes or server actions).
 */
export class ChefService {
  /**
   * Get all active chefs with optional pagination
   */
  async findAll(options?: { limit?: number; offset?: number }): Promise<Chef[]> {
    const { limit, offset = 0 } = options || {};

    return db.query.chefs.findMany({
      where: eq(chefs.is_active, true),
      orderBy: [asc(chefs.name)],
      limit,
      offset,
    });
  }

  /**
   * Get all chefs (including inactive) - for admin use
   */
  async findAllIncludingInactive(options?: { limit?: number; offset?: number }): Promise<Chef[]> {
    const { limit, offset = 0 } = options || {};

    return db.query.chefs.findMany({
      orderBy: [desc(chefs.created_at)],
      limit,
      offset,
    });
  }

  /**
   * Find chef by slug
   */
  async findBySlug(slug: string): Promise<Chef | null> {
    const chef = await db.query.chefs.findFirst({
      where: and(eq(chefs.slug, slug), eq(chefs.is_active, true)),
    });

    return chef || null;
  }

  /**
   * Find chef by ID
   */
  async findById(id: string): Promise<Chef | null> {
    const chef = await db.query.chefs.findFirst({
      where: eq(chefs.id, id),
    });

    return chef || null;
  }

  /**
   * Get recipes associated with a chef
   */
  async findRecipesByChef(
    chefId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<typeof recipes.$inferSelect[]> {
    const { limit = 24, offset = 0 } = options || {};

    const chefRecipesData = await db
      .select({
        recipe: recipes,
      })
      .from(chefRecipes)
      .innerJoin(recipes, eq(chefRecipes.recipe_id, recipes.id))
      .where(eq(chefRecipes.chef_id, chefId))
      .orderBy(desc(recipes.created_at))
      .limit(limit)
      .offset(offset);

    return chefRecipesData.map((cr) => cr.recipe);
  }

  /**
   * Create a new chef
   */
  async create(data: NewChef): Promise<Chef> {
    const [chef] = await db
      .insert(chefs)
      .values({
        ...data,
        slug: data.slug.toLowerCase().replace(/\s+/g, '-'),
        updated_at: new Date(),
      })
      .returning();

    if (!chef) {
      throw new Error('Failed to create chef');
    }

    return chef;
  }

  /**
   * Update a chef by ID
   */
  async update(id: string, data: Partial<NewChef>): Promise<Chef | null> {
    const [chef] = await db
      .update(chefs)
      .set({
        ...data,
        updated_at: new Date(),
      })
      .where(eq(chefs.id, id))
      .returning();

    return chef || null;
  }

  /**
   * Delete a chef by ID
   */
  async delete(id: string): Promise<boolean> {
    const result = await db.delete(chefs).where(eq(chefs.id, id)).returning();

    return result.length > 0;
  }

  /**
   * Update chef recipe count
   * Should be called after adding/removing recipes
   */
  async updateRecipeCount(chefId: string): Promise<number> {
    const count = await db
      .select({ count: sql<number>`count(*)` })
      .from(chefRecipes)
      .where(eq(chefRecipes.chef_id, chefId));

    const recipeCount = Number(count[0]?.count || 0);

    await db
      .update(chefs)
      .set({ recipe_count: recipeCount, updated_at: new Date() })
      .where(eq(chefs.id, chefId));

    return recipeCount;
  }

  /**
   * Link a recipe to a chef
   */
  async linkRecipeToChef(params: {
    chefId: string;
    recipeId: string;
    originalUrl?: string;
  }): Promise<void> {
    await db.insert(chefRecipes).values({
      chef_id: params.chefId,
      recipe_id: params.recipeId,
      original_url: params.originalUrl,
      scraped_at: params.originalUrl ? new Date() : undefined,
    });

    // Update recipe to reference chef
    await db.update(recipes).set({ chef_id: params.chefId }).where(eq(recipes.id, params.recipeId));

    // Update chef recipe count
    await this.updateRecipeCount(params.chefId);
  }

  /**
   * Unlink a recipe from a chef
   */
  async unlinkRecipeFromChef(chefId: string, recipeId: string): Promise<void> {
    await db
      .delete(chefRecipes)
      .where(and(eq(chefRecipes.chef_id, chefId), eq(chefRecipes.recipe_id, recipeId)));

    // Remove chef reference from recipe
    await db.update(recipes).set({ chef_id: null }).where(eq(recipes.id, recipeId));

    // Update chef recipe count
    await this.updateRecipeCount(chefId);
  }

  /**
   * Search chefs by name or specialty
   */
  async search(query: string, limit = 20): Promise<Chef[]> {
    const results = await db.query.chefs.findMany({
      where: and(
        eq(chefs.is_active, true),
        sql`(
          ${chefs.name} ILIKE ${`%${query}%`} OR
          ${chefs.display_name} ILIKE ${`%${query}%`} OR
          ${chefs.bio} ILIKE ${`%${query}%`} OR
          EXISTS (
            SELECT 1 FROM unnest(${chefs.specialties}) AS specialty
            WHERE specialty ILIKE ${`%${query}%`}
          )
        )`
      ),
      orderBy: [desc(chefs.recipe_count)],
      limit,
    });

    return results;
  }
}

// Export singleton instance for consistency
export const chefService = new ChefService();
