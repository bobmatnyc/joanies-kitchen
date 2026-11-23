// @vitest-environment node
/**
 * #142: POST /api/ingest-recipe returns the stored recipe for a URL a live
 * recipe already holds by `canonical_source_url` (the daily crawl's D7c rule),
 * with no scrape, no LLM parse and no write. Real `recipes` table (PGlite);
 * only the scrape and LLM boundaries are stubbed, and they record calls.
 */

import type { PGlite } from '@electric-sql/pglite';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  db: undefined as unknown,
  scraped: [] as string[],
  parsed: [] as string[],
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({
  get db() {
    return state.db;
  },
}));
vi.mock('@/lib/rate-limit/counter', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rate-limit/counter')>()),
  defaultUsageDb: async () => state.db,
}));
vi.mock('@/lib/firecrawl', () => ({
  scrapeRecipePage: async (url: string) => {
    state.scraped.push(url);
    return { success: true, markdown: `# page ${url}` };
  },
}));
vi.mock('@/lib/ai/recipe-ingestion-parser', () => ({
  parseRecipeForIngestion: async (_markdown: string, url: string) => {
    state.parsed.push(url);
    return {
      name: 'Beef Stew',
      description: '',
      ingredients: [{ quantity: '1', unit: '', name: 'beef' }],
      instructions: ['Cook it'],
      tags: [],
    };
  },
}));
vi.mock('@/lib/ai/embeddings', () => ({
  generateRecipeEmbedding: async () => {
    throw new Error('no embeddings in test');
  },
}));
vi.mock('@/lib/db/embeddings', () => ({ saveRecipeEmbedding: vi.fn() }));
vi.mock('@/lib/api-auth/require-auth', () => ({
  requireScopes:
    (_scopes: string[], handler: (...args: unknown[]) => unknown) =>
    (request: unknown, context: unknown) =>
      handler(request, { authenticated: true, userId: 'admin-1', scopes: [] }, context),
}));

import { createVisibilityDb } from '@/app/actions/__tests__/recipe-visibility-db';
import { users } from '@/lib/db/auth-schema';
import { recipes } from '@/lib/db/schema';
import { usageCounters } from '@/lib/db/usage-counters-schema';
import { POST } from '../route';

const call = POST as unknown as (r: NextRequest, c: unknown) => Promise<Response>;
async function post(body: unknown) {
  const res = await call(
    new NextRequest('http://localhost/api/ingest-recipe', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({}) }
  );
  type Hit = { alreadyExists?: boolean; recipe: { id: string; slug: string } };
  return {
    status: res.status,
    body: (await res.json()) as Hit & { stats?: Record<string, unknown>; results: Hit[] },
  };
}

let client: PGlite;
const count = async (table: string) =>
  (await client.query<{ n: number }>(`SELECT count(*)::int AS n FROM "${table}"`)).rows[0].n;

beforeAll(async () => {
  const built = await createVisibilityDb(
    [users, recipes, usageCounters],
    { recipes, usageCounters },
    { constraints: true }
  );
  client = built.client;
  state.db = built.db;
  await client.exec(`INSERT INTO "users" (id, email, is_admin)
    VALUES ('admin-1', 'admin@example.com', true)`);
});

afterAll(async () => {
  await client?.close();
});

beforeEach(async () => {
  await client.exec('DELETE FROM "recipes"; DELETE FROM "usage_counters";');
  // `source` differs from the request URL by more than #135's rule sees (a different
  // path case is kept by both), so only the canonical_source_url lookup can match.
  await client.exec(`INSERT INTO "recipes" (id, user_id, name, ingredients, instructions, source, canonical_source_url, slug, is_public)
    VALUES ('known-1', 'someone', 'Beef Stew', '[]', '[]', 'https://legacy.example/old-path', 'https://a.com/beef-stew', 'beef-stew', true)`);
  state.scraped = [];
  state.parsed = [];
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('POST /api/ingest-recipe known URL (#142)', () => {
  it('returns the stored recipe for a known URL with no fetch, LLM call or write', async () => {
    const res = await post({ url: 'http://www.a.com/beef-stew/?utm_source=x#top' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      alreadyExists: true,
      recipe: { id: 'known-1', name: 'Beef Stew', slug: 'beef-stew', url: '/recipes/beef-stew' },
    });
    expect(state.scraped).toEqual([]);
    expect(state.parsed).toEqual([]);
    expect(await count('recipes')).toBe(1);
    expect(await count('usage_counters')).toBe(0);
  });

  it('reports a known URL in a batch as alreadyExists, with no fetch', async () => {
    const res = await post({ urls: ['https://a.com/beef-stew'] });
    expect(res.status).toBe(200);
    expect(res.body.stats).toMatchObject({ total: 1, success: 1, alreadyExists: 1 });
    expect(res.body.results[0]).toMatchObject({
      alreadyExists: true,
      recipe: { id: 'known-1', slug: 'beef-stew' },
    });
    expect(state.scraped).toEqual([]);
    expect(state.parsed).toEqual([]);
  });

  it('still extracts an unknown URL, beside a known one in the same batch', async () => {
    const res = await post({ urls: ['https://a.com/beef-stew', 'https://a.com/lamb-stew'] });
    expect(res.status).toBe(200);
    expect(res.body.results[0]).toMatchObject({ alreadyExists: true });
    expect(res.body.results[1]).toMatchObject({ success: true });
    expect(res.body.results[1].alreadyExists).toBeUndefined();
    expect(state.scraped).toEqual(['https://a.com/lamb-stew']);
    expect(state.parsed).toEqual(['https://a.com/lamb-stew']);
    expect(await count('recipes')).toBe(2);
  });

  it('ignores a soft-deleted match and returns the live recipe holding the URL', async () => {
    await client.exec(`UPDATE "recipes" SET deleted_at = now() WHERE id = 'known-1'`);
    await client.exec(`INSERT INTO "recipes" (id, user_id, name, ingredients, instructions, source, canonical_source_url, slug, is_public)
      VALUES ('known-2', 'someone', 'Beef Stew', '[]', '[]', 'https://legacy.example/new-path', 'https://a.com/beef-stew', 'beef-stew-2', true)`);
    const res = await post({ url: 'https://a.com/beef-stew' });
    expect(res.status).toBe(200);
    expect(res.body.recipe).toMatchObject({ id: 'known-2', slug: 'beef-stew-2' });
    expect(state.scraped).toEqual([]);
  });
});
