// #22: Auth.js endpoints (sign-in, OAuth callback, session, sign-out).
import type { NextRequest } from 'next/server';
import { handlers } from '@/auth';
import { isAuthConfigured } from '@/lib/auth-env';

/**
 * Why: with the Auth.js env vars missing (a Vercel preview, #154), Auth.js
 * answers every call with a 500 "server configuration" error, and the
 * client SessionProvider logs it on every page load.
 * What: answers without calling Auth.js. `GET /api/auth/session` returns the
 * signed-out session (`null`); every other action returns 503, so nothing
 * can start a sign-in or mint a session. Applies in every environment, so
 * production with missing config also stays signed-out (fail closed).
 * Test: `src/app/api/auth/[...nextauth]/__tests__/route.test.ts`
 */
function authNotConfigured(req: NextRequest): Response {
  if (req.method === 'GET' && req.nextUrl.pathname.endsWith('/api/auth/session')) {
    return Response.json(null);
  }
  return Response.json({ error: 'Sign-in is not configured' }, { status: 503 });
}

export async function GET(req: NextRequest): Promise<Response> {
  // #154: no Auth.js config → no session read; report signed-out.
  if (!isAuthConfigured()) return authNotConfigured(req);
  return handlers.GET(req);
}

export async function POST(req: NextRequest): Promise<Response> {
  // #154: no Auth.js config → refuse sign-in and session updates.
  if (!isAuthConfigured()) return authNotConfigured(req);
  return handlers.POST(req);
}
