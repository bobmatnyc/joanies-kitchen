# API Keys Schema Documentation

## Overview

This schema provides a complete infrastructure for API key authentication and management to support dual authentication (Clerk for users + API keys for programmatic access).

## Database Tables

### 1. `api_keys` Table

Secure storage and management of API authentication keys.

**Key Features:**
- ✅ SHA-256 hashed keys (never stores plaintext)
- ✅ Scoped permissions for fine-grained access control
- ✅ Soft revocation without data loss
- ✅ Optional expiration dates
- ✅ Usage tracking (denormalized for performance)

**Fields:**
```typescript
{
  id: uuid,                    // Primary key
  user_id: text,              // Owner (Clerk user_id or local user)
  name: varchar(100),         // Human-readable name (e.g., "Mobile App")
  key_hash: varchar(64),      // SHA-256 hash (never plaintext!)
  key_prefix: varchar(12),    // First 8-12 chars for display (e.g., "jk_live_abc1")
  scopes: json[],             // Permission array (e.g., ["read:recipes", "write:meals"])
  is_active: boolean,         // Soft revocation flag
  last_used_at: timestamp,    // Last successful authentication
  expires_at: timestamp,      // Optional expiration (null = never)
  description: text,          // Optional purpose description
  environment: varchar(20),   // 'production', 'staging', 'development'
  total_requests: integer,    // Total API calls (denormalized)
  last_ip_address: varchar(45), // Last IP that used this key
  created_by: text,           // User ID who created this key
  revoked_at: timestamp,      // When key was revoked
  revoked_by: text,           // Who revoked the key
  revocation_reason: text,    // Why it was revoked
  created_at: timestamp,      // Creation timestamp
  updated_at: timestamp       // Last update timestamp
}
```

**Indexes:**
- `user_id` - Find all keys for a user
- `key_hash` - Fast authentication lookup
- `key_prefix` - Display/search by prefix
- `is_active` - Filter active/revoked keys
- `expires_at` - Expiration cleanup jobs
- `last_used_at` - Activity monitoring
- Composite: `(user_id, is_active)` - User's active keys

### 2. `api_key_usage` Table

Detailed tracking and analytics for API key activity.

**Purpose:**
- Security audit trail
- Usage analytics and monitoring
- Rate limiting and abuse detection
- Future billing/quota tracking

**Fields:**
```typescript
{
  id: uuid,                    // Primary key
  api_key_id: uuid,           // Reference to api_keys
  endpoint: varchar(255),     // API endpoint (e.g., "/api/recipes")
  method: varchar(10),        // HTTP method (GET, POST, etc.)
  status_code: integer,       // HTTP response status (200, 401, etc.)
  ip_address: varchar(45),    // Request IP (IPv4 or IPv6)
  user_agent: text,           // Request user agent string
  response_time_ms: integer,  // Response time in milliseconds
  request_size_bytes: integer,  // Request body size
  response_size_bytes: integer, // Response body size
  error_message: text,        // Error message if failed
  error_code: varchar(50),    // Application error code
  metadata: json,             // Additional custom metadata
  requested_at: timestamp     // Request timestamp
}
```

**Indexes:**
- `api_key_id` - All usage for a key
- `requested_at` - Time-based queries
- `endpoint` - Per-endpoint analytics
- `status_code` - Error analysis
- Composite: `(api_key_id, requested_at)` - Key activity over time
- Composite: `(endpoint, status_code)` - Endpoint error rates

**Data Retention:**
- Implement 90-day retention policy in production
- Aggregate to summary tables for long-term analytics

## Usage Examples

### Creating an API Key

```typescript
import { db } from '@/lib/db';
import { apiKeys, type NewApiKey } from '@/lib/db/api-keys-schema';
import { randomBytes, createHash } from 'crypto';

// Generate a new API key
function generateApiKey(environment: 'production' | 'staging' | 'development' = 'production'): string {
  const prefix = environment === 'production' ? 'jk_live_' : 'jk_test_';
  const randomPart = randomBytes(32).toString('hex');
  return `${prefix}${randomPart}`;
}

// Hash the API key for storage
function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

// Create a new API key
async function createApiKey(
  userId: string,
  name: string,
  scopes: string[],
  environment: 'production' | 'staging' | 'development' = 'production'
) {
  // Generate the actual key (show to user ONCE)
  const apiKey = generateApiKey(environment);

  // Extract prefix for display
  const keyPrefix = apiKey.substring(0, 12);

  // Hash for storage
  const keyHash = hashApiKey(apiKey);

  // Store in database
  const [newKey] = await db.insert(apiKeys).values({
    user_id: userId,
    name,
    key_hash: keyHash,
    key_prefix: keyPrefix,
    scopes,
    environment,
    created_by: userId,
  }).returning();

  // Return the full key ONCE (never stored!)
  return {
    ...newKey,
    apiKey, // Show to user immediately
  };
}

// Example: Create a key for mobile app
const result = await createApiKey(
  'user_12345',
  'Mobile App - iOS',
  ['read:recipes', 'read:ingredients', 'write:meals'],
  'production'
);

console.log('New API Key:', result.apiKey);
console.log('Key Prefix:', result.key_prefix);
console.log('IMPORTANT: Save this key! It will not be shown again.');
```

