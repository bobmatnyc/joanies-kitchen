/**
 * Authentication Wrappers for API Routes
 *
 * Provides convenient wrapper functions to protect API routes with authentication.
 * Automatically handles authentication, scope checking, error responses, and usage tracking.
 *
 * Usage:
 * ```typescript
 * export const GET = requireAuth(async (request, auth) => {
 *   // auth.userId is guaranteed to exist
 *   return NextResponse.json({ userId: auth.userId });
 * });
 *
 * export const POST = requireScopes([SCOPES.WRITE_RECIPES], async (request, auth) => {
 *   // auth has WRITE_RECIPES scope guaranteed
 *   return NextResponse.json({ success: true });
 * });
 * ```
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { trackApiUsage } from './key-service';
import { authenticateRequest, authHasAllScopes } from './middleware';
import type {
  AuthContext,
  AuthenticatedHandler,
  AuthMiddlewareOptions,
  RequestTrackingInfo,
  RouteContext,
} from './types';

// ============================================================================
// MAIN WRAPPER FUNCTIONS
// ============================================================================

/**
 * Require authentication for an API route
 *
 * Wraps a handler to ensure the request is authenticated.
 * Returns 401 if not authenticated.
 *
 * @param handler - The authenticated route handler
 * @param options - Optional configuration
 * @returns Wrapped handler that enforces authentication
 *
 * @example
 * export const GET = requireAuth(async (request, auth) => {
 *   const data = await getUserData(auth.userId);
 *   return NextResponse.json(data);
 * });
 */
