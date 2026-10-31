import type { NextFetchEvent, NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import { isAuthConfigured } from './lib/auth-env';
import { decideRoute } from './lib/auth-routes';

// #22: Auth.js session middleware. Built from the edge-safe config only,
// so it verifies the session JWT without a database call.
const { auth } = NextAuth(authConfig);

function respond(req: NextRequest, user: { id?: string; isAdmin?: boolean } | undefined) {
  const decision = decideRoute(req.nextUrl.pathname, {
    userId: user?.id ?? null,
    isAdmin: user?.isAdmin === true,
  });

  if (decision === 'sign-in') {
    const signInUrl = new URL('/sign-in', req.url);
    signInUrl.searchParams.set('callbackUrl', `${req.nextUrl.pathname}${req.nextUrl.search}`);
    return NextResponse.redirect(signInUrl);
  }
  if (decision === 'home') {
    return NextResponse.redirect(new URL('/', req.url));
  }
  return NextResponse.next();
}

const withSession = auth((req) => respond(req, req.auth?.user));

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  // #22: without Auth.js env vars every request is anonymous (fail closed).
  if (!isAuthConfigured()) return respond(req, undefined);
  return withSession(req, event as never);
}

export const config = {
  matcher: [
    // Skip Next.js internals, error pages, and all static files.
    // #55: also skip /api/client-error so its responses set no Auth.js cookies.
    '/((?!_next|_error|404|500|api/client-error|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes, except /api/client-error (#55).
    '/api((?!/client-error).*)',
  ],
};
