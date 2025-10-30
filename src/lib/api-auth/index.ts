/**
 * API Authentication Module
 *
 * Provides complete API key authentication and management system.
 *
 * Features:
 * - Cryptographically secure key generation
 * - SHA-256 hashing for secure storage
 * - Fine-grained scope-based permissions
 * - Usage tracking and analytics
 * - Audit trail and revocation support
 * - Unified middleware supporting Clerk and API keys
 *
 * Usage:
 * ```typescript
 * import { createApiKey, validateApiKey, hasScope, SCOPES } from '@/lib/api-auth';
 *
 * // Create a key
 * const result = await createApiKey({
 *   userId: 'user_123',
 *   name: 'Mobile App',
 *   scopes: [SCOPES.READ_RECIPES, SCOPES.WRITE_MEALS],
 * });
 *
 * // Validate during request
 * const auth = await validateApiKey(apiKey);
 * if (auth.valid && hasScope(auth.scopes!, SCOPES.READ_RECIPES)) {
 *   // Allow access
 * }
 *
 * // Use in API routes
 * import { requireAuth, requireScopes, SCOPES } from '@/lib/api-auth';
 *
 * export const GET = requireScopes([SCOPES.READ_RECIPES], async (request, auth) => {
 *   // auth.userId is guaranteed, auth.scopes includes READ_RECIPES
 *   const recipes = await getRecipesForUser(auth.userId);
 *   return NextResponse.json(recipes);
 * });
 * ```
 */

// Re-export database types for convenience
export type {
  ApiKey,
  ApiKeyDetails,
  ApiKeyEnvironment,
  ApiKeyScope,
  ApiKeyUsage,
  ApiKeyWithStats,
  NewApiKey,
  NewApiKeyUsage,
} from '../db/api-keys-schema';
export { API_KEY_ENVIRONMENTS, API_KEY_SCOPES } from '../db/api-keys-schema';
// Key generation and validation
export {
  constantTimeCompare,
  extractKeyPrefix,
  type GeneratedApiKey,
  generateApiKey,
  getKeyEnvironment,
  hashApiKey,
  isDevelopmentKey,
  isProductionKey,
  maskApiKey,
  validateApiKeyFormat,
} from './key-generator';
// Key service operations
export {
  type ApiKeyUsageParams,
  type ApiKeyUsageStats,
  type CreateApiKeyParams,
  type CreateApiKeyResult,
  checkApiKeyPermission,
  cleanupExpiredKeys,
  createApiKey,
  deleteApiKey,
  getApiKeyById,
  getApiKeyUsage,
  getRecentUsageLogs,
  listUserApiKeys,
  revokeApiKey,
  trackApiUsage,
  updateApiKey,
  type ValidateApiKeyResult,
  validateApiKey,
} from './key-service';
// Authentication middleware
export {
  authenticateRequest,
  authHasAllScopes,
  authHasAnyScope,
  authHasScope,
  createUnauthenticatedContext,
  getAuthTypeLabel,
} from './middleware';
// Authentication wrappers for API routes
export {
  getAuthContext,
  getUserId,
  isAuthenticated,
  optionalAuth,
  requireAnyScope,
  requireAuth,
  requireScopes,
} from './require-auth';
// Scope management
export {
  expandWildcard,
  getScopeDescription,
  hasAllScopes,
  hasAnyScope,
  hasScope,
  isValidScopeFormat,
  SCOPE_GROUPS,
  SCOPES,
  type Scope,
  validateScopes,
} from './scopes';
// Type definitions
export type {
  AuthContext,
  AuthError,
  AuthenticatedHandler,
  AuthenticatedRequest,
  AuthFailureReason,
  AuthMetadata,
  AuthMiddlewareOptions,
  AuthType,
  RequestTrackingInfo,
  ScopeValidationOptions,
  UnauthenticatedHandler,
} from './types';
