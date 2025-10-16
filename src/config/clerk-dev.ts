/**
 * Clerk Development Configuration for Production Keys
 * This module enables using production Clerk keys on localhost
 * by implementing domain bypass and proxy configurations
 */

/**
 * Override configuration for using production keys in development
 * This bypasses domain restrictions by configuring Clerk appropriately
 */
export const clerkDevConfig = {
  // Force production keys in development
  forceProductionKeys: process.env.FORCE_PRODUCTION_KEYS === 'true',

  // Domain configuration for development with production keys
  domain: process.env.CLERK_DOMAIN || 'recipes.help',

  // Proxy configuration to bypass domain restrictions
  proxyUrl: process.env.CLERK_PROXY_URL || undefined,

  // Development instance configuration
  devInstanceUrl: process.env.CLERK_DEV_INSTANCE_URL || undefined,

  // Satellite application mode (allows using production keys on different domain)
  isSatellite: process.env.CLERK_IS_SATELLITE === 'true',

  // Primary application URL (for satellite mode)
  primaryUrl: process.env.CLERK_PRIMARY_URL || 'https://recipes.help',

  // Allow insecure requests in development
  allowInsecure: process.env.NODE_ENV === 'development',

  // Skip domain validation in development
  skipDomainValidation: process.env.SKIP_CLERK_DOMAIN_VALIDATION === 'true',
};

/**
 * Get Clerk initialization options for development with production keys
 */
export function getClerkDevOptions() {
  const isProdKeys = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_live_');
  const isDev = process.env.NODE_ENV === 'development';

  if (!isProdKeys || !isDev) {
    return {};
  }

  return {
    // Domain configuration
    domain: clerkDevConfig.domain,

    // Satellite configuration for using production keys on localhost
    isSatellite: true,
    satelliteDomain: 'localhost:3002',
    primaryDomain: 'recipes.help',

    // Proxy configuration
    proxyUrl: clerkDevConfig.proxyUrl,

    // Development overrides
    sdkMetadata: {
      name: '@clerk/nextjs',
      version: '5.0.0',
      environment: 'development',
    },

    // Allow insecure connections in development
    telemetry: false,

    // Custom fetch configuration to bypass domain checks
    fetchOptions: {
      credentials: 'include',
      mode: 'cors',
    },
  };
}

/**
 * Custom Clerk API configuration for development
 */
export function getClerkApiConfig() {
  const isProdKeys = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_live_');
  const isDev = process.env.NODE_ENV === 'development';

  if (!isProdKeys || !isDev) {
    return {};
  }

  return {
    // Override API URL for development
    apiUrl: process.env.CLERK_API_URL || 'https://api.clerk.com',

    // Override frontend API URL
    frontendApiUrl: process.env.CLERK_FRONTEND_API || `https://${clerkDevConfig.domain}`,

    // Custom headers for development
    headers: {
      'X-Clerk-SDK': '@clerk/nextjs',
      'X-Development-Mode': 'true',
    },
  };
}

/**
 * Check if we should use production keys override
 */
export function shouldUseProductionKeysOverride(): boolean {
  return (
    process.env.NODE_ENV === 'development' &&
    (process.env.FORCE_PRODUCTION_KEYS === 'true' ||
     process.env.USE_PRODUCTION_CLERK === 'true')
  );
}

/**
 * Get the correct Clerk keys based on environment and overrides
 */
export function getClerkKeys() {
  const forceProduction = shouldUseProductionKeysOverride();

  if (forceProduction) {
    // Use production keys even in development
    return {
      publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY_PROD ||
                     process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
      secretKey: process.env.CLERK_SECRET_KEY_PROD ||
                process.env.CLERK_SECRET_KEY,
      isProdKeys: true,
    };
  }

  // Use regular environment-based selection
  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    // Try development keys first, fall back to any available keys
    const devPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY_DEV;
    const devSecretKey = process.env.CLERK_SECRET_KEY_DEV;

    if (devPublishableKey && devSecretKey) {
      return {
        publishableKey: devPublishableKey,
        secretKey: devSecretKey,
        isProdKeys: false,
      };
    }
  }

  // Fall back to standard keys
  return {
    publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    secretKey: process.env.CLERK_SECRET_KEY,
    isProdKeys: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_live_'),
  };
}