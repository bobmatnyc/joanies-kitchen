/**
 * Authentication Configuration
 * Centralized configuration for Clerk authentication across environments
 */

// Environment detection
export const isProduction =
  process.env.NODE_ENV === 'production' ||
  process.env.VERCEL_URL?.includes('recipe.help') ||
  process.env.NEXT_PUBLIC_APP_URL?.includes('recipe.help');

export const isDevelopment = process.env.NODE_ENV === 'development';
export const isLocalhost =
  typeof window !== 'undefined'
    ? window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    : process.env.NEXT_PUBLIC_APP_URL?.includes('localhost');

// Clerk configuration validation
export const hasValidClerkKeys =
  !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY !== 'YOUR_PUBLISHABLE_KEY' &&
  !!process.env.CLERK_SECRET_KEY &&
  process.env.CLERK_SECRET_KEY !== 'YOUR_SECRET_KEY';

// Feature flags
export const authConfig = {
  // Enable Clerk authentication if keys are configured
  enableClerk: hasValidClerkKeys,

  // Allow localhost authentication for testing (can be disabled in production)
  allowLocalhostAuth: hasValidClerkKeys && (isDevelopment || process.env.ALLOW_LOCALHOST_AUTH === 'true'),

  // Require authentication for protected routes
  requireAuth: isProduction || process.env.REQUIRE_AUTH === 'true',

  // Mock authentication for development without Clerk
  useMockAuth: isDevelopment && !hasValidClerkKeys,

  // Security settings
  security: {
    // Enforce HTTPS in production
    enforceHttps: isProduction,

    // CSRF protection
    enableCsrf: isProduction,

    // Rate limiting
    enableRateLimiting: isProduction,
  },

  // URLs
  urls: {
    signIn: '/sign-in',
    signUp: '/sign-up',
    afterSignIn: process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL || '/',
    afterSignUp: process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL || '/',
  },

  // Protected routes configuration
  routes: {
    public: [
      '/',
      '/sign-in(.*)',
      '/sign-up(.*)',
      '/shared(.*)',
      '/discover(.*)',
      '/api/webhooks(.*)',
    ],
    protected: [
      '/recipes/new(.*)',
      '/recipes/.*/edit(.*)',
      '/recipes$',
      '/meal-plans(.*)',
      '/user-profile(.*)',
    ],
    apiProtected: [
      '/api/recipes/create',
      '/api/recipes/update',
      '/api/recipes/delete',
      '/api/meal-plans(.*)',
    ],
  },
};

// Export helper to check if authentication is enabled
export const isAuthEnabled = () => authConfig.enableClerk;

// Export helper to check if a route requires authentication
export const requiresAuth = (pathname: string): boolean => {
  if (!authConfig.requireAuth) return false;

  return authConfig.routes.protected.some(pattern => {
    const regex = new RegExp(`^${pattern.replace(/\(\.\*\)/g, '.*')}$`);
    return regex.test(pathname);
  });
};

// Export helper for API route authentication
export const requiresApiAuth = (pathname: string): boolean => {
  if (!authConfig.requireAuth) return false;

  return authConfig.routes.apiProtected.some(pattern => {
    const regex = new RegExp(`^${pattern.replace(/\(\.\*\)/g, '.*')}$`);
    return regex.test(pathname);
  });
};