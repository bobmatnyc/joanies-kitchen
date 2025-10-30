/**
 * API Key Service - Database Operations and Business Logic
 *
 * This module provides high-level API key management operations:
 * - Creating and storing new keys
 * - Validating keys during authentication
 * - Revoking keys (soft delete)
 * - Listing user's keys
 * - Tracking usage and analytics
 *
 * Security Features:
 * - Keys are hashed before storage (never stored in plaintext)
 * - Constant-time comparison to prevent timing attacks
 * - Comprehensive audit trail
 * - Automatic expiration checking
 * - Rate limiting support via usage tracking
 */

import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  type ApiKey,
  apiKeys,
  apiKeyUsage,
  type NewApiKey,
  type NewApiKeyUsage,
} from '../db/api-keys-schema';
import {
  constantTimeCompare,
  generateApiKey,
  hashApiKey,
  validateApiKeyFormat,
} from './key-generator';
import { hasScope, validateScopes } from './scopes';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface CreateApiKeyParams {
  userId: string;
  name: string;
  scopes: string[];
  description?: string;
  expiresAt?: Date;
  environment?: 'production' | 'development';
  createdBy?: string; // For admin-created keys
}

export interface CreateApiKeyResult {
  success: boolean;
  apiKey?: string; // Full key - ONLY returned once, never again
  keyId?: string;
  keyPrefix?: string; // For display in UI
  error?: string;
}

export interface ValidateApiKeyResult {
  valid: boolean;
  apiKey?: ApiKey;
  scopes?: string[];
  userId?: string;
  error?: string;
  reason?: 'invalid_format' | 'not_found' | 'inactive' | 'expired' | 'revoked';
}

export interface ApiKeyUsageParams {
  keyId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  ipAddress?: string;
  userAgent?: string;
  responseTimeMs?: number;
  requestSizeBytes?: number;
  responseSizeBytes?: number;
  errorMessage?: string;
  errorCode?: string;
  metadata?: Record<string, any>;
}

export interface ApiKeyUsageStats {
  totalRequests: number;
  requestsLast24h: number;
  requestsLast7Days: number;
  requestsLast30Days: number;
  averageResponseTime?: number;
  errorRate?: number;
  mostUsedEndpoints: Array<{ endpoint: string; count: number }>;
}

// ============================================================================
// API KEY CRUD OPERATIONS
// ============================================================================

/**
 * Create a new API key for a user
 *
 * Process:
 * 1. Validate scopes
 * 2. Generate cryptographically secure key
 * 3. Hash the key (SHA-256)
 * 4. Store hash in database (never store plaintext)
 * 5. Return full key ONCE (never stored or logged)
 *
 * @param params - API key creation parameters
 * @returns Result with full API key (show once) or error
 *
 * @example
 * const result = await createApiKey({
 *   userId: 'user_123',
 *   name: 'Mobile App',
 *   scopes: ['read:recipes', 'write:meals'],
 *   expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
 * });
 *
 * if (result.success) {
 *   // Show this to user ONCE - they can never retrieve it again
 *   console.log('Your API key:', result.apiKey);
 *   console.log('Key ID:', result.keyId);
 *   console.log('Prefix for reference:', result.keyPrefix);
 * }
 */
export async function createApiKey(params: CreateApiKeyParams): Promise<CreateApiKeyResult> {
  try {
    // Validate scopes
    const scopeValidation = validateScopes(params.scopes);
    if (!scopeValidation.valid) {
      return {
        success: false,
        error: scopeValidation.message || 'Invalid scopes',
      };
    }

    // Generate new API key
    const generated = generateApiKey(params.environment || 'production');

    // Prepare database record
    const newKey: NewApiKey = {
      user_id: params.userId,
      name: params.name,
      key_hash: generated.hash,
      key_prefix: generated.prefix,
      scopes: params.scopes,
      description: params.description,
      environment: params.environment || 'production',
      expires_at: params.expiresAt,
      created_by: params.createdBy || params.userId,
      is_active: true,
      total_requests: 0,
    };

    // Insert into database
    const [inserted] = await db.insert(apiKeys).values(newKey).returning();

    if (!inserted) {
      return {
        success: false,
        error: 'Failed to create API key in database',
      };
    }

    return {
      success: true,
      apiKey: generated.key, // FULL KEY - show only once
      keyId: inserted.id,
      keyPrefix: generated.prefix,
    };
  } catch (error) {
    console.error('Error creating API key:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error creating API key',
    };
  }
}

