/**
 * Server Actions for Recipe Ratings
 *
 * Handles user ratings and reviews for recipes:
 * - Rate a recipe (0-5 stars)
 * - Add optional review text
 * - Update existing rating
 * - Retrieve user's rating for a recipe
 * - Automatically recalculate average ratings
 */

'use server';

import { auth } from '@clerk/nextjs/server';
import { and, count, desc, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { recipeRatings, recipes } from '@/lib/db/schema';
import { userProfiles } from '@/lib/db/user-discovery-schema';
import { toErrorMessage } from '@/lib/utils/error-handling';

export interface RateRecipeResult {
  success: boolean;
  error?: string;
  rating?: number;
  avgUserRating?: number;
  totalRatings?: number;
}

/**
 * Rate a recipe (insert new rating or update existing)
 *
 * @param recipeId - Recipe ID to rate
 * @param rating - Rating value (0-5)
 * @param review - Optional review text
 * @returns Result with success status and updated statistics
 */
export async function rateRecipe(
  recipeId: string,
  rating: number,
  review?: string
): Promise<RateRecipeResult> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return {
        success: false,
        error: 'You must be logged in to rate recipes',
      };
    }

    // Validate rating
    if (!Number.isInteger(rating) || rating < 0 || rating > 5) {
      return {
        success: false,
        error: 'Rating must be an integer between 0 and 5',
      };
    }

    // Verify recipe exists
    const recipe = await db
      .select({ id: recipes.id })
      .from(recipes)
      .where(eq(recipes.id, recipeId))
      .limit(1);

    if (recipe.length === 0) {
      return {
        success: false,
        error: 'Recipe not found',
      };
    }

    // Upsert rating (insert or update if exists)
    await db
      .insert(recipeRatings)
      .values({
        recipe_id: recipeId,
        user_id: userId,
        rating,
        review: review || null,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .onConflictDoUpdate({
        target: [recipeRatings.recipe_id, recipeRatings.user_id],
        set: {
          rating,
          review: review || null,
          updated_at: new Date(),
        },
      });

    console.log(`[Rate Recipe] User ${userId} rated recipe ${recipeId}: ${rating}/5`);

    // Recalculate average rating and count
    const stats = await db
      .select({
        avgRating: sql<number>`CAST(AVG(${recipeRatings.rating}) AS DECIMAL(2,1))`,
        totalRatings: count(recipeRatings.id),
      })
      .from(recipeRatings)
      .where(eq(recipeRatings.recipe_id, recipeId));

    const avgRating = stats[0]?.avgRating || 0;
    const totalRatings = stats[0]?.totalRatings || 0;

    // Update recipe with new averages
    await db
      .update(recipes)
      .set({
        avg_user_rating: avgRating.toFixed(1),
        total_user_ratings: totalRatings,
      })
      .where(eq(recipes.id, recipeId));

    console.log(
      `[Rate Recipe] Updated recipe stats - Avg: ${avgRating.toFixed(1)}, Total: ${totalRatings}`
    );

    // Revalidate the recipe page to show updated ratings
    revalidatePath(`/recipes/${recipeId}`);
    revalidatePath('/recipes');

    return {
      success: true,
      rating,
      avgUserRating: parseFloat(avgRating.toFixed(1)),
      totalRatings,
    };
  } catch (error: unknown) {
    console.error('[Rate Recipe] Error:', error);
    return {
      success: false,
      error: toErrorMessage(error),
    };
  }
}

/**
 * Get the current user's rating for a recipe
 *
 * @param recipeId - Recipe ID to check
 * @returns User's rating or null if not rated
 */
export async function getUserRating(recipeId: string): Promise<{
  rating: number;
  review?: string;
  createdAt?: Date;
  updatedAt?: Date;
} | null> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return null;
    }

    const userRating = await db
      .select()
      .from(recipeRatings)
      .where(and(eq(recipeRatings.recipe_id, recipeId), eq(recipeRatings.user_id, userId)))
      .limit(1);

    if (userRating.length === 0) {
      return null;
    }

    return {
      rating: userRating[0].rating,
      review: userRating[0].review || undefined,
      createdAt: userRating[0].created_at || undefined,
      updatedAt: userRating[0].updated_at || undefined,
    };
  } catch (error: unknown) {
    console.error('[Get User Rating] Error:', error);
    return null;
  }
}

