import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/auth-schema';

/**
 * Database reads behind Auth.js sign-in and admin checks — #22.
 *
 * Why: the sign-in gate, the JWT admin refresh and `requireAdmin` all need
 * the same two facts from `users`; one module keeps them in one place and
 * gives tests a single seam to mock.
 * What: thin queries. They never swallow errors — every caller decides how
 * to fail closed.
 * Test: `src/lib/__tests__/auth-callbacks.test.ts`, `src/lib/__tests__/admin-db-check.test.ts`
 */

/** Lower-cases and trims an email; returns null for an empty or missing value. */
export function normalizeEmail(email: string | null | undefined): string | null {
  const trimmed = email?.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

/** Returns the id of the `users` row with this (normalized) email, or null. Throws on DB error. */
export async function findUserIdByEmail(email: string): Promise<string | null> {
  const rows = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  return rows[0]?.id ?? null;
}

/** Sets `users.is_admin = true` for the id. Throws on DB error. */
export async function grantUserAdmin(userId: string): Promise<void> {
  await db.update(users).set({ is_admin: true }).where(eq(users.id, userId));
}

/**
 * Returns `users.is_admin` for the id, or null when no such user exists.
 * Throws on DB error.
 */
export async function getUserAdminFlag(userId: string): Promise<boolean | null> {
  const rows = await db
    .select({ isAdmin: users.is_admin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (rows.length === 0) return null;
  return rows[0].isAdmin === true;
}

/** #103: what the JWT refresh needs about a user; null when no such user exists. */
export interface UserSessionState {
  isAdmin: boolean;
  deletionPending: boolean;
}

/**
 * Returns `is_admin` and whether an account deletion is pending, in one read,
 * or null when no such user exists. Throws on DB error.
 */
export async function getUserSessionState(userId: string): Promise<UserSessionState | null> {
  const rows = await db
    .select({ isAdmin: users.is_admin, deletionRequestedAt: users.deletion_requested_at })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (rows.length === 0) return null;
  return {
    isAdmin: rows[0].isAdmin === true,
    deletionPending: rows[0].deletionRequestedAt !== null,
  };
}

/**
 * #103: returns the id and request time of the user with this (normalized)
 * email when that user has a pending account deletion, else null. Throws on DB error.
 */
export async function findPendingDeletionByEmail(
  email: string
): Promise<{ userId: string; requestedAt: Date } | null> {
  const rows = await db
    .select({ id: users.id, requestedAt: users.deletion_requested_at })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  const row = rows[0];
  if (!row?.requestedAt) return null;
  return { userId: row.id, requestedAt: row.requestedAt };
}
