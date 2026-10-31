import type { NextResponse } from 'next/server';
import { apiForbidden, apiUnauthorized } from '@/lib/api/responses';
import { getUserAdminFlag } from '@/lib/auth-users';
import { getSessionUserId } from '@/lib/session-user';

/**
 * Admin Access Control Utilities
 *
 * #22: admin comes from `users.is_admin`, re-read from the database on every
 * check. The JWT copy (session.user.isAdmin) is only used by middleware and
 * UI hints; it can be up to 5 minutes stale.
 * Multi-layer security: middleware → server components → server actions
 */

export interface AdminCheckResult {
  isAdmin: boolean;
  userId: string | null;
}

/**
 * Why: every admin gate must see a revoked admin at once (issue #22 §3).
 * What: resolves the signed-in user id from the session, then reads
 * `users.is_admin`. Signed out, no `users` row, or a DB error all yield
 * `isAdmin: false` — it never throws on a DB error and never trusts the
 * token's own admin flag.
 * Test: `src/lib/__tests__/admin-db-check.test.ts`
 */
export async function checkAdminAccess(): Promise<AdminCheckResult> {
  const userId = await getSessionUserId();
  if (!userId) return { isAdmin: false, userId: null };

  let isAdmin = false;
  try {
    // #22: the database, not the token, decides admin.
    isAdmin = (await getUserAdminFlag(userId)) === true;
  } catch (error) {
    // #22: fail closed on a DB error.
    console.error('[Admin] users.is_admin lookup failed; denying admin:', error);
    isAdmin = false;
  }

  return { isAdmin, userId };
}

/**
 * Require admin access - throws error if not admin
 * Use this in server actions to enforce admin-only operations
 * #22: re-reads users.is_admin on every call via checkAdminAccess().
 * @throws Error if user is not admin
 * @returns User ID if admin check passes
 */
export async function requireAdmin(): Promise<{ userId: string }> {
  const { isAdmin, userId } = await checkAdminAccess();

  if (!isAdmin) {
    throw new Error('Admin access required');
  }

  if (!userId) {
    throw new Error('Authentication required');
  }

  return { userId };
}

/**
 * Why: route handlers that start paid work (#11) must admit only an admin or
 * a trusted machine caller, and must reject before doing any work.
 * What: allows `Authorization: Bearer ${CRON_SECRET}` when CRON_SECRET is set
 * (an unset or empty secret disables the bearer path), else a signed-in user
 * whose `users.is_admin` is true. Returns null when authorized, otherwise
 * a JSON 401 (no session, wrong bearer, auth failure) or 403 (signed-in
 * non-admin, or the admin lookup failed).
 * Test: `src/lib/services/__tests__/paid-routes-auth.test.ts`
 */
export async function authorizeAdminOrCronSecret(request: Request): Promise<NextResponse | null> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return null;

  let access: AdminCheckResult;
  try {
    access = await checkAdminAccess();
  } catch (error) {
    console.error('[Admin] Auth check failed; denying request:', error);
    return apiUnauthorized();
  }
  if (!access.userId) return apiUnauthorized();
  if (!access.isAdmin) return apiForbidden('Admin access required');
  return null;
}

/**
 * Check if a specific user ID has admin access
 * Useful for additional verification in sensitive operations
 */
export async function isUserAdmin(checkUserId: string): Promise<boolean> {
  const { isAdmin, userId } = await checkAdminAccess();
  return isAdmin && userId === checkUserId;
}