/**
 * Validate an API key during authentication
 *
 * Process:
 * 1. Validate key format
 * 2. Hash the provided key
 * 3. Look up hash in database (constant-time comparison)
 * 4. Check if key is active, not expired, not revoked
 * 5. Update last_used_at timestamp
 * 6. Return key details if valid
 *
 * @param providedKey - The API key provided by the client
 * @returns Validation result with key details if valid
 *
 * @example
 * const auth = await validateApiKey(req.headers['x-api-key']);
 * if (auth.valid) {
 *   // Check permissions
 *   if (hasScope(auth.scopes!, 'read:recipes')) {
 *     // Allow access
 *   }
 * }
 */
export async function validateApiKey(providedKey: string): Promise<ValidateApiKeyResult> {
  try {
    // Step 1: Validate format
    const formatValidation = validateApiKeyFormat(providedKey);
    if (!formatValidation.valid) {
      return {
        valid: false,
        reason: 'invalid_format',
        error: formatValidation.reason,
      };
    }

    // Step 2: Hash the provided key
    const keyHash = hashApiKey(providedKey);

    // Step 3: Look up key in database by hash
    const [key] = await db.select().from(apiKeys).where(eq(apiKeys.key_hash, keyHash)).limit(1);

    if (!key) {
      return {
        valid: false,
        reason: 'not_found',
        error: 'API key not found',
      };
    }

    // Additional constant-time comparison as extra security measure
    if (!constantTimeCompare(key.key_hash, keyHash)) {
      return {
        valid: false,
        reason: 'not_found',
        error: 'API key not found',
      };
    }

    // Step 4: Check if key is active
    if (!key.is_active) {
      return {
        valid: false,
        reason: 'inactive',
        error: 'API key is inactive',
      };
    }

    // Check if key is revoked
    if (key.revoked_at) {
      return {
        valid: false,
        reason: 'revoked',
        error: `API key was revoked: ${key.revocation_reason || 'No reason provided'}`,
      };
    }

    // Check if key is expired
    if (key.expires_at && new Date(key.expires_at) < new Date()) {
      return {
        valid: false,
        reason: 'expired',
        error: 'API key has expired',
      };
    }

    // Step 5: Update last_used_at timestamp (fire and forget)
    db.update(apiKeys)
      .set({
        last_used_at: new Date(),
        updated_at: new Date(),
      })
      .where(eq(apiKeys.id, key.id))
      .execute()
      .catch((err) => {
        console.error('Failed to update last_used_at:', err);
      });

    // Step 6: Return valid key with details
    return {
      valid: true,
      apiKey: key,
      scopes: key.scopes as string[],
      userId: key.user_id,
    };
  } catch (error) {
    console.error('Error validating API key:', error);
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error validating API key',
    };
  }
}

/**
 * Revoke an API key (soft delete)
 *
 * This marks the key as inactive and records revocation details.
 * The key remains in the database for audit purposes.
 *
 * @param keyId - The API key ID to revoke
 * @param revokedBy - User ID who is revoking the key
 * @param reason - Optional reason for revocation
 * @returns Success boolean
 *
 * @example
 * await revokeApiKey('key_uuid', 'user_123', 'Key compromised');
 */
export async function revokeApiKey(
  keyId: string,
  revokedBy: string,
  reason?: string
): Promise<boolean> {
  try {
    const [updated] = await db
      .update(apiKeys)
      .set({
        is_active: false,
        revoked_at: new Date(),
        revoked_by: revokedBy,
        revocation_reason: reason || 'No reason provided',
        updated_at: new Date(),
      })
      .where(eq(apiKeys.id, keyId))
      .returning();

    return !!updated;
  } catch (error) {
    console.error('Error revoking API key:', error);
    return false;
  }
}

/**
 * Permanently delete an API key (use with caution)
 *
 * This completely removes the key from the database.
 * Usually, revocation is preferred for audit trail.
 *
 * @param keyId - The API key ID to delete
 * @returns Success boolean
 */
export async function deleteApiKey(keyId: string): Promise<boolean> {
  try {
    await db.delete(apiKeys).where(eq(apiKeys.id, keyId));
    return true;
  } catch (error) {
    console.error('Error deleting API key:', error);
    return false;
  }
}

/**
 * List all API keys for a user
 *
 * Returns keys with prefix (safe to display) but never the full key.
 * Includes usage statistics.
 *
 * @param userId - The user ID
 * @param includeInactive - Whether to include inactive/revoked keys
 * @returns Array of API keys (without full key values)
 *
 * @example
 * const keys = await listUserApiKeys('user_123');
 * keys.forEach(key => {
 *   console.log(`${key.name}: ${key.key_prefix}... (${key.total_requests} requests)`);
 * });
 */
