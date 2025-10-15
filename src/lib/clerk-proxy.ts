/**
 * Clerk Proxy Configuration for Development
 * This module provides proxy functionality to use production Clerk keys on localhost
 * by intercepting and modifying requests to bypass domain restrictions
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy configuration for Clerk API requests
 */
export const clerkProxyConfig = {
  // Target Clerk API endpoints
  clerkApiUrl: 'https://api.clerk.com',
  clerkFrontendApi: 'https://clerk.recipes.help',

  // Headers to inject for domain bypass
  proxyHeaders: {
    'X-Forwarded-Host': 'recipes.help',
    'X-Forwarded-Proto': 'https',
    'X-Original-Host': 'localhost:3004',
    'X-Development-Mode': 'true',
  },

  // Paths that should be proxied
  proxyPaths: [
    '/v1/client',
    '/v1/environment',
    '/v1/sessions',
    '/v1/users',
    '/v1/organizations',
  ],
};

/**
 * Check if a request should be proxied to Clerk
 */
export function shouldProxyRequest(pathname: string): boolean {
  return clerkProxyConfig.proxyPaths.some(path => pathname.includes(path));
}

/**
 * Modify request headers for Clerk proxy
 */
export function modifyRequestHeaders(headers: Headers): Headers {
  const modifiedHeaders = new Headers(headers);

  // Add proxy headers
  Object.entries(clerkProxyConfig.proxyHeaders).forEach(([key, value]) => {
    modifiedHeaders.set(key, value);
  });

  // Modify origin and referer to appear as if from production domain
  modifiedHeaders.set('Origin', 'https://recipes.help');
  modifiedHeaders.set('Referer', 'https://recipes.help/');

  return modifiedHeaders;
}

/**
 * Create a proxied request to Clerk API
 */
export async function createProxiedRequest(
  request: NextRequest,
  targetUrl: string
): Promise<Response> {
  const modifiedHeaders = modifyRequestHeaders(request.headers);

  // Create new request with modified headers
  const proxiedRequest = new Request(targetUrl, {
    method: request.method,
    headers: modifiedHeaders,
    body: request.body,
    credentials: 'include',
  });

  try {
    const response = await fetch(proxiedRequest);

    // Create response with CORS headers for localhost
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('Access-Control-Allow-Origin', 'http://localhost:3004');
    responseHeaders.set('Access-Control-Allow-Credentials', 'true');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('[Clerk Proxy] Request failed:', error);
    throw error;
  }
}

/**
 * Handle Clerk proxy in middleware
 */
export async function handleClerkProxy(request: NextRequest): Promise<NextResponse | null> {
  const pathname = request.nextUrl.pathname;

  // Check if this is a Clerk API request that needs proxying
  if (!shouldProxyRequest(pathname)) {
    return null;
  }

  // Only proxy in development with production keys
  const isProdKeys = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_live_');
  const isDev = process.env.NODE_ENV === 'development';

  if (!isProdKeys || !isDev) {
    return null;
  }

  try {
    // Create target URL for Clerk API
    const targetUrl = `${clerkProxyConfig.clerkApiUrl}${pathname}${request.nextUrl.search}`;

    // Create and execute proxied request
    const response = await createProxiedRequest(request, targetUrl);

    // Return proxied response
    return new NextResponse(response.body, {
      status: response.status,
      headers: response.headers,
    });
  } catch (error) {
    console.error('[Clerk Proxy] Failed to proxy request:', error);
    return NextResponse.json(
      { error: 'Proxy request failed' },
      { status: 500 }
    );
  }
}

/**
 * Inject Clerk configuration script for domain bypass
 */
export function getClerkConfigScript(): string {
  const isProdKeys = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_live_');
  const isDev = process.env.NODE_ENV === 'development';

  if (!isProdKeys || !isDev) {
    return '';
  }

  return `
    <script>
      // Override Clerk configuration for development with production keys
      window.__clerk_domain = 'recipes.help';
      window.__clerk_proxy_url = 'http://localhost:3004';
      window.__clerk_satellite = true;

      // Override fetch to modify Clerk API requests
      const originalFetch = window.fetch;
      window.fetch = function(url, options = {}) {
        if (typeof url === 'string' && url.includes('clerk')) {
          // Modify headers for Clerk requests
          options.headers = {
            ...options.headers,
            'X-Forwarded-Host': 'recipes.help',
            'X-Development-Mode': 'true',
          };
        }
        return originalFetch(url, options);
      };
    </script>
  `;
}