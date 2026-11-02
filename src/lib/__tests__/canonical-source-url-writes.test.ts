// @vitest-environment node
/**
 * #142: every recipe write that sets `source` stores
 * `canonical_source_url = canonicalizeSourceUrl(source)`, and a write that
 * changes `source` moves the column with it. A source that is not an absolute
 * http(s) URL stores null.
 *
 * Real `recipes` and `users` tables (PGlite). The session is stubbed; scrapers,
 * LLMs and embeddings are stubbed. `POST /api/ingest-recipe` is covered in
 * `src/app/api/ingest-recipe/__tests__/route-dedup.test.ts`, the #135 merge's
 * source override in `src/lib/recipes/__tests__/dedup-merge-rollback.test.ts`.
 */

import type { PGlite } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  db: undefined as unknown,
  sessionUserId: null as string | null,
  scrape: vi.fn(),
  crawl: vi.fn(),
  llmCreate: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({
  get db() {
    return state.db;
  },
}));
vi.mock('@/lib/session-user', () => ({
  getSessionUserId: async () => state.sessionUserId,
  getSessionUser: async () => (state.sessionUserId ? { id: state.sessionUserId } : null),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/cache', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/cache')>()),
  invalidateRecipeCaches: vi.fn(),
  invalidateRecipeById: vi.fn(),
}));
vi.mock('@/app/actions/chefs', () => ({
  linkRecipeToChef: vi.fn(async () => ({ success: true })),
}));
vi.mock('@/lib/chef-recipe-count', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/chef-recipe-count')>()),
  recountChefRecipes: vi.fn(),
}));
// cloneRecipe favorites the original; the favorites table is not under test.
vi.mock('@/app/actions/favorites', () => ({ addFavorite: vi.fn(async () => ({ success: true })) }));
vi.mock('@/lib/firecrawl', () => ({
  crawlChefRecipes: state.crawl,
  scrapeRecipePage: state.scrape,
}));
vi.mock('@/lib/ai/recipe-parser', () => ({
  parseRecipeWithAI: async () => ({
    name: 'Scraped Soup',
    description: 'd',
    ingredients: ['1 onion'],
    instructions: ['Cook'],
  }),
  parseRecipeFromImage: vi.fn(),
}));
vi.mock('@/lib/rate-limit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rate-limit')>()),
  enforceRateLimit: vi.fn(async () => ({ allowed: true, count: 1, limit: 30 })),
}));
vi.mock('@/lib/brave-search', () => ({ searchRecipes: vi.fn() }));
vi.mock('@/lib/ai/openrouter-server', () => ({
  getOpenRouterClient: () => ({ chat: { completions: { create: state.llmCreate } } }),
  MODELS: { CLAUDE_3_HAIKU: 'anthropic/claude-3-haiku' },
}));
vi.mock('@/lib/ai/embeddings', () => ({
  generateRecipeEmbedding: async () => {
    throw new Error('no embeddings in test');
  },
}));
vi.mock('@/lib/db/embeddings', () => ({ saveRecipeEmbedding: vi.fn() }));
vi.mock('@/lib/ai/recipe-quality-evaluator', () => ({
  evaluateRecipeQuality: async () => ({ rating: 4, reasoning: 'ok' }),
}));

import { createVisibilityDb } from '@/app/actions/__tests__/recipe-visibility-db';
import { uploadRecipeFromUrl, uploadRecipeWithAI } from '@/app/actions/ai-upload';
import { scrapeSingleRecipe, startChefScraping } from '@/app/actions/chef-scraping';
import { cloneRecipe } from '@/app/actions/recipe-cloning';
import { discoverRecipeFromUrl } from '@/app/actions/recipe-discovery';
import { saveIngestedRecipe } from '@/app/actions/recipe-ingestion';
import { copyRecipeToCollection, createRecipe, updateRecipe } from '@/app/actions/recipes';
import { users } from '@/lib/db/auth-schema';
import { scrapingJobs } from '@/lib/db/chef-schema';
import { recipes } from '@/lib/db/schema';
import { storeCrawledRecipe } from '@/lib/recipe-crawl-store';
import { canonicalizeSourceUrl } from '@/lib/recipes/dedup';
import { storeIngestedRecipe } from '@/lib/services/autonomous-ingestion-store';

const ADMIN = 'admin-1';
const USER = 'user-1';
const CHEF = '00000000-0000-4000-8000-000000000001';
/** A URL variant: canonicalises to `https://a.com/stew`. */
const VARIANT = 'http://www.A.com/stew/print/?utm_source=x#comments';
/** Not an absolute URL: canonicalises to null. */
const NOT_A_URL = 'food.com/recipe/123';

