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

import { GET, maxDuration, POST } from '@/app/api/cron/daily-recipe/route';
import {
  CRON_FUNCTION_LIMIT_MS,
  FINALIZE_SAFETY_MARGIN_MS,
} from '@/lib/services/crawl-run-deadline';

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

describe('#6: daily-recipe cron run deadline', () => {
  it('passes a deadline of maxDuration minus the finalize margin', async () => {
    expect(maxDuration * 1000).toBe(CRON_FUNCTION_LIMIT_MS);
    const before = Date.now();
    await GET(request('GET'));
    const { deadlineAt } = mocks.runDailyDiscovery.mock.calls[0][0];
    const budget = maxDuration * 1000 - FINALIZE_SAFETY_MARGIN_MS;
    expect(deadlineAt).toBeGreaterThanOrEqual(before + budget);
    expect(deadlineAt).toBeLessThanOrEqual(Date.now() + budget);
  });
});

describe('#300: daily-recipe cron summary line', () => {
  it.each([
    ['GET', GET],
    ['POST', POST],
  ] as const)(
    '%s appends status and stop to the unchanged summary fields',
    async (method, handler) => {
      mocks.runDailyDiscovery.mockResolvedValueOnce({
        runId: 'r1',
        status: 'partial',
        urlsDiscovered: 20,
        recipesExtracted: 1,
        recipesStored: 1,
        recipesSkipped: 12,
        chefsCreated: 0,
        errors: ['deadline: stopped after 270s to finalize before the function limit'],
        durationMs: 270123,
        tracked: true,
        stopReason: 'deadline',
      });

      const res = await handler(request(method));

      expect(console.log).toHaveBeenCalledWith(
        '[DailyRecipeCron] Completed — stored=1, skipped=12, chefsCreated=0, errors=1, ' +
          'duration=270123ms, status=partial, stop=deadline'
      );
      expect(await res.json()).toMatchObject({ status: 'partial', stopReason: 'deadline' });
    }
  );
});

describe('#302: daily-recipe cron stage timing', () => {
  it('returns the run stage totals as stageMs in the JSON response', async () => {
    const stageMs = {
      discoveryMs: 4100,
      firecrawlMs: 90000,
      jinaMs: 60000,
      tavilyMs: 30000,
      llmMs: 50000,
      storeMs: 900,
      delayMs: 30000,
      urlTimed: 16,
      otherMs: 4000,
      runMs: 269800,
    };
    mocks.runDailyDiscovery.mockResolvedValueOnce({
      runId: 'r1',
      status: 'partial',
      urlsDiscovered: 20,
      recipesExtracted: 1,
      recipesStored: 1,
      recipesSkipped: 11,
      chefsCreated: 0,
      errors: [],
      durationMs: 269800,
      tracked: true,
      stopReason: 'deadline',
      stageMs,
    });

    const res = await GET(request('GET'));

    expect((await res.json()).stageMs).toEqual(stageMs);
  });
});
