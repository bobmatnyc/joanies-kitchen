/**
 * #141: the statements every rating write shares. Server-internal, deliberately
 * NOT 'use server': `rateRecipe` / `deleteRating` and the account purge build
 * their `db.batch` from these.
 *
 * Why: `recipes.avg_user_rating` and `recipes.total_user_ratings` are a cache of
 * `recipe_ratings`. Two concurrent rating batches used to recompute from
 * snapshots that each missed the other's rating, leaving the cache one stale.
 * What: a rating write is one `db.batch` (one transaction on neon-http): lock
 * the recipe row with `lockRecipeForRating`, write `recipe_ratings`, then set
 * the aggregates from `ratingAggregateColumns`. The lock queues the second
 * writer before its write, so under READ COMMITTED its later statements see the
 * first writer's committed rating. The recompute reads the table, never applies
 * a delta, so each write also corrects an aggregate that had drifted before.
 * Test: `src/app/actions/__tests__/rate-recipe-aggregates.test.ts`,
 * `src/app/actions/__tests__/rate-recipe-lock-order.test.ts`,
 * `src/lib/account-purge/__tests__/account-purge.test.ts`
 */

import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';

/**
 * #141: the first statement of a rating batch. FOR NO KEY UPDATE, the mode the
 * aggregate UPDATE takes itself (it changes no key column): it conflicts with
 * itself (rating writers on one recipe queue), with #174's recipes FOR UPDATE
 * and with #189's FOR NO KEY UPDATE, so those queue too. It does not conflict
 * with the FOR KEY SHARE an FK check takes, so inserts of rows that reference
 * the recipe (ratings, favorites, chef links) are not blocked by a rating.
 */
export function lockRecipeForRating(recipeId: string) {
  return db
    .select({ id: recipes.id })
    .from(recipes)
    .where(eq(recipes.id, recipeId))
    .for('no key update');
}

/**
 * #141: `set()` values that derive a recipes row's aggregates from
 * `recipe_ratings`, correlated to the row being updated. `excludeUserId` leaves
 * that user's ratings out, for a statement whose own snapshot still holds the
 * ratings it deletes (the purge's DELETE … RETURNING CTE). An average over zero
 * ratings is NULL; an average of 0 stays 0.
 */
export function ratingAggregateColumns(excludeUserId?: string) {
  // Raw column names: drizzle renders bare names inside an UPDATE's SET.
  const others = excludeUserId ? sql` AND rr."user_id" <> ${excludeUserId}` : sql``;
  return {
    avg_user_rating: sql`(SELECT CAST(AVG(rr."rating") AS DECIMAL(2,1)) FROM "recipe_ratings" rr WHERE rr."recipe_id" = "recipes"."id"${others})`,
    total_user_ratings: sql`(SELECT COUNT(*) FROM "recipe_ratings" rr WHERE rr."recipe_id" = "recipes"."id"${others})`,
  };
}