export async function listUserApiKeys(
  userId: string,
  includeInactive: boolean = false
): Promise<ApiKey[]> {
  try {
    const conditions = [eq(apiKeys.user_id, userId)];

    if (!includeInactive) {
      conditions.push(eq(apiKeys.is_active, true));
    }

    const keys = await db
      .select()
      .from(apiKeys)
      .where(and(...conditions))
      .orderBy(desc(apiKeys.created_at));

    return keys;
  } catch (error) {
    console.error('Error listing user API keys:', error);
    return [];
  }
}

/**
 * Get a single API key by ID
 *
 * @param keyId - The API key ID
 * @returns API key or null if not found
 */
export async function getApiKeyById(keyId: string): Promise<ApiKey | null> {
  try {
    const [key] = await db.select().from(apiKeys).where(eq(apiKeys.id, keyId)).limit(1);

    return key || null;
  } catch (error) {
    console.error('Error getting API key by ID:', error);
    return null;
  }
}

/**
 * Update API key metadata
 *
 * Can update: name, description, scopes, expiration
 * Cannot update: key_hash, user_id (security)
 *
 * @param keyId - The API key ID
 * @param updates - Fields to update
 * @returns Success boolean
 */
export async function updateApiKey(
  keyId: string,
  updates: {
    name?: string;
    description?: string;
    scopes?: string[];
    expires_at?: Date | null;
  }
): Promise<boolean> {
  try {
    // Validate scopes if provided
    if (updates.scopes) {
      const validation = validateScopes(updates.scopes);
      if (!validation.valid) {
        console.error('Invalid scopes:', validation.message);
        return false;
      }
    }

    const [updated] = await db
      .update(apiKeys)
      .set({
        ...updates,
        updated_at: new Date(),
      })
      .where(eq(apiKeys.id, keyId))
      .returning();

    return !!updated;
  } catch (error) {
    console.error('Error updating API key:', error);
    return false;
  }
}

// ============================================================================
// USAGE TRACKING AND ANALYTICS
// ============================================================================

/**
 * Track API usage for analytics and monitoring
 *
 * Records every API request made with a key for:
 * - Usage analytics
 * - Rate limiting
 * - Security audit
 * - Performance monitoring
 *
 * @param params - Usage tracking parameters
 * @returns Success boolean
 *
 * @example
 * await trackApiUsage({
 *   keyId: 'key_uuid',
 *   endpoint: '/api/recipes',
 *   method: 'GET',
 *   statusCode: 200,
 *   responseTimeMs: 45,
 * });
 */
export async function trackApiUsage(params: ApiKeyUsageParams): Promise<boolean> {
  try {
    const usageRecord: NewApiKeyUsage = {
      api_key_id: params.keyId,
      endpoint: params.endpoint,
      method: params.method,
      status_code: params.statusCode,
      ip_address: params.ipAddress,
      user_agent: params.userAgent,
      response_time_ms: params.responseTimeMs,
      request_size_bytes: params.requestSizeBytes,
      response_size_bytes: params.responseSizeBytes,
      error_message: params.errorMessage,
      error_code: params.errorCode,
      metadata: params.metadata,
    };

    // Insert usage record
    await db.insert(apiKeyUsage).values(usageRecord);

    // Update key's total_requests and last_used_at (fire and forget)
    db.update(apiKeys)
      .set({
        total_requests: sql`${apiKeys.total_requests} + 1`,
        last_used_at: new Date(),
        last_ip_address: params.ipAddress,
        updated_at: new Date(),
      })
      .where(eq(apiKeys.id, params.keyId))
      .execute()
      .catch((err) => {
        console.error('Failed to update key usage stats:', err);
      });

    return true;
  } catch (error) {
    console.error('Error tracking API usage:', error);
    return false;
  }
}

/**
 * Get usage statistics for an API key
 *
 * @param keyId - The API key ID
 * @param startDate - Optional start date for time range
 * @param endDate - Optional end date for time range
 * @returns Usage statistics
 *
 * @example
 * const stats = await getApiKeyUsage('key_uuid');
 * console.log(`Requests last 24h: ${stats.requestsLast24h}`);
 * console.log(`Average response time: ${stats.averageResponseTime}ms`);
 */
