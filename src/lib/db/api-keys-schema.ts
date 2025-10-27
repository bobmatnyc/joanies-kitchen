import { boolean, index, integer, json, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';

/**
 * API Keys Infrastructure Schema
 *
 * This file contains database tables for API key authentication and management:
 * - apiKeys: Secure storage and management of API keys
 * - apiKeyUsage: Usage tracking and analytics for API key activity
 *
 * Purpose: Support dual authentication system (Clerk for users + API keys for programmatic access)
 *
 * Security Model:
 * - Keys are NEVER stored in plaintext (SHA-256 hash only)
 * - keyPrefix provides human-readable identification (first 8-12 chars)
 * - Supports scopes, expiration, and revocation
 * - Comprehensive usage tracking for analytics and audit
 *
 * Key Format: jk_live_abc123def456... or jk_test_xyz789...
 */

// ============================================================================
// 1. API KEYS TABLE
// ============================================================================

/**
 * API Keys - Secure storage and management of API authentication keys
 *
 * Security Features:
 * - Stores SHA-256 hash only (never plaintext)
 * - keyPrefix for display/identification
 * - Scoped permissions for fine-grained access control
 * - Soft revocation via isActive flag
 * - Optional expiration dates
 */
export const apiKeys = pgTable(
  'api_keys',
  {
    // Primary Key
    id: uuid('id').primaryKey().defaultRandom(),

    // User Association
    // Can reference Clerk user_id (text) or local users
    user_id: text('user_id').notNull(), // Owner of this API key

    // Key Identification
    name: varchar('name', { length: 100 }).notNull(), // Human-readable name (e.g., "Mobile App", "CI/CD Pipeline")
    key_hash: varchar('key_hash', { length: 64 }).notNull().unique(), // SHA-256 hash of the actual API key (64 hex chars)
    key_prefix: varchar('key_prefix', { length: 12 }).notNull(), // First 8-12 chars for display (e.g., "jk_live_abc1")

    // Permission Scopes
    // JSON array of permission strings
    // Examples: ["read:recipes", "write:recipes", "read:ingredients", "write:meals"]
    scopes: json('scopes').$type<string[]>().notNull().default([]),

    // Status and Lifecycle
    is_active: boolean('is_active').notNull().default(true), // Soft revocation without deletion
    last_used_at: timestamp('last_used_at'), // Last successful authentication
    expires_at: timestamp('expires_at'), // Optional expiration date (null = never expires)

    // Metadata
    description: text('description'), // Optional description of key purpose
    environment: varchar('environment', { length: 20 }).default('production'), // 'production', 'staging', 'development'

    // Usage Statistics (denormalized for performance)
    total_requests: integer('total_requests').notNull().default(0), // Total API calls made with this key
    last_ip_address: varchar('last_ip_address', { length: 45 }), // Last IP that used this key (IPv4 or IPv6)

    // Audit Trail
    created_by: text('created_by'), // User ID who created this key (may differ from user_id for admin-created keys)
    revoked_at: timestamp('revoked_at'), // When key was revoked (null if active)
    revoked_by: text('revoked_by'), // User ID who revoked this key
    revocation_reason: text('revocation_reason'), // Why was the key revoked

    // Timestamps
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    // Performance indexes
    userIdIdx: index('api_keys_user_id_idx').on(table.user_id),
    keyHashIdx: index('api_keys_key_hash_idx').on(table.key_hash), // Fast lookup during authentication
    keyPrefixIdx: index('api_keys_key_prefix_idx').on(table.key_prefix), // For display/search
    isActiveIdx: index('api_keys_is_active_idx').on(table.is_active),
    expiresAtIdx: index('api_keys_expires_at_idx').on(table.expires_at), // For expiration cleanup jobs
    createdAtIdx: index('api_keys_created_at_idx').on(table.created_at.desc()),
    lastUsedAtIdx: index('api_keys_last_used_at_idx').on(table.last_used_at.desc()), // For activity monitoring
    environmentIdx: index('api_keys_environment_idx').on(table.environment),

    // Composite indexes for common queries
    userActiveIdx: index('api_keys_user_active_idx').on(table.user_id, table.is_active),
  })
);

// ============================================================================
// 2. API KEY USAGE TABLE
// ============================================================================

/**
 * API Key Usage - Detailed tracking and analytics for API key activity
 *
 * Purpose:
 * - Audit trail for security
 * - Usage analytics and monitoring
 * - Rate limiting and abuse detection
 * - Billing/quota tracking (future)
 *
 * Retention Policy:
 * - Implement data retention policy in production (e.g., 90 days)
 * - Aggregate to summary tables for long-term analytics
 */
