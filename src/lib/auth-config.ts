/**
 * Centralized authentication configuration
 * This module provides a single source of truth for authentication settings
 * Supports dual-environment setup: localhost development and production
 * Enhanced to support production keys on localhost for development
 */

import { getClerkKeys, shouldUseProductionKeysOverride } from '@/config/clerk-dev';

/**
 * Environment detection utilities
 */
export function isProduction(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production' ||
    process.env.NEXT_PUBLIC_APP_URL?.includes('recipes.help') ||
    (typeof window !== 'undefined' && window.location.hostname === 'recipes.help')
  );
}

export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

export function isLocalhost(): boolean {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.includes('localhost') ||
    (typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
  );
}

/**
 * Environment-specific Clerk keys configuration
 * Automatically selects the correct keys based on the current environment
 * Now supports using production keys on localhost when configured
 */
function getEnvironmentSpecificKeys(): {
  publishableKey: string | undefined;
  secretKey: string | undefined;
  environment: 'development' | 'production';
  usingProductionKeys: boolean;
} {
  const isProd = isProduction();

  // Check if we should use production keys override in development
  if (shouldUseProductionKeysOverride()) {
    const keys = getClerkKeys();
    return {
      publishableKey: keys.publishableKey,
      secretKey: keys.secretKey,
      environment: 'development',
      usingProductionKeys: true,
    };
  }

  if (isProd) {
    // Production environment - use live keys for recipes.help
    // Vercel deployments should use the non-suffixed variables (NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY)
    // which should be set to production keys (pk_live_, sk_live_) in Vercel dashboard
    const publishableKey =
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY_PROD ||
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    const secretKey = process.env.CLERK_SECRET_KEY_PROD || process.env.CLERK_SECRET_KEY;

    return {
      publishableKey,
      secretKey,
      environment: 'production',
      usingProductionKeys: true,
    };
  } else {
    // Development environment - use test keys for localhost
    // But allow production keys if explicitly set
    const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    const secretKey = process.env.CLERK_SECRET_KEY;

    // Check if production keys are being used in development
    const isUsingProdKeys =
      publishableKey?.startsWith('pk_live_') && secretKey?.startsWith('sk_live_');

    if (isUsingProdKeys && process.env.ALLOW_PRODUCTION_KEYS_IN_DEV === 'true') {
      return {
        publishableKey,
        secretKey,
        environment: 'development',
        usingProductionKeys: true,
      };
    }

    // Default to test keys for development
    return {
      publishableKey:
        process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY_DEV ||
        (publishableKey?.startsWith('pk_test_') ? publishableKey : undefined),
      secretKey:
        process.env.CLERK_SECRET_KEY_DEV ||
        (secretKey?.startsWith('sk_test_') ? secretKey : undefined),
      environment: 'development',
      usingProductionKeys: false,
    };
  }
}

/**
 * Check if Clerk authentication keys are properly configured for the current environment
 */
export function isClerkConfigured(): boolean {
  const { publishableKey, secretKey } = getEnvironmentSpecificKeys();

  const hasPublishableKey =
    !!publishableKey &&
    publishableKey !== 'YOUR_PUBLISHABLE_KEY' &&
    publishableKey !== 'pk_test_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX' &&
    publishableKey !== 'pk_live_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

  const hasSecretKey =
    !!secretKey &&
    secretKey !== 'YOUR_SECRET_KEY' &&
    secretKey !== 'sk_test_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX' &&
    secretKey !== 'sk_live_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

  return hasPublishableKey && hasSecretKey;
}

/**
 * Check if authentication should be enabled
 * Authentication is enabled when:
 * 1. Clerk keys are properly configured
 * 2. We're either in production OR explicitly testing auth in development
 */
export function isAuthEnabled(): boolean {
  // If Clerk is not configured, auth is disabled
  if (!isClerkConfigured()) {
    return false;
  }

  // If we're in production, always enable auth when configured
  if (isProduction()) {
    return true;
  }

  // In development, enable auth if explicitly requested via env var
  // This allows developers to test auth locally when needed
  const enableDevAuth = process.env.ENABLE_DEV_AUTH === 'true';

  return enableDevAuth;
}

/**
 * Get the base URL for the application
 */
