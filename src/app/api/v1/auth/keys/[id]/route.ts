/**
 * REST API v1 - Individual API Key Endpoints
 *
 * GET    /api/v1/auth/keys/:id - Get single API key details
 * PATCH  /api/v1/auth/keys/:id - Update API key (name, scopes, expiration)
 * DELETE /api/v1/auth/keys/:id - Revoke API key (soft delete)
 *
 * Authentication: Clerk session ONLY (API key auth NOT allowed)
 * Authorization: User must own the API key
 *
 * Security Notes:
 * - Only the owner can view/modify/revoke their keys
 * - Full key is NEVER returned (only prefix)
 * - Revoked keys cannot be re-activated
 * - Key hash and user_id cannot be modified
 */

import { type NextRequest, NextResponse } from 'next/server';
import { auth as clerkAuth } from '@clerk/nextjs/server';
import { ZodError } from 'zod';
import { getApiKeyById, updateApiKey, revokeApiKey } from '@/lib/api-auth';
import {
  updateApiKeySchema,
  type UpdateApiKeyInput,
} from '@/lib/validations/api-key-validation';
/**
 * Helper function to verify ownership and authenticate
 */
async function authenticateAndVerifyOwnership(keyId: string) {
  // CRITICAL: Only allow Clerk session authentication
  const session = await clerkAuth();

  if (!session.userId) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
          reason: 'missing_auth',
          note: 'API key management requires Clerk session authentication',
        },
        {
          status: 401,
          headers: {
            'WWW-Authenticate': 'Session realm="API Key Management"',
          },
        }
      ),
    };
  }

  // Fetch the API key
  const apiKey = await getApiKeyById(keyId);

  if (!apiKey) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: 'API key not found',
        },
        { status: 404 }
      ),
    };
  }

  // Verify ownership
  if (apiKey.user_id !== session.userId) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: 'Forbidden',
          reason: 'not_owner',
          note: 'You can only manage your own API keys',
        },
        { status: 403 }
      ),
    };
  }

  return {
    userId: session.userId,
    apiKey,
  };
}

