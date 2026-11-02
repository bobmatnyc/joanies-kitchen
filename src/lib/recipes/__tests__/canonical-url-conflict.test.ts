// @vitest-environment node
/**
 * #142 (owner ruling D09): the partial unique index on
 * `recipes.canonical_source_url` (migration 0008) and every write path's
 * handling of its violation.
 *
 * Real tables (PGlite) with the real 0008 SQL applied. The conflicting recipe
 * is another user's PRIVATE recipe: the #135 pre-check cannot see it, so the
 * insert itself hits the index. That is the case the handling exists for.
 * Session, scrapers, LLMs and embeddings are stubbed. The cron path is in
 * `src/lib/services/__tests__/autonomous-ingestion-dedup.test.ts`.
 */

import type { PGlite } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  db: undefined as unknown,
  sessionUserId: null as string | null,
  scrape: vi.fn(),
  crawl: vi.fn(),
  llmCreate: vi.fn(),
  search: vi.fn(),
  /** True: the #135 pre-check finds nothing, as when a concurrent insert races it. */
  skipPrecheck: false,
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
vi.mock('@/lib/brave-search', () => ({ searchRecipes: state.search }));
vi.mock('@/lib/recipes/dedup', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/recipes/dedup')>();
  return {
    ...actual,
    findDuplicateRecipe: async (...args: Parameters<typeof actual.findDuplicateRecipe>) =>
      state.skipPrecheck ? null : actual.findDuplicateRecipe(...args),
  };
});
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
import { restoreRecipe } from '@/app/actions/admin-content';
import { uploadRecipeFromUrl } from '@/app/actions/ai-upload';
import { scrapeSingleRecipe, startChefScraping } from '@/app/actions/chef-scraping';
import { linkRecipeToChef } from '@/app/actions/chefs';
import { discoverRecipeFromUrl, discoverRecipes } from '@/app/actions/recipe-discovery';
import { copyRecipeToCollection, createRecipe, updateRecipe } from '@/app/actions/recipes';
import { markAccountDeleted, restoreAccount } from '@/lib/account-deletion';
import { users } from '@/lib/db/auth-schema';
import { chefRecipes, chefs, scrapingJobs } from '@/lib/db/chef-schema';
import { recipes } from '@/lib/db/schema';
import { userProfiles } from '@/lib/db/user-discovery-schema';
import { storeCrawledRecipe } from '@/lib/recipe-crawl-store';
import {
  CANONICAL_SOURCE_URL_UNIQUE_INDEX,
  isCanonicalSourceUrlConflict,
  withCanonicalConflict,
} from '@/lib/recipes/canonical-url-conflict';
import { DUPLICATE_EXISTS_MESSAGE } from '@/lib/recipes/dedup';
import { applyMigration0008, migration0008Statements } from './migration-0008';

const ADMIN = 'admin-1';
const USER = 'user-1';
const OTHER = 'other-1';
const CHEF = '00000000-0000-4000-8000-000000000001';
const HELD = 'https://a.com/stew';
/** Canonicalises to HELD, and is not an exact `source` match for the batch pre-checks. */
const HELD_VARIANT = 'https://www.a.com/stew/?utm_source=x';

let client: PGlite;

const count = async (where = 'true') =>
  Number(
    (await client.query<{ n: number }>(`SELECT count(*)::int AS n FROM "recipes" WHERE ${where}`))
      .rows[0]?.n
  );

/** Another user's private live recipe holding HELD: invisible to every #135 pre-check. */
async function seedHiddenHolder(id = 'held-1') {
  await client.exec(`INSERT INTO "recipes" (id, user_id, name, ingredients, instructions, source,
      canonical_source_url, is_public)
    VALUES ('${id}', '${OTHER}', 'Private Stew', '[]', '[]', '${HELD}', '${HELD}', false)`);
}

beforeAll(async () => {
  const tables = { users, recipes, scrapingJobs, chefs, chefRecipes, userProfiles };
  const built = await createVisibilityDb(Object.values(tables), tables, { constraints: true });
  client = built.client;
  state.db = built.db;
  await applyMigration0008(client);
});

