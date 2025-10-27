# Unified Authentication Middleware

Complete authentication middleware supporting both Clerk (session-based) and API key (Bearer token) authentication for Next.js 15 API routes.

## Files Created

### Core Implementation

1. **`middleware.ts`** - Core authentication logic
   - `authenticateRequest()` - Main authentication function
   - Supports API keys, Basic auth (placeholder), and Clerk sessions
   - Returns unified `AuthContext`

2. **`require-auth.ts`** - Route wrappers
   - `requireAuth()` - Requires any valid authentication
   - `requireScopes()` - Requires specific scopes (ALL)
   - `requireAnyScope()` - Requires at least one scope (OR)
   - `optionalAuth()` - Authentication is optional
   - Automatic API key usage tracking

3. **`types.ts`** - Type definitions
   - `AuthContext` - Unified authentication result
   - `AuthType` - Authentication method types
   - `AuthenticatedHandler` - Handler function signatures
   - Error types and metadata structures

4. **`USAGE.md`** - Complete usage guide and examples

5. **`index.ts`** - Updated to export new middleware functions

## Quick Start

### Basic Authentication

```typescript
import { requireAuth } from '@/lib/api-auth';
import { NextResponse } from 'next/server';

export const GET = requireAuth(async (request, auth, context) => {
  // auth.userId is guaranteed to exist
  // auth.authType tells you how they authenticated

  const data = await getUserData(auth.userId);
  return NextResponse.json(data);
});
```

### Scope-Based Authorization

```typescript
import { requireScopes, SCOPES } from '@/lib/api-auth';

export const POST = requireScopes([SCOPES.WRITE_RECIPES], async (request, auth, context) => {
  // auth.scopes includes WRITE_RECIPES

  const body = await request.json();
  await createRecipe(auth.userId, body);
  return NextResponse.json({ success: true });
});
```

### Optional Authentication

```typescript
import { optionalAuth } from '@/lib/api-auth';

export const GET = optionalAuth(async (request, auth, context) => {
  if (auth.authenticated) {
    return NextResponse.json({ personalized: true, data: await getPersonalizedData(auth.userId) });
  }
  return NextResponse.json({ personalized: false, data: await getPublicData() });
});
```

## Authentication Methods

The middleware checks authentication in this priority order:

### 1. API Key (Bearer Token) - Highest Priority

**Client Request:**
```bash
curl -H "Authorization: Bearer jk_prod_..." \
     https://api.example.com/api/recipes
```

**Characteristics:**
- Validated against database
- Tracks usage automatically
- Returns custom scopes from key configuration
- Best for: Third-party integrations, mobile apps

### 2. Basic Auth (Username:Password) - Medium Priority

**Client Request:**
```bash
curl -u "username:password" \
     https://api.example.com/api/recipes
```

**Status:** Placeholder implementation (not yet fully functional)

### 3. Clerk Session - Lowest Priority (Fallback)

**Client Request:**
```javascript
// Uses existing session cookies
fetch('/api/recipes', { credentials: 'include' });
```

**Characteristics:**
- Automatic for web app requests
- Returns `SCOPE_GROUPS.USER` or `SCOPE_GROUPS.ADMIN` scopes
- Best for: Internal web app API calls

## AuthContext Structure

```typescript
interface AuthContext {
  authenticated: boolean;
  userId: string | null;
  authType: 'clerk' | 'api_key' | 'basic' | 'none';
  scopes: string[];
  apiKeyId?: string;
  apiKeyName?: string;
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    timestamp?: Date;
    isAdmin?: boolean;
    orgId?: string;
    environment?: 'production' | 'development';
  };
  error?: string;
  reason?: 'missing_auth' | 'invalid_format' | 'invalid_credentials' | 'expired' | 'revoked';
}
```

## Wrapper Functions

### `requireAuth(handler, options?)`

Requires any valid authentication (API key, Basic auth, or Clerk session).

```typescript
export const GET = requireAuth(async (request, auth, context) => {
  // Handler code
});
```

**Returns:**
- `401 Unauthorized` if not authenticated
- Calls handler with `AuthContext` if authenticated

### `requireScopes(scopes, handler, options?)`

Requires specific scopes (ALL must be present).

```typescript
export const POST = requireScopes(
  [SCOPES.WRITE_RECIPES, SCOPES.WRITE_INGREDIENTS],
  async (request, auth, context) => {
    // User has BOTH scopes
  }
);
```

**Returns:**
- `401 Unauthorized` if not authenticated
- `403 Forbidden` if missing required scopes
- Calls handler if all scopes present

### `requireAnyScope(scopes, handler, options?)`

Requires at least one scope (OR logic).

```typescript
export const GET = requireAnyScope(
  [SCOPES.READ_RECIPES, SCOPES.ADMIN_CONTENT],
  async (request, auth, context) => {
    // User has either READ_RECIPES OR ADMIN_CONTENT
  }
);
```

**Returns:**
- `401 Unauthorized` if not authenticated
- `403 Forbidden` if no matching scopes
- Calls handler if any scope matches

### `optionalAuth(handler, options?)`

Authentication is optional - handler always called.

```typescript
export const GET = optionalAuth(async (request, auth, context) => {
  // auth.authenticated may be true or false
  // Handle both cases
});
```

**Always calls handler** with `AuthContext` (may be unauthenticated).

## Error Responses

### 401 Unauthorized

```json
{
  "error": "Authentication required",
  "reason": "missing_auth",
  "authType": "none"
}
```

With `WWW-Authenticate` header:
```
WWW-Authenticate: Bearer realm="API", charset="UTF-8"
```

