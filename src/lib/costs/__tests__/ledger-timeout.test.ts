/**
 * Ledger-write timeout regression test (#6): an insert that never resolves
 * (a stalled Neon request) must not stall the paid call that triggered it.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

// #57: these tests cover other behaviour; the daily-cap guard has its own PGlite tests.
vi.mock('@/lib/costs/daily-cap', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/costs/daily-cap')>()),
  assertWithinDailyCap: vi.fn(async () => 0),
}));
vi.mock('@/lib/db', () => ({
  db: {
    insert: () => ({
      // Never settles: models a neon-http fetch that hangs.
      values: () => new Promise<void>(() => undefined),
    }),
  },
}));
vi.mock('@/lib/db/autonomous-scraper-schema', () => ({ crawlCostEvents: {} }));

import { trackCost } from '@/lib/costs';
import { RecipeDiscoveryService } from '@/lib/services/recipe-discovery.service';

const RECIPE_URL = 'https://www.bbcgoodfood.com/recipes/leftover-vegetable-soup';
/** Deadline for the whole call: the ~2s ledger timeout plus slack. */
const GUARD_MS = 3500;
const HUNG = Symbol('hung');

function withGuard<T>(promise: Promise<T>): Promise<T | typeof HUNG> {
  return Promise.race([
    promise,
    new Promise<typeof HUNG>((resolve) => setTimeout(() => resolve(HUNG), GUARD_MS)),
  ]);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('cost ledger write timeout', () => {
  it('trackCost resolves within the timeout when the insert never resolves', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await withGuard(trackCost({ provider: 'serpapi', operation: 'search' }));

    expect(result).not.toBe(HUNG);
    expect(result).toMatchObject({ provider: 'serpapi', operation: 'search' });
    expect(errorLog).toHaveBeenCalledWith(
      expect.stringContaining('[CostLedger] Timed out recording cost event serpapi:search')
    );
  }, 10_000);

  it('a hung ledger insert does not stall a Tavily search', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            query: 'q',
            results: [
              { title: 'Leftover Vegetable Soup', url: RECIPE_URL, content: 'Soup', score: 0.9 },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
    );
    vi.stubGlobal('fetch', fetchMock);
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const service = new RecipeDiscoveryService('fake-tavily-key');
    (service as unknown as { sleep: () => Promise<void> }).sleep = async () => undefined;

    const urls = await withGuard(
      service.discoverRecipeUrls({ searchQuery: 'leftover vegetable soup' })
    );

    expect(urls).not.toBe(HUNG);
    expect((urls as { url: string }[]).map((u) => u.url)).toEqual([RECIPE_URL]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(errorLog).toHaveBeenCalledWith(
      expect.stringContaining('[CostLedger] Timed out recording cost event tavily:search.advanced')
    );
  }, 10_000);
});