export const apiKeyUsage = pgTable(
  'api_key_usage',
  {
    // Primary Key
    id: uuid('id').primaryKey().defaultRandom(),

    // API Key Reference
    api_key_id: uuid('api_key_id')
      .notNull()
      .references(() => apiKeys.id, { onDelete: 'cascade' }), // Cascade delete when key is deleted

    // Request Details
    endpoint: varchar('endpoint', { length: 255 }).notNull(), // API endpoint called (e.g., "/api/recipes")
    method: varchar('method', { length: 10 }).notNull(), // HTTP method (GET, POST, PUT, DELETE, PATCH)
    status_code: integer('status_code').notNull(), // HTTP response status (200, 401, 404, 500, etc.)

    // Network Information
    ip_address: varchar('ip_address', { length: 45 }), // Request IP address (IPv4 or IPv6)
    user_agent: text('user_agent'), // Request user agent string

    // Performance Metrics
    response_time_ms: integer('response_time_ms'), // Response time in milliseconds

    // Request/Response Data (optional, for debugging)
    request_size_bytes: integer('request_size_bytes'), // Size of request body
    response_size_bytes: integer('response_size_bytes'), // Size of response body

    // Error Tracking
    error_message: text('error_message'), // Error message if request failed
    error_code: varchar('error_code', { length: 50 }), // Application error code

    // Metadata
    metadata: json('metadata').$type<Record<string, any>>(), // Additional custom metadata

    // Timestamp
    requested_at: timestamp('requested_at').notNull().defaultNow(),
  },
  (table) => ({
    // Performance indexes for analytics queries
    apiKeyIdIdx: index('api_key_usage_api_key_id_idx').on(table.api_key_id),
    requestedAtIdx: index('api_key_usage_requested_at_idx').on(table.requested_at.desc()),
    endpointIdx: index('api_key_usage_endpoint_idx').on(table.endpoint),
    statusCodeIdx: index('api_key_usage_status_code_idx').on(table.status_code),
    methodIdx: index('api_key_usage_method_idx').on(table.method),

    // Composite indexes for common analytics queries
    apiKeyDateIdx: index('api_key_usage_api_key_date_idx').on(
      table.api_key_id,
      table.requested_at.desc()
    ),
    endpointStatusIdx: index('api_key_usage_endpoint_status_idx').on(table.endpoint, table.status_code),

    // Index for error analysis
    errorIdx: index('api_key_usage_error_idx').on(table.error_code),

    // Index for performance monitoring
    responseTimeIdx: index('api_key_usage_response_time_idx').on(table.response_time_ms.desc()),
  })
);

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
export type ApiKeyUsage = typeof apiKeyUsage.$inferSelect;
export type NewApiKeyUsage = typeof apiKeyUsage.$inferInsert;

// ============================================================================
// ZOD VALIDATION SCHEMAS
// ============================================================================

export const insertApiKeySchema = createInsertSchema(apiKeys);
export const selectApiKeySchema = createSelectSchema(apiKeys);
export const insertApiKeyUsageSchema = createInsertSchema(apiKeyUsage);
export const selectApiKeyUsageSchema = createSelectSchema(apiKeyUsage);

// ============================================================================
// HELPER TYPES
// ============================================================================

/**
 * API Key with usage statistics (for display in management UI)
 */
export type ApiKeyWithStats = ApiKey & {
  usage_last_30_days: number;
  usage_last_7_days: number;
  usage_today: number;
};

/**
 * Detailed API Key info for admin/debugging
 */
export type ApiKeyDetails = ApiKey & {
  recent_usage: ApiKeyUsage[];
  total_usage_count: number;
};

/**
 * Common API key scopes (expand as needed)
 */
export const API_KEY_SCOPES = {
  // Recipe scopes
  READ_RECIPES: 'read:recipes',
  WRITE_RECIPES: 'write:recipes',
  DELETE_RECIPES: 'delete:recipes',

  // Ingredient scopes
  READ_INGREDIENTS: 'read:ingredients',
  WRITE_INGREDIENTS: 'write:ingredients',

  // Meal scopes
  READ_MEALS: 'read:meals',
  WRITE_MEALS: 'write:meals',
  DELETE_MEALS: 'delete:meals',

  // Collection scopes
  READ_COLLECTIONS: 'read:collections',
  WRITE_COLLECTIONS: 'write:collections',

  // Admin scopes
  ADMIN: 'admin:all',
  READ_ANALYTICS: 'read:analytics',
} as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[keyof typeof API_KEY_SCOPES];

/**
 * API Key environments
 */
export const API_KEY_ENVIRONMENTS = {
  PRODUCTION: 'production',
  STAGING: 'staging',
  DEVELOPMENT: 'development',
  TESTING: 'testing',
} as const;

export type ApiKeyEnvironment = (typeof API_KEY_ENVIRONMENTS)[keyof typeof API_KEY_ENVIRONMENTS];
