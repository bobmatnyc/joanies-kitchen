/**
 * API Authorization Helper Utilities
 *
 * Utilities for checking resource ownership and authorization.
 * Eliminates duplicate ownership verification code across API endpoints.
 *
 * @module lib/api/auth-helpers
 */

import type { NextResponse } from 'next/server';
import type { AuthContext } from '@/lib/api-auth/types';
import { apiForbidden, apiNotFound } from './responses';

// ============================================================================
// OWNERSHIP VERIFICATION
// ============================================================================

/**
 * Check if user owns a resource or is an admin
 *
 * Verifies that the authenticated user either owns the resource or has admin privileges.
 * Returns success if authorized, error response otherwise.
 *
 * @param resourceUserId - User ID associated with the resource
 * @param auth - Authentication context
 * @param resourceType - Human-readable resource type for error messages (default: 'resource')
 * @returns Object indicating authorization status or error response
 *
 * @example
 * ```typescript
 * const existingRecipe = await getRecipe(id);
 * const ownershipCheck = requireOwnership(existingRecipe.user_id, auth, 'recipe');
 * if ('error' in ownershipCheck) return ownershipCheck.error;
 *
 * // User is authorized to access this recipe
 * ```
 */
export function requireOwnership(
  resourceUserId: string,
  auth: AuthContext,
  resourceType: string = 'resource'
): { authorized: true } | { error: NextResponse } {
  // User owns the resource
  if (resourceUserId === auth.userId) {
    return { authorized: true };
  }

  // User is admin (has override privileges)
  if (auth.metadata?.isAdmin === true) {
    return { authorized: true };
  }

  // Access denied
  return {
    error: apiForbidden(`You do not have permission to access this ${resourceType}`),
  };
}

/**
 * Check if user is an admin
 *
 * Verifies admin status from authentication context metadata.
 *
 * @param auth - Authentication context
 * @returns Object indicating authorization status or error response
 *
 * @example
 * ```typescript
 * const adminCheck = requireAdmin(auth);
 * if ('error' in adminCheck) return adminCheck.error;
 *
 * // User is admin
 * ```
 */
export function requireAdmin(auth: AuthContext): { authorized: true } | { error: NextResponse } {
  if (auth.metadata?.isAdmin === true) {
    return { authorized: true };
  }

  return {
    error: apiForbidden('Admin access required'),
  };
}

/**
 * Verify resource ownership (combined null check + ownership check)
 *
 * Checks both that the resource exists and that the user owns it (or is admin).
 * This is the most common pattern for PATCH/DELETE endpoints.
 *
 * @param resource - Resource object with user_id property (or null if not found)
 * @param auth - Authentication context
 * @param resourceType - Human-readable resource type for error messages (default: 'resource')
 * @returns Object with validated resource or error response
 *
 * @example
 * ```typescript
 * export const PATCH = requireScopes([SCOPES.WRITE_RECIPES], async (request, auth, context) => {
 *   const params = await getRouteParams(context);
 *   const existingRecipe = await getRecipe(params.id);
 *
 *   if (!existingRecipe.success) {
 *     return apiError(existingRecipe.error || 'Recipe not found', 404);
 *   }
 *
 *   const ownershipCheck = verifyResourceOwnership(existingRecipe.data, auth, 'recipe');
 *   if ('error' in ownershipCheck) return ownershipCheck.error;
 *
 *   // User owns the recipe, proceed with update
 *   const { resource: recipe } = ownershipCheck;
 * });
 * ```
 */
export function verifyResourceOwnership<T extends { user_id: string }>(
  resource: T | null | undefined,
  auth: AuthContext,
  resourceType: string = 'resource'
): { resource: T } | { error: NextResponse } {
  // Check if resource exists
  if (!resource) {
    return { error: apiNotFound(resourceType) };
  }

  // Check ownership
  const ownershipCheck = requireOwnership(resource.user_id, auth, resourceType);
  if ('error' in ownershipCheck) {
    return ownershipCheck;
  }

  return { resource };
}

// ============================================================================
// SCOPE UTILITIES
// ============================================================================

/**
 * Check if auth context has all required scopes
 *
 * Utility for custom scope checking beyond the built-in requireScopes middleware.
 *
 * @param auth - Authentication context
 * @param requiredScopes - Array of scope strings that are required
 * @returns Boolean indicating if all scopes are present
 *
 * @example
 * ```typescript
 * if (!hasScopes(auth, ['read:recipes', 'write:recipes'])) {
 *   return apiForbidden('Insufficient permissions');
 * }
 * ```
 */
export function hasScopes(auth: AuthContext, requiredScopes: string[]): boolean {
  return requiredScopes.every((scope) => auth.scopes.includes(scope));
}

/**
 * Check if auth context has any of the specified scopes
 *
 * @param auth - Authentication context
 * @param scopes - Array of scope strings (user needs at least one)
 * @returns Boolean indicating if at least one scope is present
 *
 * @example
 * ```typescript
 * if (!hasAnyScope(auth, ['admin:all', 'admin:users'])) {
 *   return apiForbidden('Admin access required');
 * }
 * ```
 */
export function hasAnyScope(auth: AuthContext, scopes: string[]): boolean {
  return scopes.some((scope) => auth.scopes.includes(scope));
}
