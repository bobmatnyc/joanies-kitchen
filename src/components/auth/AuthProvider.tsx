'use client';

import { ClerkProvider, GoogleOneTap } from '@clerk/nextjs';
import type { ReactNode } from 'react';
import { getClerkApiConfig, getClerkDevOptions } from '@/config/clerk-dev';
import { authConfig } from '@/lib/auth-config';

// Check if Clerk is properly configured with valid keys
const isClerkConfigured = authConfig.isConfigured;

export function AuthProvider({ children }: { children: ReactNode }) {
  // Check if we have a publishable key (client-side check)
  // This matches the check in AuthButtons.tsx to prevent mismatch
  const hasPublishableKey =
    authConfig.clerk.publishableKey &&
    authConfig.clerk.publishableKey !== 'YOUR_PUBLISHABLE_KEY' &&
    authConfig.clerk.publishableKey !== '';

  // If Clerk is not configured at all, return children without ClerkProvider
  // This is safe because AuthButtons will render DevelopmentAuthButtons
  if (!isClerkConfigured && !hasPublishableKey) {
    console.log('[AuthProvider] Clerk not configured, skipping authentication');
    return <>{children}</>;
  }

  // If we have a publishable key (even if not fully configured), wrap with ClerkProvider
  // This prevents the "useUser can only be used within <ClerkProvider />" error
  if (!hasPublishableKey) {
    console.warn('[AuthProvider] ClerkProvider skipped: no publishable key available');
    return <>{children}</>;
  }

  // Get development options for production keys on localhost
  const devOptions = getClerkDevOptions();
  const apiConfig = getClerkApiConfig();

  // Determine if we're using production keys in development
  const usingProdKeysInDev = authConfig.features?.productionKeysInDev;

  // Configure Clerk options based on environment
  const clerkOptions: any = {
    publishableKey: authConfig.clerk.publishableKey,
    // Use new Clerk redirect API (not deprecated props)
    signInFallbackRedirectUrl: authConfig.clerk.signInFallbackRedirectUrl,
    signUpFallbackRedirectUrl: authConfig.clerk.signUpFallbackRedirectUrl,
    appearance: {
      elements: {
        formButtonPrimary: 'bg-blue-600 hover:bg-blue-700 text-white',
        card: 'shadow-lg',
      },
    },
    // Add development options when using production keys on localhost
    ...(usingProdKeysInDev
      ? {
          ...devOptions,
          ...apiConfig,
          // Satellite mode configuration for production keys on localhost
          isSatellite: true,
          domain: 'recipes.help',
          // Override the Clerk frontend API URL
          clerkJSUrl: process.env.CLERK_JS_URL,
          // Allow cookies to be set for the production domain
          allowedRedirectOrigins: ['http://localhost:3004', 'https://recipes.help'],
        }
      : {}),
  };

  // Log configuration in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[AuthProvider] Configuration:', {
      publishableKey: `${authConfig.clerk.publishableKey?.substring(0, 20)}...`,
      isClerkConfigured,
      usingProdKeysInDev,
      isSatellite: clerkOptions?.isSatellite || false,
      domain: clerkOptions?.domain || 'default',
    });
  }

  // Always return ClerkProvider when we have a publishable key
  // This ensures all Clerk hooks work correctly
  return (
    <ClerkProvider {...clerkOptions}>
      {!usingProdKeysInDev && <GoogleOneTap cancelOnTapOutside={true} />}
      {children}
    </ClerkProvider>
  );
}
