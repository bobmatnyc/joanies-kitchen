/**
 * API Authentication Middleware
 *
 * Unified authentication system supporting:
 * - Clerk session authentication
 * - API key (Bearer token) authentication
 * - Basic authentication (username:password)
 *
 * Priority order:
 * 1. Authorization: Bearer <api_key>
 * 2. Authorization: Basic <base64(username:password)>
 * 3. Clerk session (cookies)
 * 4. Unauthenticated
 */

import { auth as clerkAuth } from '@clerk/nextjs/server';
import type { NextRequest } from 'next/server';
import { validateApiKey } from './key-service';
import { hasScope, SCOPE_GROUPS } from './scopes';
import type { AuthContext, AuthFailureReason, AuthMetadata, AuthType } from './types';

// ============================================================================
// MAIN AUTHENTICATION FUNCTION
// ============================================================================

/**
 * Authenticate a request using multiple methods
 *
 * Checks authentication in priority order:
 * 1. Bearer token (API key)
 * 2. Basic auth (username:password)
 * 3. Clerk session
 * 4. None (unauthenticated)
 *
 * @param request - Next.js request object
 * @returns AuthContext with user info and scopes
 *
 * @example
 * const auth = await authenticateRequest(request);
 * if (auth.authenticated) {
 *   console.log(`User ${auth.userId} authenticated via ${auth.authType}`);
 *   console.log(`Scopes: ${auth.scopes.join(', ')}`);
 * }
 */
export async function authenticateRequest(request: NextRequest): Promise<AuthContext> {
  // Extract metadata from request
  const metadata = extractRequestMetadata(request);

  // Try each authentication method in priority order
  const authHeader = request.headers.get('authorization');

  if (authHeader) {
    // 1. Check for Bearer token (API key)
    if (authHeader.startsWith('Bearer ')) {
      return await authenticateWithApiKey(authHeader, metadata);
    }

    // 2. Check for Basic auth
    if (authHeader.startsWith('Basic ')) {
      return await authenticateWithBasicAuth(authHeader, metadata);
    }
  }

  // 3. Fall back to Clerk session authentication
  return await authenticateWithClerk(metadata);
}

// ============================================================================
// AUTHENTICATION METHODS
// ============================================================================

/**
 * Authenticate using API key (Bearer token)
 */
async function authenticateWithApiKey(
  authHeader: string,
  metadata: AuthMetadata
): Promise<AuthContext> {
  try {
    // Extract API key from "Bearer <key>"
    const apiKey = authHeader.substring(7).trim();

    if (!apiKey) {
      return {
        authenticated: false,
        userId: null,
        authType: 'api_key',
        scopes: [],
        error: 'Missing API key in Bearer token',
        reason: 'missing_auth',
        metadata,
      };
    }

    // Validate the API key
    const validation = await validateApiKey(apiKey);

    if (!validation.valid) {
      return {
        authenticated: false,
        userId: null,
        authType: 'api_key',
        scopes: [],
        error: validation.error || 'Invalid API key',
        reason: (validation.reason || 'invalid_credentials') as AuthFailureReason,
        metadata,
      };
    }

    // Successfully authenticated with API key
    return {
      authenticated: true,
      userId: validation.userId!,
      authType: 'api_key',
      scopes: validation.scopes || [],
      apiKeyId: validation.apiKey?.id,
      apiKeyName: validation.apiKey?.name,
      metadata: {
        ...metadata,
        environment: validation.apiKey?.environment as 'production' | 'development' | undefined,
      },
    };
  } catch (error) {
    console.error('Error authenticating with API key:', error);
    return {
      authenticated: false,
      userId: null,
      authType: 'api_key',
      scopes: [],
      error: error instanceof Error ? error.message : 'Unknown authentication error',
      reason: 'invalid_credentials',
      metadata,
    };
  }
}

/**
 * Authenticate using Basic auth (username:password)
 *
 * This is a placeholder for future Basic auth support.
 * For now, it validates the format but doesn't authenticate.
 */
