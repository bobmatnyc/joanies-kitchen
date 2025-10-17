'use server';

import { auth } from '@clerk/nextjs/server';
import { and, desc, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import {
  type Collection,
  collectionRecipes,
  collections,
  insertCollectionRecipeSchema,
  insertCollectionSchema,
  userProfiles,
} from '@/lib/db/user-discovery-schema';

/**
 * Collection Server Actions
 *
 * Manage recipe collections (themed groups of recipes).
 * Users can organize recipes into public or private collections.
 */

// ============================================================================
// COLLECTION CRUD
// ============================================================================

/**
 * Create a new collection
 */
export async function createCollection(data: {
  name: string;
  description?: string;
  isPublic?: boolean;
}) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return { success: false, error: 'Unauthorized - Please sign in' };
    }

    // Ensure user has a profile (auto-create if needed)
    const { ensureUserProfile } = await import('./user-profiles');
    const profile = await ensureUserProfile();

    if (!profile) {
      return { success: false, error: 'Failed to create user profile' };
    }

    // Generate slug from name
    const slug = data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // Validate data
    const validatedData = insertCollectionSchema.parse({
      userId,
      name: data.name,
      slug,
      description: data.description || null,
      isPublic: data.isPublic ?? false,
    });

    // Create collection
    const [newCollection] = await db.insert(collections).values(validatedData).returning();

    revalidatePath('/collections');
    revalidatePath(`/profile/${profile.username}`);

    return { success: true, collection: newCollection };
  } catch (error) {
    console.error('Error creating collection:', error);

    if (error instanceof Error) {
      if (error.message.includes('unique')) {
        return { success: false, error: 'You already have a collection with this name' };
      }
      return { success: false, error: error.message };
    }

    return { success: false, error: 'Failed to create collection' };
  }
}

/**
 * Update an existing collection
 */
export async function updateCollection(
  collectionId: string,
  updates: {
    name?: string;
    description?: string;
    isPublic?: boolean;
    coverImageUrl?: string;
  }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return { success: false, error: 'Unauthorized' };
    }

    // Verify ownership
    const [existingCollection] = await db
      .select()
      .from(collections)
      .where(eq(collections.id, collectionId))
      .limit(1);

    if (!existingCollection) {
      return { success: false, error: 'Collection not found' };
    }

    if (existingCollection.user_id !== userId) {
      return { success: false, error: 'You can only edit your own collections' };
    }

    // Generate new slug if name changed
    const slug = updates.name
      ? updates.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
      : existingCollection.slug;

    // Update collection
    const [updatedCollection] = await db
      .update(collections)
      .set({
        ...updates,
        slug,
        updated_at: new Date(),
      })
      .where(eq(collections.id, collectionId))
      .returning();

    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.user_id, userId))
      .limit(1);

    revalidatePath('/collections');
    if (profile) {
      revalidatePath(`/profile/${profile.username}`);
      revalidatePath(`/collections/${profile.username}/${updatedCollection.slug}`);
    }

    return { success: true, collection: updatedCollection };
  } catch (error) {
    console.error('Error updating collection:', error);
    return { success: false, error: 'Failed to update collection' };
  }
}

/**
 * Delete a collection
 */
export async function deleteCollection(collectionId: string) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return { success: false, error: 'Unauthorized' };
    }

    // Verify ownership
    const [existingCollection] = await db
      .select()
      .from(collections)
      .where(eq(collections.id, collectionId))
      .limit(1);

    if (!existingCollection) {
      return { success: false, error: 'Collection not found' };
    }

    if (existingCollection.user_id !== userId) {
      return { success: false, error: 'You can only delete your own collections' };
    }

    // Delete collection (cascade will delete collection_recipes)
    await db.delete(collections).where(eq(collections.id, collectionId));

    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.user_id, userId))
      .limit(1);

    revalidatePath('/collections');
    if (profile) {
      revalidatePath(`/profile/${profile.username}`);
    }

    return { success: true };
  } catch (error) {
    console.error('Error deleting collection:', error);
    return { success: false, error: 'Failed to delete collection' };
  }
}

// ============================================================================
// GET COLLECTIONS
// ============================================================================

/**
 * Get user's collections
 */
export async function getUserCollections(targetUserId?: string) {
  try {
    const { userId: currentUserId } = await auth();
    const userId = targetUserId || currentUserId;

    if (!userId) {
      return [];
    }

    const isOwnProfile = userId === currentUserId;

    // If viewing own profile, show all collections
    // Otherwise, only show public collections
    const userCollections = await db
      .select()
      .from(collections)
      .where(
        isOwnProfile
          ? eq(collections.user_id, userId)
          : and(eq(collections.user_id, userId), eq(collections.is_public, true))
      )
      .orderBy(desc(collections.created_at));

    return userCollections;
  } catch (error) {
    console.error('Error fetching user collections:', error);
    return [];
  }
}

