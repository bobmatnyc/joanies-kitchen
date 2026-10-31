// @vitest-environment node
/**
 * #233: only an admin may create a system recipe through POST /api/ingest-recipe.
 * Admin status is `users.is_admin`, read from a real PGlite `users` table for
 * both session and API-key callers. Scrape, LLM parse and embeddings are stubbed.
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
  scrapeRecipePage: async (url: string) => ({ success: true, markdown: `# page ${url}` }),
}));
vi.mock('@/lib/ai/recipe-ingestion-parser', () => ({
  parseRecipeForIngestion: async (_markdown: string, url: string) => ({
    name: `Recipe ${url.split('/').pop()}`,
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
import { POST } from '../route';

const call = POST as unknown as (r: NextRequest, c: unknown) => Promise<Response>;

let client: PGlite;
let seq = 0;

/** Ingests one fresh URL as the current caller; returns the stored row's flags. */
async function ingestOne() {
  seq += 1;
  const res = await call(
    new NextRequest('http://localhost/api/ingest-recipe', {
      method: 'POST',
      body: JSON.stringify({ url: `https://example.com/r${seq}` }),
    }),
    { params: Promise.resolve({}) }
  );
  expect(res.status).toBe(201);
  const { recipe } = (await res.json()) as { recipe: { id: string } };
  const rows = await client.query<{
    user_id: string;
    is_system_recipe: boolean;
    is_public: boolean;
  }>('SELECT user_id, is_system_recipe, is_public FROM "recipes" WHERE id = $1', [recipe.id]);
  return rows.rows[0];
}

/** Posts a raw JSON body as the current caller. */
const post = (body: unknown) =>
  call(
    new NextRequest('http://localhost/api/ingest-recipe', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({}) }
  );

/** `is_system_recipe` of every stored recipe. */
const systemFlags = async () =>
  (
    await client.query<{ is_system_recipe: boolean }>(
      'SELECT is_system_recipe FROM "recipes" ORDER BY created_at, id'
    )
  ).rows.map((r) => r.is_system_recipe);

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
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  // Skip the 1 s pause between batch URLs.
  const realSetTimeout = globalThis.setTimeout;
  vi.spyOn(globalThis, 'setTimeout').mockImplementation(((fn: () => void, ms?: number) =>
    realSetTimeout(fn, ms === 1000 ? 0 : ms)) as typeof setTimeout);
});

describe('POST /api/ingest-recipe system flag (#233)', () => {
  it('stores a non-admin session ingest as a non-system recipe', async () => {
    state.auth = { authenticated: true, userId: 'member-1' };
    expect(await ingestOne()).toEqual({
      user_id: 'member-1',
      is_system_recipe: false,
      is_public: true,
    });
  });

  it('stores an admin session ingest as a system recipe, as before', async () => {
    state.auth = { authenticated: true, userId: 'admin-1' };
    expect(await ingestOne()).toMatchObject({ is_system_recipe: true, is_public: true });
  });

  it("takes an API-key caller's admin status from the key owner's users row", async () => {
    state.auth = { authenticated: true, userId: 'member-1', apiKeyId: 'key-m' };
    expect((await ingestOne()).is_system_recipe).toBe(false);
    state.auth = { authenticated: true, userId: 'admin-1', apiKeyId: 'key-a' };
    expect((await ingestOne()).is_system_recipe).toBe(true);
    expect(state.adminLookups).toEqual(['member-1', 'admin-1']);
  });

  it('ignores a client-supplied is_system_recipe on a single-URL request', async () => {
    state.auth = { authenticated: true, userId: 'member-1' };
    const res = await post({ url: 'https://example.com/client-single', is_system_recipe: true });
    expect(res.status).toBe(201);
    expect(await systemFlags()).toEqual([false]);
  });

  it('ignores a client-supplied is_system_recipe on a batch request', async () => {
    state.auth = { authenticated: true, userId: 'member-1' };
    const urls = ['https://example.com/client-b1', 'https://example.com/client-b2'];
    const res = await post({ urls, is_system_recipe: true });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { stats: { success: number } };
    expect(body.stats.success).toBe(2);
    expect(await systemFlags()).toEqual([false, false]);
  });

  it('stores a non-system recipe when the admin lookup fails', async () => {
    state.auth = { authenticated: true, userId: 'admin-1' };
    state.adminError = new Error('db down');
    expect((await ingestOne()).is_system_recipe).toBe(false);
    expect(state.adminLookups).toEqual(['admin-1']);
  });
});
