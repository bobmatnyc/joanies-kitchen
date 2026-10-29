// @vitest-environment node
/**
 * POST /api/ingest-recipe counts every URL of a batch against the caller's
 * `recipe-ingest-api` bucket, against the real usage_counters upsert (PGlite).
 * The bucket limit is lowered to 2 so a short batch crosses it.
 */

import type { PGlite } from '@electric-sql/pglite';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  usageDb: undefined as unknown,
  auth: { authenticated: true, userId: 'user-1', apiKeyId: 'key-1' } as {
    authenticated: boolean;
    userId: string;
    apiKeyId?: string;
  },
  capAfter: Infinity,
  scraped: [] as string[],
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ db: {} }));
vi.mock('@/lib/rate-limit/counter', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rate-limit/counter')>()),
  defaultUsageDb: async () => state.usageDb,
}));
vi.mock('@/lib/firecrawl', () => ({
  scrapeRecipePage: async (url: string) => {
    state.scraped.push(url);
    if (state.scraped.length > state.capAfter) {
      const { PaidCallBlockedError } = await import('@/lib/costs/daily-cap');
      throw new PaidCallBlockedError('COST_CAP_REACHED', 'Daily cost cap reached');
    }
    return { success: false, error: 'scrape stub' };
  },
}));
vi.mock('@/lib/ai/recipe-ingestion-parser', () => ({ parseRecipeForIngestion: vi.fn() }));
vi.mock('@/lib/ai/embeddings', () => ({ generateRecipeEmbedding: vi.fn() }));
vi.mock('@/lib/db/embeddings', () => ({ saveRecipeEmbedding: vi.fn() }));
vi.mock('@/lib/utils/slug', () => ({ generateUniqueSlug: vi.fn() }));
// #135: the duplicate query has its own PGlite test (route-dedup); nothing is a duplicate here.
vi.mock('@/lib/recipes/dedup', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/recipes/dedup')>()),
  findDuplicateRecipe: async () => null,
}));
vi.mock('@/lib/api-auth/require-auth', () => ({
  requireScopes:
    (_scopes: string[], handler: (...args: unknown[]) => unknown) =>
    (request: unknown, context: unknown) =>
      handler(request, { ...state.auth, scopes: [] }, context),
}));

import { createVisibilityDb } from '@/app/actions/__tests__/recipe-visibility-db';
import { usageCounters } from '@/lib/db/usage-counters-schema';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { POST } from '../route';

const BUCKET = 'recipe-ingest-api';
const ORIGINAL_LIMIT = RATE_LIMITS[BUCKET].limit;
/** RATE_LIMITS is `as const`; the test lowers the limit in place. */
const setLimit = (n: number) => {
  (RATE_LIMITS[BUCKET] as { limit: number }).limit = n;
};
const call = POST as unknown as (r: NextRequest, c: unknown) => Promise<Response>;
const ingest = (urls: string[]) =>
  call(
    new NextRequest('http://localhost/api/ingest-recipe', {
      method: 'POST',
      body: JSON.stringify({ urls }),
    }),
    { params: Promise.resolve({}) }
  );
const urlsOf = (n: number, tag = 'a') =>
  Array.from({ length: n }, (_, i) => `https://example.com/${tag}${i}`);

let client: PGlite;

beforeAll(async () => {
  const built = await createVisibilityDb([usageCounters], { usageCounters }, { constraints: true });
  client = built.client;
  state.usageDb = built.db;
});

afterAll(async () => {
  setLimit(ORIGINAL_LIMIT);
  await client?.close();
});

beforeEach(async () => {
  await client.exec('DELETE FROM "usage_counters";');
  setLimit(2);
  state.auth = { authenticated: true, userId: 'user-1', apiKeyId: 'key-1' };
  state.capAfter = Infinity;
  state.scraped = [];
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  // Skip the 1 s pause between batch URLs.
  const realSetTimeout = globalThis.setTimeout;
  vi.spyOn(globalThis, 'setTimeout').mockImplementation(((fn: () => void, ms?: number) =>
    realSetTimeout(fn, ms === 1000 ? 0 : ms)) as typeof setTimeout);
});

describe('POST /api/ingest-recipe batch rate limit', () => {
  it('scrapes 2 of 3 URLs at limit 2 and reports the third as RATE_LIMITED', async () => {
    const urls = urlsOf(3);
    const res = await ingest(urls);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      results: Array<{ url: string; errorCode?: string }>;
    };
    expect(state.scraped).toEqual(urls.slice(0, 2));
    expect(body.results).toHaveLength(3);
    expect(body.results[2]).toMatchObject({ url: urls[2], errorCode: 'RATE_LIMITED' });
  });

  it('answers 429 with Retry-After when the first URL is refused', async () => {
    await ingest(urlsOf(2)); // spends the whole bucket
    state.scraped = [];
    const res = await ingest(urlsOf(2, 'b'));
    expect(res.status).toBe(429);
    expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect(((await res.json()) as { errorCode: string }).errorCode).toBe('RATE_LIMITED');
    expect(state.scraped).toEqual([]);
  });

  it('stops the loop on a cost-cap refusal so no later URL reaches the provider', async () => {
    setLimit(10);
    state.capAfter = 1; // the second scrape is refused
    const urls = urlsOf(4);
    const res = await ingest(urls);
    const body = (await res.json()) as { results: Array<{ errorCode?: string }> };
    expect(state.scraped).toEqual(urls.slice(0, 2));
    expect(body.results).toHaveLength(2);
    expect(body.results[1].errorCode).toBe('COST_CAP_REACHED');
  });

  it('gives each apiKeyId its own bucket', async () => {
    await ingest(urlsOf(2)); // key-1 is now spent
    state.auth = { authenticated: true, userId: 'user-1', apiKeyId: 'key-2' };
    state.scraped = [];
    const res = await ingest(urlsOf(2, 'b'));
    expect(res.status).toBe(200);
    expect(state.scraped).toHaveLength(2);
    const rows = await client.query<{ key: string; count: number }>(
      'SELECT key, count FROM "usage_counters" ORDER BY key'
    );
    expect(rows.rows).toEqual([
      { key: 'apikey:key-1', count: 2 },
      { key: 'apikey:key-2', count: 2 },
    ]);
  });

  it('keys a session caller without an apiKeyId as user:<id>', async () => {
    state.auth = { authenticated: true, userId: 'user-9' };
    await ingest(urlsOf(1));
    const rows = await client.query<{ key: string }>('SELECT key FROM "usage_counters"');
    expect(rows.rows).toEqual([{ key: 'user:user-9' }]);
  });
});
