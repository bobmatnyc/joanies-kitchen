import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { authConfig, isAuthEnabled, logAuthStatus } from './lib/auth-config';
import { handleClerkProxy } from './lib/clerk-proxy';

export async function middleware(request: NextRequest) {
  // PRODUCTION ONLY: Redirect sign-up attempts to registration-closed page
  if (process.env.NODE_ENV === 'production' && request.nextUrl.pathname.startsWith('/sign-up')) {
    const url = request.nextUrl.clone();
    url.pathname = '/registration-closed';
    return NextResponse.redirect(url);
  }

  // Handle Clerk proxy for production keys on localhost
  const proxyResponse = await handleClerkProxy(request);
  if (proxyResponse) {
    return proxyResponse;
  }

  // Log auth status in development for debugging
  if (process.env.NODE_ENV === 'development') {
    logAuthStatus();
  }

  // Check if authentication should be enabled
  const authEnabled = isAuthEnabled();

  if (!authEnabled) {
    // Skip authentication when not enabled
    // This happens when:
    // 1. Clerk is not configured
    // 2. We're in development without ENABLE_DEV_AUTH=true
    console.log('[Middleware] Authentication disabled, allowing all requests');
    return NextResponse.next();
  }

  // Verify we have the correct keys for the current environment
  if (!authConfig.clerk.publishableKey || !authConfig.clerk.secretKey) {
    console.error('[Middleware] Missing Clerk keys for environment:', authConfig.environment);
    if (authConfig.isProduction) {
      return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 503 });
    }
    return NextResponse.next();
  }

  // Dynamically import and use clerkMiddleware only when configured
  const { clerkMiddleware, createRouteMatcher } = await import('@clerk/nextjs/server');

  // Define public routes that don't require authentication
  // These routes are accessible to everyone
  const _isPublicRoute = createRouteMatcher([
    '/', // Homepage
    '/sign-in(.*)', // Sign in pages
    '/sign-up(.*)', // Sign up pages
    '/shared(.*)', // Shared recipes browsing
    '/discover(.*)', // Discover/AI recipe generation (read-only browsing)
    '/api/webhooks(.*)', // Webhooks
  ]);

  // Recipe view routes are handled with custom logic below
  // (individual recipes like /recipes/123 that don't end with /new or contain /edit)

  // Define strictly protected routes that always require authentication
  const isProtectedRoute = createRouteMatcher([
    '/recipes/new(.*)', // Creating new recipes
    '/recipes/edit(.*)', // Editing recipes (simplified pattern)
    '/recipes$', // My Recipes listing (personal collection)
    '/meals/new(.*)', // Creating new meals
    '/meals$', // My Meals listing (personal collection)
    '/meal-plans(.*)', // Meal planning
    '/shopping-lists(.*)', // Shopping lists
  ]);

  // Define admin routes that require admin access
  const isAdminRoute = createRouteMatcher([
    '/admin(.*)', // Admin dashboard and all sub-routes
  ]);

  // Define protected API routes
  const isProtectedApiRoute = createRouteMatcher([
    '/api/recipes/create',
    '/api/recipes/update',
    '/api/recipes/delete',
    '/api/meal-plans(.*)',
    '/api/shopping-lists(.*)',
  ]);

  // Use the clerkMiddleware with route protection logic
  return clerkMiddleware(async (auth, req) => {
    const { userId, sessionClaims } = await auth();
    const path = req.nextUrl.pathname;

    // Check if this is a recipe view route (e.g., /recipes/123) but NOT /recipes/new or /recipes/*/edit
    const isViewingRecipe =
      path.match(/^\/recipes\/[a-zA-Z0-9-]+$/) && !path.endsWith('/new') && !path.includes('/edit');

    // Check if this is a meal view route (e.g., /meals/slug) but NOT /meals/new
    const isViewingMeal = path.match(/^\/meals\/[a-zA-Z0-9-]+$/) && !path.endsWith('/new');

    // If it's a recipe or meal view route, allow it (the page itself will check if the content is public)
    if (isViewingRecipe || isViewingMeal) {
      return NextResponse.next();
    }

    // Check admin routes first - requires authentication AND admin role
    if (isAdminRoute(req)) {
      if (!userId) {
        // Not authenticated - redirect to sign-in
        const signInUrl = new URL('/sign-in', req.url);
        signInUrl.searchParams.set('redirect_url', req.url);
        return NextResponse.redirect(signInUrl);
      }

      // Check if user has admin role
      const metadata = sessionClaims?.metadata as { isAdmin?: string } | undefined;
      const isAdmin = metadata?.isAdmin === 'true';
      if (!isAdmin) {
        // Authenticated but not admin - redirect to home with error
        const homeUrl = new URL('/', req.url);
        return NextResponse.redirect(homeUrl);
      }

      // Admin access granted
      return NextResponse.next();
    }

    // If accessing a strictly protected route without authentication, redirect to sign-in
    if (!userId && (isProtectedRoute(req) || isProtectedApiRoute(req))) {
      // For API routes, return 401 instead of redirecting
      if (path.startsWith('/api/')) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }

      // For regular routes, redirect to sign-in with return URL
      const signInUrl = new URL('/sign-in', req.url);
      signInUrl.searchParams.set('redirect_url', req.url);
      return NextResponse.redirect(signInUrl);
    }

    return NextResponse.next();
  })(request, {} as any);
}

export const config = {
  matcher: [
    // Skip Next.js internals, error pages, and all static files
    '/((?!_next|_error|404|500|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