afterAll(async () => {
  await client?.close();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

beforeEach(async () => {
  vi.clearAllMocks();
  await client.exec(
    'DELETE FROM "chef_recipes"; DELETE FROM "recipes"; DELETE FROM "scraping_jobs"; DELETE FROM "chefs"; DELETE FROM "users";'
  );
  await client.exec(`INSERT INTO "users" (id, email, is_admin) VALUES
    ('${ADMIN}', 'admin@example.com', true), ('${USER}', 'user@example.com', false),
    ('${OTHER}', 'other@example.com', false)`);
  await client.exec(`INSERT INTO "chefs" (id, name, slug) VALUES ('${CHEF}', 'Chef', 'chef')`);
  state.sessionUserId = null;
  state.skipPrecheck = false;
  state.scrape.mockResolvedValue({ markdown: '# Scraped Soup' });
  const extracted = {
    name: 'Chicken soup',
    description: 'Soup',
    ingredients: ['1 chicken'],
    instructions: ['Simmer'],
    confidenceScore: 0.9,
    isValid: true,
  };
  state.llmCreate.mockResolvedValue({
    choices: [{ message: { content: JSON.stringify(extracted) } }],
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

describe('migration 0008 (#142 D09)', () => {
  /** A fresh recipes table with `rows`, then 0008; answers the error, or null when it applied. */
  async function migrate(rows: string): Promise<Error | null> {
    const { client: c } = await createVisibilityDb([recipes], { recipes }, { constraints: true });
    try {
      if (rows)
        await c.exec(`INSERT INTO "recipes" (id, user_id, name, ingredients, instructions,
        canonical_source_url, deleted_at) VALUES ${rows}`);
      await applyMigration0008(c);
      return null;
    } catch (error) {
      return error as Error;
    } finally {
      await c.close();
    }
  }

  it('refuses to run while live duplicates exist, naming the count and the URL', async () => {
    const error = await migrate(
      `('a', 'u', 'A', '[]', '[]', '${HELD}', NULL), ('b', 'u', 'B', '[]', '[]', '${HELD}', NULL)`
    );
    expect(error?.message).toContain('0008: 1 duplicate group(s)');
    expect(error?.message).toContain(HELD);
  });

  it('counts rows pending account deletion with the live ones', async () => {
    const { client: c } = await createVisibilityDb([recipes], { recipes }, { constraints: true });
    try {
      await c.exec(`INSERT INTO "recipes" (id, user_id, name, ingredients, instructions,
          canonical_source_url, deleted_at, deleted_by) VALUES
        ('a', 'u', 'A', '[]', '[]', '${HELD}', NULL, NULL),
        ('b', 'v', 'B', '[]', '[]', '${HELD}', now(), 'account-deletion:v')`);
      await expect(applyMigration0008(c)).rejects.toThrow('0008: 1 duplicate group(s)');
      // Nothing changed: the check runs before any DDL.
      const idx = await c.query(`SELECT 1 FROM pg_indexes WHERE indexname = $1`, [
        CANONICAL_SOURCE_URL_UNIQUE_INDEX,
      ]);
      expect(idx.rows).toEqual([]);
    } finally {
      await c.close();
    }
  });

  it('applies when the duplicates are soft-deleted, and with many NULL URLs', async () => {
    const error = await migrate(
      `('a', 'u', 'A', '[]', '[]', '${HELD}', NULL), ('b', 'u', 'B', '[]', '[]', '${HELD}', now()),
       ('c', 'u', 'C', '[]', '[]', NULL, NULL), ('d', 'u', 'D', '[]', '[]', NULL, NULL)`
    );
    expect(error).toBeNull();
  });

  it('enforces one live row per URL; deleted rows and NULLs are exempt; the 0007 index is gone', async () => {
    await seedHiddenHolder();
    await client.exec(`INSERT INTO "recipes" (id, user_id, name, ingredients, instructions,
        canonical_source_url, deleted_at) VALUES
      ('gone', 'u', 'Gone', '[]', '[]', '${HELD}', now()),
      ('n1', 'u', 'N1', '[]', '[]', NULL, NULL), ('n2', 'u', 'N2', '[]', '[]', NULL, NULL)`);
    const second = client.exec(`INSERT INTO "recipes" (id, user_id, name, ingredients, instructions,
        canonical_source_url) VALUES ('dup', 'u', 'Dup', '[]', '[]', '${HELD}')`);
    await expect(second).rejects.toMatchObject({
      code: '23505',
      constraint: CANONICAL_SOURCE_URL_UNIQUE_INDEX,
    });
    const indexes = await client.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'recipes' AND indexname LIKE '%canonical%'`
    );
    expect(indexes.rows.map((r) => r.indexname)).toEqual([CANONICAL_SOURCE_URL_UNIQUE_INDEX]);
    expect(migration0008Statements()).toHaveLength(3); // precheck, create, drop
  });
});

describe('withCanonicalConflict', () => {
  it('rethrows any error other than this index violation', async () => {
    const other = Object.assign(new Error('x'), {
      code: '23505',
      constraint: 'recipes_slug_unique',
    });
    await expect(withCanonicalConflict(HELD, async () => Promise.reject(other))).rejects.toBe(
      other
    );
    expect(
      isCanonicalSourceUrlConflict({
        cause: { code: '23505', constraint: CANONICAL_SOURCE_URL_UNIQUE_INDEX },
      })
    ).toBe(true);
  });

  it('rethrows the violation when the holder lookup itself rejects', async () => {
    await seedHiddenHolder();
    const violation = { code: '23505', constraint: CANONICAL_SOURCE_URL_UNIQUE_INDEX };
    const failingDb = {
      select: () => {
        throw new Error('lookup down');
      },
    } as unknown as Parameters<typeof withCanonicalConflict>[2];
    await expect(
      withCanonicalConflict(HELD, async () => Promise.reject(violation), failingDb)
    ).rejects.toBe(violation);
  });

  it('rethrows the violation when no live recipe holds the URL any more', async () => {
    const violation = { code: '23505', constraint: CANONICAL_SOURCE_URL_UNIQUE_INDEX };
    await expect(withCanonicalConflict(HELD, async () => Promise.reject(violation))).rejects.toBe(
      violation
    );
  });
});

describe('background paths skip the conflicting URL and keep going (#142 D09)', () => {
  it('storeCrawledRecipe answers a skipped duplicate naming the holder, and inserts nothing', async () => {
    await seedHiddenHolder();
    const res = await storeCrawledRecipe(
      {
        name: 'Crawled Stew',
        description: 'A stew',
        ingredients: ['beef'],
        instructions: ['Simmer'],
        confidenceScore: 0.9,
        isValid: true,
      },
      { sourceUrl: HELD_VARIANT }
    );
    expect(res).toMatchObject({
      success: false,
      error: 'skipped: duplicate of held-1',
      duplicate: { id: 'held-1', reason: 'source-url' },
    });
    expect(await count()).toBe(1);
  });

  it(
    'startChefScraping skips the held page, stores the next, and URL-less pages do not collide',
    {
      timeout: 10_000,
    },
    async () => {
      await seedHiddenHolder();
      state.sessionUserId = ADMIN;
      state.crawl.mockResolvedValue({
        data: [
          { url: HELD_VARIANT, markdown: '# held' },
          { url: 'https://a.com/soup', markdown: '# soup' },
          { markdown: '# no url 1' },
          { markdown: '# no url 2' },
        ],
      });
      await startChefScraping({ chefId: CHEF, sourceUrl: 'https://chef.com' });
      await vi.waitFor(
        async () => {
          const job = await client.query<{ status: string }>('SELECT status FROM "scraping_jobs"');
          expect(job.rows[0]?.status).toBe('completed');
        },
        { timeout: 8_000, interval: 50 }
      );
      const job = await client.query<{
        recipes_scraped: number;
        recipes_failed: number;
        metadata: unknown;
      }>('SELECT recipes_scraped, recipes_failed, metadata FROM "scraping_jobs"');
      expect(job.rows[0]).toMatchObject({
        recipes_scraped: 3,
        recipes_failed: 0,
        metadata: { recipes_skipped: 1 },
      });
      expect(await count(`canonical_source_url = '${HELD}'`)).toBe(1);
      // #142: the private holder gets no chef link (chef_recipes row or chef_id).
      expect(vi.mocked(linkRecipeToChef).mock.calls.map(([a]) => a.recipeId)).not.toContain(
        'held-1'
      );
    }
  );

  it('scrapeSingleRecipe answers the skip instead of the raw Postgres error', async () => {
    await seedHiddenHolder();
    state.sessionUserId = ADMIN;
    const res = await scrapeSingleRecipe({ chefId: CHEF, url: HELD_VARIANT });
    // #142: a holder the system may not see is neither named nor linked.
    expect(res).toEqual({ success: false, error: DUPLICATE_EXISTS_MESSAGE });
    expect(linkRecipeToChef).not.toHaveBeenCalled();
    expect(await count()).toBe(1);
  });

  it('scrapeSingleRecipe links a conflict holder the system may see (pre-check raced)', async () => {
    await client.exec(`INSERT INTO "recipes" (id, user_id, name, ingredients, instructions, source,
        canonical_source_url, is_public, moderation_status)
      VALUES ('pub-held', '${OTHER}', 'Public Stew', '[]', '[]', '${HELD}', '${HELD}', true, 'approved')`);
    state.sessionUserId = ADMIN;
    state.skipPrecheck = true;
    const res = await scrapeSingleRecipe({ chefId: CHEF, url: HELD_VARIANT });
    expect(res).toMatchObject({ success: false, duplicateOf: 'pub-held', linkedToChef: true });
    expect(linkRecipeToChef).toHaveBeenCalledWith(
      expect.objectContaining({ chefId: CHEF, recipeId: 'pub-held' })
    );
  });
});

describe('user paths refuse the conflicting URL without naming a hidden recipe (#142 D09)', () => {
  const content = { name: 'My Stew', ingredients: '[]', instructions: '[]' };

  it('createRecipe refuses and inserts nothing', async () => {
    await seedHiddenHolder();
    state.sessionUserId = USER;
    const res = await createRecipe({ ...content, source: HELD_VARIANT } as Parameters<
      typeof createRecipe
    >[0]);
    expect(res).toEqual({ success: false, error: DUPLICATE_EXISTS_MESSAGE });
    expect(await count()).toBe(1);
  });

  it('updateRecipe refuses a source another live recipe holds and leaves the row as it was', async () => {
    await seedHiddenHolder();
    await client.exec(`INSERT INTO "recipes" (id, user_id, name, ingredients, instructions, source,
        canonical_source_url) VALUES ('mine', '${USER}', 'Toast', '[]', '[]', 'https://b.com/t', 'https://b.com/t')`);
    state.sessionUserId = USER;
    const res = await updateRecipe('mine', { source: HELD_VARIANT });
    expect(res).toEqual({ success: false, error: DUPLICATE_EXISTS_MESSAGE });
    const row = await client.query<{ source: string }>(
      `SELECT source FROM "recipes" WHERE id = 'mine'`
    );
    expect(row.rows[0]?.source).toBe('https://b.com/t');
  });

  it('uploadRecipeFromUrl refuses instead of failing with the Postgres error', async () => {
    await seedHiddenHolder();
    state.sessionUserId = USER;
    const res = await uploadRecipeFromUrl(HELD_VARIANT);
    expect(res).toEqual({ success: false, error: DUPLICATE_EXISTS_MESSAGE });
  });

  it('discoverRecipeFromUrl refuses instead of failing with the Postgres error', async () => {
    await seedHiddenHolder();
    state.sessionUserId = USER;
    const res = await discoverRecipeFromUrl(HELD_VARIANT);
    expect(res).toEqual({ success: false, error: DUPLICATE_EXISTS_MESSAGE });
    expect(await count()).toBe(1);
  });

  it('updateRecipe on a copy that re-sends its unchanged source succeeds and keeps the key NULL', async () => {
    await client.exec(`INSERT INTO "recipes" (id, user_id, name, ingredients, instructions, source,
        canonical_source_url, is_public, moderation_status) VALUES
      ('orig', '${ADMIN}', 'Public Stew', '[]', '[]', '${HELD}', '${HELD}', true, 'approved'),
      ('copy', '${USER}', 'Public Stew (Copy)', '[]', '[]', '${HELD}', NULL, false, 'pending')`);
    state.sessionUserId = USER;
    const res = await updateRecipe('copy', { source: HELD, description: 'edited' });
    expect(res.success).toBe(true);
    const row = await client.query<{ description: string; canonical_source_url: string | null }>(
      `SELECT description, canonical_source_url FROM "recipes" WHERE id = 'copy'`
    );
    expect(row.rows[0]).toEqual({ description: 'edited', canonical_source_url: null });
  });

  it('copyRecipeToCollection succeeds: the copy keeps source and stores no canonical URL', async () => {
    await client.exec(`INSERT INTO "recipes" (id, user_id, name, ingredients, instructions, source,
        canonical_source_url, is_public, moderation_status)
      VALUES ('pub-1', '${ADMIN}', 'Public Stew', '[]', '[]', '${HELD}', '${HELD}', true, 'approved')`);
    state.sessionUserId = USER;
    const res = (await copyRecipeToCollection('pub-1')) as {
      success: boolean;
      data?: { id: string };
    };
    expect(res.success).toBe(true);
    const copy = await client.query<{ source: string; canonical_source_url: string | null }>(
      'SELECT source, canonical_source_url FROM "recipes" WHERE id = $1',
      [res.data?.id]
    );
    expect(copy.rows[0]).toEqual({ source: HELD, canonical_source_url: null });
  });
});

describe('restoring soft-deleted recipes (#142 D09)', () => {
  it('restoreAccount releases a URL another live recipe took meanwhile, and keeps the rest', async () => {
    await client.exec(`INSERT INTO "recipes" (id, user_id, name, ingredients, instructions, source,
        canonical_source_url) VALUES
      ('u-held', '${USER}', 'Stew', '[]', '[]', '${HELD}', '${HELD}'),
      ('u-free', '${USER}', 'Soup', '[]', '[]', 'https://a.com/soup', 'https://a.com/soup')`);
    const requestedAt = new Date('2026-11-01T00:00:00Z');
    await markAccountDeleted(USER, false, requestedAt);
    await seedHiddenHolder(); // takes HELD while USER's recipes are soft-deleted
    await restoreAccount(USER, requestedAt);
    const rows = await client.query<{
      id: string;
      deleted_at: Date | null;
      canonical_source_url: string | null;
    }>(
      `SELECT id, deleted_at, canonical_source_url FROM "recipes" WHERE user_id = '${USER}' ORDER BY id`
    );
    expect(rows.rows).toEqual([
      { id: 'u-free', deleted_at: null, canonical_source_url: 'https://a.com/soup' },
      { id: 'u-held', deleted_at: null, canonical_source_url: null },
    ]);
  });
});

describe('restoring rows that share a URL (#142 D09)', () => {
  const marker = `account-deletion:${USER}`;
  /** USER's recipes pending deletion; the index allows deleted rows to share a URL. */
  async function seedPending(ids: string[], url = HELD) {
    for (const id of ids) {
      await client.exec(`INSERT INTO "recipes" (id, user_id, name, ingredients, instructions, source,
          canonical_source_url, is_public, deleted_at, deleted_by)
        VALUES ('${id}', '${USER}', '${id}', '[]', '[]', '${url}', '${url}', true, now(), '${marker}')`);
    }
  }
  const urls = async () =>
    (
      await client.query<{
        id: string;
        deleted_at: Date | null;
        canonical_source_url: string | null;
      }>(
        `SELECT id, deleted_at, canonical_source_url FROM "recipes" WHERE user_id = '${USER}' ORDER BY id`
      )
    ).rows;

  it('restoreAccount restores both; only the smaller id keeps the shared URL', async () => {
    await seedPending(['p-1', 'p-2']);
    await restoreAccount(USER, new Date());
    expect(await urls()).toEqual([
      { id: 'p-1', deleted_at: null, canonical_source_url: HELD },
      { id: 'p-2', deleted_at: null, canonical_source_url: null },
    ]);
  });

  it('restoreAccount gives neither the URL when a live recipe holds it', async () => {
    await seedPending(['p-1', 'p-2']);
    await seedHiddenHolder();
    await restoreAccount(USER, new Date());
    expect((await urls()).map((r) => r.canonical_source_url)).toEqual([null, null]);
  });

  it('admin restoreRecipe restores a recipe whose URL a live recipe took, with the key NULL', async () => {
    await seedPending(['p-1']);
    await seedHiddenHolder();
    state.sessionUserId = ADMIN;
    expect(await restoreRecipe('p-1')).toMatchObject({ success: true });
    expect(await urls()).toEqual([{ id: 'p-1', deleted_at: null, canonical_source_url: null }]);
  });
});

describe('discoverRecipes: a failed holder lookup fails one item (#142)', () => {
  it('counts the item as failed and still saves the next one', async () => {
    await client.exec(`INSERT INTO "recipes" (id, user_id, name, ingredients, instructions, source,
        canonical_source_url, is_public, moderation_status)
      VALUES ('pub-held', '${OTHER}', 'Public Stew', '[]', '[]', '${HELD}', '${HELD}', true, 'approved')`);
    state.sessionUserId = USER;
    state.skipPrecheck = true; // the insert, not the pre-check, finds the holder
    state.search.mockResolvedValue([
      { url: HELD_VARIANT, title: 'Stew', description: '' },
      { url: 'https://a.com/soup', title: 'Soup', description: '' },
    ]);
    const query = (state.db as { query: { recipes: { findFirst: () => Promise<unknown> } } }).query;
    vi.spyOn(query.recipes, 'findFirst').mockRejectedValueOnce(new Error('lookup down'));

    const res = await discoverRecipes('stew', { maxResults: 2 });

    expect(res.success).toBe(true);
    expect(res.stats).toMatchObject({ saved: 1, failed: 1, skipped: 0 });
    expect(await count(`user_id = '${USER}'`)).toBe(1);
  });
});
