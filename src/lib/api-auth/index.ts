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

// Key generation and validation
export {
  constantTimeCompare,
  extractKeyPrefix,
  generateApiKey,
  type GeneratedApiKey,
  getKeyEnvironment,
  hashApiKey,
  isDevelopmentKey,
  isProductionKey,
  maskApiKey,
  validateApiKeyFormat,
} from './key-generator';

// Key service operations
export {
  checkApiKeyPermission,
  cleanupExpiredKeys,
  createApiKey,
  type CreateApiKeyParams,
  type CreateApiKeyResult,
  deleteApiKey,
  getApiKeyById,
  getApiKeyUsage,
  type ApiKeyUsageParams,
  type ApiKeyUsageStats,
  getRecentUsageLogs,
  listUserApiKeys,
  revokeApiKey,
  trackApiUsage,
  updateApiKey,
  validateApiKey,
  type ValidateApiKeyResult,
} from './key-service';

// Scope management
export {
  expandWildcard,
  getScopeDescription,
  hasAllScopes,
  hasAnyScope,
  hasScope,
  isValidScopeFormat,
  type Scope,
  SCOPE_GROUPS,
  SCOPES,
  validateScopes,
} from './scopes';

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

// Type definitions
export type {
  AuthContext,
  AuthError,
  AuthFailureReason,
  AuthenticatedHandler,
  AuthenticatedRequest,
  AuthMetadata,
  AuthMiddlewareOptions,
  AuthType,
  RequestTrackingInfo,
  ScopeValidationOptions,
  UnauthenticatedHandler,
} from './types';

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