export async function getApiKeyUsage(
  keyId: string,
  startDate?: Date,
  endDate?: Date
): Promise<ApiKeyUsageStats> {
  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Base conditions
    const conditions = [eq(apiKeyUsage.api_key_id, keyId)];
    if (startDate) conditions.push(gte(apiKeyUsage.requested_at, startDate));
    if (endDate) conditions.push(lte(apiKeyUsage.requested_at, endDate));

    // Total requests in time range
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(apiKeyUsage)
      .where(and(...conditions));

    // Last 24h
    const [last24hResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(apiKeyUsage)
      .where(
        and(eq(apiKeyUsage.api_key_id, keyId), gte(apiKeyUsage.requested_at, twentyFourHoursAgo))
      );

    // Last 7 days
    const [last7dResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(apiKeyUsage)
      .where(and(eq(apiKeyUsage.api_key_id, keyId), gte(apiKeyUsage.requested_at, sevenDaysAgo)));

    // Last 30 days
    const [last30dResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(apiKeyUsage)
      .where(and(eq(apiKeyUsage.api_key_id, keyId), gte(apiKeyUsage.requested_at, thirtyDaysAgo)));

    // Average response time
    const [avgResponseTime] = await db
      .select({ avg: sql<number>`avg(${apiKeyUsage.response_time_ms})::int` })
      .from(apiKeyUsage)
      .where(and(...conditions));

    // Error rate
    const [errorCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(apiKeyUsage)
      .where(and(...conditions, sql`${apiKeyUsage.status_code} >= 400`));

    const totalRequests = totalResult?.count || 0;
    const errorRate = totalRequests > 0 ? (errorCount?.count || 0) / totalRequests : 0;

    // Most used endpoints
    const topEndpoints = await db
      .select({
        endpoint: apiKeyUsage.endpoint,
        count: sql<number>`count(*)::int`,
      })
      .from(apiKeyUsage)
      .where(and(...conditions))
      .groupBy(apiKeyUsage.endpoint)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    return {
      totalRequests,
      requestsLast24h: last24hResult?.count || 0,
      requestsLast7Days: last7dResult?.count || 0,
      requestsLast30Days: last30dResult?.count || 0,
      averageResponseTime: avgResponseTime?.avg || undefined,
      errorRate,
      mostUsedEndpoints: topEndpoints.map((e) => ({
        endpoint: e.endpoint,
        count: e.count,
      })),
    };
  } catch (error) {
    console.error('Error getting API key usage:', error);
    return {
      totalRequests: 0,
      requestsLast24h: 0,
      requestsLast7Days: 0,
      requestsLast30Days: 0,
      mostUsedEndpoints: [],
    };
  }
}

/**
 * Get recent usage logs for an API key
 *
 * @param keyId - The API key ID
 * @param limit - Maximum number of logs to return (default 100)
 * @returns Recent usage log entries
 */
export async function getRecentUsageLogs(keyId: string, limit: number = 100) {
  try {
    return await db
      .select()
      .from(apiKeyUsage)
      .where(eq(apiKeyUsage.api_key_id, keyId))
      .orderBy(desc(apiKeyUsage.requested_at))
      .limit(limit);
  } catch (error) {
    console.error('Error getting recent usage logs:', error);
    return [];
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if a user has permission via their API key
 *
 * @param keyId - The API key ID
 * @param requiredScope - The scope to check for
 * @returns true if key has the required scope
 */
export async function checkApiKeyPermission(
  keyId: string,
  requiredScope: string
): Promise<boolean> {
  try {
    const key = await getApiKeyById(keyId);
    if (!key || !key.is_active) {
      return false;
    }

    return hasScope(key.scopes as string[], requiredScope);
  } catch (error) {
    console.error('Error checking API key permission:', error);
    return false;
  }
}

/**
 * Clean up expired API keys (for scheduled jobs)
 *
 * @param autoRevoke - If true, automatically revoke expired keys
 * @returns Number of expired keys found
 */
export async function cleanupExpiredKeys(autoRevoke: boolean = false): Promise<number> {
  try {
    const now = new Date();

    const expiredKeys = await db
      .select()
      .from(apiKeys)
      .where(and(lte(apiKeys.expires_at, now), eq(apiKeys.is_active, true)));

    if (autoRevoke && expiredKeys.length > 0) {
      await db
        .update(apiKeys)
        .set({
          is_active: false,
          revoked_at: now,
          revoked_by: 'system',
          revocation_reason: 'Automatic expiration',
          updated_at: now,
        })
        .where(and(lte(apiKeys.expires_at, now), eq(apiKeys.is_active, true)));
    }

    return expiredKeys.length;
  } catch (error) {
    console.error('Error cleaning up expired keys:', error);
    return 0;
  }
}
