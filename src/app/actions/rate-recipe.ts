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

import { and, desc, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { recipeRatings, recipes } from '@/lib/db/schema';
import { userProfiles } from '@/lib/db/user-discovery-schema';
import { findViewableRecipe, getRecipeViewer } from '@/lib/recipe-visibility';
import { toErrorMessage } from '@/lib/utils/error-handling';

/**
 * #137: one statement derives the recipe's aggregates from `recipe_ratings`, so
 * they cannot drift from the rows. It always rides in the same `db.batch` as the
 * rating write (neon-http has no `db.transaction`; a batch is one HTTP
 * transaction), so the write and the recompute succeed or fail together.
 * An average over zero ratings is NULL; an average of 0 stays 0.
 * Test: `rate-recipe-aggregates.test.ts`
 */
function recomputeRatingAggregates(recipeId: string) {
  return db
    .update(recipes)
    .set({
      avg_user_rating: sql`(SELECT CAST(AVG(${recipeRatings.rating}) AS DECIMAL(2,1)) FROM ${recipeRatings} WHERE ${recipeRatings.recipe_id} = ${recipeId})`,
      total_user_ratings: sql`(SELECT COUNT(*) FROM ${recipeRatings} WHERE ${recipeRatings.recipe_id} = ${recipeId})`,
    })
    .where(eq(recipes.id, recipeId))
    .returning({
      avgUserRating: recipes.avg_user_rating,
      totalUserRatings: recipes.total_user_ratings,
    });
}

/** Postgres returns DECIMAL as a string; NULL (no ratings) stays null, "0.0" becomes 0. */
function toNullableNumber(value: string | number | null | undefined): number | null {
  return value === null || value === undefined ? null : Number(value);
}

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

    // #137: a recipe the caller may not see (private, rejected or soft-deleted
    // and not theirs) answers exactly as a missing one, before any write.
    if (!(await findViewableRecipe(recipeId, await getRecipeViewer()))) {
      return {
        success: false,
        error: 'Recipe not found',
      };
    }

    // #137: upsert and aggregate recompute in one atomic batch.
    const now = new Date();
    const [, recomputed] = await db.batch([
      db
        .insert(recipeRatings)
        .values({
          recipe_id: recipeId,
          user_id: userId,
          rating,
          review: review || null,
          created_at: now,
          updated_at: now,
        })
        .onConflictDoUpdate({
          target: [recipeRatings.recipe_id, recipeRatings.user_id],
          set: { rating, review: review || null, updated_at: now },
        }),
      recomputeRatingAggregates(recipeId),
    ]);

    console.log(`[Rate Recipe] User ${userId} rated recipe ${recipeId}: ${rating}/5`);

    const stats = recomputed[0];
    if (!stats) {
      return { success: false, error: 'Recipe not found' };
    }
    const avgRating = toNullableNumber(stats.avgUserRating) ?? 0;
    const totalRatings = Number(stats.totalUserRatings ?? 0);

    console.log(
      `[Rate Recipe] Updated recipe stats - Avg: ${avgRating.toFixed(1)}, Total: ${totalRatings}`
    );

    // Revalidate the recipe page to show updated ratings
    revalidatePath(`/recipes/${recipeId}`);
    revalidatePath('/recipes');

    return {
      success: true,
      rating,
      avgUserRating: avgRating,
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

    // #137: no rating for a recipe the caller may not see, as for a missing one.
    if (!(await findViewableRecipe(recipeId, await getRecipeViewer()))) {
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
    // #137: a hidden recipe's reviews are as unreadable as a missing recipe's.
    if (!(await findViewableRecipe(recipeId, await getRecipeViewer()))) {
      return [];
    }

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

    // #137: nothing to delete (missing or hidden recipe, no rating): no write, no recompute.
    const [existing] = await db
      .select({ id: recipeRatings.id })
      .from(recipeRatings)
      .where(and(eq(recipeRatings.recipe_id, recipeId), eq(recipeRatings.user_id, userToDelete)))
      .limit(1);
    if (!existing) {
      return { success: true };
    }

    // Delete and recompute in one atomic batch (a concurrent delete only makes the delete a no-op).
    await db.batch([
      db
        .delete(recipeRatings)
        .where(and(eq(recipeRatings.recipe_id, recipeId), eq(recipeRatings.user_id, userToDelete))),
      recomputeRatingAggregates(recipeId),
    ]);

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
