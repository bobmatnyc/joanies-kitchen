/**
 * API Response Utilities
 *
 * Standardized response formatting functions for API v1 endpoints.
 * Ensures consistent response structure across all API routes.
 *
 * @module lib/api/responses
 */

import { NextResponse } from 'next/server';
import type { ZodError } from 'zod';

// ============================================================================
// RESPONSE TYPES
// ============================================================================

/**
 * Standard successful API response
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

/**
 * Standard error API response
 */
export interface ApiErrorResponse {
  success: false;
  error: string;
  details?: unknown;
  reason?: string;
}

/**
 * Pagination metadata
 */
export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

/**
 * Paginated data wrapper
 */
export interface PaginatedData<T> {
  items: T[];
  pagination: PaginationInfo;
}

// ============================================================================
// SUCCESS RESPONSES
// ============================================================================

/**
 * Create a successful JSON response
 *
 * @param data - Response data payload
 * @param status - HTTP status code (default: 200)
 * @returns NextResponse with standardized success format
 *
 * @example
 * ```typescript
 * return apiSuccess({ id: '123', name: 'Recipe' });
 * // Returns: { success: true, data: { id: '123', name: 'Recipe' } }
 * ```
 */
export function apiSuccess<T>(data: T, status: number = 200): NextResponse {
  return NextResponse.json(
    {
      success: true,
      data,
    } as ApiSuccessResponse<T>,
    { status }
  );
}

/**
 * Create a paginated successful response
 *
 * @param items - Array of items for current page
 * @param page - Current page number (1-indexed)
 * @param limit - Items per page
 * @param total - Total number of items across all pages
 * @param status - HTTP status code (default: 200)
 * @returns NextResponse with paginated data and metadata
 *
 * @example
 * ```typescript
 * return apiSuccessPaginated(recipes, 1, 20, 100);
 * // Returns:
 * // {
 * //   success: true,
 * //   data: {
 * //     items: [...recipes],
 * //     pagination: { page: 1, limit: 20, total: 100, totalPages: 5, hasMore: true }
 * //   }
 * // }
 * ```
 */
export function apiSuccessPaginated<T>(
  items: T[],
  page: number,
  limit: number,
  total: number,
  status: number = 200
): NextResponse {
  const totalPages = Math.ceil(total / limit);
  const hasMore = page * limit < total;

  return NextResponse.json(
    {
      success: true,
      data: {
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasMore,
        },
      },
    } as ApiSuccessResponse<PaginatedData<T>>,
    { status }
  );
}

// ============================================================================
// ERROR RESPONSES
// ============================================================================

/**
 * Create a generic error JSON response
 *
 * @param error - Error message
 * @param status - HTTP status code (default: 500)
 * @param details - Additional error details (optional)
 * @param reason - Machine-readable error reason (optional)
 * @returns NextResponse with standardized error format
 *
 * @example
 * ```typescript
 * return apiError('Something went wrong', 500);
 * return apiError('Invalid data', 400, { field: 'email' }, 'validation_error');
 * ```
 */
export function apiError(
  error: string,
  status: number = 500,
  details?: unknown,
  reason?: string
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error,
      ...(details !== undefined && { details }),
      ...(reason && { reason }),
    } as ApiErrorResponse,
    { status }
  );
}

/**
 * Create a validation error response (400)
 *
 * @param details - Validation error details (Zod errors or custom)
 * @returns NextResponse with validation error format
 *
 * @example
 * ```typescript
 * // From Zod validation
 * catch (error) {
 *   if (error instanceof ZodError) {
 *     return apiValidationError(error.errors);
 *   }
 * }
 * ```
 */
export function apiValidationError(details: unknown): NextResponse {
  return apiError('Invalid request data', 400, details, 'validation_error');
}

/**
 * Create a not found error response (404)
 *
 * @param resource - Name of the resource that wasn't found
 * @returns NextResponse with 404 error
 *
 * @example
 * ```typescript
 * return apiNotFound('Recipe');
 * // Returns: { success: false, error: 'Recipe not found', reason: 'not_found' }
 * ```
 */
export function apiNotFound(resource: string): NextResponse {
  return apiError(`${resource} not found`, 404, undefined, 'not_found');
}

/**
 * Create an unauthorized error response (401)
 *
 * @param message - Custom error message (default: 'Authentication required')
 * @returns NextResponse with 401 error
 *
 * @example
 * ```typescript
 * return apiUnauthorized();
 * return apiUnauthorized('Invalid API key');
 * ```
 */
export function apiUnauthorized(message: string = 'Authentication required'): NextResponse {
  return apiError(message, 401, undefined, 'unauthorized');
}

/**
 * Create a forbidden error response (403)
 *
 * @param message - Custom error message (default: 'Access denied')
 * @returns NextResponse with 403 error
 *
 * @example
 * ```typescript
 * return apiForbidden();
 * return apiForbidden('Insufficient permissions');
 * ```
 */
export function apiForbidden(message: string = 'Access denied'): NextResponse {
  return apiError(message, 403, undefined, 'forbidden');
}

// ============================================================================
// ERROR MAPPING UTILITIES
// ============================================================================

/**
 * Map common error messages to appropriate HTTP responses
 *
 * @param errorMessage - Error message from server action or database
 * @param defaultStatus - Default status code if no match found (default: 500)
 * @returns NextResponse with appropriate status code
 *
 * @example
 * ```typescript
 * const result = await getRecipe(id);
 * if (!result.success) {
 *   return mapErrorToResponse(result.error || 'Failed to fetch recipe');
 * }
 * ```
 */
export function mapErrorToResponse(
  errorMessage: string,
  defaultStatus: number = 500
): NextResponse {
  const errorLower = errorMessage.toLowerCase();

  // Not found errors (404)
  if (errorLower.includes('not found')) {
    return apiNotFound(errorMessage.split(' ')[0] || 'Resource');
  }

  // Permission errors (403)
  if (
    errorLower.includes('access denied') ||
    errorLower.includes('permission') ||
    errorLower.includes('unauthorized')
  ) {
    return apiForbidden(errorMessage);
  }

  // Validation errors (400)
  if (errorLower.includes('invalid') || errorLower.includes('validation')) {
    return apiError(errorMessage, 400, undefined, 'validation_error');
  }

  // Default to generic error
  return apiError(errorMessage, defaultStatus);
}

/**
 * Handle server action result and convert to API response
 *
 * @param result - Server action result with success/error pattern
 * @returns Object with either data or error response
 *
 * @example
 * ```typescript
 * const result = await getRecipe(id);
 * const handled = handleActionResult(result);
 * if ('error' in handled) return handled.error;
 *
 * return apiSuccess(handled.data);
 * ```
 */
export function handleActionResult<T>(result: {
  success: boolean;
  data?: T;
  error?: string;
}): { data: T } | { error: NextResponse } {
  if (result.success && result.data !== undefined) {
    return { data: result.data };
  }

  return {
    error: mapErrorToResponse(result.error || 'Operation failed'),
  };
}
