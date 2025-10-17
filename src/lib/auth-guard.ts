/**
 * Authentication Guard Utilities
 *
 * Provides consistent authentication validation across all LLM-powered features
 * and other protected server actions.
 */

import { auth } from '@clerk/nextjs/server';

/**
 * Requires authentication for server actions
 * Throws a user-friendly error if not authenticated
 *
 * @param featureName - Name of the feature requiring auth (for error messages)
 * @returns Object containing the authenticated userId
 * @throws Error if user is not authenticated
 *
 * @example
 * export async function generateRecipe() {
 *   const { userId } = await requireAuth('AI recipe generation');
 *   // ... rest of implementation
 * }
 */
export async function requireAuth(featureName: string = 'this feature') {
  const { userId } = await auth();

  if (!userId) {
    throw new Error(`Authentication required. Please sign in to use ${featureName}.`);
  }

  return { userId };
}

/**
 * Checks authentication without throwing an error
 * Useful for optional authentication or checking auth status
 *
 * @returns Object containing userId (or null if not authenticated) and isAuthenticated flag
 *
 * @example
 * export async function getRecipes() {
 *   const { userId, isAuthenticated } = await checkAuth();
 *   if (isAuthenticated) {
 *     // Include private recipes
 *   }
 * }
 */
export async function checkAuth() {
  const { userId } = await auth();

  return {
    userId: userId || null,
    isAuthenticated: !!userId,
  };
}

/**
 * Error class for authentication-related errors
 * Allows for better error handling in client components
 */
export class AuthenticationError extends Error {
  constructor(featureName: string = 'this feature') {
    super(`Authentication required. Please sign in to use ${featureName}.`);
    this.name = 'AuthenticationError';
  }
}

/**
 * Type guard to check if an error is an authentication error
 *
 * @example
 * try {
 *   await generateRecipe();
 * } catch (error) {
 *   if (isAuthError(error)) {
 *     // Show sign-in prompt
 *   }
 * }
 */
export function isAuthError(error: unknown): error is AuthenticationError {
  return (
    error instanceof AuthenticationError ||
    (error instanceof Error && error.message.includes('Authentication required'))
  );
}