### Authenticating with an API Key

```typescript
import { db } from '@/lib/db';
import { apiKeys } from '@/lib/db/api-keys-schema';
import { eq } from 'drizzle-orm';
import { createHash } from 'crypto';

async function authenticateApiKey(providedKey: string) {
  // Hash the provided key
  const keyHash = createHash('sha256').update(providedKey).digest('hex');

  // Find matching key
  const [key] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.key_hash, keyHash))
    .limit(1);

  if (!key) {
    return { valid: false, reason: 'Invalid API key' };
  }

  if (!key.is_active) {
    return { valid: false, reason: 'API key has been revoked' };
  }

  if (key.expires_at && new Date() > key.expires_at) {
    return { valid: false, reason: 'API key has expired' };
  }

  // Update last used timestamp
  await db
    .update(apiKeys)
    .set({
      last_used_at: new Date(),
      total_requests: key.total_requests + 1,
    })
    .where(eq(apiKeys.id, key.id));

  return {
    valid: true,
    key,
    scopes: key.scopes as string[],
  };
}
```

### Tracking API Usage

```typescript
import { db } from '@/lib/db';
import { apiKeyUsage, type NewApiKeyUsage } from '@/lib/db/api-keys-schema';

async function trackApiUsage(
  apiKeyId: string,
  endpoint: string,
  method: string,
  statusCode: number,
  ipAddress: string,
  userAgent: string,
  responseTimeMs: number
) {
  await db.insert(apiKeyUsage).values({
    api_key_id: apiKeyId,
    endpoint,
    method,
    status_code: statusCode,
    ip_address: ipAddress,
    user_agent: userAgent,
    response_time_ms: responseTimeMs,
  });
}

// Example: Track a successful GET request
await trackApiUsage(
  'key-uuid-here',
  '/api/recipes',
  'GET',
  200,
  '192.168.1.1',
  'Mozilla/5.0...',
  125 // milliseconds
);
```

### Revoking an API Key

```typescript
import { db } from '@/lib/db';
import { apiKeys } from '@/lib/db/api-keys-schema';
import { eq } from 'drizzle-orm';

async function revokeApiKey(
  keyId: string,
  revokedBy: string,
  reason: string
) {
  await db
    .update(apiKeys)
    .set({
      is_active: false,
      revoked_at: new Date(),
      revoked_by: revokedBy,
      revocation_reason: reason,
      updated_at: new Date(),
    })
    .where(eq(apiKeys.id, keyId));
}

// Example: Revoke a compromised key
await revokeApiKey(
  'key-uuid-here',
  'admin_user_123',
  'Key compromised - user reported unauthorized access'
);
```

### Checking Scopes (Authorization)

```typescript
import { API_KEY_SCOPES } from '@/lib/db/api-keys-schema';

function hasScope(keyScopes: string[], requiredScope: string): boolean {
  // Check for admin scope (has all permissions)
  if (keyScopes.includes(API_KEY_SCOPES.ADMIN)) {
    return true;
  }

  // Check for exact scope match
  return keyScopes.includes(requiredScope);
}

// Example: Middleware for route protection
function requireScope(requiredScope: string) {
  return async (req, res, next) => {
    const { key } = req; // Assumes key from authentication middleware

    if (!hasScope(key.scopes, requiredScope)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: requiredScope,
      });
    }

    next();
  };
}

// Protect a route
app.get('/api/recipes', requireScope(API_KEY_SCOPES.READ_RECIPES), async (req, res) => {
  // Handler code
});
```

### Usage Analytics

```typescript
import { db } from '@/lib/db';
import { apiKeys, apiKeyUsage } from '@/lib/db/api-keys-schema';
import { eq, and, gte, sql } from 'drizzle-orm';

// Get usage statistics for a key
async function getKeyUsageStats(apiKeyId: string, daysBack: number = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);

  const stats = await db
    .select({
      total_requests: sql<number>`COUNT(*)`,
      total_errors: sql<number>`COUNT(*) FILTER (WHERE ${apiKeyUsage.status_code} >= 400)`,
      avg_response_time: sql<number>`AVG(${apiKeyUsage.response_time_ms})`,
      unique_ips: sql<number>`COUNT(DISTINCT ${apiKeyUsage.ip_address})`,
    })
    .from(apiKeyUsage)
    .where(
      and(
        eq(apiKeyUsage.api_key_id, apiKeyId),
        gte(apiKeyUsage.requested_at, cutoffDate)
      )
    );

  return stats[0];
}

// Get most used endpoints
async function getMostUsedEndpoints(apiKeyId: string, limit: number = 10) {
  return db
    .select({
      endpoint: apiKeyUsage.endpoint,
      count: sql<number>`COUNT(*)`,
    })
    .from(apiKeyUsage)
    .where(eq(apiKeyUsage.api_key_id, apiKeyId))
    .groupBy(apiKeyUsage.endpoint)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(limit);
}
```

