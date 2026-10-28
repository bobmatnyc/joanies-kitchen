/**
 * Error handling utilities for type-safe error management
 * Provides type guards and utilities to handle unknown errors safely
 */

/**
 * Type guard to check if an error has a message property
 */
export function isErrorWithMessage(error: unknown): error is { message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as Record<string, unknown>).message === 'string'
  );
}

/**
 * Type guard to check if an error has a code property
 */
export function isErrorWithCode(error: unknown): error is { code: string | number } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (typeof (error as Record<string, unknown>).code === 'string' ||
      typeof (error as Record<string, unknown>).code === 'number')
  );
}

/**
 * Type guard to check if an error is a native Error instance
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Safely extract error message from unknown error type
 * Falls back to string representation if no message property exists
 */
export function toErrorMessage(error: unknown): string {
  if (isErrorWithMessage(error)) {
    return error.message;
  }

  if (isError(error)) {
    return error.message;
  }

  try {
    return String(error);
  } catch {
    return 'Unknown error occurred';
  }
}

/**
 * Extract error code if available, otherwise return undefined
 */
export function getErrorCode(error: unknown): string | number | undefined {
  if (isErrorWithCode(error)) {
    return error.code;
  }
  return undefined;
}

/**
 * Create a standardized error response object
 */
export interface ErrorResponse {
  success: false;
  error: string;
  code?: string | number;
}

/**
 * Convert unknown error to standardized error response
 */
export function toErrorResponse(error: unknown): ErrorResponse {
  return {
    success: false,
    error: toErrorMessage(error),
    code: getErrorCode(error),
  };
}

/**
 * Database error type guard
 */
export function isDatabaseError(error: unknown): error is { code: string; detail?: string } {
  return isErrorWithCode(error) && typeof (error as Record<string, unknown>).code === 'string';
}

/** Upper bound on a stored database-error string (#12). */
export const DB_ERROR_MESSAGE_MAX = 500;

/**
 * Why: drizzle-orm wraps a failed query in DrizzleQueryError, whose message is
 * "Failed query: <sql>\nparams: ..." — the Postgres error that explains the
 * failure lives only on `err.cause` (#12).
 * What: returns the cause's message, suffixed with `(SQLSTATE <code>)` when the
 * cause carries a string code; with no usable cause, the error's own message.
 * The result is cut to `maxLen` characters.
 * Test: `src/lib/utils/__tests__/error-handling-db.test.ts`
 */
export function describeDbError(error: unknown, maxLen = DB_ERROR_MESSAGE_MAX): string {
  const cause = isError(error) ? error.cause : undefined;
  let text: string;
  if (isErrorWithMessage(cause) && cause.message) {
    const code = getErrorCode(cause);
    text = code !== undefined ? `${cause.message} (SQLSTATE ${code})` : cause.message;
  } else {
    text = toErrorMessage(error);
  }
  return text.length > maxLen ? `${text.slice(0, maxLen - 1)}…` : text;
}
