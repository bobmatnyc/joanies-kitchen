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
  type ApiErrorResponse,
  type ApiSuccessResponse,
  apiError,
  apiForbidden,
  apiNotFound,
  apiSuccess,
  apiSuccessPaginated,
  apiUnauthorized,
  apiValidationError,
  handleActionResult,
  mapErrorToResponse,
  type PaginatedData,
  type PaginationInfo,
} from './responses';

// ============================================================================
// REQUEST HELPERS
// ============================================================================

export {
  getRequiredParam,
  getRouteParams,
  parseJsonBody,
  parseParamAndBody,
  parseQueryParams,
} from './request-helpers';

// ============================================================================
// AUTH HELPERS
// ============================================================================

export {
  hasAnyScope,
  hasScopes,
  requireAdmin,
  requireOwnership,
  verifyResourceOwnership,
} from './auth-helpers';

// ============================================================================
// QUERY HELPERS
// ============================================================================

export {
  applyFilter,
  applyFilters,
  applyPagination,
  applyQueryOperations,
  applySorting,
  searchItems,
} from './query-helpers';
