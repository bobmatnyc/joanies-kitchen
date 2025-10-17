/**
 * Client-Safe Admin Utilities
 *
 * These functions can be safely imported in client components
 * They do not use server-only Clerk auth functions
 */

/**
 * Simple client-side check if current user is admin
 * This is a basic check - full validation happens server-side
 *
 * @param userId - Clerk user ID
 * @returns True if user ID is in admin list
 */
export function isAdmin(userId: string | null | undefined): boolean {
  if (!userId) return false;

  // In production, this should check against Clerk metadata
  // This is just a client-side hint - server validates properly
  const adminUserIds = process.env.NEXT_PUBLIC_ADMIN_USER_IDS?.split(',') || [];
  return adminUserIds.includes(userId);
}

/**
 * Check if admin features should be shown
 * This is for UI display only - server actions validate properly
 */
export function showAdminFeatures(userId: string | null | undefined): boolean {
  return isAdmin(userId);
}