let client: PGlite;
const stored = async (id: string) =>
  (
    await client.query<{ source: string | null; canonical_source_url: string | null }>(
      'SELECT source, canonical_source_url FROM "recipes" WHERE id = $1',
      [id]
    )
  ).rows[0];
/** The new recipe's id from an action result; undefined on a refusal. */
const idOf = (res: object) => {
  const r = res as {
    recipe?: { id: string };
    data?: { id: string };
    clonedRecipe?: { id: string };
  };
  return (r.recipe ?? r.data ?? r.clonedRecipe)?.id as string;
};
/** The row as the fix must leave it: the column equals canonicalizeSourceUrl(source). */
const expected = (source: string) => ({
  source,
  canonical_source_url: canonicalizeSourceUrl(source),
});

beforeAll(async () => {
  const built = await createVisibilityDb(
    [users, recipes, scrapingJobs],
    { users, recipes, scrapingJobs },
    { constraints: true }
  );
  client = built.client;
  state.db = built.db;
  // Guard: the expectations below are not vacuous.
  expect(canonicalizeSourceUrl(VARIANT)).toBe('https://a.com/stew');
  expect(canonicalizeSourceUrl(NOT_A_URL)).toBeNull();
});

afterAll(async () => {
  await client?.close();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

beforeEach(async () => {
  vi.clearAllMocks();
  await client.exec('DELETE FROM "recipes"; DELETE FROM "scraping_jobs"; DELETE FROM "users";');
  await client.exec(`INSERT INTO "users" (id, email, is_admin)
    VALUES ('${ADMIN}', 'admin@example.com', true), ('${USER}', 'user@example.com', false)`);
  state.sessionUserId = null;
  state.scrape.mockResolvedValue({ markdown: '# Scraped Soup' });
  state.llmCreate.mockResolvedValue({
    choices: [
      {
        message: {
          content: JSON.stringify({
            name: 'Chicken soup',
            description: 'Soup',
            ingredients: ['1 chicken'],
            instructions: ['Simmer'],
            confidenceScore: 0.9,
            isValid: true,
          }),
        },
      },
    ],
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () => new Response(`<html><body>${'Chicken soup recipe. '.repeat(20)}</body></html>`)
    )
  );
  for (const level of ['log', 'warn', 'error'] as const) {
    vi.spyOn(console, level).mockImplementation(() => undefined);
  }
});

describe('ingest paths write canonical_source_url (#142)', () => {
  const input = {
    name: 'Ingested Stew',
    description: null,
    ingredients: ['1 beef'],
    instructions: ['Simmer'],
    prep_time: null,
    cook_time: null,
    servings: null,
    difficulty: null,
    cuisine: null,
    tags: [],
  };

  it('saveIngestedRecipe: a URL stores its canonical form; a non-URL source stores null', async () => {
    state.sessionUserId = ADMIN;
    const url = await saveIngestedRecipe({ ...input, source: VARIANT });
    expect(await stored(url.data?.id as string)).toEqual(expected(VARIANT));
    const text = await saveIngestedRecipe({ ...input, name: 'Other Stew', source: NOT_A_URL });
    expect(await stored(text.data?.id as string)).toEqual({
      source: NOT_A_URL,
      canonical_source_url: null,
    });
  });

  it('storeIngestedRecipe (autonomous cron)', async () => {
    const recipe = {
      title: 'Cron Stew',
      description: 'A stew',
      ingredients: ['beef'],
      instructions: ['Simmer'],
      tags: [],
    } as unknown as Parameters<typeof storeIngestedRecipe>[0];
    const id = await storeIngestedRecipe(recipe, null, VARIANT, 'stew');
    expect(await stored(id as string)).toEqual(expected(VARIANT));
  });
});

describe('crawl and scrape paths write canonical_source_url (#142)', () => {
  it('storeCrawledRecipe', async () => {
    const res = await storeCrawledRecipe(
      {
        name: 'Crawled Stew',
        description: 'A stew',
        ingredients: ['beef'],
        instructions: ['Simmer'],
        confidenceScore: 0.9,
        isValid: true,
      },
      { sourceUrl: VARIANT }
    );
    expect(await stored(res.recipeId as string)).toEqual(expected(VARIANT));
  });

  it('scrapeSingleRecipe (chef scraping)', async () => {
    state.sessionUserId = ADMIN;
    const res = await scrapeSingleRecipe({ chefId: CHEF, url: VARIANT });
    expect(await stored(idOf(res))).toEqual(expected(VARIANT));
  });

  it('discoverRecipeFromUrl (user URL import)', async () => {
    state.sessionUserId = USER;
    const res = await discoverRecipeFromUrl(VARIANT);
    expect(await stored(idOf(res))).toEqual(expected(VARIANT));
  });

  it('uploadRecipeFromUrl (AI upload from a URL)', async () => {
    state.sessionUserId = USER;
    const res = await uploadRecipeFromUrl(VARIANT);
    expect(await stored(idOf(res))).toEqual(expected(VARIANT));
  });

  it('uploadRecipeWithAI stores null: its source is the label "AI Upload"', async () => {
    state.sessionUserId = USER;
    const res = await uploadRecipeWithAI({ text: 'Soup: 1 onion. Cook it.' });
    expect(await stored(idOf(res))).toEqual({ source: 'AI Upload', canonical_source_url: null });
  });

  it('startChefScraping (multi-page chef crawl)', { timeout: 10_000 }, async () => {
    state.sessionUserId = ADMIN;
    state.crawl.mockResolvedValue({ data: [{ url: VARIANT, markdown: '# soup' }] });
    expect(await startChefScraping({ chefId: CHEF, sourceUrl: 'https://chef.com' })).toMatchObject({
      success: true,
    });
    // The crawl runs in the background; wait for the job to finish.
    await vi.waitFor(
      async () => {
        const job = await client.query<{ status: string }>('SELECT status FROM "scraping_jobs"');
        expect(job.rows[0]?.status).toBe('completed');
      },
      { timeout: 5_000, interval: 50 }
    );
    const { rows } = await client.query<{ source: string; canonical_source_url: string | null }>(
      'SELECT source, canonical_source_url FROM "recipes"'
    );
    expect(rows).toEqual([expected(VARIANT)]);
  });
});

describe('user recipe writes keep canonical_source_url in step with source (#142)', () => {
  const content = { name: 'My Stew', ingredients: '[]', instructions: '[]' };

  it('createRecipe stores the canonical form; a forged canonical_source_url is ignored', async () => {
    state.sessionUserId = USER;
    const res = await createRecipe({
      ...content,
      source: VARIANT,
      canonical_source_url: 'https://forged.example/x',
    } as Parameters<typeof createRecipe>[0]);
    expect(await stored(idOf(res))).toEqual(expected(VARIANT));
  });

  it('updateRecipe moves the column with source, to null for a non-URL, and leaves it when source is absent', async () => {
    await client.exec(`INSERT INTO "recipes" (id, user_id, name, ingredients, instructions, source, canonical_source_url)
      VALUES ('r-1', '${USER}', 'Toast', '[]', '[]', 'https://old.com/toast', 'https://old.com/toast')`);
    state.sessionUserId = USER;
    await updateRecipe('r-1', { source: VARIANT });
    expect(await stored('r-1')).toEqual(expected(VARIANT));
    await updateRecipe('r-1', { description: 'edited' });
    expect(await stored('r-1')).toEqual(expected(VARIANT));
    await updateRecipe('r-1', { source: NOT_A_URL });
    expect(await stored('r-1')).toEqual({ source: NOT_A_URL, canonical_source_url: null });
  });

  it('copyRecipeToCollection writes the copy from the original source', async () => {
    await client.exec(`INSERT INTO "recipes" (id, user_id, name, ingredients, instructions, source, is_public)
      VALUES ('pub-1', '${ADMIN}', 'Public Stew', '[]', '[]', '${VARIANT}', true)`);
    state.sessionUserId = USER;
    const res = await copyRecipeToCollection('pub-1');
    expect(await stored(idOf(res))).toEqual(expected(VARIANT));
  });

  it('cloneRecipe stores null: its source is the fork note, not the original URL', async () => {
    await client.exec(`INSERT INTO "recipes" (id, user_id, name, ingredients, instructions, source, canonical_source_url, is_public)
      VALUES ('pub-2', '${ADMIN}', 'Public Stew', '[]', '[]', '${VARIANT}', 'https://a.com/stew', true)`);
    state.sessionUserId = USER;
    const res = await cloneRecipe('pub-2');
    expect(await stored(idOf(res))).toEqual({
      source: 'Forked from recipe ID: pub-2',
      canonical_source_url: null,
    });
  });
});