/**
 * Get collection by ID with recipes
 */
export async function getCollectionById(collectionId: string) {
  try {
    const { userId } = await auth();

    const [collection] = await db
      .select()
      .from(collections)
      .where(eq(collections.id, collectionId))
      .limit(1);

    if (!collection) {
      return null;
    }

    // Check visibility
    if (!collection.is_public && collection.user_id !== userId) {
      return null;
    }

    // Get recipes in collection
    const collectionRecipesList = await db
      .select({
        collectionRecipe: collectionRecipes,
        recipe: recipes,
      })
      .from(collectionRecipes)
      .innerJoin(recipes, eq(collectionRecipes.recipe_id, recipes.id))
      .where(eq(collectionRecipes.collection_id, collectionId))
      .orderBy(collectionRecipes.position);

    return {
      ...collection,
      recipes: collectionRecipesList.map((cr) => ({
        ...cr.recipe,
        position: cr.collectionRecipe.position,
        personalNote: cr.collectionRecipe.personal_note,
        addedAt: cr.collectionRecipe.added_at,
      })),
    };
  } catch (error) {
    console.error('Error fetching collection:', error);
    return null;
  }
}

/**
 * Get collection by username and slug
 */
export async function getCollectionBySlug(username: string, slug: string) {
  try {
    const { userId: currentUserId } = await auth();

    // Find user profile
    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(sql`LOWER(${userProfiles.username})`, username.toLowerCase()))
      .limit(1);

    if (!profile) {
      return null;
    }

    // Find collection
    const [collection] = await db
      .select()
      .from(collections)
      .where(and(eq(collections.user_id, profile.user_id), eq(collections.slug, slug)))
      .limit(1);

    if (!collection) {
      return null;
    }

    // Check visibility
    const isOwner = currentUserId === collection.user_id;
    if (!collection.is_public && !isOwner) {
      return null;
    }

    // Get recipes in collection
    const collectionRecipesList = await db
      .select({
        collectionRecipe: collectionRecipes,
        recipe: recipes,
      })
      .from(collectionRecipes)
      .innerJoin(recipes, eq(collectionRecipes.recipe_id, recipes.id))
      .where(eq(collectionRecipes.collection_id, collection.id))
      .orderBy(collectionRecipes.position);

    return {
      ...collection,
      ownerUsername: profile.username,
      recipes: collectionRecipesList.map((cr) => ({
        ...cr.recipe,
        position: cr.collectionRecipe.position,
        personalNote: cr.collectionRecipe.personal_note,
        addedAt: cr.collectionRecipe.added_at,
      })),
    };
  } catch (error) {
    console.error('Error fetching collection by slug:', error);
    return null;
  }
}

/**
 * Get public collections (browse/discover)
 */
export async function getPublicCollections(limit = 20, offset = 0) {
  try {
    const publicCollections = await db
      .select({
        collection: collections,
        profile: userProfiles,
      })
      .from(collections)
      .innerJoin(userProfiles, eq(collections.user_id, userProfiles.user_id))
      .where(eq(collections.is_public, true))
      .orderBy(desc(collections.created_at))
      .limit(limit)
      .offset(offset);

    return publicCollections.map((c) => ({
      ...c.collection,
      ownerUsername: c.profile.username,
      ownerDisplayName: c.profile.display_name,
    }));
  } catch (error) {
    console.error('Error fetching public collections:', error);
    return [];
  }
}

// ============================================================================
// MANAGE RECIPES IN COLLECTION
// ============================================================================

/**
 * Add recipe to collection
 */
