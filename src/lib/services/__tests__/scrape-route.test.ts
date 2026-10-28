/**
 * #6 S2: POST /api/recipes/scrape caps maxResults and reports `tracked`.
 * Calls are authorized with the CRON_SECRET bearer (#11); the auth guard
 * itself is covered by paid-routes-auth.test.ts.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
// No session in tests; the bearer path never reaches it.
vi.mock('@/lib/auth', () => ({ auth: vi.fn(async () => ({ userId: null, sessionClaims: null })) }));
// #22: @/lib/admin reads users.is_admin through this module; keep the real db out.
vi.mock('@/lib/auth-users', () => ({ getUserAdminFlag: vi.fn() }));

const SECRET = 'test-secret';

beforeEach(() => {
  vi.stubEnv('CRON_SECRET', SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

import { POST } from '@/app/api/recipes/scrape/route';

function post(body: unknown) {
  const req = new Request('http://localhost/api/recipes/scrape', {
    method: 'POST',
    headers: { authorization: `Bearer ${SECRET}` },
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
