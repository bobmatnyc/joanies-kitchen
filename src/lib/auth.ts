import { auth as clerkAuth } from '@clerk/nextjs/server';
import { isClerkConfigured, isAuthEnabled } from './auth-config';

export async function auth() {
  // Check if authentication is enabled
  if (!isAuthEnabled()) {
    // Return mock auth when authentication is disabled
    // This allows the app to work in development without Clerk keys
    // or when ENABLE_DEV_AUTH is not set to true
    return {
      userId: null,
      sessionId: null,
      sessionClaims: null,
      orgId: null,
      orgRole: null,
      orgSlug: null,
    };
  }

  // Properly await the Clerk auth function
  return await clerkAuth();
}