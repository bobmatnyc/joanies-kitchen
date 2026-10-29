/**
 * GET /api/health — uptime/health probe for Vercel (#56).
 *
 * Why: a public endpoint an uptime check can poll to learn whether the app
 * and its database are up.
 * What: runs `SELECT 1` with a short timeout. 200 only when every check
 * passes, else 503. Reports a check name and short reason only, never
 * connection strings or driver errors. No side effects, no paid APIs.
 * Test: `src/app/api/health/__tests__/route.test.ts`
 */
import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { isAuthConfigured } from '@/lib/auth-env';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

const DB_TIMEOUT_MS = 2500;

type CheckResult = { status: 'ok' } | { status: 'error'; reason: 'timeout' | 'unreachable' };

async function checkDb(): Promise<CheckResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), DB_TIMEOUT_MS);
  });
  try {
    const outcome = await Promise.race([
      db.execute(sql`SELECT 1`).then(() => 'ok' as const),
      timeout,
    ]);
    return outcome === 'ok' ? { status: 'ok' } : { status: 'error', reason: 'timeout' };
  } catch {
    return { status: 'error', reason: 'unreachable' };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * #55 S3: whether the sign-in config is present. Booleans only, never values;
 * a missing var means sign-in is broken, so health reports 503.
 */
function checkAuthConfig() {
  const secret = Boolean(process.env.AUTH_SECRET);
  const googleId = Boolean(process.env.AUTH_GOOGLE_ID);
  const googleSecret = Boolean(process.env.AUTH_GOOGLE_SECRET);
  return {
    // #55: same requirement as sign-in itself (isAuthConfigured), all three vars.
    status: isAuthConfigured() ? ('ok' as const) : ('error' as const),
    AUTH_SECRET: secret,
    AUTH_GOOGLE_ID: googleId,
    AUTH_GOOGLE_SECRET: googleSecret,
  };
}

export async function GET() {
  const dbCheck = await checkDb();
  const authCheck = checkAuthConfig();
  const healthy = dbCheck.status === 'ok' && authCheck.status === 'ok';
  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'error',
      checks: { db: dbCheck, auth: authCheck }, // #55: auth added; db unchanged
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      timestamp: new Date().toISOString(),
    },
    {
      status: healthy ? 200 : 503,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    }
  );
}