async function authenticateWithBasicAuth(
  authHeader: string,
  metadata: AuthMetadata
): Promise<AuthContext> {
  try {
    // Extract credentials from "Basic <base64>"
    const base64Credentials = authHeader.substring(6).trim();

    if (!base64Credentials) {
      return {
        authenticated: false,
        userId: null,
        authType: 'basic',
        scopes: [],
        error: 'Missing credentials in Basic auth',
        reason: 'missing_auth',
        metadata,
      };
    }

    // Decode base64 to get "username:password"
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [username, password] = credentials.split(':');

    if (!username || !password) {
      return {
        authenticated: false,
        userId: null,
        authType: 'basic',
        scopes: [],
        error: 'Invalid Basic auth format (expected username:password)',
        reason: 'invalid_format',
        metadata,
      };
    }

    // TODO: Implement actual Basic auth validation
    // For now, reject all Basic auth attempts
    return {
      authenticated: false,
      userId: null,
      authType: 'basic',
      scopes: [],
      error: 'Basic authentication not yet implemented',
      reason: 'invalid_credentials',
      metadata,
    };
  } catch (error) {
    console.error('Error parsing Basic auth:', error);
    return {
      authenticated: false,
      userId: null,
      authType: 'basic',
      scopes: [],
      error: 'Invalid Basic auth format',
      reason: 'invalid_format',
      metadata,
    };
  }
}

/**
 * Authenticate using Clerk session
 */
async function authenticateWithClerk(metadata: AuthMetadata): Promise<AuthContext> {
  try {
    const session = await clerkAuth();

    // Check if user is authenticated with Clerk
    if (!session.userId) {
      return {
        authenticated: false,
        userId: null,
        authType: 'none',
        scopes: [],
        metadata,
      };
    }

    // Extract admin status from session claims
    const sessionMetadata = session.sessionClaims?.metadata as { isAdmin?: string } | undefined;
    const isAdmin = sessionMetadata?.isAdmin === 'true';

    // Clerk users get standard user scopes (or admin scopes if admin)
    const scopes = isAdmin ? [...SCOPE_GROUPS.ADMIN] : [...SCOPE_GROUPS.USER];

    return {
      authenticated: true,
      userId: session.userId,
      authType: 'clerk',
      scopes,
      metadata: {
        ...metadata,
        isAdmin,
        orgId: session.orgId || undefined,
      },
    };
  } catch (error) {
    console.error('Error authenticating with Clerk:', error);
    return {
      authenticated: false,
      userId: null,
      authType: 'clerk',
      scopes: [],
      error: error instanceof Error ? error.message : 'Unknown Clerk authentication error',
      reason: 'invalid_credentials',
      metadata,
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract metadata from the request for tracking
 */
function extractRequestMetadata(request: NextRequest): AuthMetadata {
  // Get IP address from various headers (respecting proxies)
  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    undefined;

  const userAgent = request.headers.get('user-agent') || undefined;

  // Generate a simple request ID for tracing
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  return {
    ipAddress,
    userAgent,
    timestamp: new Date(),
    requestId,
  };
}

/**
 * Check if authentication context has a specific scope
 *
 * @param auth - Authentication context
 * @param scope - Required scope
 * @returns true if auth has the scope
 */
export function authHasScope(auth: AuthContext, scope: string): boolean {
  if (!auth.authenticated) {
    return false;
  }

  return hasScope(auth.scopes, scope);
}

/**
 * Check if authentication context has all required scopes
 *
 * @param auth - Authentication context
 * @param requiredScopes - Array of required scopes
 * @returns true if auth has all required scopes
 */
export function authHasAllScopes(auth: AuthContext, requiredScopes: string[]): boolean {
  if (!auth.authenticated) {
    return false;
  }

  return requiredScopes.every((scope) => hasScope(auth.scopes, scope));
}

/**
 * Check if authentication context has any of the required scopes
 *
 * @param auth - Authentication context
 * @param requiredScopes - Array of scopes (need at least one)
 * @returns true if auth has at least one required scope
 */
export function authHasAnyScope(auth: AuthContext, requiredScopes: string[]): boolean {
  if (!auth.authenticated) {
    return false;
  }

  return requiredScopes.some((scope) => hasScope(auth.scopes, scope));
}

/**
 * Get authentication type as string for logging
 */
export function getAuthTypeLabel(authType: AuthType): string {
  const labels: Record<AuthType, string> = {
    clerk: 'Clerk Session',
    api_key: 'API Key',
    basic: 'Basic Auth',
    none: 'Unauthenticated',
  };
  return labels[authType];
}

/**
 * Create an unauthenticated AuthContext
 * Useful for public endpoints that still want to track requests
 */
export function createUnauthenticatedContext(request: NextRequest): AuthContext {
  return {
    authenticated: false,
    userId: null,
    authType: 'none',
    scopes: [],
    metadata: extractRequestMetadata(request),
  };
}
