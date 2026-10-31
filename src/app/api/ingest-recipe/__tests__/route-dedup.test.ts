// @vitest-environment node
/**
 * #135: POST /api/ingest-recipe skips a duplicate instead of inserting it,
 * against a real `recipes` table (PGlite). Scrape, LLM parse and embeddings
 * are stubbed; the slug helper and the duplicate query run for real.
 *
 * A user import applies the canonical-URL rule only: on user-submitted hosts
 * different recipes share common titles, so a same-title page on the same host
 * is a new recipe. The old slug check ran after `generateUniqueSlug` had picked
 * a free slug, so it never fired; the URL check replaces it.
 */

import type { PGlite } from '@electric-sql/pglite';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  db: undefined as unknown,
  scraped: [] as string[],
  /** Set to make every duplicate lookup reject (fail-closed test). */
  dedupError: undefined as Error | undefined,
  /** Title the stubbed LLM parser returns for each URL. */
  titles: {} as Record<string, string>,
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
  parseRecipeForIngestion: async (_markdown: string, url: string) => ({
    name: state.titles[url] ?? 'Untitled',
    description: '',
    ingredients: [{ quantity: '1', unit: '', name: 'onion' }],
    instructions: ['Cook it'],
    tags: [],
  }),
}));
vi.mock('@/lib/ai/embeddings', () => ({
  generateRecipeEmbedding: async () => {
    throw new Error('no embeddings in test');
  },
}));
vi.mock('@/lib/db/embeddings', () => ({ saveRecipeEmbedding: vi.fn() }));
vi.mock('@/lib/recipes/dedup', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/recipes/dedup')>();
  return {
    ...actual,
    findDuplicateRecipe: (...args: Parameters<typeof actual.findDuplicateRecipe>) =>
      state.dedupError ? Promise.reject(state.dedupError) : actual.findDuplicateRecipe(...args),
  };
});
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
async function ingest(url: string, title: string) {
  state.titles[url] = title;
  const res = await call(
    new NextRequest('http://localhost/api/ingest-recipe', {
      method: 'POST',
      body: JSON.stringify({ url }),
    }),
    { params: Promise.resolve({}) }
  );
  return {
    status: res.status,
    body: (await res.json()) as {
      error?: string;
      duplicateOf?: string;
      recipe?: { id: string; slug: string };
    },
  };
}

let client: PGlite;
const count = async () =>
  (await client.query<{ n: number }>('SELECT count(*)::int AS n FROM "recipes"')).rows[0].n;

beforeAll(async () => {
  // #220: the recipe insert reads `users` for a pending deletion.
  const built = await createVisibilityDb(
    [users, recipes, usageCounters],
    { recipes, usageCounters },
    { constraints: true }
  );
  client = built.client;
  state.db = built.db;
  // #233: the route is admin-only; the caller is a real admin row.
  await client.exec(`INSERT INTO "users" (id, email, is_admin)
    VALUES ('admin-1', 'admin@example.com', true)`);
});

afterAll(async () => {
  await client?.close();
});

beforeEach(async () => {
  await client.exec('DELETE FROM "recipes"; DELETE FROM "usage_counters";');
  await client.exec(`INSERT INTO "recipes" (id, user_id, name, ingredients, instructions, source, slug, is_public)
    VALUES ('seed-1', 'someone', 'Chicken Soup', '[]', '[]', 'https://www.a.com/chicken-soup/', 'chicken-soup', true),
           ('seed-2', 'someone', 'Chicken Soup', '[]', '[]', 'https://z.com/soup', 'chicken-soup-2', true)`);
  state.scraped = [];
  state.titles = {};
  state.dedupError = undefined;
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('POST /api/ingest-recipe duplicate guard (#135)', () => {
  it('skips a URL variant of a stored source before the paid scrape', async () => {
    const res = await ingest('http://a.com/chicken-soup/print/?utm_source=x#comments', 'Whatever');
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      error: 'skipped: duplicate of seed-1',
      duplicateOf: 'seed-1',
    });
    expect(state.scraped).toEqual([]);
    expect(await count()).toBe(2);
  });

  it('inserts a same-title recipe from a different URL on the same host', async () => {
    const res = await ingest('https://a.com/soup-again', 'Chicken soup!');
    expect(res.status).toBe(201);
    expect(res.body.duplicateOf).toBeUndefined();
    expect(await count()).toBe(3);
  });

  it('skips a duplicate of a hidden recipe without naming it', async () => {
    await client.exec(`INSERT INTO "recipes" (id, user_id, name, ingredients, instructions, source, is_public, moderation_status)
      VALUES ('hidden-1', 'someone', 'Pie', '[]', '[]', 'https://c.com/pie', true, 'rejected')`);
    const res = await ingest('https://c.com/pie/', 'Pie');
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ success: false, error: 'Recipe already exists' });
    expect(JSON.stringify(res.body)).not.toContain('hidden-1');
    expect(state.scraped).toEqual([]);
  });

  it('fails closed when the duplicate lookup rejects: nothing scraped or inserted', async () => {
    state.dedupError = new Error('db down');
    const res = await ingest('https://a.com/beef-stew', 'Beef Stew');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('db down');
    expect(state.scraped).toEqual([]);
    expect(await count()).toBe(2);
  });

  it('inserts the same title from another host', async () => {
    const res = await ingest('https://b.com/grandmas-soup', 'Chicken Soup');
    expect(res.status).toBe(201);
    expect(res.body.recipe?.slug).toBe('chicken-soup-3');
    expect(await count()).toBe(3);
  });

  it('inserts a genuinely new recipe', async () => {
    const res = await ingest('https://a.com/beef-stew', 'Beef Stew');
    expect(res.status).toBe(201);
    expect(res.body.recipe?.slug).toBe('beef-stew');
    expect(await count()).toBe(3);
  });

  it("ignores another user's private recipe and a soft-deleted one", async () => {
    await client.exec(`INSERT INTO "recipes" (id, user_id, name, ingredients, instructions, source, is_public, deleted_at)
      VALUES ('priv', 'other-user', 'Pie', '[]', '[]', 'https://c.com/pie', false, NULL),
             ('gone', 'someone', 'Tart', '[]', '[]', 'https://c.com/tart', true, now())`);
    expect((await ingest('https://c.com/pie', 'Pie')).status).toBe(201);
    expect((await ingest('https://c.com/tart', 'Tart')).status).toBe(201);
  });
});
