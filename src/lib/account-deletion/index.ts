import { type AnyColumn, and, eq, isNull, type SQL, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/auth-schema';
import { recipes } from '@/lib/db/schema';
import { userProfiles } from '@/lib/db/user-discovery-schema';

/**
 * Account soft delete with a 30-day grace period — #103 (D7c S4).
 *
 * Why: a deletion must be undoable for 30 days (mistakes, account takeover),
 * so nothing is destroyed here; the purge is S5.
 * What: `markAccountDeleted` and `restoreAccount` each run as one `db.batch`
 * (one atomic HTTP transaction on neon-http), so a failure leaves no partial
 * state. Every statement is scoped so it touches only rows this flow owns:
 * - recipes: hidden with `deleted_by = 'account-deletion:<uid>'`, only where
 *   `deleted_at IS NULL`; restore clears only rows carrying that marker, so a
 *   recipe an admin deleted before the request stays deleted.
 * - profile: `is_public` is flipped to false only when it was true, and that
 *   row's `updated_at` is set to the exact request timestamp. Restore sets
 *   `is_public = true` only where `is_public = false AND updated_at =
 *   deletion_requested_at`, so a profile that was already private stays
 *   private. If anything else touched the row meanwhile, it stays private
 *   (the safe direction).
 * - comments: not written; `authorNotPendingDeletion` filters them on read.
 * Test: `src/lib/account-deletion/__tests__/account-deletion.test.ts`
 */

/** Grace period between the request and the purge; undo is possible inside it. */
export const DELETION_GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

/** `recipes.deleted_by` marker for recipes hidden by this user's deletion request. */
export function accountDeletionMarker(userId: string): string {
  return `account-deletion:${userId}`;
}

/** True while `requestedAt` is inside the grace period at `now`. */
export function isWithinGracePeriod(requestedAt: Date, now = Date.now()): boolean {
  return now - requestedAt.getTime() < DELETION_GRACE_PERIOD_MS;
}

/**
 * SQL condition: the row's author has no pending account deletion. Authors
 * with no `users` row (legacy ids) pass. #197: also takes a user id value, so
 * a write can carry the check in its own statement.
 */
export function authorNotPendingDeletion(userId: AnyColumn | string): SQL {
  return sql`NOT EXISTS (SELECT 1 FROM ${users} WHERE ${users.id} = ${userId} AND ${users.deletion_requested_at} IS NOT NULL)`;
}

/**
 * Records the request and hides the user's recipes and profile, atomically.
 * Rejects when the batch fails. The users update is guarded by
 * `deletion_requested_at IS NULL`, so a repeat request keeps the first time.
 */
export async function markAccountDeleted(
  userId: string,
  keepRecipes: boolean,
  now: Date
): Promise<void> {
  await db.batch([
    db
      .update(users)
      .set({ deletion_requested_at: now, deletion_keep_recipes: keepRecipes })
      .where(and(eq(users.id, userId), isNull(users.deletion_requested_at))),
    db
      .update(recipes)
      .set({ deleted_at: now, deleted_by: accountDeletionMarker(userId) })
      .where(and(eq(recipes.user_id, userId), isNull(recipes.deleted_at))),
    db
      .update(userProfiles)
      .set({ is_public: false, updated_at: now })
      .where(and(eq(userProfiles.user_id, userId), eq(userProfiles.is_public, true))),
  ]);
}

/**
 * Reverses `markAccountDeleted` for the request made at `requestedAt`,
 * atomically. Rejects when the batch fails.
 */
export async function restoreAccount(userId: string, requestedAt: Date): Promise<void> {
  await db.batch([
    db
      .update(userProfiles)
      .set({ is_public: true, updated_at: new Date() })
      .where(
        and(
          eq(userProfiles.user_id, userId),
          eq(userProfiles.is_public, false),
          eq(userProfiles.updated_at, requestedAt)
        )
      ),
    db
      .update(recipes)
      .set({ deleted_at: null, deleted_by: null })
      .where(
        and(eq(recipes.user_id, userId), eq(recipes.deleted_by, accountDeletionMarker(userId)))
      ),
    db
      .update(users)
      .set({ deletion_requested_at: null, deletion_keep_recipes: null })
      .where(and(eq(users.id, userId), eq(users.deletion_requested_at, requestedAt))),
  ]);
}
