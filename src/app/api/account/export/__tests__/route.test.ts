// @vitest-environment node
/** #58: GET /api/account/export — 401 signed out, 429 over limit, 500 on any query failure. */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { seedExportDb } from '@/lib/account-export/__tests__/export-fixture';

const state = vi.hoisted(() => ({
  userId: null as string | null,
  db: undefined as unknown,
  verdict: { allowed: true, count: 1, limit: 3 } as Record<string, unknown>,
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth', () => ({ auth: async () => ({ userId: state.userId }) }));
vi.mock('@/lib/db', () => ({ getDb: () => state.db, db: {} }));
vi.mock('@/lib/rate-limit', () => ({ enforceRateLimit: vi.fn(async () => state.verdict) }));

import { enforceRateLimit } from '@/lib/rate-limit';
import { GET } from '../route';

let fx: Awaited<ReturnType<typeof seedExportDb>>;

beforeAll(async () => {
  fx = await seedExportDb();
});
afterAll(async () => {
  await fx.client.close();
});
beforeEach(() => {
  state.userId = fx.userA;
  state.db = fx.db;
  state.verdict = { allowed: true, count: 1, limit: 3 };
});

describe('GET /api/account/export', () => {
  it('returns 401 without a session and checks no limit', async () => {
    state.userId = null;
    vi.mocked(enforceRateLimit).mockClear();
    const res = await GET();
    expect(res.status).toBe(401);
    expect(enforceRateLimit).not.toHaveBeenCalled();
  });

  it('returns the caller export as an uncached JSON attachment', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(res.headers.get('content-disposition')).toMatch(
      /^attachment; filename="joanies-kitchen-export-\d{4}-\d{2}-\d{2}\.json"$/
    );
    expect(res.headers.get('cache-control')).toContain('no-store');
    const text = await res.text();
    const body = JSON.parse(text);
    expect(body.user_id).toBe(fx.userA);
    for (const id of fx.bIds) expect(text).not.toContain(id);
    expect(enforceRateLimit).toHaveBeenCalledWith('account-export', fx.userA);
  });

  it('returns 429 with Retry-After over the limit', async () => {
    state.verdict = { allowed: false, reason: 'limited', retryAfterSec: 1200, limit: 3 };
    const res = await GET();
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('1200');
  });

  it('returns 503 with no export data when the limiter is unavailable', async () => {
    state.verdict = { allowed: false, reason: 'unavailable', retryAfterSec: 60, limit: 3 };
    const res = await GET();
    const text = await res.text();
    expect(res.status).toBe(503);
    expect(JSON.parse(text)).toEqual({ error: 'Export is temporarily unavailable' });
    expect(text).not.toContain(fx.userA);
  });

  it('returns 500 and no export data when a table query fails', async () => {
    const broken = await seedExportDb();
    await broken.client.exec('DROP TABLE "recipe_flags";');
    state.db = broken.db;
    state.userId = broken.userA;
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = await GET();
    const text = await res.text();
    expect(res.status).toBe(500);
    expect(JSON.parse(text)).toEqual({ error: 'Export failed' });
    expect(text).not.toContain(broken.userA);
    spy.mockRestore();
    await broken.client.close();
  });
});
