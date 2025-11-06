'use server';

import { randomUUID } from 'node:crypto';
import { auth } from '@clerk/nextjs/server';
import { eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { type NewRecipe, type Recipe, recipes } from '@/lib/db/schema';
import { toErrorMessage } from '@/lib/utils/error-handling';
import { addFavorite } from './favorites';

/**
 * Recipe Cloning Server Actions
 *
 * Clone (fork) recipes with optional modifications.
 * Cloned recipes maintain attribution to the original and increment fork counts.
 */

interface CloneRecipeOptions {
  // Optional modifications to apply to the cloned recipe
  name?: string;
  description?: string;
  ingredients?: string; // JSON array
  instructions?: string; // JSON array
  tags?: string; // JSON array
  difficulty?: 'easy' | 'medium' | 'hard';
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  cuisine?: string;
  nutritionInfo?: string; // JSON object
  isPublic?: boolean;
}

/**
 * Clone a recipe (create editable copy with attribution)
 *
 * Process:
 * 1. Fetch original recipe
 * 2. Create new recipe with user as owner
 * 3. Apply any modifications
 * 4. Increment original recipe's fork_count
 * 5. Add to user's favorites
 * 6. Return cloned recipe
 */
export async function cloneRecipe(originalRecipeId: string, modifications?: CloneRecipeOptions) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return { success: false, error: 'Please sign in to clone recipes' };
    }

    // 1. Fetch original recipe
    const [originalRecipe] = await db
      .select()
      .from(recipes)
      .where(eq(recipes.id, originalRecipeId))
      .limit(1);

    if (!originalRecipe) {
      return { success: false, error: 'Original recipe not found' };
    }

    // Don't allow cloning your own recipe (just edit it instead)
    if (originalRecipe.user_id === userId) {
      return {
        success: false,
        error: 'You cannot clone your own recipe. Edit it directly instead.',
      };
    }

    // 2. Create new recipe based on original
    const clonedRecipeData: NewRecipe = {
      // New ownership and ID
      id: randomUUID(),
      user_id: userId,

      // Copy core content (with optional modifications)
      name: modifications?.name || `${originalRecipe.name} (My Version)`,
      description:
        modifications?.description ||
        originalRecipe.description ||
        `Forked from ${originalRecipe.name}`,
      ingredients: modifications?.ingredients || originalRecipe.ingredients,
      instructions: modifications?.instructions || originalRecipe.instructions,
      tags: modifications?.tags || originalRecipe.tags,

      // Copy metadata (with optional modifications)
      difficulty: modifications?.difficulty || originalRecipe.difficulty,
      cuisine: modifications?.cuisine || originalRecipe.cuisine,
      prep_time: modifications?.prepTime ?? originalRecipe.prep_time,
      cook_time: modifications?.cookTime ?? originalRecipe.cook_time,
      servings: modifications?.servings ?? originalRecipe.servings,
      nutrition_info: modifications?.nutritionInfo || originalRecipe.nutrition_info,

      // Attribution: Store reference to original
      source: `Forked from recipe ID: ${originalRecipeId}`,

      // Copy images (user can change later)
      images: originalRecipe.images,
      image_url: originalRecipe.image_url,

      // New recipe settings
      is_public: modifications?.isPublic ?? false, // Private by default
      is_ai_generated: false, // User-cloned, not AI-generated
      is_system_recipe: false, // Never a system recipe
      is_meal_prep_friendly: originalRecipe.is_meal_prep_friendly,

      // Initialize engagement metrics
      like_count: 0,
      fork_count: 0,
      collection_count: 0,

      // Timestamps
      created_at: new Date(),
      updated_at: new Date(),
    };

    // 3. Insert cloned recipe
    const [clonedRecipe] = await db.insert(recipes).values(clonedRecipeData).returning();

    // 4. Increment original recipe's fork_count
    await db
      .update(recipes)
      .set({
        fork_count: sql`${recipes.fork_count} + 1`,
        updated_at: new Date(),
      })
      .where(eq(recipes.id, originalRecipeId));

    // 5. Automatically favorite the original recipe (thank the author)
    await addFavorite(originalRecipeId);

    // 6. Revalidate paths
    revalidatePath(`/recipes/${originalRecipeId}`);
    revalidatePath(`/recipes/${clonedRecipe.id}`);
    revalidatePath('/recipes');

    return {
      success: true,
      clonedRecipe,
      message: 'Recipe cloned successfully! You can now edit your version.',
    };
  } catch (error) {
    console.error('Error cloning recipe:', error);

    if (error instanceof Error) {
      return { success: false, error: toErrorMessage(error) };
    }

    return { success: false, error: 'Failed to clone recipe' };
  }
}

/**
 * Get the original recipe that this recipe was cloned from
 * Parses the source field to extract original recipe ID
 */
export async function getOriginalRecipe(recipeId: string): Promise<Recipe | null> {
  try {
    const [recipe] = await db.select().from(recipes).where(eq(recipes.id, recipeId)).limit(1);

    if (!recipe || !recipe.source) {
      return null;
    }

    // Parse source field: "Forked from recipe ID: <uuid>"
    const match = recipe.source.match(/Forked from recipe ID: ([a-f0-9-]+)/i);
    if (!match) {
      return null;
    }

    const originalRecipeId = match[1];
    const [originalRecipe] = await db
      .select()
      .from(recipes)
      .where(eq(recipes.id, originalRecipeId))
      .limit(1);

    return originalRecipe || null;
  } catch (error) {
    console.error('Error fetching original recipe:', error);
    return null;
  }
}

/**
 * Check if current user has cloned a specific recipe
 */
export async function hasUserClonedRecipe(recipeId: string): Promise<boolean> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return false;
    }

    // Check if user has any recipe with source referencing this recipe
    const [clonedRecipe] = await db
      .select()
      .from(recipes)
      .where(sql`${recipes.user_id} = ${userId} AND ${recipes.source} LIKE ${`%${recipeId}%`}`)
      .limit(1);

    return !!clonedRecipe;
  } catch (error) {
    console.error('Error checking clone status:', error);
    return false;
  }
}

/**
 * Get all recipes that were cloned from a specific recipe
 */
export async function getRecipeForks(recipeId: string): Promise<Recipe[]> {
  try {
    const forks = await db
      .select()
      .from(recipes)
      .where(sql`${recipes.source} LIKE ${`%${recipeId}%`}`)
      .orderBy(recipes.created_at);

    return forks;
  } catch (error) {
    console.error('Error fetching recipe forks:', error);
    return [];
  }
}

/**
 * Get fork statistics for a recipe
 */
export async function getForkStats(recipeId: string) {
  try {
    const [recipe] = await db
      .select({
        forkCount: recipes.fork_count,
        name: recipes.name,
      })
      .from(recipes)
      .where(eq(recipes.id, recipeId))
      .limit(1);

    return recipe || { forkCount: 0, name: 'Unknown' };
  } catch (error) {
    console.error('Error fetching fork stats:', error);
    return { forkCount: 0, name: 'Unknown' };
  }
}
