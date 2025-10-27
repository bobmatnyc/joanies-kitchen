# API Authentication Middleware - Usage Guide

This guide covers how to use the unified authentication middleware in your Next.js API routes.

## Table of Contents

- [Overview](#overview)
- [Basic Usage](#basic-usage)
- [Authentication Methods](#authentication-methods)
- [Wrapper Functions](#wrapper-functions)
- [Examples](#examples)
- [Error Handling](#error-handling)
- [Testing](#testing)

## Overview

The authentication middleware supports three authentication methods:

1. **API Keys** (Bearer token) - Priority 1
2. **Basic Auth** (username:password) - Priority 2
3. **Clerk Session** (cookies) - Priority 3 (fallback)

The middleware automatically detects the authentication method and returns a unified `AuthContext` with user information and scopes.

## Basic Usage

### Simple Authentication

Require any valid authentication:

```typescript
// src/app/api/recipes/route.ts
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';

export const GET = requireAuth(async (request, auth) => {
  // auth.userId is guaranteed to exist
  // auth.authType will be 'clerk' | 'api_key' | 'basic'

  const recipes = await getRecipesForUser(auth.userId);
  return NextResponse.json(recipes);
});
```

### Scope-Based Authorization

Require specific permissions:

```typescript
// src/app/api/recipes/create/route.ts
import { NextResponse } from 'next/server';
import { requireScopes, SCOPES } from '@/lib/api-auth';

export const POST = requireScopes([SCOPES.WRITE_RECIPES], async (request, auth) => {
  // auth.userId is guaranteed
  // auth.scopes includes WRITE_RECIPES

  const data = await request.json();
  const recipe = await createRecipe(auth.userId, data);
  return NextResponse.json(recipe);
});
```

### Optional Authentication

Allow both authenticated and unauthenticated requests:

```typescript
// src/app/api/recipes/public/route.ts
import { NextResponse } from 'next/server';
import { optionalAuth } from '@/lib/api-auth';

export const GET = optionalAuth(async (request, auth) => {
  if (auth.authenticated) {
    // Show personalized content
    const recipes = await getPersonalizedRecipes(auth.userId);
    return NextResponse.json({ personalized: true, recipes });
  } else {
    // Show public content
    const recipes = await getPublicRecipes();
    return NextResponse.json({ personalized: false, recipes });
  }
});
```

## Authentication Methods

### 1. API Key (Bearer Token)

**Client Request:**
```bash
curl -H "Authorization: Bearer jk_prod_AbCd123..." \
     https://api.example.com/api/recipes
```

**Characteristics:**
- Highest priority (checked first)
- Validated against database
- Tracks usage automatically
- Returns scopes from API key configuration
- Best for: Third-party integrations, mobile apps

### 2. Basic Auth (Username:Password)

**Client Request:**
```bash
curl -u "username:password" \
     https://api.example.com/api/recipes

# Or with explicit header:
curl -H "Authorization: Basic dXNlcm5hbWU6cGFzc3dvcmQ=" \
     https://api.example.com/api/recipes
```

**Characteristics:**
- Second priority
- Not yet fully implemented (placeholder)
- Best for: Simple authentication, legacy systems

### 3. Clerk Session

**Client Request:**
```bash
# No special headers needed - uses cookies
curl --cookie "session=..." \
     https://api.example.com/api/recipes
```

**Characteristics:**
- Lowest priority (fallback)
- Uses existing Clerk session from browser
- Returns standard user scopes or admin scopes
- Best for: Web app API calls, internal routes

## Wrapper Functions

### `requireAuth(handler, options?)`

Requires any valid authentication.

```typescript
export const GET = requireAuth(async (request, auth) => {
  // Handler code
}, {
  trackUsage: true, // Track API key usage (default: true)
  usageMetadata: { endpoint: 'recipes-list' }
});
```

**Returns:**
- `401 Unauthorized` if not authenticated
- Calls handler with `AuthContext` if authenticated

### `requireScopes(scopes, handler, options?)`

Requires specific scopes (ALL required).

```typescript
export const POST = requireScopes(
  [SCOPES.WRITE_RECIPES, SCOPES.WRITE_INGREDIENTS],
  async (request, auth) => {
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
  async (request, auth) => {
    // User has either READ_RECIPES OR ADMIN_CONTENT
  }
);
```

**Returns:**
- `401 Unauthorized` if not authenticated
- `403 Forbidden` if no matching scopes
- Calls handler if any scope matches

### `optionalAuth(handler, options?)`

Authentication is optional.

```typescript
export const GET = optionalAuth(async (request, auth) => {
  // auth.authenticated may be true or false
  // Handle both cases
});
```

**Always calls handler** with `AuthContext` (may be unauthenticated).

## Examples

### Example 1: Protected Recipe Creation

```typescript
// src/app/api/recipes/route.ts
import { NextResponse } from 'next/server';
import { requireScopes, SCOPES } from '@/lib/api-auth';

export const POST = requireScopes([SCOPES.WRITE_RECIPES], async (request, auth) => {
  try {
    const data = await request.json();

    // Validate input
    if (!data.title || !data.ingredients) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create recipe for authenticated user
    const recipe = await createRecipe({
      ...data,
      userId: auth.userId,
      createdBy: auth.authType, // Track how they authenticated
    });

    return NextResponse.json(recipe, { status: 201 });
  } catch (error) {
    console.error('Recipe creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create recipe' },
      { status: 500 }
    );
  }
});
```

### Example 2: Admin-Only Endpoint

```typescript
// src/app/api/admin/users/route.ts
import { NextResponse } from 'next/server';
import { requireScopes, SCOPES } from '@/lib/api-auth';

export const GET = requireScopes([SCOPES.ADMIN_USERS], async (request, auth) => {
  // Only users with admin:users scope can access

  const users = await getAllUsers();
  return NextResponse.json(users);
});

export const DELETE = requireScopes([SCOPES.ADMIN_USERS], async (request, auth) => {
  const { userId } = await request.json();

  // Prevent self-deletion
  if (userId === auth.userId) {
    return NextResponse.json(
      { error: 'Cannot delete your own account' },
      { status: 400 }
    );
  }

  await deleteUser(userId);
  return NextResponse.json({ success: true });
});
```

### Example 3: Multi-Method Authentication

```typescript
// src/app/api/recipes/[slug]/route.ts
import { NextResponse } from 'next/server';
import { optionalAuth } from '@/lib/api-auth';

export const GET = optionalAuth(async (request, auth, params) => {
  const slug = params?.slug as string;
  const recipe = await getRecipeBySlug(slug);

  if (!recipe) {
    return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
  }

  // Check if user can access this recipe
  if (!recipe.isPublic && !auth.authenticated) {
    return NextResponse.json(
      { error: 'Authentication required for private recipes' },
      { status: 401 }
    );
  }

  if (recipe.userId !== auth.userId && !recipe.isPublic) {
    return NextResponse.json(
      { error: 'Access denied' },
      { status: 403 }
    );
  }

  // Log analytics based on auth type
  await logRecipeView(recipe.id, {
    userId: auth.userId,
    authType: auth.authType,
    isAuthenticated: auth.authenticated,
  });

  return NextResponse.json(recipe);
});
```

### Example 4: Checking Auth Without Wrapper

```typescript
// src/app/api/custom/route.ts
import { NextResponse } from 'next/server';
import { authenticateRequest, authHasScope, SCOPES } from '@/lib/api-auth';

export async function POST(request: NextRequest) {
  // Manually authenticate
  const auth = await authenticateRequest(request);

  if (!auth.authenticated) {
    return NextResponse.json({ error: 'Auth required' }, { status: 401 });
  }

  // Check specific scope
  if (authHasScope(auth, SCOPES.WRITE_RECIPES)) {
    // User can write recipes
    return NextResponse.json({ canWrite: true });
  }

  return NextResponse.json({ canWrite: false });
}
```

### Example 5: Flexible Scope Requirements

```typescript
// src/app/api/content/route.ts
import { NextResponse } from 'next/server';
import { requireAnyScope, SCOPES } from '@/lib/api-auth';

// Allow either content creators OR admins
export const GET = requireAnyScope(
  [SCOPES.WRITE_RECIPES, SCOPES.ADMIN_CONTENT],
  async (request, auth) => {
    // User has at least one of the required scopes
    const isAdmin = auth.scopes.includes(SCOPES.ADMIN_CONTENT);

    const content = isAdmin
      ? await getAllContent()
      : await getUserContent(auth.userId);

    return NextResponse.json(content);
  }
);
```

## Error Handling

### Standard Error Responses

**401 Unauthorized:**
```json
{
  "error": "Authentication required",
  "reason": "missing_auth",
  "authType": "none"
}
```

**403 Forbidden:**
```json
{
  "error": "Insufficient permissions",
  "reason": "insufficient_scope",
  "required": ["write:recipes"],
  "provided": ["read:recipes"],
  "authType": "api_key"
}
```

### Custom Error Handling

```typescript
export const GET = requireAuth(async (request, auth) => {
  // Handler
}, {
  onError: (error) => {
    // Custom error response
    return NextResponse.json(
      {
        error: 'Custom error message',
        details: error.message
      },
      { status: error.statusCode || 401 }
    );
  }
});
```

## Testing

### Testing with API Keys

```bash
# Set API key in environment
export API_KEY="jk_prod_AbCdEf123456..."

# Make authenticated request
curl -H "Authorization: Bearer $API_KEY" \
     http://localhost:3002/api/recipes
```

### Testing with Clerk Session

```javascript
// In your frontend code
const response = await fetch('/api/recipes', {
  credentials: 'include', // Include cookies
});
```

### Testing Unauthenticated

```bash
# Request without auth header
curl http://localhost:3002/api/recipes
# Should return 401 for protected routes
```

## Available Scopes

```typescript
import { SCOPES } from '@/lib/api-auth';

SCOPES.READ_RECIPES      // 'read:recipes'
SCOPES.WRITE_RECIPES     // 'write:recipes'
SCOPES.DELETE_RECIPES    // 'delete:recipes'
SCOPES.RECIPES_ALL       // 'recipes:*'

SCOPES.READ_INGREDIENTS  // 'read:ingredients'
SCOPES.WRITE_INGREDIENTS // 'write:ingredients'

SCOPES.READ_MEALS        // 'read:meals'
SCOPES.WRITE_MEALS       // 'write:meals'

SCOPES.READ_COLLECTIONS  // 'read:collections'
SCOPES.WRITE_COLLECTIONS // 'write:collections'

SCOPES.READ_INVENTORY    // 'read:inventory'
SCOPES.WRITE_INVENTORY   // 'write:inventory'

SCOPES.ADMIN_USERS       // 'admin:users'
SCOPES.ADMIN_CONTENT     // 'admin:content'
SCOPES.ADMIN_SYSTEM      // 'admin:system'

SCOPES.ALL               // '*' (use with caution)
```

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
  };
  error?: string;
  reason?: 'missing_auth' | 'invalid_format' | 'invalid_credentials' | 'expired' | 'revoked';
}
```

## Best Practices

1. **Use the Most Specific Wrapper**: Use `requireScopes` over `requireAuth` when you need specific permissions

2. **Track API Key Usage**: Leave `trackUsage: true` (default) to monitor API key usage

3. **Log Authentication Type**: Use `auth.authType` to understand how users are authenticating

4. **Check Scopes Explicitly**: When behavior differs by permission level, check scopes in handler

5. **Handle Both Auth States**: In `optionalAuth`, always handle both authenticated and unauthenticated cases

6. **Validate Input**: Always validate request data even after authentication

7. **Use Consistent Error Messages**: Return clear error messages for better API experience

8. **Test All Auth Methods**: Test your endpoints with API keys, Clerk sessions, and no auth

## Migration from Direct Clerk Auth

**Before:**
```typescript
import { auth } from '@clerk/nextjs/server';

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

export const GET = requireAuth(async (request, auth) => {
  // auth.userId is guaranteed
  // Handler code
});
```

**Benefits:**
- Supports multiple auth methods
- Automatic usage tracking
- Consistent error responses
- Scope-based authorization
- Less boilerplate