/**
 * Get all ratings for a recipe with user profile data (for display)
 *
 * @param recipeId - Recipe ID
 * @param limit - Max number of ratings to return
 * @param offset - Number of ratings to skip (for pagination)
 * @returns Array of ratings with user info
 */
export async function getRecipeRatings(
  recipeId: string,
  limit: number = 10,
  offset: number = 0
): Promise<
  {
    id: string;
    userId: string;
    rating: number;
    review: string | null;
    createdAt: Date;
    updatedAt: Date;
    userName: string;
    userAvatar?: string;
  }[]
> {
  try {
    // Get ratings with left join to user profiles for display names
    const ratingsWithProfiles = await db
      .select({
        id: recipeRatings.id,
        userId: recipeRatings.user_id,
        rating: recipeRatings.rating,
        review: recipeRatings.review,
        createdAt: recipeRatings.created_at,
        updatedAt: recipeRatings.updated_at,
        displayName: userProfiles.display_name,
        avatar: userProfiles.profile_image_url,
      })
      .from(recipeRatings)
      .leftJoin(userProfiles, eq(recipeRatings.user_id, userProfiles.user_id))
      .where(eq(recipeRatings.recipe_id, recipeId))
      .orderBy(desc(recipeRatings.created_at))
      .limit(limit)
      .offset(offset);

    return ratingsWithProfiles.map((r) => ({
      id: r.id,
      userId: r.userId,
      rating: r.rating,
      review: r.review,
      createdAt: r.createdAt || new Date(),
      updatedAt: r.updatedAt || new Date(),
      userName: r.displayName || 'Anonymous User',
      userAvatar: r.avatar || undefined,
    }));
  } catch (error: unknown) {
    console.error('[Get Recipe Ratings] Error:', error);
    return [];
  }
}

/**
 * Delete a user's rating (admin or own rating)
 *
 * @param recipeId - Recipe ID
 * @param targetUserId - User ID to delete (optional, defaults to current user)
 * @returns Success status
 */
export async function deleteRating(
  recipeId: string,
  targetUserId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return {
        success: false,
        error: 'You must be logged in',
      };
    }

    // If no target specified, delete own rating
    const userToDelete = targetUserId || userId;

    // Only allow deleting own rating (could add admin check here)
    if (userToDelete !== userId) {
      return {
        success: false,
        error: 'You can only delete your own rating',
      };
    }

    // Delete the rating
    await db
      .delete(recipeRatings)
      .where(and(eq(recipeRatings.recipe_id, recipeId), eq(recipeRatings.user_id, userToDelete)));

    // Recalculate average
    const stats = await db
      .select({
        avgRating: sql<number>`CAST(AVG(${recipeRatings.rating}) AS DECIMAL(2,1))`,
        totalRatings: count(recipeRatings.id),
      })
      .from(recipeRatings)
      .where(eq(recipeRatings.recipe_id, recipeId));

    const avgRating = stats[0]?.avgRating || null;
    const totalRatings = stats[0]?.totalRatings || 0;

    // Update recipe
    await db
      .update(recipes)
      .set({
        avg_user_rating: avgRating ? avgRating.toFixed(1) : null,
        total_user_ratings: totalRatings,
      })
      .where(eq(recipes.id, recipeId));

    console.log(`[Delete Rating] Deleted rating for recipe ${recipeId}`);

    revalidatePath(`/recipes/${recipeId}`);
    revalidatePath('/recipes');

    return { success: true };
  } catch (error: unknown) {
    console.error('[Delete Rating] Error:', error);
    return {
      success: false,
      error: toErrorMessage(error),
    };
  }
}
