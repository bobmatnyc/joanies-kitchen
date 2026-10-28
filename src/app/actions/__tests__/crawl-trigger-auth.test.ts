/**
 * #6 S4: the crawl monitor's manual trigger starts paid work, so it rejects a
 * non-admin before any query, reap or run. Removing `requireAdmin` makes the
 * rejection cases fail: the action then queries the capturing db, schedules
 * the run and resolves.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  after: vi.fn(),
  reap: vi.fn(),
  runDailyDiscovery: vi.fn(),
  queries: [] as string[],
  runningRows: [] as unknown[][],
}));

vi.mock('@/lib/auth', () => ({ auth: mocks.auth }));
// #22: admin is read from users.is_admin; here the DB row mirrors the fixture's flag.
vi.mock('@/lib/auth-users', () => ({
  getUserAdminFlag: async () => (await mocks.auth())?.sessionClaims?.metadata?.isAdmin === 'true',
}));
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: mocks.after,
}));
vi.mock('@/lib/services/discovery-run-reaper', () => ({
  reapStaleDiscoveryRunsFailOpen: mocks.reap,
}));
vi.mock('@/lib/services/autonomous-recipe-ingestion.service', () => ({
  getAutonomousRecipeIngestionService: () => ({ runDailyDiscovery: mocks.runDailyDiscovery }),
}));
vi.mock('@/lib/db', async () => {
  const { drizzle } = await import('drizzle-orm/pg-proxy');
  return {
    db: drizzle(async (sql) => {
      mocks.queries.push(sql);
      return { rows: mocks.runningRows };
    }),
  };
});

import * as actions from '@/app/actions/crawl-trigger';

function signedIn(isAdmin: string) {
  mocks.auth.mockResolvedValue({ userId: 'user_1', sessionClaims: { metadata: { isAdmin } } });
}

function expectNothingStarted() {
  expect(mocks.queries).toHaveLength(0);
  expect(mocks.reap).not.toHaveBeenCalled();
  expect(mocks.after).not.toHaveBeenCalled();
  expect(mocks.runDailyDiscovery).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.queries = [];
  mocks.runningRows = [];
  mocks.reap.mockResolvedValue(0);
  mocks.runDailyDiscovery.mockResolvedValue({ runId: 'r1', status: 'completed' });
});

it('exports only triggerManualCrawl', () => {
  const fns = Object.entries(actions).filter(([, v]) => typeof v === 'function');
  expect(fns.map(([k]) => k)).toEqual(['triggerManualCrawl']);
});

describe('triggerManualCrawl', () => {
  it('rejects a signed-out caller before any query or run', async () => {
    mocks.auth.mockResolvedValue({ userId: null, sessionClaims: null });
    await expect(actions.triggerManualCrawl()).rejects.toThrow('Admin access required');
    expectNothingStarted();
  });

  it('rejects a signed-in non-admin before any query or run', async () => {
    signedIn('false');
    await expect(actions.triggerManualCrawl()).rejects.toThrow('Admin access required');
    expectNothingStarted();
  });

  it('starts one manual run with the default budget for an admin', async () => {
    signedIn('true');
    await expect(actions.triggerManualCrawl()).resolves.toEqual({ started: true });
    expect(mocks.reap).toHaveBeenCalledOnce();
    expect(mocks.queries[0]).toMatch(/"status" = \$1/);
    expect(mocks.after).toHaveBeenCalledOnce();
    expect(mocks.runDailyDiscovery).not.toHaveBeenCalled();

    await mocks.after.mock.calls[0][0]();
    // No budgetUsd: the run falls back to the S2 default budget.
    expect(mocks.runDailyDiscovery).toHaveBeenCalledWith({ runType: 'manual' });
  });

  it('refuses while a discovery run is running', async () => {
    signedIn('true');
    mocks.runningRows = [['22222222-2222-4222-8222-222222222222']];
    const result = await actions.triggerManualCrawl();
    expect(result).toEqual({ started: false, reason: expect.stringMatching(/already running/) });
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it('keeps a failing background run from throwing out of after()', async () => {
    signedIn('true');
    mocks.runDailyDiscovery.mockRejectedValue(new Error('boom'));
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await actions.triggerManualCrawl();
    await expect(mocks.after.mock.calls[0][0]()).resolves.toBeUndefined();
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});
