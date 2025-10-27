# API Authentication System

Complete API key authentication and management system for Joanie's Kitchen.

## Features

- **Cryptographically Secure**: Uses Node.js `crypto.randomBytes` for secure key generation
- **SHA-256 Hashing**: Keys are hashed before storage (never stored in plaintext)
- **Environment-Aware**: Production (`jk_live_`) and development (`jk_test_`) key prefixes
- **Fine-Grained Permissions**: Scope-based access control with wildcard support
- **Usage Tracking**: Comprehensive analytics and audit trail
- **Soft Revocation**: Keys can be revoked without deletion for audit purposes

## Key Format

```
jk_{env}_{random}
```

- **Prefix**: `jk_` (Joanie's Kitchen identifier)
- **Environment**: `live` (production) or `test` (development/staging)
- **Random**: 32-48 bytes of cryptographically secure random data (hex encoded)

**Example**: `jk_live_a1b2c3d4e5f6789...`

## Quick Start

### 1. Create an API Key

```typescript
import { createApiKey, SCOPES } from '@/lib/api-auth';

const result = await createApiKey({
  userId: 'user_123',
  name: 'Mobile App',
  scopes: [SCOPES.READ_RECIPES, SCOPES.WRITE_MEALS],
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
});

if (result.success) {
  // IMPORTANT: Show this to the user ONCE - it can never be retrieved again
  console.log('Your API key:', result.apiKey);
  console.log('Key ID:', result.keyId);
  console.log('Display prefix:', result.keyPrefix);
}
```

### 2. Validate API Key During Request

```typescript
import { validateApiKey, hasScope, SCOPES } from '@/lib/api-auth';

// In your API route
const apiKey = request.headers.get('x-api-key');

const auth = await validateApiKey(apiKey);

if (!auth.valid) {
  return Response.json({ error: 'Invalid API key' }, { status: 401 });
}

// Check permissions
if (!hasScope(auth.scopes!, SCOPES.READ_RECIPES)) {
  return Response.json({ error: 'Insufficient permissions' }, { status: 403 });
}

// Proceed with request...
```

### 3. Track Usage

```typescript
import { trackApiUsage } from '@/lib/api-auth';

await trackApiUsage({
  keyId: auth.apiKey!.id,
  endpoint: '/api/recipes',
  method: 'GET',
  statusCode: 200,
  responseTimeMs: 45,
  ipAddress: request.headers.get('x-forwarded-for') || undefined,
});
```

## Available Scopes

### Recipe Scopes
- `read:recipes` - Read recipes
- `write:recipes` - Create and update recipes
- `delete:recipes` - Delete recipes
- `recipes:*` - Full access to recipes (wildcard)

### Ingredient Scopes
- `read:ingredients`
- `write:ingredients`
- `delete:ingredients`
- `ingredients:*`

### Meal Scopes
- `read:meals`
- `write:meals`
- `delete:meals`
- `meals:*`

### Collection Scopes
- `read:collections`
- `write:collections`
- `delete:collections`
- `collections:*`

### Admin Scopes
- `admin:users` - Manage user accounts
- `admin:content` - Manage site content
- `admin:system` - Manage system settings
- `admin:*` - Full admin access

### Global Wildcard
- `*` - Full access to all resources (use with extreme caution)

## Scope Groups

Pre-defined permission sets for common use cases:

```typescript
import { SCOPE_GROUPS } from '@/lib/api-auth';

// Read-only access
SCOPE_GROUPS.READ_ONLY

// Full user access
SCOPE_GROUPS.USER

// Content creator access
SCOPE_GROUPS.CREATOR

// Admin access
SCOPE_GROUPS.ADMIN
```

## API Reference

### Key Generation

#### `generateApiKey(environment?, lengthBytes?)`
Generate a cryptographically secure API key.

```typescript
const generated = generateApiKey('production', 32);
// Returns: { key, hash, prefix, environment }
```

#### `hashApiKey(apiKey)`
Hash an API key using SHA-256 for secure storage.

```typescript
const hash = hashApiKey('jk_live_abc123...');
```

#### `validateApiKeyFormat(apiKey)`
Validate API key format without database lookup.

```typescript
const validation = validateApiKeyFormat(apiKey);
if (validation.valid) {
  console.log('Environment:', validation.environment);
}
```

### Key Management

#### `createApiKey(params)`
Create and store a new API key.

```typescript
const result = await createApiKey({
  userId: 'user_123',
  name: 'Mobile App',
  scopes: ['read:recipes', 'write:meals'],
  description: 'API key for mobile app',
  expiresAt: new Date('2025-12-31'),
  environment: 'production',
});
```

#### `validateApiKey(providedKey)`
Validate an API key during authentication.

```typescript
const auth = await validateApiKey(apiKey);
if (auth.valid) {
  console.log('User ID:', auth.userId);
  console.log('Scopes:', auth.scopes);
}
```

#### `revokeApiKey(keyId, revokedBy, reason?)`
Revoke an API key (soft delete).

```typescript
await revokeApiKey('key_uuid', 'user_123', 'Key compromised');
```

#### `listUserApiKeys(userId, includeInactive?)`
List all API keys for a user.

```typescript
const keys = await listUserApiKeys('user_123');
keys.forEach(key => {
  console.log(`${key.name}: ${key.key_prefix}...`);
});
```

#### `updateApiKey(keyId, updates)`
Update API key metadata.

```typescript
await updateApiKey('key_uuid', {
  name: 'Updated Name',
  scopes: ['read:recipes', 'write:recipes'],
  expires_at: new Date('2026-01-01'),
});
```

### Usage Tracking

#### `trackApiUsage(params)`
Record API usage for analytics and audit.

```typescript
await trackApiUsage({
  keyId: 'key_uuid',
  endpoint: '/api/recipes',
  method: 'GET',
  statusCode: 200,
  responseTimeMs: 45,
  ipAddress: '192.168.1.1',
});
```

#### `getApiKeyUsage(keyId, startDate?, endDate?)`
Get usage statistics for an API key.

```typescript
const stats = await getApiKeyUsage('key_uuid');
console.log('Requests (24h):', stats.requestsLast24h);
console.log('Avg response time:', stats.averageResponseTime);
console.log('Error rate:', stats.errorRate);
```

### Permission Checking

#### `hasScope(userScopes, requiredScope)`
Check if user has a specific scope.

```typescript
if (hasScope(['read:recipes', 'write:recipes'], 'read:recipes')) {
  // Allow access
}

// Supports wildcards
if (hasScope(['recipes:*'], 'read:recipes')) {
  // Also allowed
}
```

#### `hasAllScopes(userScopes, requiredScopes)`
Check if user has ALL required scopes.

```typescript
if (hasAllScopes(userScopes, ['read:recipes', 'write:recipes'])) {
  // User has both scopes
}
```

#### `hasAnyScope(userScopes, requiredScopes)`
Check if user has ANY of the required scopes.

```typescript
if (hasAnyScope(userScopes, ['read:recipes', 'write:recipes'])) {
  // User has at least one scope
}
```

## Security Best Practices

1. **Never Log Full Keys**: Use `maskApiKey()` for logging
2. **Show Keys Only Once**: After creation, only show prefix
3. **Use HTTPS**: Always transmit keys over encrypted connections
4. **Rotate Keys Regularly**: Set expiration dates and rotate periodically
5. **Least Privilege**: Only grant scopes that are actually needed
6. **Monitor Usage**: Track usage patterns for anomaly detection
7. **Revoke Compromised Keys**: Immediately revoke if compromise suspected

## Database Schema

### `api_keys` Table

Stores API key metadata and hashes (never plaintext keys).

```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  name VARCHAR(100) NOT NULL,
  key_hash VARCHAR(64) NOT NULL UNIQUE,
  key_prefix VARCHAR(12) NOT NULL,
  scopes JSON NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMP,
  revoked_at TIMESTAMP,
  revoked_by TEXT,
  revocation_reason TEXT,
  total_requests INTEGER DEFAULT 0,
  last_used_at TIMESTAMP,
  last_ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### `api_key_usage` Table

Tracks every API request for analytics and audit.

```sql
CREATE TABLE api_key_usage (
  id UUID PRIMARY KEY,
  api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  status_code INTEGER NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  response_time_ms INTEGER,
  error_message TEXT,
  error_code VARCHAR(50),
  metadata JSON,
  requested_at TIMESTAMP DEFAULT NOW()
);
```

## Migration

If you already have an existing database, you'll need to run migrations to create the API keys tables:

```bash
# Generate migration
npx drizzle-kit generate:pg

# Apply migration
npx drizzle-kit push:pg
```

## Example: Complete API Route

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, hasScope, trackApiUsage, SCOPES } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  // Extract API key from header
  const apiKey = request.headers.get('x-api-key');

  if (!apiKey) {
    return NextResponse.json(
      { error: 'API key required' },
      { status: 401 }
    );
  }

  // Validate API key
  const startTime = Date.now();
  const auth = await validateApiKey(apiKey);

  if (!auth.valid) {
    // Track failed authentication
    return NextResponse.json(
      { error: 'Invalid or expired API key' },
      { status: 401 }
    );
  }

  // Check permissions
  if (!hasScope(auth.scopes!, SCOPES.READ_RECIPES)) {
    // Track unauthorized access
    await trackApiUsage({
      keyId: auth.apiKey!.id,
      endpoint: '/api/recipes',
      method: 'GET',
      statusCode: 403,
      responseTimeMs: Date.now() - startTime,
    });

    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 }
    );
  }

  // Fetch recipes...
  const recipes = await fetchRecipes();

  // Track successful request
  await trackApiUsage({
    keyId: auth.apiKey!.id,
    endpoint: '/api/recipes',
    method: 'GET',
    statusCode: 200,
    responseTimeMs: Date.now() - startTime,
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
    userAgent: request.headers.get('user-agent') || undefined,
  });

  return NextResponse.json({ recipes });
}
```

## Testing

```typescript
// Test key generation
import { generateApiKey, validateApiKeyFormat } from '@/lib/api-auth';

const generated = generateApiKey('development');
console.log('Generated key:', generated.key);

const validation = validateApiKeyFormat(generated.key);
console.log('Valid?', validation.valid);
console.log('Environment:', validation.environment);
```

## Support

For issues or questions:
- Check the inline documentation in the source files
- Review the type definitions for detailed parameter info
- Consult the integration tests for usage examples
