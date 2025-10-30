/**
 * API Key Authentication - Usage Examples
 *
 * This file demonstrates common usage patterns for the API authentication system.
 * These are example implementations - adapt to your specific use case.
 */

import type { NextRequest } from 'next/server';
import {
  createApiKey,
  getApiKeyUsage,
  hasAllScopes,
  hasScope,
  listUserApiKeys,
  revokeApiKey,
  SCOPE_GROUPS,
  SCOPES,
  trackApiUsage,
  validateApiKey,
} from '@/lib/api-auth';

// ============================================================================
// EXAMPLE 1: Create an API Key for a User
// ============================================================================

export async function exampleCreateApiKey(userId: string) {
  // Create a new API key with specific permissions
  const result = await createApiKey({
    userId,
    name: 'Mobile App',
    scopes: [SCOPES.READ_RECIPES, SCOPES.WRITE_RECIPES, SCOPES.READ_MEALS, SCOPES.WRITE_MEALS],
    description: 'API key for mobile app access',
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
    environment: 'production',
  });

  if (result.success) {
    // IMPORTANT: This is the ONLY time the full key is available
    console.log('='.repeat(60));
    console.log('API KEY CREATED SUCCESSFULLY');
    console.log('='.repeat(60));
    console.log('');
    console.log('API Key (COPY THIS NOW - will never be shown again):');
    console.log(result.apiKey);
    console.log('');
    console.log('Key ID:', result.keyId);
    console.log('Display Prefix:', result.keyPrefix);
    console.log('');
    console.log('Keep this key secure and never share it publicly.');
    console.log('='.repeat(60));

    // Return only safe-to-store information
    return {
      success: true,
      keyId: result.keyId,
      keyPrefix: result.keyPrefix,
    };
  } else {
    console.error('Failed to create API key:', result.error);
    return result;
  }
}

// ============================================================================
// EXAMPLE 2: Validate API Key in API Route
// ============================================================================

export async function exampleApiRouteWithAuth(request: NextRequest) {
  const startTime = Date.now();

  // Extract API key from header
  const apiKey = request.headers.get('x-api-key');

  if (!apiKey) {
    return Response.json(
      { error: 'Missing API key. Provide in x-api-key header.' },
      { status: 401 }
    );
  }

  // Validate the API key
  const auth = await validateApiKey(apiKey);

  if (!auth.valid) {
    return Response.json(
      {
        error: 'Invalid or expired API key',
        reason: auth.reason,
      },
      { status: 401 }
    );
  }

  // Check if user has required permissions
  if (!hasScope(auth.scopes!, SCOPES.READ_RECIPES)) {
    // Track unauthorized attempt
    await trackApiUsage({
      keyId: auth.apiKey?.id,
      endpoint: '/api/recipes',
      method: 'GET',
      statusCode: 403,
      responseTimeMs: Date.now() - startTime,
    });

    return Response.json(
      { error: 'Insufficient permissions. Required: read:recipes' },
      { status: 403 }
    );
  }

  // Process the actual request...
  const recipes = await fetchRecipes(); // Your business logic

  // Track successful request
  await trackApiUsage({
    keyId: auth.apiKey?.id,
    endpoint: '/api/recipes',
    method: 'GET',
    statusCode: 200,
    responseTimeMs: Date.now() - startTime,
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
    userAgent: request.headers.get('user-agent') || undefined,
  });

  return Response.json({ recipes });
}

// Placeholder function for example
async function fetchRecipes() {
  return [{ id: '1', name: 'Example Recipe' }];
}

// ============================================================================
// EXAMPLE 3: Admin Endpoint with Multiple Scope Requirements
// ============================================================================

export async function exampleAdminEndpoint(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');

  if (!apiKey) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  const auth = await validateApiKey(apiKey);

  if (!auth.valid) {
    return Response.json({ error: 'Invalid API key' }, { status: 401 });
  }

  // Require ALL of these scopes for admin operations
  const requiredScopes = [SCOPES.ADMIN_CONTENT, SCOPES.WRITE_RECIPES];

  if (!hasAllScopes(auth.scopes!, requiredScopes)) {
    return Response.json(
      {
        error: 'Insufficient permissions',
        required: requiredScopes,
        current: auth.scopes,
      },
      { status: 403 }
    );
  }

  // Admin operation...
  return Response.json({ success: true });
}

// ============================================================================
// EXAMPLE 4: List User's API Keys (Dashboard)
// ============================================================================

export async function exampleListUserKeys(userId: string) {
  const keys = await listUserApiKeys(userId);

  console.log(`\nAPI Keys for user ${userId}:\n`);

  if (keys.length === 0) {
    console.log('No API keys found.');
    return;
  }

  keys.forEach((key, index) => {
    console.log(`${index + 1}. ${key.name}`);
    console.log(`   Prefix: ${key.key_prefix}...`);
    console.log(`   Status: ${key.is_active ? 'Active' : 'Inactive'}`);
    console.log(`   Scopes: ${(key.scopes as string[]).join(', ')}`);
    console.log(`   Created: ${key.created_at.toLocaleDateString()}`);
    console.log(`   Last used: ${key.last_used_at?.toLocaleDateString() || 'Never'}`);
    console.log(`   Total requests: ${key.total_requests}`);
    console.log('');
  });
}

