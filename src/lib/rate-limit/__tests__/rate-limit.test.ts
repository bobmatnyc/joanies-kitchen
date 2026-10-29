// @vitest-environment node
/**
 * #17: fixed-window limiter over a real Postgres upsert (PGlite).
 */

import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createVisibilityDb } from '@/app/actions/__tests__/recipe-visibility-db';
import { usageCounters } from '@/lib/db/usage-counters-schema';
import { checkRateLimit, clientIpFrom, RATE_LIMITS, rateLimitKey, UNKNOWN_IP_KEY } from '..';
import { incrementCounter, type UsageDb } from '../counter';

let client: PGlite;
let db: UsageDb;

beforeAll(async () => {
  const built = await createVisibilityDb([usageCounters], { usageCounters }, { constraints: true });
  client = built.client;
  db = built.db as unknown as UsageDb;
});

afterAll(async () => {
  await client?.close();
});

beforeEach(async () => {
  await client.exec('DELETE FROM "usage_counters";');
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

const { limit, windowSec } = RATE_LIMITS['semantic-search'];
const T0 = new Date('2026-10-28T12:00:05Z');

describe('#17 checkRateLimit', () => {
  it('allows N calls in a window, then blocks', async () => {
    for (let i = 1; i <= limit; i++) {
      const result = await checkRateLimit('semantic-search', 'ip:1.2.3.4', { db, now: T0 });
      expect(result).toMatchObject({ allowed: true, count: i });
    }
    const over = await checkRateLimit('semantic-search', 'ip:1.2.3.4', { db, now: T0 });
    expect(over).toMatchObject({ allowed: false, reason: 'limited' });
    // Another caller has its own budget.
    const other = await checkRateLimit('semantic-search', 'ip:5.6.7.8', { db, now: T0 });
    expect(other.allowed).toBe(true);
  });

  it('resets when the window rolls over', async () => {
    for (let i = 0; i <= limit; i++) {
      await checkRateLimit('semantic-search', 'ip:1.2.3.4', { db, now: T0 });
    }
    const next = new Date(T0.getTime() + windowSec * 1000);
    const result = await checkRateLimit('semantic-search', 'ip:1.2.3.4', { db, now: next });
    expect(result).toMatchObject({ allowed: true, count: 1 });
  });

  it('concurrent increments are atomic', async () => {
    const start = new Date('2026-10-28T12:00:00Z');
    const counts = await Promise.all(
      Array.from({ length: 25 }, () => incrementCounter(db, 'rl:test', 'k', start))
    );
    expect([...counts].sort((a, b) => a - b)).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
    const rows = await client.query<{ count: number }>('SELECT count FROM usage_counters');
    expect(rows.rows).toEqual([{ count: 25 }]);
  });

  it('fails closed when the counter query errors', async () => {
    const broken = {
      insert: () => {
        throw new Error('neon down');
      },
    } as unknown as UsageDb;
    const result = await checkRateLimit('semantic-search', 'ip:1.2.3.4', { db: broken, now: T0 });
    expect(result).toMatchObject({ allowed: false, reason: 'unavailable' });
    expect(console.error).toHaveBeenCalled();
  });
});

describe('#17 client IP', () => {
  const h = (values: Record<string, string>) => new Headers(values);

  it('clientIpFrom reads x-real-ip then x-forwarded-for', () => {
    expect(clientIpFrom(h({ 'x-real-ip': '9.9.9.9', 'x-forwarded-for': '1.1.1.1' }))).toBe(
      '9.9.9.9'
    );
    expect(clientIpFrom(h({ 'x-forwarded-for': ' 1.1.1.1 , 10.0.0.1' }))).toBe('1.1.1.1');
    expect(clientIpFrom(h({ 'x-forwarded-for': '2001:DB8::1' }))).toBe('2001:db8::1');
  });

  it('clientIpFrom rejects junk', () => {
    expect(clientIpFrom(h({ 'x-forwarded-for': 'not-an-ip' }))).toBeNull();
    expect(clientIpFrom(h({ 'x-real-ip': '999.1.1.1' }))).toBeNull();
    expect(clientIpFrom(h({}))).toBeNull();
  });

  it('a caller with no readable IP shares the unknown bucket, and is still limited', async () => {
    const key = rateLimitKey(null, h({ 'x-forwarded-for': 'garbage' }));
    expect(key).toBe(UNKNOWN_IP_KEY);
    expect(rateLimitKey('u1', h({}))).toBe('user:u1');
    for (let i = 0; i < limit; i++) await checkRateLimit('semantic-search', key, { db, now: T0 });
    const over = await checkRateLimit('semantic-search', key, { db, now: T0 });
    expect(over.allowed).toBe(false);
  });
});

describe('daily window boundary', () => {
  const daily = RATE_LIMITS['recipe-ingest-api'];

  it('refuses with retryAfterSec 1 half a second before midnight UTC, then starts fresh', async () => {
    const lastSecond = new Date('2026-10-28T23:59:59.500Z');
    for (let i = 0; i < daily.limit; i++) {
      await checkRateLimit('recipe-ingest-api', 'user:daily', { db, now: lastSecond });
    }
    const over = await checkRateLimit('recipe-ingest-api', 'user:daily', { db, now: lastSecond });
    expect(over).toMatchObject({ allowed: false, reason: 'limited', retryAfterSec: 1 });

    const midnight = new Date('2026-10-29T00:00:00.000Z');
    const fresh = await checkRateLimit('recipe-ingest-api', 'user:daily', { db, now: midnight });
    expect(fresh).toMatchObject({ allowed: true, count: 1 });
  });
});
