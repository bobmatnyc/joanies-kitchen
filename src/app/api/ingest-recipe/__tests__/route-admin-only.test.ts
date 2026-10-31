// @vitest-environment node
/**
 * #233: POST /api/ingest-recipe is admin-only. Admin status is `users.is_admin`,
 * read from a real PGlite `users` table for both session and API-key callers
 * (the key owner's row). A non-admin, a caller with no `users` row, or a failed
 * lookup gets 403 before any scrape, LLM parse, embedding, rate-limit count or
 * insert. Scrape, LLM parse and embeddings are stubbed and counted.
 */

import type { PGlite } from '@electric-sql/pglite';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  db: undefined as unknown,
  auth: { authenticated: true, userId: 'member-1' } as {
    authenticated: boolean;
    userId: string;
    apiKeyId?: string;
  },
  /** Set to make the admin lookup reject (fail-closed test). */
  adminError: undefined as Error | undefined,
  adminLookups: [] as string[],
  /** Every paid or embedding call the route made, in order. */
  calls: [] as string[],
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
vi.mock('@/lib/auth-users', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth-users')>();
  return {
    ...actual,
    getUserAdminFlag: (userId: string) => {
      state.adminLookups.push(userId);
      return state.adminError ? Promise.reject(state.adminError) : actual.getUserAdminFlag(userId);
    },
  };
});
vi.mock('@/lib/firecrawl', () => ({
  scrapeRecipePage: async (url: string) => {
    state.calls.push(`scrape:${url}`);
    return { success: true, markdown: `# page ${url}` };
  },
}));
vi.mock('@/lib/ai/recipe-ingestion-parser', () => ({
  parseRecipeForIngestion: async (_markdown: string, url: string) => {
    state.calls.push(`parse:${url}`);
    return {
      name: `Recipe ${url.split('/').pop()}`,
      description: '',
      ingredients: [{ quantity: '1', unit: '', name: 'onion' }],
      instructions: ['Cook it'],
      tags: [],
    };
  },
}));
vi.mock('@/lib/ai/embeddings', () => ({
  generateRecipeEmbedding: async () => {
    state.calls.push('embed');
    throw new Error('no embeddings in test');
  },
}));
vi.mock('@/lib/db/embeddings', () => ({ saveRecipeEmbedding: vi.fn() }));
vi.mock('@/lib/api-auth/require-auth', () => ({
  requireScopes:
    (_scopes: string[], handler: (...args: unknown[]) => unknown) =>
    (request: unknown, context: unknown) =>
      handler(request, { ...state.auth, scopes: [] }, context),
}));

import { createVisibilityDb } from '@/app/actions/__tests__/recipe-visibility-db';
import { users } from '@/lib/db/auth-schema';
import { recipes } from '@/lib/db/schema';
import { usageCounters } from '@/lib/db/usage-counters-schema';
import { GET, POST } from '../route';

const call = POST as unknown as (r: NextRequest, c: unknown) => Promise<Response>;

let client: PGlite;
let seq = 0;

/** Posts a JSON body as the current caller. */
const post = (body: unknown) =>
  call(
    new NextRequest('http://localhost/api/ingest-recipe', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({}) }
  );

/** A fresh single-URL body. */
const oneUrl = () => {
  seq += 1;
  return { url: `https://example.com/r${seq}` };
};

/** Row counts of every table the route could write. */
const written = async () => ({
  recipes: (await client.query<{ n: number }>('SELECT count(*)::int AS n FROM "recipes"')).rows[0]
    .n,
  usage: (await client.query<{ n: number }>('SELECT count(*)::int AS n FROM "usage_counters"'))
    .rows[0].n,
});

/** Asserts a 403 with no paid call, no rate-limit count and no stored row. */
async function expectRefused(res: Response) {
  expect(res.status).toBe(403);
  expect(((await res.json()) as { error: string }).error).toBe('Admin access required');
  expect(state.calls).toEqual([]);
  expect(await written()).toEqual({ recipes: 0, usage: 0 });
}