// ============================================================================
// EXAMPLE 5: Get Usage Statistics
// ============================================================================

export async function exampleGetUsageStats(keyId: string) {
  const stats = await getApiKeyUsage(keyId);

  console.log(`\nUsage Statistics for Key ${keyId}:\n`);
  console.log(`Total Requests: ${stats.totalRequests}`);
  console.log(`Last 24 hours: ${stats.requestsLast24h}`);
  console.log(`Last 7 days: ${stats.requestsLast7Days}`);
  console.log(`Last 30 days: ${stats.requestsLast30Days}`);

  if (stats.averageResponseTime) {
    console.log(`Average Response Time: ${stats.averageResponseTime}ms`);
  }

  if (stats.errorRate) {
    console.log(`Error Rate: ${(stats.errorRate * 100).toFixed(2)}%`);
  }

  if (stats.mostUsedEndpoints.length > 0) {
    console.log('\nMost Used Endpoints:');
    stats.mostUsedEndpoints.forEach((endpoint, i) => {
      console.log(`  ${i + 1}. ${endpoint.endpoint}: ${endpoint.count} requests`);
    });
  }
}

// ============================================================================
// EXAMPLE 6: Revoke an API Key
// ============================================================================

export async function exampleRevokeKey(keyId: string, revokedBy: string, reason: string) {
  const success = await revokeApiKey(keyId, revokedBy, reason);

  if (success) {
    console.log(`API key ${keyId} has been revoked.`);
    console.log(`Reason: ${reason}`);
    return { success: true };
  } else {
    console.error(`Failed to revoke API key ${keyId}`);
    return { success: false };
  }
}

// ============================================================================
// EXAMPLE 7: Using Scope Groups for Quick Setup
// ============================================================================

export async function exampleCreateKeyWithScopeGroup(userId: string) {
  // Use predefined scope group for common use cases
  const result = await createApiKey({
    userId,
    name: 'Full User Access',
    scopes: [...SCOPE_GROUPS.USER], // Predefined scope set (spread to make mutable)
    description: 'Standard user permissions',
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
  });

  return result;
}

// ============================================================================
// EXAMPLE 8: Rate Limiting Check (Advanced)
// ============================================================================

export async function exampleRateLimitCheck(keyId: string): Promise<boolean> {
  const stats = await getApiKeyUsage(keyId);

  // Example: Limit to 1000 requests per 24 hours
  const RATE_LIMIT = 1000;

  if (stats.requestsLast24h >= RATE_LIMIT) {
    console.log(`Rate limit exceeded for key ${keyId}`);
    return false;
  }

  return true;
}

// ============================================================================
// EXAMPLE 9: Middleware Pattern for Next.js API Routes
// ============================================================================

export function withApiKeyAuth(requiredScopes: string[]) {
  return async function middleware(request: NextRequest, handler: Function) {
    const startTime = Date.now();
    const apiKey = request.headers.get('x-api-key');

    if (!apiKey) {
      return Response.json({ error: 'API key required' }, { status: 401 });
    }

    const auth = await validateApiKey(apiKey);

    if (!auth.valid) {
      return Response.json({ error: 'Invalid API key' }, { status: 401 });
    }

    // Check scopes
    if (!hasAllScopes(auth.scopes!, requiredScopes)) {
      await trackApiUsage({
        keyId: auth.apiKey?.id,
        endpoint: request.url,
        method: request.method,
        statusCode: 403,
        responseTimeMs: Date.now() - startTime,
      });

      return Response.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Call the actual handler with auth context
    const response = await handler(request, auth);

    // Track successful request
    await trackApiUsage({
      keyId: auth.apiKey?.id,
      endpoint: request.url,
      method: request.method,
      statusCode: 200,
      responseTimeMs: Date.now() - startTime,
    });

    return response;
  };
}

// Usage:
// export const GET = withApiKeyAuth([SCOPES.READ_RECIPES])(
//   async (request, auth) => {
//     // Your handler logic here
//     return Response.json({ data: 'protected data' });
//   }
// );

// ============================================================================
// EXAMPLE 10: Development vs Production Keys
// ============================================================================

export async function exampleCreateDevelopmentKey(userId: string) {
  // Create a test key for development
  const result = await createApiKey({
    userId,
    name: 'Development Testing',
    scopes: [...SCOPE_GROUPS.READ_ONLY], // Spread to make mutable
    environment: 'development', // Creates jk_test_ prefix
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  });

  if (result.success) {
    console.log('Development key created:', result.keyPrefix);
    console.log('Full key:', result.apiKey);
  }

  return result;
}
