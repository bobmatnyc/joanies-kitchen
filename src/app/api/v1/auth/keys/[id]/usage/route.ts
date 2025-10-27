/**
 * REST API v1 - API Key Usage Analytics Endpoint
 *
 * GET /api/v1/auth/keys/:id/usage - Get usage statistics for an API key
 *
 * Authentication: Clerk session ONLY (API key auth NOT allowed)
 * Authorization: User must own the API key
 *
 * Provides detailed analytics:
 * - Total requests in period
 * - Requests by endpoint
 * - Requests by status code
 * - Timeline (daily breakdown)
 * - Average response time
 * - Error rate
 */

import { type NextRequest, NextResponse } from 'next/server';
import { auth as clerkAuth } from '@clerk/nextjs/server';
import { ZodError } from 'zod';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { getApiKeyById } from '@/lib/api-auth';
import { db } from '@/lib/db';
import { apiKeyUsage } from '@/lib/db/api-keys-schema';
import {
  usageQuerySchema,
  type UsageQueryParams,
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
          note: 'You can only view usage for your own API keys',
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
 * GET /api/v1/auth/keys/:id/usage
 *
 * Get usage statistics and analytics for an API key
 *
 * Authentication: Clerk session ONLY
 * Authorization: User must own the key
 *
 * Query Parameters:
 * - startDate: Start date for usage period (ISO 8601 format)
 * - endDate: End date for usage period (ISO 8601 format)
 * - endpoint: Filter by specific endpoint
 * - limit: Maximum number of timeline entries (default: 100, max: 1000)
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     keyId: "uuid",
 *     totalRequests: 152,
 *     period: {
 *       start: "2025-10-20T...",
 *       end: "2025-10-27T..."
 *     },
 *     byEndpoint: [
 *       { endpoint: "/api/v1/recipes", count: 120 },
 *       { endpoint: "/api/v1/meals", count: 32 }
 *     ],
 *     byStatus: [
 *       { status: 200, count: 140 },
 *       { status: 404, count: 10 },
 *       { status: 403, count: 2 }
 *     ],
 *     timeline: [
 *       { date: "2025-10-27", requests: 45 },
 *       { date: "2025-10-26", requests: 38 }
 *     ],
 *     averageResponseTime: 125,  // milliseconds
 *     errorRate: 0.079  // 7.9%
 *   }
 * }
 *
 * Errors:
 * - 401: Not authenticated
 * - 403: Not the owner of this key
 * - 404: Key not found
 * - 400: Invalid query parameters
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

    // Parse and validate query parameters
    const searchParams = request.nextUrl.searchParams;
    const queryParams: Record<string, any> = {};

    searchParams.forEach((value, key) => {
      queryParams[key] = value;
    });

    let validatedQuery: UsageQueryParams;
    try {
      validatedQuery = usageQuerySchema.parse(queryParams);
    } catch (error) {
      if (error instanceof ZodError) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid query parameters',
            details: error.errors,
          },
          { status: 400 }
        );
      }
      throw error;
    }

    // Build query conditions
    const conditions = [eq(apiKeyUsage.api_key_id, keyId)];

    if (validatedQuery.startDate) {
      conditions.push(gte(apiKeyUsage.requested_at, validatedQuery.startDate));
    }

    if (validatedQuery.endDate) {
      conditions.push(lte(apiKeyUsage.requested_at, validatedQuery.endDate));
    }

    if (validatedQuery.endpoint) {
      conditions.push(eq(apiKeyUsage.endpoint, validatedQuery.endpoint));
    }

    // Get total requests in period
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(apiKeyUsage)
      .where(and(...conditions));

    const totalRequests = totalResult?.count || 0;

    // Get requests by endpoint (top 10)
    const byEndpoint = await db
      .select({
        endpoint: apiKeyUsage.endpoint,
        count: sql<number>`count(*)::int`,
      })
      .from(apiKeyUsage)
      .where(and(...conditions))
      .groupBy(apiKeyUsage.endpoint)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    // Get requests by status code
    const byStatus = await db
      .select({
        status: apiKeyUsage.status_code,
        count: sql<number>`count(*)::int`,
      })
      .from(apiKeyUsage)
      .where(and(...conditions))
      .groupBy(apiKeyUsage.status_code)
      .orderBy(desc(sql`count(*)`));

    // Get timeline (daily breakdown)
    const timeline = await db
      .select({
        date: sql<string>`DATE(${apiKeyUsage.requested_at})::text`,
        requests: sql<number>`count(*)::int`,
      })
      .from(apiKeyUsage)
      .where(and(...conditions))
      .groupBy(sql`DATE(${apiKeyUsage.requested_at})`)
      .orderBy(desc(sql`DATE(${apiKeyUsage.requested_at})`))
      .limit(validatedQuery.limit);

    // Get average response time
    const [avgResponseTime] = await db
      .select({
        avg: sql<number>`avg(${apiKeyUsage.response_time_ms})::int`,
      })
      .from(apiKeyUsage)
      .where(and(...conditions, sql`${apiKeyUsage.response_time_ms} IS NOT NULL`));

    // Calculate error rate (4xx and 5xx status codes)
    const [errorCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(apiKeyUsage)
      .where(and(...conditions, sql`${apiKeyUsage.status_code} >= 400`));

    const errorRate = totalRequests > 0 ? (errorCount?.count || 0) / totalRequests : 0;

    // Build response
    return NextResponse.json({
      success: true,
      data: {
        keyId,
        totalRequests,
        period: {
          start: validatedQuery.startDate || null,
          end: validatedQuery.endDate || null,
        },
        byEndpoint: byEndpoint.map((e) => ({
          endpoint: e.endpoint,
          count: e.count,
        })),
        byStatus: byStatus.map((s) => ({
          status: s.status,
          count: s.count,
        })),
        timeline: timeline.map((t) => ({
          date: t.date,
          requests: t.requests,
        })),
        averageResponseTime: avgResponseTime?.avg || undefined,
        errorRate,
      },
    });
  } catch (error) {
    console.error('Error fetching API key usage:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
