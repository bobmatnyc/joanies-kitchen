/**
 * #167 (D26): the one favorites store. Server actions, `socialService` and the
 * v1 API (`/favorites*` and the deprecated `/recipes/:id/like`) all call these.
 *
 * Why: likes were written to `recipe_likes` by the API and to `favorites` by the
 * web UI, so the two disagreed and `recipes.like_count` drifted. One store, one
 * set of writers, and every `like_count` change made in the same statement as
 * the row change keeps them consistent.
 * What: user-id keyed add/remove/check/count/list over `favorites`. Callers own
 * authentication and the #41 visibility gate; this module does neither.
 * Test: `src/lib/favorites/__tests__/favorites-core.test.ts`,
 * `src/app/actions/__tests__/favorites-like-count.test.ts`
 */

import { and, count, desc, eq, sql } from 'drizzle-orm';
import { authorNotPendingDeletion } from '@/lib/account-deletion';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { favorites } from '@/lib/db/user-discovery-schema';
import { ensureUserProfileFor, type ProfileIdentity } from '@/lib/ensure-user-profile';
import { type RecipeViewer, recipeVisibilityCondition } from '@/lib/recipe-visibility';

export type Favorite = typeof favorites.$inferSelect;
export type Recipe = typeof recipes.$inferSelect;

export type AddFavoriteResult =
  | { status: 'added'; favorite: Favorite }
  | { status: 'exists' }
  | { status: 'no-profile' }
  // #208: the caller's account has a pending deletion; nothing was written.
  | { status: 'pending-deletion' };

/** #208: the message every caller shows for a `pending-deletion` refusal. */
export const PENDING_DELETION_FAVORITE_ERROR =
  'Your account is scheduled for deletion, so you cannot favorite recipes. Cancel the deletion to favorite again.';

/** #208: thrown by `socialService` when the core answers `pending-deletion`. */
export class FavoritePendingDeletionError extends Error {
  constructor() {
    super(PENDING_DELETION_FAVORITE_ERROR);
    this.name = 'FavoritePendingDeletionError';
  }
}

interface InsertedRow {
  id: string;
  user_id: string;
  recipe_id: string;
  created_at: Date | string | null;
  allowed: boolean;
  added: boolean;
}

/**
 * Why: a favorite needs its owner's profile row (FK), and a repeat add must not
 * count twice. #208: an account with a pending deletion must not add one; the
 * purge locks only the recipes its user had favorited when it started.
 * What: ensures the profile, then inserts the favorite and increments
 * `like_count` in ONE statement; the increment runs only when the insert added
 * a row (`ON CONFLICT DO NOTHING` + EXISTS on its RETURNING). Atomic on
 * neon-http, which cannot branch on an earlier statement inside `db.batch`.
 * #208: the same statement refuses a caller whose `users.deletion_requested_at`
 * is set (ids with no `users` row pass): no row, no `like_count` change.
 * Test: `addFavorite twice increments like_count once`,
 * `favorites-pending-deletion.test.ts`
 */
