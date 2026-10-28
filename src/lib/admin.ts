import type { NextResponse } from 'next/server';
import { apiForbidden, apiUnauthorized } from '@/lib/api/responses';
import { auth } from '@/lib/auth';

/**
 * Admin Access Control Utilities
 *
 * Uses Clerk's sessionClaims.metadata.isAdmin for role-based access control
 * Multi-layer security: middleware → server components → server actions
 */

export interface AdminCheckResult {
  isAdmin: boolean;
  userId: string | null;
  sessionClaims: any;
}

/**
 * Check if the current user has admin access
 * @returns Admin status and user information
 */
export async function checkAdminAccess(): Promise<AdminCheckResult> {
  const { sessionClaims, userId } = await auth();
  const metadata = sessionClaims?.metadata as { isAdmin?: string } | undefined;
  const isAdmin = metadata?.isAdmin === 'true';

  return {
    isAdmin,
    userId,
    sessionClaims,
  };
}

/**
 * Require admin access - throws error if not admin
 * Use this in server actions to enforce admin-only operations
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
 * (an unset or empty secret disables the bearer path), else a Clerk session
 * with `metadata.isAdmin === 'true'`. Returns null when authorized, otherwise
 * a JSON 401 (no session, wrong bearer, auth failure) or 403 (signed-in
 * non-admin).
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

/**
 * Simple check if current user is admin (synchronous version for components)
 * NOTE: This is a simplified check - use checkAdminAccess() for full validation
 */
export function isAdmin(userId: string | null): boolean {
  // In production, this should check against a database or Clerk metadata
  // For now, we'll use a simple environment variable check
  const adminUserIds = process.env.ADMIN_USER_IDS?.split(',') || [];
  return userId ? adminUserIds.includes(userId) : false;
}
