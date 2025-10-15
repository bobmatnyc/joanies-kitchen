/**
 * Clerk Proxy API Route
 * Handles proxying requests to Clerk API with domain bypass for development
 */

import { NextRequest, NextResponse } from 'next/server';

// Clerk API configuration
const CLERK_API_URL = 'https://api.clerk.com';
const CLERK_FRONTEND_API = 'https://clerk.recipes.help';

/**
 * Handle all HTTP methods for Clerk proxy
 */
async function handleRequest(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const params = await context.params;
  // Only allow proxy in development with production keys
  const isProdKeys = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_live_');
  const isDev = process.env.NODE_ENV === 'development';

  if (!isProdKeys || !isDev) {
    return NextResponse.json(
      { error: 'Proxy not available' },
      { status: 403 }
    );
  }

  // Reconstruct the path
  const path = params.path.join('/');
  const url = new URL(request.url);

  // Determine target URL based on the path
  let targetUrl: string;
  if (path.startsWith('v1/')) {
    targetUrl = `${CLERK_API_URL}/${path}${url.search}`;
  } else {
    targetUrl = `${CLERK_FRONTEND_API}/${path}${url.search}`;
  }

  // Create modified headers
  const headers = new Headers(request.headers);

  // Override headers to bypass domain restriction
  headers.set('Origin', 'https://recipes.help');
  headers.set('Referer', 'https://recipes.help/');
  headers.set('X-Forwarded-Host', 'recipes.help');
  headers.set('X-Forwarded-Proto', 'https');
  headers.delete('Host'); // Remove localhost host header

  // Handle request body for POST/PUT/PATCH
  let body: BodyInit | undefined;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    try {
      body = await request.text();
    } catch {
      body = undefined;
    }
  }

  try {
    // Make the proxied request
    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
      credentials: 'include',
    });

    // Get response body
    const responseBody = await response.text();

    // Create response with proper CORS headers
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('Access-Control-Allow-Origin', 'http://localhost:3004');
    responseHeaders.set('Access-Control-Allow-Credentials', 'true');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Modify any recipes.help URLs in the response to localhost
    const modifiedBody = responseBody.replace(
      /https:\/\/recipes\.help/g,
      'http://localhost:3004'
    );

    return new NextResponse(modifiedBody, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('[Clerk Proxy] Request failed:', error);
    return NextResponse.json(
      { error: 'Proxy request failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Export handlers for all HTTP methods
export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const PATCH = handleRequest;
export const DELETE = handleRequest;
export const OPTIONS = handleRequest;