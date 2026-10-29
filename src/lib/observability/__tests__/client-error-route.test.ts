// @vitest-environment node
/** #55 S2: POST /api/client-error validates, rate-limits, and logs one redacted app-error line. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RateLimitResult } from '@/lib/rate-limit';
import { handleClientError } from '../client-error-handler';
import { MAX_CLIENT_ERROR_BODY_BYTES } from '../client-error-payload';

const allow = async (): Promise<RateLimitResult> => ({ allowed: true, count: 1, limit: 10 });

function captureLines(): string[] {
  const lines: string[] = [];
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    lines.push(args.map(String).join(' '));
  });
  return lines;
}

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('https://joanies.kitchen/api/client-error', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'content-type': 'application/json', 'x-real-ip': '1.2.3.4', ...headers },
  });
}

const valid = {
  name: 'TypeError',
  message: 'cannot read x of jane.doe@example.com',
  digest: 'abc123',
  boundary: 'meals',
  pathname: '/meals/pasta-night?token=secret-value-123#frag',
};

afterEach(() => vi.restoreAllMocks());

describe('handleClientError', () => {
  it('logs one redacted client app-error line with the query and hash stripped', async () => {
    const lines = captureLines();
    const res = await handleClientError(post(valid), { limit: allow });
    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
    expect(lines).toHaveLength(1);
    const line = lines[0] ?? '';
    expect(line).not.toContain('jane.doe@example.com');
    expect(line).not.toContain('?');
    expect(line).not.toContain('secret-value');
    expect(line).not.toContain('frag');
    expect(JSON.parse(line)).toMatchObject({
      tag: 'app-error',
      source: 'client',
      path: '/meals/pasta-night',
      detail: 'meals',
      digest: 'abc123',
      name: 'TypeError',
      message: 'cannot read x of [email]',
    });
  });

  it.each([
    ['non-JSON', 'not json {'],
    ['array', [valid]],
    ['unknown key', { ...valid, userId: 'u1' }],
    ['unknown boundary', { ...valid, boundary: 'evil' }],
    ['relative pathname', { ...valid, pathname: 'meals' }],
    ['missing message', { ...valid, message: undefined }],
    ['non-string name', { ...valid, name: 42 }],
    ['over-cap message', { ...valid, message: 'x'.repeat(1001) }],
    ['oversized body', { ...valid, message: 'y'.repeat(MAX_CLIENT_ERROR_BODY_BYTES) }],
  ])('rejects %s with a fixed 400 that echoes nothing', async (_label, body) => {
    const lines = captureLines();
    const limit = vi.fn(allow);
    const res = await handleClientError(post(body), { limit });
    expect(res.status).toBe(400);
    expect(await res.text()).toBe('bad request');
    expect(lines).toHaveLength(0);
    expect(limit).not.toHaveBeenCalled();
  });

  it('rejects a declared oversized content-length before reading', async () => {
    const res = await handleClientError(post(valid, { 'content-length': '999999' }), {
      limit: allow,
    });
    expect(res.status).toBe(400);
  });

  it('returns 429 over the limit, keyed by IP only, and logs nothing', async () => {
    const lines = captureLines();
    const limit = vi.fn(
      async (): Promise<RateLimitResult> => ({
        allowed: false,
        reason: 'limited',
        retryAfterSec: 30,
        limit: 10,
      })
    );
    const res = await handleClientError(post(valid, { cookie: 'authjs.session-token=s' }), {
      limit,
    });
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('30');
    expect(await res.text()).toBe('too many requests');
    expect(limit).toHaveBeenCalledWith('ip:1.2.3.4');
    expect(lines).toHaveLength(0);
  });

  it('fails closed with 503 when the limiter database is unavailable', async () => {
    // #55: real checkRateLimit with a db whose insert throws (DB down) — Fail-Open Check.
    const { checkRateLimit } = await import('@/lib/rate-limit');
    const lines = captureLines();
    const brokenDb = {
      insert: () => {
        throw new Error('connect ECONNREFUSED');
      },
    } as never;
    const res = await handleClientError(post(valid), {
      limit: (key) => checkRateLimit('client-error', key, { db: brokenDb }),
    });
    expect(res.status).toBe(503);
    expect(await res.text()).toBe('unavailable');
    expect(lines.some((l) => l.includes('"tag":"app-error"'))).toBe(false);
  });

  it('returns 503 instead of throwing when the limiter itself throws', async () => {
    captureLines();
    const res = await handleClientError(post(valid), {
      limit: async () => {
        throw new Error('boom');
      },
    });
    expect(res.status).toBe(503);
  });
});
