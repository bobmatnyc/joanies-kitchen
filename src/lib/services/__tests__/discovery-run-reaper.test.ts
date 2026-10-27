/**
 * Stale-run reaper (#6 S2). Drizzle runs on a pg-proxy driver that captures
 * the SQL and parameters the reaper sends, so the test checks the exact
 * predicate Postgres evaluates, including the cutoff value.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const captured = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][],
}));

vi.mock('@/lib/db', async () => {
  const { drizzle } = await import('drizzle-orm/pg-proxy');
  return {
    db: drizzle(async (sql, params) => {
      captured.queries.push({ sql, params });
      return { rows: captured.rows };
    }),
  };
});

import {
  LOCAL_STALE_RUN_CUTOFF_MS,
  reapedRunError,
  reapStaleDiscoveryRuns,
  STALE_RUN_CUTOFF_MS,
} from '@/lib/services/discovery-run-reaper';

const NOW = new Date('2026-10-28T06:00:00.000Z');

beforeEach(() => {
  captured.queries = [];
  captured.rows = [];
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('reapStaleDiscoveryRuns', () => {
  it('defaults to a 15-minute cutoff, 3x the cron maxDuration', () => {
    expect(STALE_RUN_CUTOFF_MS).toBe(3 * 300 * 1000);
    expect(reapedRunError(STALE_RUN_CUTOFF_MS)).toBe('reaped: exceeded 900s without completing');
  });

  it('reapStaleDiscoveryRuns only matches running rows older than the cutoff', async () => {
    captured.rows = [['run-a'], ['run-b']];

    const reaped = await reapStaleDiscoveryRuns(STALE_RUN_CUTOFF_MS, NOW);

    expect(reaped).toBe(2);
    expect(captured.queries).toHaveLength(1);
    const { sql, params } = captured.queries[0];
    expect(sql).toMatch(/^update "recipe_discovery_runs" set "status" = \$1/);
    // Only `running` rows strictly older than the cutoff: a row started at or
    // after now-15min (still inside its window) does not satisfy `<`.
    expect(sql).toContain('where ("recipe_discovery_runs"."status" = $');
    expect(sql).toMatch(/"recipe_discovery_runs"\."started_at" < \$\d+/);
    const cutoff = new Date(NOW.getTime() - STALE_RUN_CUTOFF_MS).toISOString();
    expect(params).toContain('running');
    expect(params).toContain(cutoff);
    expect(params).toContain('failed');
    // The reaped error is appended to errors[], not replacing it.
    expect(sql).toContain(`coalesce("recipe_discovery_runs"."errors", '[]'::jsonb) ||`);
    expect(params).toContain(JSON.stringify(['reaped: exceeded 900s without completing']));
  });

  it('a local run that started 20 minutes ago is not reaped', async () => {
    await reapStaleDiscoveryRuns(STALE_RUN_CUTOFF_MS, NOW);

    const { sql, params } = captured.queries[0];
    expect(LOCAL_STALE_RUN_CUTOFF_MS).toBe(6 * 60 * 60 * 1000);
    // One UPDATE whose predicate splits on run_type: local rows are compared
    // against now-6h, every other type against now-15min.
    expect(sql).toMatch(
      /\(\("recipe_discovery_runs"\."run_type" = \$(\d+) and "recipe_discovery_runs"\."started_at" < \$(\d+)\) or \("recipe_discovery_runs"\."run_type" <> \$(\d+) and "recipe_discovery_runs"\."started_at" < \$(\d+)\)\)/
    );
    const m = sql.match(
      /"run_type" = \$(\d+) and "recipe_discovery_runs"\."started_at" < \$(\d+)\) or \("recipe_discovery_runs"\."run_type" <> \$(\d+) and "recipe_discovery_runs"\."started_at" < \$(\d+)/
    );
    const p = (i: string) => params[Number(i) - 1];
    expect(m).not.toBeNull();
    const [, localTypeIdx, localCutoffIdx, otherTypeIdx, otherCutoffIdx] = m as RegExpMatchArray;
    expect(p(localTypeIdx)).toBe('local');
    expect(p(otherTypeIdx)).toBe('local');
    const localCutoff = new Date(p(localCutoffIdx) as string);
    const otherCutoff = new Date(p(otherCutoffIdx) as string);
    expect(localCutoff.toISOString()).toBe(
      new Date(NOW.getTime() - LOCAL_STALE_RUN_CUTOFF_MS).toISOString()
    );

    // A local run started 20 minutes ago fails `started_at < localCutoff`...
    const startedAt = new Date(NOW.getTime() - 20 * 60 * 1000);
    expect(startedAt < localCutoff).toBe(false);
    // ...while a daily run with the same start would be reaped.
    expect(startedAt < otherCutoff).toBe(true);
    expect(params).toContain(JSON.stringify(['reaped: exceeded 21600s without completing']));
  });

  it('returns 0 and touches nothing when no row is past the cutoff', async () => {
    captured.rows = [];
    await expect(reapStaleDiscoveryRuns(60_000, NOW)).resolves.toBe(0);
    expect(captured.queries[0].params).toContain(new Date(NOW.getTime() - 60_000).toISOString());
  });

  it('reapStaleDiscoveryRuns rejects a non-positive cutoff', async () => {
    // A 0 or negative cutoff would reap runs that are still in progress.
    await expect(reapStaleDiscoveryRuns(0, NOW)).rejects.toThrow(RangeError);
    await expect(reapStaleDiscoveryRuns(Number.NaN, NOW)).rejects.toThrow(RangeError);
    expect(captured.queries).toHaveLength(0);
  });
});
