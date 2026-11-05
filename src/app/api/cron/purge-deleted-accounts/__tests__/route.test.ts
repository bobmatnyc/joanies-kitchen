// @vitest-environment node
/** #104: the purge cron route requires the CRON_SECRET bearer and reports failures as 500. */

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ purgeDueAccounts: vi.fn() }));
vi.mock('@/lib/account-purge', () => ({ purgeDueAccounts: mocks.purgeDueAccounts }));

import { GET } from '@/app/api/cron/purge-deleted-accounts/route';
import vercelConfig from '../../../../../../vercel.json';

const SECRET = 'test-cron-secret';

function request(authorization?: string) {
  return new NextRequest('http://localhost/api/cron/purge-deleted-accounts', {
    headers: authorization ? { authorization } : {},
  });
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv('CRON_SECRET', SECRET);
  mocks.purgeDueAccounts.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('GET /api/cron/purge-deleted-accounts', () => {
  it.each([
    ['no header', undefined],
    ['a wrong secret', 'Bearer nope'],
    ['the secret without Bearer', SECRET],
  ])('returns 401 and purges nothing with %s', async (_label, header) => {
    const res = await GET(request(header));
    expect(res.status).toBe(401);
    expect(mocks.purgeDueAccounts).not.toHaveBeenCalled();
  });

  it('returns 401 when CRON_SECRET is unset, even for "Bearer undefined"', async () => {
    vi.stubEnv('CRON_SECRET', '');
    const res = await GET(request('Bearer undefined'));
    expect(res.status).toBe(401);
    expect(mocks.purgeDueAccounts).not.toHaveBeenCalled();
  });

  it('returns the counts with 200 when every account purged', async () => {
    mocks.purgeDueAccounts.mockResolvedValue({ purged: ['u1', 'u2'], failed: [], skipped: [] });
    const res = await GET(request(`Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      purged: 2,
      failed: 0,
      skipped: 0,
      failures: [],
    });
  });

  it('returns 500 with the failure listed when an account failed', async () => {
    const failed = [{ userId: 'u2', error: 'boom' }];
    mocks.purgeDueAccounts.mockResolvedValue({ purged: ['u1'], failed, skipped: [] });
    const res = await GET(request(`Bearer ${SECRET}`));
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({
      success: false,
      purged: 1,
      failed: 1,
      failures: failed,
    });
    // #55: one app-error line, source cron, without the account id.
    const appErrors = vi
      .mocked(console.error)
      .mock.calls.map((c) => String(c[0]))
      .filter((l) => l.includes('"tag":"app-error"'));
    expect(appErrors).toHaveLength(1);
    expect(JSON.parse(appErrors[0] ?? '')).toMatchObject({ source: 'cron' });
    expect(appErrors[0]).not.toContain('u2');
  });

  it('reports a thrown run as a cron app-error and keeps the 500 body', async () => {
    mocks.purgeDueAccounts.mockRejectedValue(new Error('db down'));
    const res = await GET(request(`Bearer ${SECRET}`));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ success: false, error: 'Purge run failed' });
    const calls = vi.mocked(console.error).mock.calls.map((c) => String(c[0]));
    expect(calls.some((l) => l.includes('"tag":"app-error"') && l.includes('db down'))).toBe(true);
  });

  it('logs one info summary with counts only and no account ids (#111)', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    mocks.purgeDueAccounts.mockResolvedValue({
      purged: ['user-1@example.com', 'u2'],
      failed: [],
      skipped: ['u3'],
    });
    const res = await GET(request(`Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    expect(info).toHaveBeenCalledTimes(1);
    const line = String(info.mock.calls[0]?.[0]);
    expect(line).toMatch(
      /^\[PurgeDeletedAccounts\] Completed — purged=2, skipped=1, failed=0, durationMs=\d+$/
    );
    expect(line).not.toMatch(/u2|u3|@example|SECRET|test-cron/);
  });

  it('logs an error-level outcome line with the message when the run throws (#111)', async () => {
    mocks.purgeDueAccounts.mockRejectedValue(new Error('db down'));
    await GET(request(`Bearer ${SECRET}`));
    const lines = vi.mocked(console.error).mock.calls.map((c) => String(c[0]));
    const line = lines.find((l) => l.startsWith('[PurgeDeletedAccounts] Failed'));
    expect(line).toMatch(/Failed — db down, durationMs=\d+$/);
  });

  it('is scheduled in vercel.json', () => {
    expect(vercelConfig.crons.map((c) => c.path)).toContain('/api/cron/purge-deleted-accounts');
  });
});
