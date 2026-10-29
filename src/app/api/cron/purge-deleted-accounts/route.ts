/**
 * Cron API: purge accounts whose deletion grace period has ended — #104 (D7c S5).
 *
 * GET /api/cron/purge-deleted-accounts — Vercel cron, daily (see vercel.json).
 * Requires Authorization: Bearer <CRON_SECRET>; anything else gets 401.
 * Returns the purged/failed/skipped counts; any failed account makes the
 * response 500 so the run shows as failed in the Vercel cron log.
 * Test: `src/app/api/cron/purge-deleted-accounts/__tests__/route.test.ts`
 */

import { type NextRequest, NextResponse } from 'next/server';
import { purgeDueAccounts } from '@/lib/account-purge';
import { isCronAuthorized } from '@/lib/cron-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request, '[PurgeDeletedAccountsCron]')) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await purgeDueAccounts();
    const body = {
      success: result.failed.length === 0,
      purged: result.purged.length,
      failed: result.failed.length,
      skipped: result.skipped.length,
      failures: result.failed,
    };
    return NextResponse.json(body, { status: result.failed.length === 0 ? 200 : 500 });
  } catch (error) {
    console.error('[PurgeDeletedAccountsCron] run failed:', error);
    return NextResponse.json({ success: false, error: 'Purge run failed' }, { status: 500 });
  }
}