export async function addRecipeToCollection(
  collectionId: string,
  recipeId: string,
  personalNote?: string
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return { success: false, error: 'Unauthorized' };
    }

    // Verify collection ownership
    const [collection] = await db
      .select()
      .from(collections)
      .where(eq(collections.id, collectionId))
      .limit(1);

    if (!collection) {
      return { success: false, error: 'Collection not found' };
    }

    if (collection.user_id !== userId) {
      return { success: false, error: 'You can only add recipes to your own collections' };
    }

    // Check if recipe exists
    const [recipe] = await db.select().from(recipes).where(eq(recipes.id, recipeId)).limit(1);

    if (!recipe) {
      return { success: false, error: 'Recipe not found' };
    }

    // Get current max position
    const [maxPosition] = await db
      .select({ max: sql<number>`COALESCE(MAX(${collectionRecipes.position}), -1)` })
      .from(collectionRecipes)
      .where(eq(collectionRecipes.collection_id, collectionId));

    const position = (maxPosition?.max ?? -1) + 1;

    // Add recipe to collection
    const validatedData = insertCollectionRecipeSchema.parse({
      collectionId,
      recipeId,
      position,
      personalNote: personalNote || null,
    });

    const [newCollectionRecipe] = await db
      .insert(collectionRecipes)
      .values(validatedData)
      .returning();

    // Update collection recipe count and last added timestamp
    await db
      .update(collections)
      .set({
        recipe_count: sql`${collections.recipe_count} + 1`,
        last_recipe_added_at: new Date(),
        updated_at: new Date(),
      })
      .where(eq(collections.id, collectionId));

    revalidatePath(`/collections/${collectionId}`);

    return { success: true, collectionRecipe: newCollectionRecipe };
  } catch (error) {
    console.error('Error adding recipe to collection:', error);

    if (error instanceof Error && error.message.includes('unique')) {
      return { success: false, error: 'Recipe already in this collection' };
    }

    return { success: false, error: 'Failed to add recipe to collection' };
  }
}

/**
 * Remove recipe from collection
 */
export async function removeRecipeFromCollection(collectionId: string, recipeId: string) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return { success: false, error: 'Unauthorized' };
    }

    // Verify collection ownership
    const [collection] = await db
      .select()
      .from(collections)
      .where(eq(collections.id, collectionId))
      .limit(1);

    if (!collection) {
      return { success: false, error: 'Collection not found' };
    }

    if (collection.user_id !== userId) {
      return { success: false, error: 'You can only modify your own collections' };
    }

    // Remove recipe from collection
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

    revalidatePath(`/collections/${collectionId}`);

    return { success: true };
  } catch (error) {
    console.error('Error removing recipe from collection:', error);
    return { success: false, error: 'Failed to remove recipe' };
  }
}

/**
 * Reorder recipes in collection
 */
export async function reorderCollectionRecipes(collectionId: string, recipeIds: string[]) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return { success: false, error: 'Unauthorized' };
    }

    // Verify collection ownership
    const [collection] = await db
      .select()
      .from(collections)
      .where(eq(collections.id, collectionId))
      .limit(1);

    if (!collection) {
      return { success: false, error: 'Collection not found' };
    }

    if (collection.user_id !== userId) {
      return { success: false, error: 'You can only reorder your own collections' };
    }

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

    revalidatePath(`/collections/${collectionId}`);

    return { success: true };
  } catch (error) {
    console.error('Error reordering recipes:', error);
    return { success: false, error: 'Failed to reorder recipes' };
  }
}

// ============================================================================
// COLLECTION MEMBERSHIP CHECKS
// ============================================================================

/**
 * Get all collections that contain a specific recipe
 * Only returns collections visible to the current user
 */
export async function getRecipeCollections(recipeId: string): Promise<Collection[]> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return [];
    }

    // Get collections containing this recipe
    const recipeCollectionsList = await db
      .select({
        collection: collections,
      })
      .from(collectionRecipes)
      .innerJoin(collections, eq(collectionRecipes.collection_id, collections.id))
      .where(
        and(
          eq(collectionRecipes.recipe_id, recipeId),
          eq(collections.user_id, userId) // Only user's own collections
        )
      )
      .orderBy(desc(collections.created_at));

    return recipeCollectionsList.map((c) => c.collection);
  } catch (error) {
    console.error('Error fetching recipe collections:', error);
    return [];
  }
}

/**
 * Check if a recipe is in a specific collection
 */
export async function isRecipeInCollection(
  recipeId: string,
  collectionId: string
): Promise<boolean> {
  try {
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
  } catch (error) {
    console.error('Error checking collection membership:', error);
    return false;
  }
}

/**
 * Get collection IDs that contain a specific recipe (for current user)
 * Useful for bulk checking which collections a recipe is in
 */
export async function getRecipeCollectionIds(recipeId: string): Promise<string[]> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return [];
    }

    const userCollections = await db
      .select({
        collection_id: collectionRecipes.collection_id,
      })
      .from(collectionRecipes)
      .innerJoin(collections, eq(collectionRecipes.collection_id, collections.id))
      .where(and(eq(collectionRecipes.recipe_id, recipeId), eq(collections.user_id, userId)));

    return userCollections.map((c) => c.collection_id);
  } catch (error) {
    console.error('Error fetching recipe collection IDs:', error);
    return [];
  }
}
