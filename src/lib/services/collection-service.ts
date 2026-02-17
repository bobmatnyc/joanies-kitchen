import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import {
  type Collection,
  collectionRecipes,
  collections,
  type NewCollection,
  userProfiles,
} from '@/lib/db/user-discovery-schema';

/**
 * CollectionService - Business logic for recipe collections
 *
 * Responsibilities:
 * - CRUD operations for collections
 * - Managing recipes within collections
 * - Collection visibility and discovery
 *
 * Note: This service is stateless. Caller must provide userId for ownership checks.
 */
export class CollectionService {
  /**
   * Get all collections for a user
   */
  async findByUserId(
    userId: string,
    options?: { includePrivate?: boolean }
  ): Promise<Collection[]> {
    const { includePrivate = true } = options || {};

    const query = includePrivate
      ? eq(collections.user_id, userId)
      : and(eq(collections.user_id, userId), eq(collections.is_public, true));

    return db.select().from(collections).where(query).orderBy(desc(collections.created_at));
  }

  /**
   * Find collection by user and slug
   */
  async findBySlug(userId: string, slug: string): Promise<Collection | null> {
    const [collection] = await db
      .select()
      .from(collections)
      .where(and(eq(collections.user_id, userId), eq(collections.slug, slug)))
      .limit(1);

    return collection || null;
  }

  /**
   * Find collection by ID
   */
  async findById(id: string): Promise<Collection | null> {
    const [collection] = await db
      .select()
      .from(collections)
      .where(eq(collections.id, id))
      .limit(1);

    return collection || null;
  }

  /**
   * Create a new collection
   */
  async create(
    userId: string,
    data: Omit<NewCollection, 'user_id' | 'slug'>
  ): Promise<Collection> {
    // Generate slug from name
    const slug = data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const [newCollection] = await db
      .insert(collections)
      .values({
        user_id: userId,
        name: data.name,
        slug,
        description: data.description || null,
        is_public: data.is_public ?? false,
      })
      .returning();

    if (!newCollection) {
      throw new Error('Failed to create collection');
    }

    return newCollection;
  }

  /**
   * Update an existing collection
   */
  async update(
    id: string,
    updates: {
      name?: string;
      description?: string;
      is_public?: boolean;
      cover_image_url?: string;
    }
  ): Promise<Collection | null> {
    // Generate new slug if name changed
    const slug = updates.name
      ? updates.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
      : undefined;

    const [updatedCollection] = await db
      .update(collections)
      .set({
        ...updates,
        ...(slug && { slug }),
        updated_at: new Date(),
      })
      .where(eq(collections.id, id))
      .returning();

    return updatedCollection || null;
  }

  /**
   * Delete a collection
   */
  async delete(id: string): Promise<boolean> {
    const result = await db.delete(collections).where(eq(collections.id, id)).returning();

    return result.length > 0;
  }

  /**
   * Add a recipe to a collection
   */
  async addRecipe(
    collectionId: string,
    recipeId: string,
    personalNote?: string
  ): Promise<void> {
    // Get current max position
    const [maxPosition] = await db
      .select({ max: sql<number>`COALESCE(MAX(${collectionRecipes.position}), -1)` })
      .from(collectionRecipes)
      .where(eq(collectionRecipes.collection_id, collectionId));

    const position = (maxPosition?.max ?? -1) + 1;

    // Add recipe to collection
    await db.insert(collectionRecipes).values({
      collection_id: collectionId,
      recipe_id: recipeId,
      position,
      personal_note: personalNote || null,
    });

    // Update collection recipe count and timestamp
    await db
      .update(collections)
      .set({
        recipe_count: sql`${collections.recipe_count} + 1`,
        last_recipe_added_at: new Date(),
        updated_at: new Date(),
      })
      .where(eq(collections.id, collectionId));

    // Increment recipe's collection_count
    await db
      .update(recipes)
      .set({
        collection_count: sql`${recipes.collection_count} + 1`,
      })
      .where(eq(recipes.id, recipeId));
  }

  /**
   * Remove a recipe from a collection
   */
  async removeRecipe(collectionId: string, recipeId: string): Promise<void> {
    await db
      .delete(collectionRecipes)
      .where(
        and(
          eq(collectionRecipes.collection_id, collectionId),
          eq(collectionRecipes.recipe_id, recipeId)
        )
      );

    // Update collection recipe count
    await db
      .update(collections)
      .set({
        recipe_count: sql`GREATEST(${collections.recipe_count} - 1, 0)`,
        updated_at: new Date(),
      })
      .where(eq(collections.id, collectionId));

    // Decrement recipe's collection_count
    await db
      .update(recipes)
      .set({
        collection_count: sql`GREATEST(${recipes.collection_count} - 1, 0)`,
      })
      .where(eq(recipes.id, recipeId));
  }

  /**
   * Get all recipes in a collection
   */
  async getRecipes(collectionId: string): Promise<typeof recipes.$inferSelect[]> {
    const collectionRecipesList = await db
      .select({
        recipe: recipes,
        position: collectionRecipes.position,
      })
      .from(collectionRecipes)
      .innerJoin(recipes, eq(collectionRecipes.recipe_id, recipes.id))
      .where(eq(collectionRecipes.collection_id, collectionId))
      .orderBy(collectionRecipes.position);

    return collectionRecipesList.map((cr) => cr.recipe);
  }

  /**
   * Get public collections with pagination
   */
  async findPublic(limit = 20, offset = 0): Promise<Collection[]> {
    return db
      .select()
      .from(collections)
      .where(eq(collections.is_public, true))
      .orderBy(desc(collections.created_at))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Check if a recipe is in a collection
   */
  async isRecipeInCollection(recipeId: string, collectionId: string): Promise<boolean> {
    const [existingEntry] = await db
      .select()
      .from(collectionRecipes)
      .where(
        and(
          eq(collectionRecipes.recipe_id, recipeId),
          eq(collectionRecipes.collection_id, collectionId)
        )
      )
      .limit(1);

    return !!existingEntry;
  }

  /**
   * Get collection IDs that contain a specific recipe (for a user)
   */
  async getRecipeCollectionIds(recipeId: string, userId: string): Promise<string[]> {
    const userCollections = await db
      .select({
        collection_id: collectionRecipes.collection_id,
      })
      .from(collectionRecipes)
      .innerJoin(collections, eq(collectionRecipes.collection_id, collections.id))
      .where(and(eq(collectionRecipes.recipe_id, recipeId), eq(collections.user_id, userId)));

    return userCollections.map((c) => c.collection_id);
  }

  /**
   * Reorder recipes in a collection
   */
  async reorderRecipes(collectionId: string, recipeIds: string[]): Promise<void> {
    // Update position for each recipe
    for (let i = 0; i < recipeIds.length; i++) {
      await db
        .update(collectionRecipes)
        .set({ position: i })
        .where(
          and(
            eq(collectionRecipes.collection_id, collectionId),
            eq(collectionRecipes.recipe_id, recipeIds[i])
          )
        );
    }

    // Update collection timestamp
    await db
      .update(collections)
      .set({ updated_at: new Date() })
      .where(eq(collections.id, collectionId));
  }
}

// Export singleton instance
export const collectionService = new CollectionService();