export function getAppUrl(): string {
  // Use configured URL if available
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  // In production, use Vercel URL if available
  if (isProduction() && process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // Default to localhost:3002 in development
  return 'http://localhost:3002';
}

/**
 * Authentication configuration object
 * Dynamically configures Clerk based on environment
 * Enhanced to support production keys on localhost
 */
export const authConfig = (() => {
  const { publishableKey, secretKey, environment, usingProductionKeys } =
    getEnvironmentSpecificKeys();
  const isProd = isProduction();
  const isConfigured = isClerkConfigured();
  const isEnabled = isAuthEnabled();

  return {
    isConfigured,
    isEnabled,
    isProduction: isProd,
    isDevelopment: isDevelopment(),
    isLocalhost: isLocalhost(),
    environment,
    appUrl: getAppUrl(),
    usingProductionKeys,

    // Clerk-specific configuration with environment-aware keys
    clerk: {
      publishableKey,
      secretKey,
      signInUrl: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || '/sign-in',
      signUpUrl: process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL || '/sign-up',
      // Updated to use current Clerk API (signInFallbackRedirectUrl replaces afterSignInUrl)
      signInFallbackRedirectUrl: process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL || '/',
      signUpFallbackRedirectUrl: process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL || '/',
      // Domain configuration for production keys on localhost
      domain: usingProductionKeys && !isProd ? 'recipes.help' : undefined,
      isSatellite: usingProductionKeys && !isProd,
    },

    // Security settings
    security: {
      requireAuth: isProd && isConfigured,
      allowGuestAccess: !isProd || !isConfigured,
      enforceHttps: isProd && !usingProductionKeys, // Don't enforce HTTPS when testing prod keys locally
      enableCsrf: isProd,
    },

    // Environment-specific settings
    features: {
      allowDevAuth: process.env.ENABLE_DEV_AUTH === 'true',
      mockAuth: isDevelopment() && !isConfigured,
      strictDomainCheck: isProd && !usingProductionKeys, // Disable strict domain check when using prod keys in dev
      productionKeysInDev: usingProductionKeys && !isProd,
    },
  };
})();

/**
 * Validate authentication configuration at runtime
 */
export function validateAuthConfig(): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if keys look like placeholders
  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.includes('XXXX')) {
    warnings.push('Clerk publishable key appears to be a placeholder');
  }

  if (process.env.CLERK_SECRET_KEY?.includes('XXXX')) {
    warnings.push('Clerk secret key appears to be a placeholder');
  }

  const { publishableKey, secretKey, environment } = getEnvironmentSpecificKeys();

  // Check key format
  if (publishableKey && !publishableKey.startsWith('pk_')) {
    errors.push('Invalid Clerk publishable key format (should start with pk_)');
  }

  if (secretKey && !secretKey.startsWith('sk_')) {
    errors.push('Invalid Clerk secret key format (should start with sk_)');
  }

  // Check for environment-specific key validation
  if (isClerkConfigured()) {
    const pubKeyEnv = publishableKey?.includes('pk_test') ? 'test' : 'live';
    const secKeyEnv = secretKey?.includes('sk_test') ? 'test' : 'live';

    if (pubKeyEnv !== secKeyEnv) {
      errors.push(
        `Clerk key environment mismatch: publishable key is ${pubKeyEnv}, secret key is ${secKeyEnv}`
      );
    }

    // Validate production keys are used in production
    if (isProduction() && pubKeyEnv === 'test') {
      errors.push(
        'Production environment detected but using test keys. Use live keys for production.'
      );
    }

    // Validate development keys are used in development
    if (isDevelopment() && pubKeyEnv === 'live' && !process.env.ALLOW_LIVE_KEYS_IN_DEV) {
      warnings.push(
        'Development environment using live keys. Consider using test keys for development.'
      );
    }
  }

  // Warn about production without auth
  if (isProduction() && !isClerkConfigured()) {
    warnings.push('Running in production without authentication configured');
  }

  // Check APP_URL configuration
  if (!process.env.NEXT_PUBLIC_APP_URL && isProduction()) {
    warnings.push('NEXT_PUBLIC_APP_URL not set in production');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Log authentication configuration status (for debugging)
 */
export function logAuthStatus(): void {
  if (process.env.NODE_ENV === 'development') {
    const { environment, publishableKey, usingProductionKeys } = getEnvironmentSpecificKeys();

    console.log('[Auth Config]', {
      isConfigured: isClerkConfigured(),
      isEnabled: isAuthEnabled(),
      environment,
      isProduction: isProduction(),
      isDevelopment: isDevelopment(),
      isLocalhost: isLocalhost(),
      appUrl: getAppUrl(),
      enableDevAuth: process.env.ENABLE_DEV_AUTH === 'true',
      keyType: publishableKey?.startsWith('pk_test_')
        ? 'test'
        : publishableKey?.startsWith('pk_live_')
          ? 'live'
          : 'none',
      usingProductionKeys,
      domainCheck: authConfig.features.strictDomainCheck,
      productionKeysInDev: authConfig.features.productionKeysInDev,
    });

    const validation = validateAuthConfig();
    if (validation.errors.length > 0) {
      console.error('[Auth Config] Errors:', validation.errors);
    }
    if (validation.warnings.length > 0) {
      console.warn('[Auth Config] Warnings:', validation.warnings);
    }
  }
}
