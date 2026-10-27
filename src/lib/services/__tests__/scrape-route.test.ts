/**
 * #6 S2: POST /api/recipes/scrape caps maxResults and reports `tracked`.
 */

import { describe, expect, it, vi } from 'vitest';

const runRecordedWeeklyCrawl = vi.hoisted(() =>
  vi.fn(async () => ({
    runId: null,
    tracked: false,
    status: 'completed',
    weeks: [{ success: true, stats: {}, recipes: [] }],
    errors: [],
    costUsd: 0,
  }))
);
vi.mock('@/lib/services/recorded-weekly-crawl', () => ({ runRecordedWeeklyCrawl }));

import { POST } from '@/app/api/recipes/scrape/route';

function post(body: unknown) {
  const req = new Request('http://localhost/api/recipes/scrape', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return POST(req as unknown as Parameters<typeof POST>[0]);
}

describe('POST /api/recipes/scrape', () => {
  it('caps maxResults at 50 and passes the clamped value to the run', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    for (const [requested, expected] of [
      [10_000, 50],
      [7, 7],
      [0, 1],
    ] as const) {
      runRecordedWeeklyCrawl.mockClear();
      await post({ weeksAgo: 0, maxResults: requested });
      expect(runRecordedWeeklyCrawl).toHaveBeenCalledWith(
        expect.objectContaining({ maxResultsPerWeek: expected })
      );
    }
  });

  it('reports tracked=false when the run row could not be created', async () => {
    const res = await post({ weeksAgo: 0 });
    const json = await res.json();
    expect(json).toMatchObject({ runId: null, tracked: false, success: true });
  });
});
