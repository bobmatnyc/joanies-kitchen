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
