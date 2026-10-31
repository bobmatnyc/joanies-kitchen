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

import { and, desc, eq, exists, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { authorNotPendingDeletion } from '@/lib/account-deletion';
import { db } from '@/lib/db';
import { recipeRatings, recipes } from '@/lib/db/schema';
import { userProfiles } from '@/lib/db/user-discovery-schema';
import { lockRecipeForRating, ratingAggregateColumns } from '@/lib/recipe-rating-aggregates';
import { findViewableRecipe, getRecipeViewer } from '@/lib/recipe-visibility';
import { getSessionUserId } from '@/lib/session-user';
import { toErrorMessage } from '@/lib/utils/error-handling';

/**
 * #137: one statement derives the recipe's aggregates from `recipe_ratings`. It
 * always rides in the same `db.batch` as the rating write (neon-http has no
 * `db.transaction`; a batch is one HTTP transaction), so the write and the
 * recompute succeed or fail together.
 * #141: the batch opens with `lockRecipeForRating`, so concurrent rating writes
 * on one recipe run one after the other and each recompute sees every committed
 * rating. The stored aggregates then match `recipe_ratings` after every rating
 * write, and a write also repairs an aggregate that was stale before it.
 * #197: `writtenAt` limits the recompute to a batch whose rating write landed:
 * it runs only when the caller's rating row carries this batch's `updated_at`.
 * Test: `rate-recipe-aggregates.test.ts`, `rate-recipe-lock-order.test.ts`,
 * `rate-recipe-pending-deletion.test.ts`
 */
function recomputeRatingAggregates(recipeId: string, writtenAt?: { userId: string; at: Date }) {
  // #197: tied to the write itself, not to a second read of the deletion flag,
  // so a flag change between the batch's statements cannot split write and recompute.
  const written = writtenAt
    ? exists(
        db
          .select({ one: sql`1` })
          .from(recipeRatings)
          .where(
            and(
              eq(recipeRatings.recipe_id, recipeId),
              eq(recipeRatings.user_id, writtenAt.userId),
              eq(recipeRatings.updated_at, writtenAt.at)
            )
          )
      )
    : undefined;
  return db
    .update(recipes)
    .set(ratingAggregateColumns())
    .where(and(eq(recipes.id, recipeId), written))
    .returning({
      avgUserRating: recipes.avg_user_rating,
      totalUserRatings: recipes.total_user_ratings,
    });
}

/**
 * #197: the rating upsert, refused in its own statement when the rater's
 * account has a pending deletion. `INSERT … SELECT … FROM recipes WHERE id = $r
 * AND NOT EXISTS (pending deletion)`: a refused write selects no row, so it
 * inserts and updates nothing, takes no row lock and RETURNING is empty.
 * The parameters carry casts because a SELECT list gives them no column type.
 */
function upsertRatingUnlessPendingDeletion(
  recipeId: string,
  userId: string,
  rating: number,
  review: string | null,
  now: Date
) {
  const at = sql`${sql.param(now, recipeRatings.updated_at)}::timestamp`;
  return db
    .insert(recipeRatings)
    .select(
      db
        .select({
          id: sql`gen_random_uuid()`.as('id'),
          recipe_id: recipes.id,
          user_id: sql`${userId}::text`.as('user_id'),
          rating: sql`${rating}::integer`.as('rating'),
          review: sql`${review}::text`.as('review'),
          created_at: at.as('created_at'),
          updated_at: at.as('updated_at'),
        })
        .from(recipes)
        .where(and(eq(recipes.id, recipeId), authorNotPendingDeletion(userId)))
    )
    .onConflictDoUpdate({
      target: [recipeRatings.recipe_id, recipeRatings.user_id],
      set: { rating, review, updated_at: now },
    })
    .returning({ id: recipeRatings.id });
}

/** #197: the refusal `rateRecipe` returns for an account with a pending deletion. */
const PENDING_DELETION_ERROR =
  'Your account is scheduled for deletion, so you cannot rate recipes. Cancel the deletion to rate again.';

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
    const userId = await getSessionUserId();

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
    const [locked, written, recomputed] = await db.batch([
      // #141: lock the recipe row (FOR NO KEY UPDATE) first, so concurrent raters queue.
      lockRecipeForRating(recipeId),
      // #197: the pending-deletion check rides in the write statement, not a prior query.
      upsertRatingUnlessPendingDeletion(recipeId, userId, rating, review || null, now),
      // #197: a no-op unless the write above landed.
      recomputeRatingAggregates(recipeId, { userId, at: now }),
    ]);

    if (locked.length === 0) {
      return { success: false, error: 'Recipe not found' };
    }
    // #197: an empty RETURNING on an existing recipe means the guard refused the write.
    if (written.length === 0) {
      return { success: false, error: PENDING_DELETION_ERROR };
    }

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
    const userId = await getSessionUserId();

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
    const userId = await getSessionUserId();

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
    // #197: no pending-deletion guard here. A delete creates no row and only
    // removes the caller's own rating, which the purge would delete anyway.
    await db.batch([
      // #141: lock the recipe row (FOR NO KEY UPDATE) first, so a concurrent rate/delete queues.
      lockRecipeForRating(recipeId),
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