export async function addFavorite(
  userId: string,
  recipeId: string,
  identity: ProfileIdentity | null = null
): Promise<AddFavoriteResult> {
  if (!(await ensureUserProfileFor(userId, identity))) return { status: 'no-profile' };

  // Targetless ON CONFLICT: matches favorites_unique without naming it.
  // #208: `allowed` is the pending-deletion guard, read in this statement's
  // snapshot, never in a query of its own. It is a plain read of `users` (no row
  // lock), and a refused insert writes nothing, so the FK checks and the
  // like_count UPDATE take no row lock either. The SELECT list needs casts.
  // The final LEFT JOIN always returns one row, so a refusal is told from a repeat.
  const result = await db.execute(sql`
    WITH allowed AS (
      SELECT 1 AS ok WHERE ${authorNotPendingDeletion(userId)}
    ), inserted AS (
      INSERT INTO ${favorites} (user_id, recipe_id)
      SELECT ${userId}::text, ${recipeId}::text FROM allowed
      ON CONFLICT DO NOTHING
      RETURNING id, user_id, recipe_id, created_at
    ), bumped AS (
      UPDATE ${recipes}
      SET like_count = COALESCE(${recipes.like_count}, 0) + 1
      WHERE ${recipes.id} = ${recipeId} AND EXISTS (SELECT 1 FROM inserted)
      RETURNING 1
    )
    SELECT i.id, i.user_id, i.recipe_id, i.created_at,
      EXISTS (SELECT 1 FROM allowed) AS allowed, EXISTS (SELECT 1 FROM inserted) AS added
    FROM (SELECT 1) AS one LEFT JOIN inserted i ON true
  `);

  const row = (result.rows as unknown as InsertedRow[])[0];
  // #208: refused by the guard, told apart from an existing favorite.
  if (!row?.allowed) return { status: 'pending-deletion' };
  if (!row.added) return { status: 'exists' };
  return {
    status: 'added',
    favorite: {
      id: row.id,
      user_id: row.user_id,
      recipe_id: row.recipe_id,
      created_at: (row.created_at === null ? null : new Date(row.created_at)) as Date,
    },
  };
}

/**
 * Why: a repeat or never-favorited remove must not take someone else's count.
 * What: deletes the favorite and decrements `like_count` in ONE statement; the
 * decrement runs only when the DELETE removed a row. Returns whether it did.
 * #208: no pending-deletion guard, as for #197's `deleteRating`: it creates no
 * row and removes only the caller's own favorite, which the purge deletes anyway.
 * Test: `decrements once for a real favorite; a repeat call changes nothing`
 */
export async function removeFavorite(userId: string, recipeId: string): Promise<boolean> {
  const result = await db.execute(sql`
    WITH removed AS (
      DELETE FROM ${favorites}
      WHERE ${favorites.user_id} = ${userId} AND ${favorites.recipe_id} = ${recipeId}
      RETURNING 1
    ), dropped AS (
      UPDATE ${recipes}
      SET like_count = GREATEST(${recipes.like_count} - 1, 0)
      WHERE ${recipes.id} = ${recipeId} AND EXISTS (SELECT 1 FROM removed)
      RETURNING 1
    )
    SELECT count(*)::int AS removed FROM removed
  `);
  const row = (result.rows as unknown as Array<{ removed: number | string }>)[0];
  return Number(row?.removed ?? 0) > 0;
}

/** Whether `userId` has favorited `recipeId`. */
export async function isFavorite(userId: string, recipeId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: favorites.id })
    .from(favorites)
    .where(and(eq(favorites.user_id, userId), eq(favorites.recipe_id, recipeId)))
    .limit(1);
  return !!row;
}

/** Number of users who favorited `recipeId`, counted from `favorites`. */
export async function getFavoriteCount(recipeId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(favorites)
    .where(eq(favorites.recipe_id, recipeId));
  return Number(row?.n ?? 0);
}

/**
 * `userId`'s favorited recipes that `viewer` may read (#41), newest favorite first.
 */
export async function listFavorites(
  userId: string,
  viewer: RecipeViewer
): Promise<Array<{ recipe: Recipe; favoritedAt: Date }>> {
  const rows = await db
    .select({ recipe: recipes, favoritedAt: favorites.created_at })
    .from(favorites)
    .innerJoin(recipes, eq(favorites.recipe_id, recipes.id))
    .where(and(eq(favorites.user_id, userId), recipeVisibilityCondition(viewer)))
    .orderBy(desc(favorites.created_at));
  return rows;
}

/** Recipe ids `userId` has favorited, for quick lookup. */
export async function listFavoriteRecipeIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ recipe_id: favorites.recipe_id })
    .from(favorites)
    .where(eq(favorites.user_id, userId));
  return rows.map((r) => r.recipe_id);
}
