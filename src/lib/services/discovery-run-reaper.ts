/**
 * Stale discovery-run reaper (#6 S2). A run killed mid-flight (a Vercel
 * timeout, a crashed pm2 process) never reaches its `finally` and stays
 * `running` forever; this marks such rows `failed`.
 */

import { and, eq, lt, ne, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { crawlCostEvents, recipeDiscoveryRuns } from '@/lib/db/autonomous-scraper-schema';
import { CRON_FUNCTION_LIMIT_MS } from './crawl-run-deadline';

/**
 * Default cutoff: the cron function limit plus 60s (#6). A `daily`/`manual`
 * run older than that cannot still be executing, so the next cron reaps it.
 */
export const STALE_RUN_CUTOFF_MS = CRON_FUNCTION_LIMIT_MS + 60 * 1000;

/**
 * Cutoff for `local` runs: 6 hours. tsx/pm2 scripts have no `maxDuration` and
 * a long local run must not be reaped while it is still crawling.
 */
export const LOCAL_STALE_RUN_CUTOFF_MS = 6 * 60 * 60 * 1000;

/** The `errors[]` entry a reaped run carries. */
export function reapedRunError(olderThanMs: number): string {
  return `reaped: exceeded ${Math.round(olderThanMs / 1000)}s without completing`;
}

/**
 * Why: a stuck `running` row reads as a live crawl in the admin view and
 * hides the failure (the 2026-10-25 production run).
 * What: In one conditional UPDATE, sets every `running` row whose `started_at`
 * is before its run type's cutoff to `failed`, stamps `completed_at`, and
 * appends `reaped: exceeded <n>s without completing` to `errors`. A null
 * `cost_usd` is filled with the run's `crawl_cost_events` SUM and a null
 * `duration_ms` with `completed_at - started_at` (#6). `daily` and
 * `manual` rows use `now - olderThanMs`; `local` rows use the larger of
 * `olderThanMs` and `LOCAL_STALE_RUN_CUTOFF_MS`. Rows inside their cutoff are
 * not matched. Returns the number of rows reaped.
 * Test: `reapStaleDiscoveryRuns only matches running rows older than the cutoff`,
 * `a local run that started 20 minutes ago is not reaped`,
 * `reapStaleDiscoveryRuns rejects a non-positive cutoff`
 */
export async function reapStaleDiscoveryRuns(
  olderThanMs: number = STALE_RUN_CUTOFF_MS,
  now: Date = new Date()
): Promise<number> {
  if (!Number.isFinite(olderThanMs) || olderThanMs <= 0) {
    throw new RangeError(`reapStaleDiscoveryRuns: olderThanMs must be > 0, got ${olderThanMs}`);
  }
  const localOlderThanMs = Math.max(olderThanMs, LOCAL_STALE_RUN_CUTOFF_MS);
  const cutoff = new Date(now.getTime() - olderThanMs);
  const localCutoff = new Date(now.getTime() - localOlderThanMs);
  const message = JSON.stringify([reapedRunError(olderThanMs)]);
  const localMessage = JSON.stringify([reapedRunError(localOlderThanMs)]);
  const runType = recipeDiscoveryRuns.run_type;

  const reaped = await db
    .update(recipeDiscoveryRuns)
    .set({
      status: 'failed',
      completed_at: now,
      duration_ms: sql`coalesce(${recipeDiscoveryRuns.duration_ms}, (extract(epoch from (${now.toISOString()}::timestamp - ${recipeDiscoveryRuns.started_at})) * 1000)::integer)`,
      cost_usd: sql`coalesce(${recipeDiscoveryRuns.cost_usd}, (select coalesce(sum(${crawlCostEvents.usd}), 0) from ${crawlCostEvents} where ${crawlCostEvents.run_id} = ${recipeDiscoveryRuns.id}))`,
      errors: sql`coalesce(${recipeDiscoveryRuns.errors}, '[]'::jsonb) || (case when ${runType} = 'local' then ${localMessage} else ${message} end)::jsonb`,
    })
    .where(
      and(
        eq(recipeDiscoveryRuns.status, 'running'),
        or(
          and(eq(runType, 'local'), lt(recipeDiscoveryRuns.started_at, localCutoff)),
          and(ne(runType, 'local'), lt(recipeDiscoveryRuns.started_at, cutoff))
        )
      )
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

/**
 * #6: callers about to start a run reap first but must not let a reaper
 * failure block the new run. Logs the error under `logPrefix` and returns 0.
 */
export async function reapStaleDiscoveryRunsFailOpen(logPrefix: string): Promise<number> {
  try {
    return await reapStaleDiscoveryRuns();
  } catch (error) {
    console.error(`${logPrefix} Stale-run reaper failed; continuing:`, error);
    return 0;
  }
}
