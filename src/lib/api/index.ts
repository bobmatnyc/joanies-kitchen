/**
 * API Utilities - Main Export
 *
 * Centralized exports for all API utility modules.
 * Import from this file for convenience: `import { apiSuccess, parseQueryParams } from '@/lib/api'`
 *
 * @module lib/api
 */

// ============================================================================
// RESPONSE UTILITIES
// ============================================================================

export {
  apiSuccess,
  apiSuccessPaginated,
  apiError,
  apiValidationError,
  apiNotFound,
  apiUnauthorized,
  apiForbidden,
  mapErrorToResponse,
  handleActionResult,
  type ApiSuccessResponse,
  type ApiErrorResponse,
  type PaginationInfo,
  type PaginatedData,
} from './responses';

// ============================================================================
// REQUEST HELPERS
// ============================================================================

export {
  parseQueryParams,
  parseJsonBody,
  getRouteParams,
  getRequiredParam,
  parseParamAndBody,
} from './request-helpers';

// ============================================================================
// AUTH HELPERS
// ============================================================================

export {
  requireOwnership,
  requireAdmin,
  verifyResourceOwnership,
  hasScopes,
  hasAnyScope,
} from './auth-helpers';

// ============================================================================
// QUERY HELPERS
// ============================================================================

export {
  applyFilters,
  applyFilter,
  applySorting,
  applyPagination,
  applyQueryOperations,
  searchItems,
} from './query-helpers';
