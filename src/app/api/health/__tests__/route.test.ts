/** #56: /api/health returns 200 only when the DB check passes, else 503. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const execute = vi.hoisted(() => vi.fn());
vi.mock('@/lib/db', () => ({ db: { execute } }));

import { GET } from '../route';

describe('GET /api/health', () => {
  beforeEach(() => {
    execute.mockReset();
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'abcdef1234567890');
    vi.stubEnv('AUTH_SECRET', 'secret-value-123');
    vi.stubEnv('AUTH_GOOGLE_ID', 'google-id-value');
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('returns 200 and ok when SELECT 1 succeeds', async () => {
    execute.mockResolvedValue({ rows: [{ '?column?': 1 }] });
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('no-store');
    expect(body.status).toBe('ok');
    expect(body.checks.db).toEqual({ status: 'ok' });
    expect(body.commit).toBe('abcdef1');
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);
  });

  it('returns 503 without leaking the error when the DB throws', async () => {
    execute.mockRejectedValue(new Error('connect postgres://user:secret@host/db failed'));
    const res = await GET();
    const text = await res.text();
    const body = JSON.parse(text);
    expect(res.status).toBe(503);
    expect(body.status).toBe('error');
    expect(body.checks.db).toEqual({ status: 'error', reason: 'unreachable' });
    expect(text).not.toContain('secret');
    expect(text).not.toContain('postgres://');
  });

  it('returns 503 when the DB check times out', async () => {
    vi.useFakeTimers();
    execute.mockReturnValue(new Promise<never>(() => undefined));
    const pending = GET();
    await vi.advanceTimersByTimeAsync(3000);
    const res = await pending;
    expect(res.status).toBe(503);
    expect((await res.json()).checks.db).toEqual({ status: 'error', reason: 'timeout' });
  });

  // #55 S3: auth config presence is reported as booleans and gates the status.
  it('reports auth config presence as booleans, never values', async () => {
    execute.mockResolvedValue({ rows: [] });
    const res = await GET();
    const text = await res.text();
    expect(res.status).toBe(200);
    expect(JSON.parse(text).checks.auth).toEqual({
      status: 'ok',
      AUTH_SECRET: true,
      AUTH_GOOGLE_ID: true,
    });
    expect(text).not.toContain('secret-value-123');
    expect(text).not.toContain('google-id-value');
  });

  it.each(['AUTH_SECRET', 'AUTH_GOOGLE_ID'])('returns 503 when %s is missing', async (name) => {
    execute.mockResolvedValue({ rows: [] });
    vi.stubEnv(name, '');
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(503);
    expect(body.status).toBe('error');
    expect(body.checks.db).toEqual({ status: 'ok' });
    expect(body.checks.auth.status).toBe('error');
    expect(body.checks.auth[name]).toBe(false);
  });
});