/**
 * GET /api/v1/auth/keys/:id
 *
 * Get details of a specific API key
 *
 * Authentication: Clerk session ONLY
 * Authorization: User must own the key
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     id: "uuid",
 *     keyPrefix: "jk_live_abc1",  // Only prefix shown
 *     name: "Mobile App",
 *     scopes: ["read:recipes", "write:meals"],
 *     description: "...",
 *     isActive: true,
 *     lastUsedAt: "2025-10-27T...",
 *     totalRequests: 152,
 *     expiresAt: null,
 *     environment: "production",
 *     createdAt: "2025-10-27T...",
 *     updatedAt: "2025-10-27T..."
 *   }
 * }
 *
 * Errors:
 * - 401: Not authenticated
 * - 403: Not the owner of this key
 * - 404: Key not found
 * - 500: Internal server error
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Await params to comply with Next.js 15
    const params = await context.params;
    const keyId = params?.id as string;

    if (!keyId) {
      return NextResponse.json(
        {
          success: false,
          error: 'API key ID is required',
        },
        { status: 400 }
      );
    }

    // Authenticate and verify ownership
    const auth = await authenticateAndVerifyOwnership(keyId);
    if (auth.error) return auth.error;

    const { apiKey } = auth;

    // Return key details (without full key)
    return NextResponse.json({
      success: true,
      data: {
        id: apiKey.id,
        keyPrefix: apiKey.key_prefix,
        name: apiKey.name,
        scopes: apiKey.scopes as string[],
        description: apiKey.description || null,
        isActive: apiKey.is_active,
        lastUsedAt: apiKey.last_used_at,
        totalRequests: apiKey.total_requests,
        expiresAt: apiKey.expires_at,
        environment: apiKey.environment,
        createdAt: apiKey.created_at,
        updatedAt: apiKey.updated_at,
        revokedAt: apiKey.revoked_at || null,
        revocationReason: apiKey.revocation_reason || null,
      },
    });
  } catch (error) {
    console.error('Error fetching API key:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/v1/auth/keys/:id
 *
 * Update an API key's metadata
 *
 * Can update: name, description, scopes, expiresAt
 * Cannot update: key_hash, user_id (security)
 *
 * Authentication: Clerk session ONLY
 * Authorization: User must own the key
 *
 * Request Body (all optional):
 * {
 *   name?: "New Name",
 *   scopes?: ["read:recipes"],
 *   description?: "New description",
 *   expiresAt?: "2025-12-31T00:00:00Z" | null  // null removes expiration
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     id: "uuid",
 *     keyPrefix: "jk_live_abc1",
 *     // ... (same as GET response)
 *   }
 * }
 *
 * Errors:
 * - 401: Not authenticated
 * - 403: Not the owner of this key
 * - 404: Key not found
 * - 400: Invalid request body
 * - 500: Internal server error
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Await params to comply with Next.js 15
    const params = await context.params;
    const keyId = params?.id as string;

    if (!keyId) {
      return NextResponse.json(
        {
          success: false,
          error: 'API key ID is required',
        },
        { status: 400 }
      );
    }

    // Authenticate and verify ownership
    const auth = await authenticateAndVerifyOwnership(keyId);
    if (auth.error) return auth.error;

    // Parse request body
    const body = await request.json();

    // Validate request body
    let validatedData: UpdateApiKeyInput;
    try {
      validatedData = updateApiKeySchema.parse(body);
    } catch (error) {
      if (error instanceof ZodError) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid request body',
            details: error.errors,
          },
          { status: 400 }
        );
      }
      throw error;
    }

    // Check if there's anything to update
    if (Object.keys(validatedData).length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No fields to update',
        },
        { status: 400 }
      );
    }

    // Update the API key
    const success = await updateApiKey(keyId, {
      name: validatedData.name,
      description: validatedData.description,
      scopes: validatedData.scopes,
      expires_at: validatedData.expiresAt,
    });

    if (!success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to update API key',
        },
        { status: 500 }
      );
    }

    // Fetch updated key
    const updatedKey = await getApiKeyById(keyId);

    if (!updatedKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'API key not found after update',
        },
        { status: 500 }
      );
    }

    // Return updated key details
    return NextResponse.json({
      success: true,
      data: {
        id: updatedKey.id,
        keyPrefix: updatedKey.key_prefix,
        name: updatedKey.name,
        scopes: updatedKey.scopes as string[],
        description: updatedKey.description || null,
        isActive: updatedKey.is_active,
        lastUsedAt: updatedKey.last_used_at,
        totalRequests: updatedKey.total_requests,
        expiresAt: updatedKey.expires_at,
        environment: updatedKey.environment,
        createdAt: updatedKey.created_at,
        updatedAt: updatedKey.updated_at,
      },
    });
  } catch (error) {
    console.error('Error updating API key:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/auth/keys/:id
 *
 * Revoke an API key (soft delete)
 *
 * This marks the key as inactive and revoked.
 * The key remains in the database for audit purposes.
 * Revoked keys CANNOT be re-activated.
 *
 * Authentication: Clerk session ONLY
 * Authorization: User must own the key
 *
 * Response:
 * {
 *   success: true,
 *   message: "API key revoked successfully"
 * }
 *
 * Errors:
 * - 401: Not authenticated
 * - 403: Not the owner of this key
 * - 404: Key not found
 * - 500: Internal server error
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Await params to comply with Next.js 15
    const params = await context.params;
    const keyId = params?.id as string;

    if (!keyId) {
      return NextResponse.json(
        {
          success: false,
          error: 'API key ID is required',
        },
        { status: 400 }
      );
    }

    // Authenticate and verify ownership
    const auth = await authenticateAndVerifyOwnership(keyId);
    if (auth.error) return auth.error;

    const { userId } = auth;

    // Revoke the API key
    const success = await revokeApiKey(
      keyId,
      userId,
      'Revoked by user via API'
    );

    if (!success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to revoke API key',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'API key revoked successfully',
    });
  } catch (error) {
    console.error('Error revoking API key:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