export function requireAuth(
  handler: AuthenticatedHandler,
  options?: AuthMiddlewareOptions
): (request: NextRequest, context: RouteContext) => Promise<NextResponse> {
  return async (request: NextRequest, context: RouteContext) => {
    const startTime = Date.now();

    // Authenticate the request
    const auth = await authenticateRequest(request);

    // Check if authenticated
    if (!auth.authenticated) {
      return createUnauthorizedResponse(auth, options);
    }

    try {
      // Call the handler with auth context
      const response = await handler(request, auth, context);

      // Track usage for API keys
      if (auth.authType === 'api_key' && auth.apiKeyId && options?.trackUsage !== false) {
        await trackRequestUsage(request, auth, response, startTime, options);
      }

      return response;
    } catch (error) {
      console.error('Error in authenticated handler:', error);

      // Track failed request
      if (auth.authType === 'api_key' && auth.apiKeyId && options?.trackUsage !== false) {
        await trackRequestUsage(
          request,
          auth,
          NextResponse.json({ error: 'Internal server error' }, { status: 500 }),
          startTime,
          options,
          error instanceof Error ? error.message : 'Unknown error'
        );
      }

      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  };
}

/**
 * Require specific scopes for an API route
 *
 * Wraps a handler to ensure the request has required permissions.
 * Returns 401 if not authenticated, 403 if insufficient permissions.
 *
 * @param requiredScopes - Array of required scopes (user must have ALL)
 * @param handler - The authenticated route handler
 * @param options - Optional configuration
 * @returns Wrapped handler that enforces authentication and scopes
 *
 * @example
 * export const POST = requireScopes([SCOPES.WRITE_RECIPES], async (request, auth) => {
 *   await createRecipe(auth.userId, data);
 *   return NextResponse.json({ success: true });
 * });
 */
export function requireScopes(
  requiredScopes: string[],
  handler: AuthenticatedHandler,
  options?: AuthMiddlewareOptions
): (request: NextRequest, context: RouteContext) => Promise<NextResponse> {
  return async (request: NextRequest, context: RouteContext) => {
    const startTime = Date.now();

    // Authenticate the request
    const auth = await authenticateRequest(request);

    // Check if authenticated
    if (!auth.authenticated) {
      return createUnauthorizedResponse(auth, options);
    }

    // Check if user has required scopes
    if (!authHasAllScopes(auth, requiredScopes)) {
      return createForbiddenResponse(auth, requiredScopes, options);
    }

    try {
      // Call the handler with auth context
      const response = await handler(request, auth, context);

      // Track usage for API keys
      if (auth.authType === 'api_key' && auth.apiKeyId && options?.trackUsage !== false) {
        await trackRequestUsage(request, auth, response, startTime, options);
      }

      return response;
    } catch (error) {
      console.error('Error in scoped handler:', error);

      // Track failed request
      if (auth.authType === 'api_key' && auth.apiKeyId && options?.trackUsage !== false) {
        await trackRequestUsage(
          request,
          auth,
          NextResponse.json({ error: 'Internal server error' }, { status: 500 }),
          startTime,
          options,
          error instanceof Error ? error.message : 'Unknown error'
        );
      }

      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  };
}

/**
 * Require ANY of the specified scopes (OR logic)
 *
 * Similar to requireScopes but only needs ONE of the required scopes.
 * Useful for endpoints accessible to multiple user types.
 *
 * @param requiredScopes - Array of scopes (user needs at least one)
 * @param handler - The authenticated route handler
 * @param options - Optional configuration
 * @returns Wrapped handler that enforces authentication and scope check
 *
 * @example
 * export const GET = requireAnyScope(
 *   [SCOPES.READ_RECIPES, SCOPES.ADMIN_CONTENT],
 *   async (request, auth) => {
 *     // User has either read:recipes OR admin:content
 *     return NextResponse.json({ data });
 *   }
 * );
 */
export function requireAnyScope(
  requiredScopes: string[],
  handler: AuthenticatedHandler,
  options?: AuthMiddlewareOptions
): (request: NextRequest, context: RouteContext) => Promise<NextResponse> {
  return async (request: NextRequest, context: RouteContext) => {
    const startTime = Date.now();

    // Authenticate the request
    const auth = await authenticateRequest(request);

    // Check if authenticated
    if (!auth.authenticated) {
      return createUnauthorizedResponse(auth, options);
    }

    // Check if user has at least one required scope
    const hasAnyScope = requiredScopes.some((scope) =>
      auth.scopes.some((userScope) => userScope === scope || userScope === '*')
    );

    if (!hasAnyScope) {
      return createForbiddenResponse(auth, requiredScopes, options);
    }

    try {
      // Call the handler with auth context
      const response = await handler(request, auth, context);

      // Track usage for API keys
      if (auth.authType === 'api_key' && auth.apiKeyId && options?.trackUsage !== false) {
        await trackRequestUsage(request, auth, response, startTime, options);
      }

      return response;
    } catch (error) {
      console.error('Error in any-scope handler:', error);

      // Track failed request
      if (auth.authType === 'api_key' && auth.apiKeyId && options?.trackUsage !== false) {
        await trackRequestUsage(
          request,
          auth,
          NextResponse.json({ error: 'Internal server error' }, { status: 500 }),
          startTime,
          options,
          error instanceof Error ? error.message : 'Unknown error'
        );
      }

      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  };
}

/**
 * Optional authentication for an API route
 *
 * Attempts to authenticate but allows unauthenticated requests.
 * Handler receives auth context with authenticated = false if no auth.
 * Useful for endpoints that behave differently for authenticated users.
 *
 * @param handler - The handler that receives auth context (may be unauthenticated)
 * @param options - Optional configuration
 * @returns Wrapped handler with optional authentication
 *
 * @example
 * export const GET = optionalAuth(async (request, auth) => {
 *   if (auth.authenticated) {
 *     // Show personalized content
 *     return NextResponse.json({ user: auth.userId, data });
 *   } else {
 *     // Show public content
 *     return NextResponse.json({ data });
 *   }
 * });
 */
export function optionalAuth(
  handler: AuthenticatedHandler,
  options?: AuthMiddlewareOptions
): (request: NextRequest, context: RouteContext) => Promise<NextResponse> {
  return async (request: NextRequest, context: RouteContext) => {
    const startTime = Date.now();

    // Authenticate the request (but don't fail if not authenticated)
    const auth = await authenticateRequest(request);

    try {
      // Call the handler with auth context (even if not authenticated)
      const response = await handler(request, auth, context?.params);

      // Track usage for authenticated API keys
      if (
        auth.authenticated &&
        auth.authType === 'api_key' &&
        auth.apiKeyId &&
        options?.trackUsage !== false
      ) {
        await trackRequestUsage(request, auth, response, startTime, options);
      }

      return response;
    } catch (error) {
      console.error('Error in optional-auth handler:', error);

      // Track failed request
      if (
        auth.authenticated &&
        auth.authType === 'api_key' &&
        auth.apiKeyId &&
        options?.trackUsage !== false
      ) {
        await trackRequestUsage(
          request,
          auth,
          NextResponse.json({ error: 'Internal server error' }, { status: 500 }),
          startTime,
          options,
          error instanceof Error ? error.message : 'Unknown error'
        );
      }

      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  };
}

// ============================================================================
// ERROR RESPONSE HELPERS
// ============================================================================

/**
 * Create a 401 Unauthorized response
 */
function createUnauthorizedResponse(
  auth: AuthContext,
  options?: AuthMiddlewareOptions
): NextResponse {
  if (options?.onError) {
    const error = new Error(auth.error || 'Authentication required');
    return options.onError(error as any);
  }

  const message = auth.error || 'Authentication required';
  const response = NextResponse.json(
    {
      error: message,
      reason: auth.reason || 'missing_auth',
      authType: auth.authType,
    },
    { status: 401 }
  );

  // Add WWW-Authenticate header for API key auth
  if (auth.authType === 'api_key' || auth.authType === 'none') {
    response.headers.set('WWW-Authenticate', 'Bearer realm="API", charset="UTF-8"');
  }

  return response;
}

/**
 * Create a 403 Forbidden response for insufficient permissions
 */
function createForbiddenResponse(
  auth: AuthContext,
  requiredScopes: string[],
  options?: AuthMiddlewareOptions
): NextResponse {
  if (options?.onError) {
    const error = new Error('Insufficient permissions');
    return options.onError(error as any);
  }

  return NextResponse.json(
    {
      error: 'Insufficient permissions',
      reason: 'insufficient_scope',
      required: requiredScopes,
      provided: auth.scopes,
      authType: auth.authType,
    },
    { status: 403 }
  );
}

// ============================================================================
// USAGE TRACKING
// ============================================================================

/**
 * Track API usage for analytics and monitoring
 */
async function trackRequestUsage(
  request: NextRequest,
  auth: AuthContext,
  response: NextResponse,
  startTime: number,
  options?: AuthMiddlewareOptions,
  errorMessage?: string
): Promise<void> {
  if (!auth.apiKeyId) {
    return;
  }

  try {
    const responseTime = Date.now() - startTime;
    const endpoint = request.nextUrl.pathname;
    const method = request.method;

    // Get response status from response object
    const statusCode = response.status;

    // Build tracking info
    const _trackingInfo: RequestTrackingInfo = {
      apiKeyId: auth.apiKeyId,
      userId: auth.userId || undefined,
      endpoint,
      method,
      statusCode,
      responseTimeMs: responseTime,
      ipAddress: auth.metadata?.ipAddress,
      userAgent: auth.metadata?.userAgent,
      errorMessage,
      metadata: options?.usageMetadata,
    };

    // Track usage (fire and forget to avoid blocking response)
    await trackApiUsage({
      keyId: auth.apiKeyId,
      endpoint,
      method,
      statusCode,
      responseTimeMs: responseTime,
      ipAddress: auth.metadata?.ipAddress,
      userAgent: auth.metadata?.userAgent,
      errorMessage,
      metadata: options?.usageMetadata,
    }).catch((err) => {
      console.error('Failed to track API usage:', err);
    });
  } catch (error) {
    // Log but don't fail the request if tracking fails
    console.error('Error tracking API usage:', error);
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Extract auth context from an already-authenticated request
 * Useful for Server Actions that need to access auth context
 *
 * @param request - Next.js request (should be authenticated)
 * @returns AuthContext if available
 */
export async function getAuthContext(request: NextRequest): Promise<AuthContext> {
  return await authenticateRequest(request);
}

/**
 * Check if request is authenticated (simple boolean check)
 *
 * @param request - Next.js request
 * @returns true if request is authenticated
 */
export async function isAuthenticated(request: NextRequest): Promise<boolean> {
  const auth = await authenticateRequest(request);
  return auth.authenticated;
}

/**
 * Get user ID from authenticated request
 *
 * @param request - Next.js request
 * @returns User ID or null if not authenticated
 */
export async function getUserId(request: NextRequest): Promise<string | null> {
  const auth = await authenticateRequest(request);
  return auth.userId;
}
