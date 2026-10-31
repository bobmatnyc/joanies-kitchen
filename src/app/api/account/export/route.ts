/**
 * GET /api/account/export — download the signed-in user's own data as JSON (#58).
 *
 * Why: a self-serve export replaces the manual by-email request on /privacy.
 * What: 401 without a session; 429 over the `account-export` limit (3/hour per
 * user), 503 when the limiter cannot be read. Otherwise builds the full export
 * and returns it as an attachment with `Cache-Control: no-store`. Any query
 * failure returns 500 and no partial export.
 * Test: `src/app/api/account/export/__tests__/route.test.ts`
 */
import { NextResponse } from 'next/server';
import { buildUserExport } from '@/lib/account-export';
import { getDb } from '@/lib/db';
import { enforceRateLimit } from '@/lib/rate-limit';
import { getSessionUserId } from '@/lib/session-user';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' };

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json(
      { error: 'Sign in to export your data' },
      { status: 401, headers: NO_STORE }
    );
  }

  const verdict = await enforceRateLimit('account-export', userId);
  if (!verdict.allowed) {
    const limited = verdict.reason === 'limited';
    return NextResponse.json(
      {
        error: limited
          ? 'Too many export requests; try again later'
          : 'Export is temporarily unavailable',
      },
      {
        status: limited ? 429 : 503,
        headers: { ...NO_STORE, 'Retry-After': String(verdict.retryAfterSec) },
      }
    );
  }

  let body: string;
  let date: string;
  try {
    const exported = await buildUserExport(getDb(), userId);
    body = JSON.stringify(exported, null, 2);
    date = exported.exported_at.slice(0, 10);
  } catch (error) {
    // #58: fail closed — never send a partial export.
    console.error('[AccountExport] export failed:', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500, headers: NO_STORE });
  }

  return new NextResponse(body, {
    status: 200,
    headers: {
      ...NO_STORE,
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="joanies-kitchen-export-${date}.json"`,
    },
  });
}