## Migration

To apply this schema to your database:

```bash
# Generate migration
npx drizzle-kit generate:pg

# Apply migration
npx drizzle-kit push:pg
```

Or create a custom migration file:

```sql
-- migrations/XXXX_create_api_keys_tables.sql

-- Create api_keys table
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name VARCHAR(100) NOT NULL,
  key_hash VARCHAR(64) NOT NULL UNIQUE,
  key_prefix VARCHAR(12) NOT NULL,
  scopes JSON NOT NULL DEFAULT '[]'::json,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMP,
  expires_at TIMESTAMP,
  description TEXT,
  environment VARCHAR(20) DEFAULT 'production',
  total_requests INTEGER NOT NULL DEFAULT 0,
  last_ip_address VARCHAR(45),
  created_by TEXT,
  revoked_at TIMESTAMP,
  revoked_by TEXT,
  revocation_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for api_keys
CREATE INDEX api_keys_user_id_idx ON api_keys(user_id);
CREATE INDEX api_keys_key_hash_idx ON api_keys(key_hash);
CREATE INDEX api_keys_key_prefix_idx ON api_keys(key_prefix);
CREATE INDEX api_keys_is_active_idx ON api_keys(is_active);
CREATE INDEX api_keys_expires_at_idx ON api_keys(expires_at);
CREATE INDEX api_keys_last_used_at_idx ON api_keys(last_used_at DESC);
CREATE INDEX api_keys_environment_idx ON api_keys(environment);
CREATE INDEX api_keys_user_active_idx ON api_keys(user_id, is_active);

-- Create api_key_usage table
CREATE TABLE api_key_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  status_code INTEGER NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  response_time_ms INTEGER,
  request_size_bytes INTEGER,
  response_size_bytes INTEGER,
  error_message TEXT,
  error_code VARCHAR(50),
  metadata JSON,
  requested_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for api_key_usage
CREATE INDEX api_key_usage_api_key_id_idx ON api_key_usage(api_key_id);
CREATE INDEX api_key_usage_requested_at_idx ON api_key_usage(requested_at DESC);
CREATE INDEX api_key_usage_endpoint_idx ON api_key_usage(endpoint);
CREATE INDEX api_key_usage_status_code_idx ON api_key_usage(status_code);
CREATE INDEX api_key_usage_method_idx ON api_key_usage(method);
CREATE INDEX api_key_usage_api_key_date_idx ON api_key_usage(api_key_id, requested_at DESC);
CREATE INDEX api_key_usage_endpoint_status_idx ON api_key_usage(endpoint, status_code);
CREATE INDEX api_key_usage_error_idx ON api_key_usage(error_code);
CREATE INDEX api_key_usage_response_time_idx ON api_key_usage(response_time_ms DESC);
```

## Security Best Practices

1. **Never store plaintext keys** - Always use SHA-256 hashing
2. **Show keys only once** - On creation, display the full key to the user exactly once
3. **Use HTTPS only** - API keys must only be transmitted over secure connections
4. **Implement rate limiting** - Prevent abuse by limiting requests per key
5. **Rotate keys regularly** - Encourage users to rotate keys every 90 days
6. **Monitor for anomalies** - Track unusual usage patterns (location, request volume)
7. **Scope appropriately** - Grant minimum necessary permissions
8. **Set expiration dates** - Use time-limited keys for temporary access
9. **Audit regularly** - Review api_key_usage logs for security incidents

## Available Scopes

```typescript
API_KEY_SCOPES = {
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
}
```

## Future Enhancements

- [ ] Rate limiting per key (requests per minute/hour)
- [ ] Quota management (monthly request limits)
- [ ] Webhook support for key events (created, revoked, expired)
- [ ] Automated key rotation
- [ ] IP whitelisting/blacklisting
- [ ] Geographic restrictions
- [ ] Billing integration based on usage
- [ ] Key usage alerting (unusual patterns)
- [ ] Dashboard UI for key management
- [ ] Bulk key operations (revoke all, rotate all)

## TypeScript Types

```typescript
// Main types
type ApiKey = typeof apiKeys.$inferSelect;
type NewApiKey = typeof apiKeys.$inferInsert;
type ApiKeyUsage = typeof apiKeyUsage.$inferSelect;
type NewApiKeyUsage = typeof apiKeyUsage.$inferInsert;

// Helper types
type ApiKeyWithStats = ApiKey & {
  usage_last_30_days: number;
  usage_last_7_days: number;
  usage_today: number;
};

type ApiKeyDetails = ApiKey & {
  recent_usage: ApiKeyUsage[];
  total_usage_count: number;
};

type ApiKeyScope = (typeof API_KEY_SCOPES)[keyof typeof API_KEY_SCOPES];
type ApiKeyEnvironment = 'production' | 'staging' | 'development' | 'testing';
```
