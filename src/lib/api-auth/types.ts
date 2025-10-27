/**
 * API Authentication Types
 *
 * Unified type definitions for API authentication middleware.
 * Supports multiple authentication methods: Clerk sessions, API keys, Basic auth.
 */

import type { NextRequest, NextResponse } from 'next/server';

// ============================================================================
// AUTH TYPES
// ============================================================================

/**
 * Authentication type detected from the request
 */
export type AuthType = 'clerk' | 'api_key' | 'basic' | 'none';

/**
 * Unified authentication context
 * Returned by authenticateRequest() and passed to protected handlers
 */
export interface AuthContext {
  /** Whether the request is authenticated */
  authenticated: boolean;

  /** User ID (from Clerk or API key owner) */
  userId: string | null;

  /** Authentication method used */
  authType: AuthType;

  /** Scopes/permissions granted to this authentication */
  scopes: string[];

  /** API key ID if authenticated via API key */
  apiKeyId?: string;

  /** API key name/label for logging */
  apiKeyName?: string;

  /** Additional metadata about the authentication */
  metadata?: AuthMetadata;

  /** Error message if authentication failed */
  error?: string;

  /** Reason for authentication failure */
  reason?: AuthFailureReason;
}

/**
 * Additional metadata tracked with authentication
 */
export interface AuthMetadata {
  /** IP address of the request */
  ipAddress?: string;

  /** User agent string */
  userAgent?: string;

  /** Request timestamp */
  timestamp?: Date;

  /** Request ID for tracing */
  requestId?: string;

  /** Admin status (from Clerk session claims) */
  isAdmin?: boolean;

  /** Organization ID (from Clerk session) */
  orgId?: string;

  /** API key environment (production/development) */
  environment?: 'production' | 'development';
}

/**
 * Reasons why authentication might fail
 */
export type AuthFailureReason =
  | 'missing_auth'
  | 'invalid_format'
  | 'invalid_credentials'
  | 'expired'
  | 'revoked'
  | 'inactive'
  | 'insufficient_scope'
  | 'not_found'; // API key not found in database

// ============================================================================
// HANDLER TYPES
// ============================================================================

/**
 * Route context from Next.js (matches Next.js 15 App Router)
 * For routes with dynamic segments, params is a Promise
 * For routes without dynamic segments, it's an empty object
 */
export type RouteContext = {
  params?: Promise<Record<string, string | string[]>>;
};

/**
 * API route handler with authentication context
 * Use this type when wrapping handlers with requireAuth/requireScopes
 */
export type AuthenticatedHandler = (
  request: NextRequest,
  auth: AuthContext,
  context: RouteContext
) => Promise<NextResponse> | NextResponse;

/**
 * API route handler without authentication (standard Next.js)
 */
export type UnauthenticatedHandler = (
  request: NextRequest,
  context?: RouteContext
) => Promise<NextResponse> | NextResponse;

/**
 * Combined handler type for flexibility
 */
export type ApiRouteHandler = AuthenticatedHandler | UnauthenticatedHandler;

// ============================================================================
// REQUEST EXTENSIONS
// ============================================================================

/**
 * Extended Next.js request with auth context attached
 * Allows middleware to attach auth info to the request
 */
export interface AuthenticatedRequest extends NextRequest {
  auth?: AuthContext;
}

// ============================================================================
// MIDDLEWARE OPTIONS
// ============================================================================

/**
 * Options for authentication middleware
 */
export interface AuthMiddlewareOptions {
  /** Required scopes for this endpoint */
  requiredScopes?: string[];

  /** Whether to allow unauthenticated requests (auth is optional) */
  optional?: boolean;

  /** Custom error handler */
  onError?: (error: AuthError) => NextResponse;

  /** Whether to track API usage (default: true for API keys) */
  trackUsage?: boolean;

  /** Additional metadata to include in usage tracking */
  usageMetadata?: Record<string, any>;
}

/**
 * Authentication error with context
 */
export class AuthError extends Error {
  public readonly statusCode: number;
  public readonly reason: AuthFailureReason;
  public readonly authType?: AuthType;

  constructor(message: string, statusCode: number, reason: AuthFailureReason, authType?: AuthType) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
    this.reason = reason;
    this.authType = authType;
  }
}

// ============================================================================
// SCOPE VALIDATION
// ============================================================================

/**
 * Options for scope validation
 */
export interface ScopeValidationOptions {
  /** Whether to require ALL scopes (AND) or ANY scope (OR) */
  requireAll?: boolean;

  /** Custom error message for insufficient permissions */
  errorMessage?: string;
}

// ============================================================================
// USAGE TRACKING
// ============================================================================

/**
 * Information tracked for each authenticated request
 */
export interface RequestTrackingInfo {
  /** API key ID (if API key auth) */
  apiKeyId?: string;

  /** User ID */
  userId?: string;

  /** Request endpoint */
  endpoint: string;

  /** HTTP method */
  method: string;

  /** Response status code */
  statusCode: number;

  /** Response time in milliseconds */
  responseTimeMs?: number;

  /** IP address */
  ipAddress?: string;

  /** User agent */
  userAgent?: string;

  /** Request size in bytes */
  requestSizeBytes?: number;

  /** Response size in bytes */
  responseSizeBytes?: number;

  /** Error message if request failed */
  errorMessage?: string;

  /** Error code if request failed */
  errorCode?: string;

  /** Additional metadata */
  metadata?: Record<string, any>;
}
