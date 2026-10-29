/**
 * Fail-Open regression test (#6): a cost-ledger insert that throws must not
 * change what a crawl call returns, and the failure must be logged.
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
      values: async () => {
        throw new Error('ledger insert failed: connection refused');
      },
    }),
  },
}));
vi.mock('@/lib/db/autonomous-scraper-schema', () => ({ crawlCostEvents: {} }));

import { RecipeDiscoveryService } from '@/lib/services/recipe-discovery.service';

const RECIPE_URL = 'https://www.bbcgoodfood.com/recipes/leftover-vegetable-soup';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('cost ledger fail-open', () => {
  it('a failed ledger insert does not abort a Tavily search', async () => {
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
    // Skip retry back-off so a regression fails on its assertion, not the test timeout.
    (service as unknown as { sleep: () => Promise<void> }).sleep = async () => undefined;

    const urls = await service.discoverRecipeUrls({ searchQuery: 'leftover vegetable soup' });

    // The crawl result is unchanged by the ledger failure...
    expect(urls.map((u) => u.url)).toEqual([RECIPE_URL]);
    // ...the paid call was made once, not retried because of the ledger...
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // ...and the failure was logged.
    expect(errorLog).toHaveBeenCalledWith(
      expect.stringContaining('[CostLedger] Failed to record cost event tavily:search.advanced'),
      expect.any(Error)
    );
  });
});
