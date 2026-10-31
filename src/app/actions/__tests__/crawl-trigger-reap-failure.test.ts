/**
 * #6 S4: `triggerManualCrawl` when the stale-run reaper throws. The reaper,
 * the ingestion service and the S2 budget code are real; only the db driver
 * (pg-proxy, failing the reaper's UPDATE), auth, `after()` and the discovery
 * provider are stubbed. A reaper failure must neither block the trigger nor
 * bypass its guards: it still refuses while a run is `running`, and a run it
 * starts is a `manual` run whose row carries the S2-resolved budget.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const RUN_ID = '33333333-3333-4333-8333-333333333333';

const mocks = vi.hoisted(() => ({
  sessionUserId: vi.fn(),
  adminFlag: vi.fn(),
  after: vi.fn(),
  queries: [] as { sql: string; params: unknown[] }[],
  runningRows: [] as unknown[][],
}));

vi.mock('@/lib/session-user', () => ({ getSessionUserId: mocks.sessionUserId }));
// #22: admin is read from users.is_admin; `mocks.adminFlag` stands in for that row.
vi.mock('@/lib/auth-users', () => ({
  getUserAdminFlag: mocks.adminFlag,
}));
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: mocks.after,
}));
vi.mock('@/lib/db', async () => {
  const { drizzle } = await import('drizzle-orm/pg-proxy');
  return {
    db: drizzle(async (sql, params) => {
      mocks.queries.push({ sql, params });
      // The reaper's UPDATE is the only statement filtering on started_at.
      if (/^update "recipe_discovery_runs"/.test(sql) && sql.includes('"started_at" <')) {
        throw new Error('reaper: connection refused');
      }
      if (/^select .* from "recipe_discovery_runs"/.test(sql)) {
        return { rows: mocks.runningRows };
      }
      if (/^insert into "recipe_discovery_runs"/.test(sql)) return { rows: [[RUN_ID]] };
      return { rows: [] };
    }),
  };
});
// Discovery reports itself unconfigured, so the run ends right after its
// run row is created and no provider client loads.
vi.mock('@/lib/services/recipe-discovery.service', () => ({
  getRecipeDiscoveryService: () => ({ isConfigured: () => false }),
}));
vi.mock('@/lib/services/recipe-extraction.service', () => ({
  getRecipeExtractionService: vi.fn(),
}));
vi.mock('@/lib/services/chef-discovery.service', () => ({ getChefDiscoveryService: vi.fn() }));

import { triggerManualCrawl } from '@/app/actions/crawl-trigger';
import { DEFAULT_RUN_BUDGET_USD, MAX_RUN_BUDGET_USD } from '@/lib/costs';
import { getAutonomousRecipeIngestionService } from '@/lib/services/autonomous-recipe-ingestion.service';
import {
  CRON_FUNCTION_LIMIT_MS,
  FINALIZE_SAFETY_MARGIN_MS,
} from '@/lib/services/crawl-run-deadline';

const runInserts = () =>
  mocks.queries.filter((q) => /^insert into "recipe_discovery_runs"/.test(q.sql));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.queries = [];
  mocks.runningRows = [];
  mocks.sessionUserId.mockResolvedValue('admin_1');
  mocks.adminFlag.mockResolvedValue(true);
  vi.stubEnv('CRON_RUN_BUDGET_USD', '');
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

/** Runs the trigger, then the scheduled background run, and returns its run-row insert. */
async function triggerAndRun() {
  await expect(triggerManualCrawl()).resolves.toEqual({ started: true });
  expect(mocks.after).toHaveBeenCalledOnce();
  await mocks.after.mock.calls[0][0]();
  const inserts = runInserts();
  expect(inserts).toHaveLength(1);
  return inserts[0].params;
}

describe('triggerManualCrawl when the stale-run reaper throws', () => {
  it('still refuses while a discovery run is running', async () => {
    mocks.runningRows = [['22222222-2222-4222-8222-222222222222']];

    const result = await triggerManualCrawl();

    expect(result).toEqual({ started: false, reason: expect.stringMatching(/already running/) });
    expect(mocks.queries[0].sql).toMatch(/^update "recipe_discovery_runs"/);
    expect(mocks.after).not.toHaveBeenCalled();
    expect(runInserts()).toHaveLength(0);
  });

  it('starts a manual run with the default S2 budget', async () => {
    const params = await triggerAndRun();
    expect(params).toContain('manual');
    expect(params).toContain(DEFAULT_RUN_BUDGET_USD.toFixed(6));
    expect(DEFAULT_RUN_BUDGET_USD).toBe(5);
  });

  it('clamps an oversized CRON_RUN_BUDGET_USD to MAX_RUN_BUDGET_USD', async () => {
    vi.stubEnv('CRON_RUN_BUDGET_USD', '500');
    const params = await triggerAndRun();
    expect(params).toContain('manual');
    expect(params).toContain(MAX_RUN_BUDGET_USD.toFixed(6));
    expect(MAX_RUN_BUDGET_USD).toBe(100);
  });
});

describe('#6: triggerManualCrawl run deadline', () => {
  it('passes a deadline computed at action entry', async () => {
    const run = vi.spyOn(getAutonomousRecipeIngestionService(), 'runDailyDiscovery');
    const before = Date.now();
    await triggerAndRun();
    const after = Date.now();
    const budget = CRON_FUNCTION_LIMIT_MS - FINALIZE_SAFETY_MARGIN_MS;
    const { deadlineAt } = run.mock.calls[0][0] ?? {};
    expect(deadlineAt).toBeGreaterThanOrEqual(before + budget);
    expect(deadlineAt).toBeLessThanOrEqual(after + budget);
  });
});