### 403 Forbidden

```json
{
  "error": "Insufficient permissions",
  "reason": "insufficient_scope",
  "required": ["write:recipes"],
  "provided": ["read:recipes"],
  "authType": "api_key"
}
```

## Available Scopes

```typescript
import { SCOPES } from '@/lib/api-auth';

// Recipe scopes
SCOPES.READ_RECIPES       // 'read:recipes'
SCOPES.WRITE_RECIPES      // 'write:recipes'
SCOPES.DELETE_RECIPES     // 'delete:recipes'
SCOPES.RECIPES_ALL        // 'recipes:*'

// Ingredient scopes
SCOPES.READ_INGREDIENTS   // 'read:ingredients'
SCOPES.WRITE_INGREDIENTS  // 'write:ingredients'

// Meal scopes
SCOPES.READ_MEALS         // 'read:meals'
SCOPES.WRITE_MEALS        // 'write:meals'

// Collection scopes
SCOPES.READ_COLLECTIONS   // 'read:collections'
SCOPES.WRITE_COLLECTIONS  // 'write:collections'

// Admin scopes
SCOPES.ADMIN_USERS        // 'admin:users'
SCOPES.ADMIN_CONTENT      // 'admin:content'
SCOPES.ADMIN_SYSTEM       // 'admin:system'

// Global wildcard
SCOPES.ALL                // '*' (use with caution)
```

## Usage Tracking

For API key authentication, every request is automatically tracked:

- Request count
- Response time
- Status code
- IP address
- User agent
- Error details (if failed)

This data is used for:
- Usage analytics
- Rate limiting
- Security audits
- Performance monitoring

## Migration from Direct Clerk Auth

**Before:**
```typescript
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Handler code
}
```

**After:**
```typescript
import { requireAuth } from '@/lib/api-auth';

export const GET = requireAuth(async (request, auth, context) => {
  // auth.userId is guaranteed
  // Handler code
});
```

**Benefits:**
- 60% less boilerplate
- Supports multiple auth methods
- Automatic usage tracking
- Consistent error responses
- Scope-based authorization

## Testing

### Test with API Key

```bash
export API_KEY="jk_prod_..."
curl -H "Authorization: Bearer $API_KEY" http://localhost:3002/api/recipes
```

### Test with Clerk Session

```javascript
// In browser (has cookies)
const response = await fetch('/api/recipes', {
  credentials: 'include'
});
```

### Test Unauthenticated

```bash
curl http://localhost:3002/api/recipes
# Should return 401 for protected routes
```

## Security Features

✅ API keys hashed with SHA-256
✅ Constant-time comparison (prevents timing attacks)
✅ Automatic expiration checking
✅ Revocation support with audit trail
✅ Comprehensive request logging
✅ IP and user agent tracking
✅ Rate limiting via usage tracking

## Integration with Existing Auth

Works seamlessly with existing authentication:

- **Clerk users**: Get `SCOPE_GROUPS.USER` scopes automatically
- **Admin users**: Get `SCOPE_GROUPS.ADMIN` scopes (based on `isAdmin` claim)
- **API keys**: Have custom scopes from their configuration

## Best Practices

1. **Use the most specific wrapper**: Use `requireScopes` over `requireAuth` when you need specific permissions

2. **Check scopes explicitly**: When behavior differs by permission level, check scopes in the handler

3. **Handle both auth states**: In `optionalAuth`, always handle both authenticated and unauthenticated cases

4. **Validate input**: Always validate request data even after authentication

5. **Use consistent error messages**: Return clear error messages for better API experience

6. **Test all auth methods**: Test your endpoints with API keys, Clerk sessions, and no auth

7. **Track usage**: Leave `trackUsage: true` (default) to monitor API key usage

## Troubleshooting

### "Type error: Route has an invalid export"

Make sure your handler includes the `context` parameter:

```typescript
// ❌ Wrong
export const GET = requireAuth(async (request, auth) => { ... });

// ✅ Correct
export const GET = requireAuth(async (request, auth, context) => { ... });
```

### "Cannot read property 'userId' of null"

Use `requireAuth` or check `auth.authenticated` before accessing `auth.userId`:

```typescript
export const GET = requireAuth(async (request, auth, context) => {
  // auth.userId is guaranteed here
});

// OR

export const GET = optionalAuth(async (request, auth, context) => {
  if (auth.authenticated) {
    // Now safe to use auth.userId
  }
});
```

### API key not being detected

Check that the `Authorization` header is set correctly:

```bash
# ✅ Correct
curl -H "Authorization: Bearer jk_prod_..." http://localhost:3002/api/recipes

# ❌ Wrong - missing "Bearer"
curl -H "Authorization: jk_prod_..." http://localhost:3002/api/recipes

# ❌ Wrong - using X-API-Key header
curl -H "X-API-Key: jk_prod_..." http://localhost:3002/api/recipes
```

## Next Steps

1. Read [USAGE.md](./USAGE.md) for detailed examples
2. Check [scopes.ts](./scopes.ts) for available permissions
3. See [key-service.ts](./key-service.ts) for API key management
4. Review [middleware.ts](./middleware.ts) for authentication logic

## Support

For issues or questions:
1. Check USAGE.md for examples
2. Review type definitions in types.ts
3. Check existing implementations in the codebase
4. Consult Next.js 15 App Router documentation

---

**Version:** 1.0.0
**Created:** 2025-10-27
**Supports:** Next.js 15, Clerk, API Keys, Basic Auth (placeholder)