beforeAll(async () => {
  const built = await createVisibilityDb(
    [users, recipes, usageCounters],
    { users, recipes, usageCounters },
    { constraints: true }
  );
  client = built.client;
  state.db = built.db;
  await client.exec(`INSERT INTO "users" (id, email, is_admin)
    VALUES ('admin-1', 'admin@example.com', true), ('member-1', 'member@example.com', false)`);
});

afterAll(async () => {
  await client?.close();
});

beforeEach(async () => {
  await client.exec('DELETE FROM "recipes"; DELETE FROM "usage_counters";');
  state.adminError = undefined;
  state.adminLookups = [];
  state.calls = [];
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  // Skip the 1 s pause between batch URLs.
  const realSetTimeout = globalThis.setTimeout;
  vi.spyOn(globalThis, 'setTimeout').mockImplementation(((fn: () => void, ms?: number) =>
    realSetTimeout(fn, ms === 1000 ? 0 : ms)) as typeof setTimeout);
});

describe('POST /api/ingest-recipe is admin-only (#233)', () => {
  it('refuses a non-admin session with 403 before any work', async () => {
    state.auth = { authenticated: true, userId: 'member-1' };
    await expectRefused(await post(oneUrl()));
    expect(state.adminLookups).toEqual(['member-1']);
  });

  it('refuses a non-admin session batch with 403 before any work', async () => {
    state.auth = { authenticated: true, userId: 'member-1' };
    await expectRefused(await post({ urls: [oneUrl().url, oneUrl().url] }));
  });

  it("refuses an API key whose owner's users row is not admin", async () => {
    state.auth = { authenticated: true, userId: 'member-1', apiKeyId: 'key-m' };
    await expectRefused(await post(oneUrl()));
    expect(state.adminLookups).toEqual(['member-1']);
  });

  it('refuses a caller with no users row', async () => {
    state.auth = { authenticated: true, userId: 'ghost-1', apiKeyId: 'key-g' };
    await expectRefused(await post(oneUrl()));
  });

  it('refuses with 403 when the admin lookup fails', async () => {
    state.auth = { authenticated: true, userId: 'admin-1' };
    state.adminError = new Error('db down');
    await expectRefused(await post(oneUrl()));
    expect(state.adminLookups).toEqual(['admin-1']);
  });

  it('lets an admin session ingest a public system recipe, as before', async () => {
    state.auth = { authenticated: true, userId: 'admin-1' };
    const res = await post(oneUrl());
    expect(res.status).toBe(201);
    const { recipe } = (await res.json()) as { recipe: { id: string } };
    const rows = await client.query('SELECT user_id, is_system_recipe, is_public FROM "recipes"');
    expect(rows.rows).toEqual([{ user_id: 'admin-1', is_system_recipe: true, is_public: true }]);
    expect(recipe.id).toBeTruthy();
    expect(state.calls.filter((c) => c.startsWith('scrape:'))).toHaveLength(1);
    expect(await written()).toEqual({ recipes: 1, usage: 1 });
  });

  it("lets an admin-owned API key ingest a batch, counted on the key's bucket", async () => {
    state.auth = { authenticated: true, userId: 'admin-1', apiKeyId: 'key-a' };
    const res = await post({ urls: [oneUrl().url, oneUrl().url], is_system_recipe: false });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { stats: { success: number } }).stats.success).toBe(2);
    const flags = await client.query<{ is_system_recipe: boolean }>(
      'SELECT is_system_recipe FROM "recipes"'
    );
    expect(flags.rows.map((r) => r.is_system_recipe)).toEqual([true, true]);
    const keys = await client.query<{ key: string }>('SELECT key FROM "usage_counters"');
    expect(keys.rows).toEqual([{ key: 'apikey:key-a' }]);
    expect(state.adminLookups).toEqual(['admin-1']);
  });
});

describe('GET /api/ingest-recipe', () => {
  it('describes the route as admin-only', async () => {
    const body = (await (await GET()).json()) as { authentication: { adminOnly: boolean } };
    expect(body.authentication.adminOnly).toBe(true);
  });
});
