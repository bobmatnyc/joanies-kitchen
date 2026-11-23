// @vitest-environment node
/**
 * #142: the admin import action (`ingestRecipeFromUrl`, behind /admin/ingest-recipe)
 * returns the stored recipe for a URL a live recipe already holds by
 * `canonical_source_url`, with no scrape and no LLM parse. Real `recipes` and
 * `users` tables (PGlite) and the real admin check; only the session, Firecrawl
 * and the LLM parser are stubbed, and the last two record their calls.
 */

import type { PGlite } from '@electric-sql/pglite';
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
vi.mock('@/lib/session-user', () => ({
  getSessionUserId: async () => 'admin-1',
  getSessionUser: async () => ({ id: 'admin-1' }),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/firecrawl', () => ({
  scrapeRecipePage: async (url: string) => {
    state.scraped.push(url);
    return { success: true, markdown: `# page ${url}`, metadata: {} };
  },
}));
vi.mock('@/lib/ai/recipe-ingestion-parser', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/ai/recipe-ingestion-parser')>()),
  parseRecipeForIngestion: async (_markdown: string, url: string) => {
    state.parsed.push(url);
    return {
      name: 'Lamb Stew',
      description: '',
      ingredients: [{ quantity: '1', unit: '', name: 'lamb' }],
      instructions: ['Cook it'],
      tags: [],
    };
  },
}));

import { createVisibilityDb } from '@/app/actions/__tests__/recipe-visibility-db';
import { ingestRecipeFromUrl } from '@/app/actions/recipe-ingestion';
import { users } from '@/lib/db/auth-schema';
import { recipes } from '@/lib/db/schema';

let client: PGlite;

beforeAll(async () => {
  const built = await createVisibilityDb(
    [users, recipes],
    { users, recipes },
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
  await client.exec('DELETE FROM "recipes";');
  // `source` differs from the request URL, so only the canonical_source_url lookup matches.
  await client.exec(`INSERT INTO "recipes" (id, user_id, name, ingredients, instructions, source, canonical_source_url, slug, is_public)
    VALUES ('known-1', 'someone', 'Beef Stew', '[]', '[]', 'https://legacy.example/old', 'https://a.com/beef-stew', 'beef-stew', true)`);
  state.scraped = [];
  state.parsed = [];
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('ingestRecipeFromUrl known URL (#142)', () => {
  it('returns the stored recipe for a known URL with no fetch or LLM call', async () => {
    const res = await ingestRecipeFromUrl('http://www.a.com/beef-stew/?utm_source=x');
    expect(res).toEqual({
      success: true,
      existing: { id: 'known-1', name: 'Beef Stew', slug: 'beef-stew', url: '/recipes/beef-stew' },
    });
    expect(state.scraped).toEqual([]);
    expect(state.parsed).toEqual([]);
  });

  it('refuses a hidden known recipe without naming it, before any fetch', async () => {
    await client.exec(`UPDATE "recipes" SET moderation_status = 'rejected' WHERE id = 'known-1'`);
    const res = await ingestRecipeFromUrl('https://a.com/beef-stew');
    expect(res).toEqual({ success: false, error: 'Recipe already exists' });
    expect(state.scraped).toEqual([]);
  });

  it('#142: returns a visible known recipe with no slug by its id link', async () => {
    await client.exec(`UPDATE "recipes" SET slug = NULL WHERE id = 'known-1'`);
    const res = await ingestRecipeFromUrl('https://a.com/beef-stew');
    expect(res).toEqual({
      success: true,
      existing: { id: 'known-1', name: 'Beef Stew', slug: null, url: '/recipes/known-1' },
    });
    expect(state.scraped).toEqual([]);
    expect(state.parsed).toEqual([]);
  });

  it('#142: refuses a hidden known recipe with no slug without naming it', async () => {
    await client.exec(
      `UPDATE "recipes" SET slug = NULL, moderation_status = 'rejected' WHERE id = 'known-1'`
    );
    const res = await ingestRecipeFromUrl('https://a.com/beef-stew');
    expect(res).toEqual({ success: false, error: 'Recipe already exists' });
    expect(state.scraped).toEqual([]);
  });

  it('ignores a soft-deleted match and returns the live recipe holding the URL', async () => {
    await client.exec(`UPDATE "recipes" SET deleted_at = now() WHERE id = 'known-1'`);
    await client.exec(`INSERT INTO "recipes" (id, user_id, name, ingredients, instructions, source, canonical_source_url, slug, is_public)
      VALUES ('known-2', 'someone', 'Beef Stew', '[]', '[]', 'https://legacy.example/new', 'https://a.com/beef-stew', 'beef-stew-2', true)`);
    const res = await ingestRecipeFromUrl('https://a.com/beef-stew');
    expect(res.existing).toMatchObject({ id: 'known-2', slug: 'beef-stew-2' });
    expect(state.scraped).toEqual([]);
  });

  it('still fetches and parses an unknown URL, and only that one', async () => {
    await ingestRecipeFromUrl('https://a.com/beef-stew');
    const res = await ingestRecipeFromUrl('https://a.com/lamb-stew');
    expect(res.success).toBe(true);
    expect(res.existing).toBeUndefined();
    expect(res.data?.recipe.name).toBe('Lamb Stew');
    expect(state.scraped).toEqual(['https://a.com/lamb-stew']);
    expect(state.parsed).toEqual(['https://a.com/lamb-stew']);
  });
});
