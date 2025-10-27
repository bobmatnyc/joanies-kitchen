/**
 * REST API v1 - API Keys Collection Endpoints
 *
 * GET    /api/v1/auth/keys - List user's API keys
 * POST   /api/v1/auth/keys - Create new API key
 *
 * Authentication: MUST use Clerk session (API key auth NOT allowed for key creation)
 * Authorization: Authenticated users can manage their own keys
 *
 * Security Notes:
 * - API key creation is ONLY allowed via Clerk session (not API key auth)
 * - This prevents API keys from creating new API keys (security risk)
 * - Full key is shown ONLY ONCE at creation
 * - After creation, only key prefix is visible
 */

import { type NextRequest, NextResponse } from 'next/server';
import { auth as clerkAuth } from '@clerk/nextjs/server';
import { ZodError } from 'zod';
import { createApiKey, listUserApiKeys } from '@/lib/api-auth';
import {
  createApiKeySchema,
  type CreateApiKeyInput,
} from '@/lib/validations/api-key-validation';

/**
 * GET /api/v1/auth/keys
 *
 * List all API keys for the authenticated user
 *
 * Authentication: Clerk session ONLY (API key auth NOT allowed)
 *
 * Response:
 * {
 *   success: true,
 *   data: [
 *     {
 *       id: "uuid",
 *       keyPrefix: "jk_live_abc1",  // Only prefix shown
 *       name: "Mobile App",
 *       scopes: ["read:recipes", "write:meals"],
 *       isActive: true,
 *       lastUsedAt: "2025-10-27T...",
 *       totalRequests: 152,
 *       expiresAt: null,
 *       createdAt: "2025-10-27T...",
 *       updatedAt: "2025-10-27T..."
 *     }
 *   ]
 * }
 *
 * Errors:
 * - 401: Not authenticated (must use Clerk session)
 * - 500: Internal server error
 */
export async function GET(request: NextRequest) {
  try {
    // CRITICAL: Only allow Clerk session authentication (not API keys)
    const session = await clerkAuth();

    if (!session.userId) {
      return NextResponse.json(
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
      );
    }

    // Fetch user's API keys (returns keys with prefix only, never full key)
    const apiKeys = await listUserApiKeys(session.userId);

    // Transform to response format
    const responseData = apiKeys.map((key) => ({
      id: key.id,
      keyPrefix: key.key_prefix,
      name: key.name,
      scopes: key.scopes as string[],
      description: key.description || null,
      isActive: key.is_active,
      lastUsedAt: key.last_used_at,
      totalRequests: key.total_requests,
      expiresAt: key.expires_at,
      environment: key.environment,
      createdAt: key.created_at,
      updatedAt: key.updated_at,
    }));

    return NextResponse.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error('Error listing API keys:', error);
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
 * POST /api/v1/auth/keys
 *
 * Create a new API key for the authenticated user
 *
 * Authentication: Clerk session ONLY (API key auth NOT allowed)
 *
 * Request Body:
 * {
 *   name: "Mobile App",
 *   scopes: ["read:recipes", "write:meals"],
 *   description?: "Optional description",
 *   expiresAt?: "2025-11-28T00:00:00Z"  // Optional expiration
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     id: "uuid",
 *     apiKey: "jk_live_abc123...",  // ⚠️ SHOWN ONLY ONCE
 *     keyPrefix: "jk_live_abc1",
 *     name: "Mobile App",
 *     scopes: ["read:recipes", "write:meals"],
 *     expiresAt: "2025-11-28T00:00:00Z",
 *     createdAt: "2025-10-27T...",
 *     warning: "This key will only be shown once. Store it securely."
 *   }
 * }
 *
 * Errors:
 * - 401: Not authenticated (must use Clerk session)
 * - 400: Invalid request body
 * - 500: Internal server error
 */
export async function POST(request: NextRequest) {
  try {
    // CRITICAL: Only allow Clerk session authentication (not API keys)
    const session = await clerkAuth();

    if (!session.userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
          reason: 'missing_auth',
          note: 'API key creation requires Clerk session authentication. API keys cannot create other API keys.',
        },
        {
          status: 401,
          headers: {
            'WWW-Authenticate': 'Session realm="API Key Management"',
          },
        }
      );
    }

    // Parse request body
    const body = await request.json();

    // Validate request body
    let validatedData: CreateApiKeyInput;
    try {
      validatedData = createApiKeySchema.parse(body);
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

    // Create the API key
    const result = await createApiKey({
      userId: session.userId,
      name: validatedData.name,
      scopes: validatedData.scopes,
      description: validatedData.description,
      expiresAt: validatedData.expiresAt,
      environment: 'production',
      createdBy: session.userId,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to create API key',
        },
        { status: 500 }
      );
    }

    // Return the full key (ONLY TIME it will be shown)
    return NextResponse.json(
      {
        success: true,
        data: {
          id: result.keyId,
          apiKey: result.apiKey, // ⚠️ FULL KEY - show only once
          keyPrefix: result.keyPrefix,
          name: validatedData.name,
          scopes: validatedData.scopes,
          description: validatedData.description || null,
          expiresAt: validatedData.expiresAt || null,
          createdAt: new Date(),
          warning: 'This key will only be shown once. Store it securely.',
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating API key:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
