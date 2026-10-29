import type { NextRequest } from 'next/server';

/**
 * #104: shared Vercel cron auth, extracted from the daily-recipe route.
 *
 * Vercel sends `Authorization: Bearer <CRON_SECRET>` on scheduled calls. A
 * missing CRON_SECRET fails closed: every request is refused and logged.
 * Test: `src/app/api/cron/purge-deleted-accounts/__tests__/route.test.ts`
 */
export function isCronAuthorized(request: NextRequest, logTag: string): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error(`${logTag} CRON_SECRET environment variable not configured`);
    return false;
  }
  return request.headers.get('authorization') === `Bearer ${cronSecret}`;
}
