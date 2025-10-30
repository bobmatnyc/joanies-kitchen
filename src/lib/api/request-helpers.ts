/**
 * API Request Helper Utilities
 *
 * Utilities for parsing and validating request data (query params, body, route params).
 * Eliminates duplicate parsing code across API endpoints.
 *
 * @module lib/api/request-helpers
 */

import type { NextRequest, NextResponse } from 'next/server';
import { ZodError, type ZodSchema } from 'zod';
import type { RouteContext } from '@/lib/api-auth/types';
import { apiError, apiValidationError } from './responses';

// ============================================================================
// QUERY PARAMETER PARSING
// ============================================================================

/**
 * Parse and validate query parameters from request
 *
 * Extracts all query parameters from the request URL and validates them
 * against a Zod schema. Returns either validated data or an error response.
 *
 * @param request - Next.js request object
 * @param schema - Zod schema for validation
 * @returns Object with either validated data or error response
 *
 * @example
 * ```typescript
 * export const GET = requireScopes([SCOPES.READ_RECIPES], async (request, auth) => {
 *   const parsed = parseQueryParams(request, listRecipesQuerySchema);
 *   if ('error' in parsed) return parsed.error;
 *
 *   const { data: query } = parsed;
 *   // Use validated query parameters
 * });
 * ```
 */
export function parseQueryParams<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): { data: T } | { error: NextResponse } {
  // Extract all query parameters
  const queryParams: Record<string, unknown> = {};

  request.nextUrl.searchParams.forEach((value, key) => {
    queryParams[key] = value;
  });

  // Validate against schema
  try {
    const validated = schema.parse(queryParams);
    return { data: validated };
  } catch (error) {
    if (error instanceof ZodError) {
      return { error: apiValidationError(error.errors) };
    }
    throw error;
  }
}

// ============================================================================
// REQUEST BODY PARSING
// ============================================================================

/**
 * Parse and validate JSON body from request
 *
 * Reads the request body as JSON and validates it against a Zod schema.
 * Handles both parsing errors (invalid JSON) and validation errors.
 *
 * @param request - Next.js request object
 * @param schema - Zod schema for validation
 * @returns Promise resolving to either validated data or error response
 *
 * @example
 * ```typescript
 * export const POST = requireScopes([SCOPES.WRITE_RECIPES], async (request, auth) => {
 *   const parsed = await parseJsonBody(request, createRecipeSchema);
 *   if ('error' in parsed) return parsed.error;
 *
 *   const { data: recipeData } = parsed;
 *   // Use validated request body
 * });
 * ```
 */
export async function parseJsonBody<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): Promise<{ data: T } | { error: NextResponse }> {
  // Parse JSON body
  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { error: apiValidationError({ message: 'Invalid JSON in request body' }) };
    }
    throw error;
  }

  // Validate against schema
  try {
    const validated = schema.parse(body);
    return { data: validated };
  } catch (error) {
    if (error instanceof ZodError) {
      return { error: apiValidationError(error.errors) };
    }
    throw error;
  }
}

// ============================================================================
// ROUTE PARAMETER EXTRACTION
// ============================================================================

/**
 * Extract route parameters from context
 *
 * Handles Next.js 15 App Router where params is a Promise.
 * Safely extracts dynamic route parameters.
 *
 * @param context - Route context from Next.js
 * @returns Promise resolving to route parameters object
 *
 * @example
 * ```typescript
 * export const GET = requireScopes([SCOPES.READ_RECIPES], async (request, auth, context) => {
 *   const params = await getRouteParams(context);
 *   const id = params.id as string;
 *
 *   if (!id) {
 *     return apiError('Recipe ID is required', 400);
 *   }
 *   // Use id...
 * });
 * ```
 */
export async function getRouteParams(
  context: RouteContext
): Promise<Record<string, string | string[]>> {
  // In Next.js 15, params is always a Promise (empty object for routes without dynamic segments)
  return await context.params;
}

/**
 * Extract and validate a single required route parameter
 *
 * @param context - Route context from Next.js
 * @param paramName - Name of the parameter to extract
 * @returns Promise resolving to either the parameter value or error response
 *
 * @example
 * ```typescript
 * export const GET = requireScopes([SCOPES.READ_RECIPES], async (request, auth, context) => {
 *   const idResult = await getRequiredParam(context, 'id');
 *   if ('error' in idResult) return idResult.error;
 *
 *   const { data: id } = idResult;
 *   // Use id (guaranteed to be a string)
 * });
 * ```
 */
export async function getRequiredParam(
  context: RouteContext,
  paramName: string
): Promise<{ data: string } | { error: NextResponse }> {
  const params = await getRouteParams(context);
  const value = params[paramName];

  if (!value || typeof value !== 'string') {
    return {
      error: apiError(`${paramName} is required`, 400, undefined, 'missing_parameter'),
    };
  }

  return { data: value };
}

// ============================================================================
// COMBINED PARSING UTILITIES
// ============================================================================

/**
 * Parse both route params and request body in one call
 *
 * Convenience function for endpoints that need both route parameters and body validation.
 *
 * @param context - Route context from Next.js
 * @param request - Next.js request object
 * @param paramName - Name of required route parameter
 * @param bodySchema - Zod schema for request body
 * @returns Promise resolving to either both values or error response
 *
 * @example
 * ```typescript
 * export const PATCH = requireScopes([SCOPES.WRITE_RECIPES], async (request, auth, context) => {
 *   const parsed = await parseParamAndBody(context, request, 'id', updateRecipeSchema);
 *   if ('error' in parsed) return parsed.error;
 *
 *   const { param: id, body: updateData } = parsed.data;
 *   // Use both id and updateData
 * });
 * ```
 */
export async function parseParamAndBody<T>(
  context: RouteContext,
  request: NextRequest,
  paramName: string,
  bodySchema: ZodSchema<T>
): Promise<{ data: { param: string; body: T } } | { error: NextResponse }> {
  // Extract route parameter
  const paramResult = await getRequiredParam(context, paramName);
  if ('error' in paramResult) return paramResult;

  // Parse request body
  const bodyResult = await parseJsonBody(request, bodySchema);
  if ('error' in bodyResult) return bodyResult;

  return {
    data: {
      param: paramResult.data,
      body: bodyResult.data,
    },
  };
}
