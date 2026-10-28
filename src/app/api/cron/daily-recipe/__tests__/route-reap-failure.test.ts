/**
 * #6: the daily cron reaps stale runs before each run, fail-open. With the
 * real reaper over a pg-proxy db whose UPDATE throws, an authorised GET or
 * POST still reaches `runDailyDiscovery`.
 */

import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  runDailyDiscovery: vi.fn(),
  queries: [] as string[],
}));

vi.mock('@/lib/db', async () => {
  const { drizzle } = await import('drizzle-orm/pg-proxy');
  return {
    db: drizzle(async (sql) => {
      mocks.queries.push(sql);
      throw new Error('reaper: connection refused');
    }),
  };
});
vi.mock('@/lib/services/autonomous-recipe-ingestion.service', () => ({
  getAutonomousRecipeIngestionService: () => ({ runDailyDiscovery: mocks.runDailyDiscovery }),
}));

import { GET, POST } from '@/app/api/cron/daily-recipe/route';

const SECRET = 'test-secret';

function request(method: 'GET' | 'POST') {
  return new NextRequest('http://localhost/api/cron/daily-recipe', {
    method,
    headers: { authorization: `Bearer ${SECRET}` },
    body: method === 'POST' ? JSON.stringify({}) : undefined,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.queries = [];
  vi.stubEnv('CRON_SECRET', SECRET);
  mocks.runDailyDiscovery.mockResolvedValue({
    runId: 'r1',
    status: 'completed',
    urlsDiscovered: 0,
    recipesExtracted: 0,
    recipesStored: 0,
    recipesSkipped: 0,
    chefsCreated: 0,
    errors: [],
    durationMs: 1,
    tracked: true,
  });
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('daily-recipe cron when the stale-run reaper throws', () => {
  it.each([
    ['GET', GET, 'daily'],
    ['POST', POST, 'manual'],
  ] as const)('%s still runs discovery', async (method, handler, runType) => {
    const res = await handler(request(method));

    expect(mocks.queries[0]).toMatch(/^update "recipe_discovery_runs"/);
    expect(console.error).toHaveBeenCalledWith(
      '[DailyRecipeCron] Stale-run reaper failed; continuing:',
      expect.any(Error)
    );
    expect(res.status).toBe(200);
    expect(mocks.runDailyDiscovery).toHaveBeenCalledOnce();
    expect(mocks.runDailyDiscovery).toHaveBeenCalledWith(expect.objectContaining({ runType }));
  });
});
