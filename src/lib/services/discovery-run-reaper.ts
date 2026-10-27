/**
 * Stale discovery-run reaper (#6 S2). A run killed mid-flight (a Vercel
 * timeout, a crashed pm2 process) never reaches its `finally` and stays
 * `running` forever; this marks such rows `failed`.
 */

import { and, eq, lt, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { recipeDiscoveryRuns } from '@/lib/db/autonomous-scraper-schema';

/** Default cutoff: 15 minutes, 3x the cron route's `maxDuration` of 300s. */
export const STALE_RUN_CUTOFF_MS = 15 * 60 * 1000;

/** The `errors[]` entry a reaped run carries. */
export function reapedRunError(olderThanMs: number): string {
  return `reaped: exceeded ${Math.round(olderThanMs / 1000)}s without completing`;
}

/**
 * Why: a stuck `running` row reads as a live crawl in the admin view and
 * hides the failure (the 2026-10-25 production run).
 * What: In one UPDATE, sets every `running` row whose `started_at` is before
 * `now - olderThanMs` to `failed`, stamps `completed_at`, and appends
 * `reaped: exceeded <n>s without completing` to `errors`. Rows still inside
 * the cutoff are not matched. Returns the number of rows reaped.
 * Test: `reapStaleDiscoveryRuns only matches running rows older than the cutoff`,
 * `reapStaleDiscoveryRuns rejects a non-positive cutoff`
 */
export async function reapStaleDiscoveryRuns(
  olderThanMs: number = STALE_RUN_CUTOFF_MS,
  now: Date = new Date()
): Promise<number> {
  if (!Number.isFinite(olderThanMs) || olderThanMs <= 0) {
    throw new RangeError(`reapStaleDiscoveryRuns: olderThanMs must be > 0, got ${olderThanMs}`);
  }
  const cutoff = new Date(now.getTime() - olderThanMs);
  const message = JSON.stringify([reapedRunError(olderThanMs)]);

  const reaped = await db
    .update(recipeDiscoveryRuns)
    .set({
      status: 'failed',
      completed_at: now,
      errors: sql`coalesce(${recipeDiscoveryRuns.errors}, '[]'::jsonb) || ${message}::jsonb`,
    })
    .where(
      and(eq(recipeDiscoveryRuns.status, 'running'), lt(recipeDiscoveryRuns.started_at, cutoff))
    )
    .returning({ id: recipeDiscoveryRuns.id });

  if (reaped.length > 0) {
    const shown = reaped.slice(0, 10).map((r) => r.id);
    const more = reaped.length > shown.length ? ` (+${reaped.length - shown.length} more)` : '';
    console.warn(
      `[RunReaper] Marked ${reaped.length} stale run(s) failed: ${shown.join(', ')}${more}`
    );
  }
  return reaped.length;
}
