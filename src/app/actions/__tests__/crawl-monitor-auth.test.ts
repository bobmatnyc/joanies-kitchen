/**
 * #6 S3: every crawl-monitor read action rejects a non-admin with the same
 * error as the other gated actions, before any query reaches the database.
 * Removing `requireAdmin` from any wrapper makes its rejection case fail,
 * because the query layer then runs against the capturing db and resolves.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  queries: [] as string[],
}));

vi.mock('@/lib/auth', () => ({ auth: mocks.auth }));
// #22: admin is read from users.is_admin; here the DB row mirrors the fixture's flag.
vi.mock('@/lib/auth-users', () => ({
  getUserAdminFlag: async () => (await mocks.auth())?.sessionClaims?.metadata?.isAdmin === 'true',
}));
vi.mock('@/lib/db', async () => {
  const { drizzle } = await import('drizzle-orm/pg-proxy');
  return {
    db: drizzle(async (sql) => {
      mocks.queries.push(sql);
      return { rows: [] };
    }),
  };
});

import * as actions from '@/app/actions/crawl-monitor';

const RUN_ID = '11111111-1111-4111-8111-111111111111';

const ACTIONS: { name: string; run: () => Promise<unknown> }[] = [
  { name: 'getCrawlRuns', run: () => actions.getCrawlRuns({ page: 1, pageSize: 10 }) },
  { name: 'getCrawlRunDetail', run: () => actions.getCrawlRunDetail(RUN_ID) },
  { name: 'getCrawlCostSummary', run: () => actions.getCrawlCostSummary() },
  {
    name: 'getUnifiedCrawlRuns',
    run: () => actions.getUnifiedCrawlRuns({ page: 1, pageSize: 10 }),
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.queries = [];
});

it('covers every exported action', () => {
  const exported = Object.entries(actions)
    .filter(([, v]) => typeof v === 'function')
    .map(([k]) => k)
    .sort();
  expect(exported).toEqual(ACTIONS.map((a) => a.name).sort());
});

describe.each(ACTIONS)('$name (admin-only read action)', (action) => {
  it('rejects a signed-out caller before any query', async () => {
    mocks.auth.mockResolvedValue({ userId: null, sessionClaims: null });
    await expect(action.run()).rejects.toThrow('Admin access required');
    expect(mocks.queries).toHaveLength(0);
  });

  it('rejects a signed-in non-admin before any query', async () => {
    mocks.auth.mockResolvedValue({
      userId: 'user_1',
      sessionClaims: { metadata: { isAdmin: 'false' } },
    });
    await expect(action.run()).rejects.toThrow('Admin access required');
    expect(mocks.queries).toHaveLength(0);
  });

  it('runs the query for an admin', async () => {
    mocks.auth.mockResolvedValue({
      userId: 'user_1',
      sessionClaims: { metadata: { isAdmin: 'true' } },
    });
    await action.run();
    expect(mocks.queries.length).toBeGreaterThan(0);
  });
});
