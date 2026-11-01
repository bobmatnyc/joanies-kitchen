// @vitest-environment node
/**
 * #248: every writer that can set `recipes.is_system_recipe = true` is gated.
 * A non-admin or unauthorized caller gets a refusal and leaves no system row;
 * an admin (or the cron bearer) can write one. URL discovery by a signed-in
 * user always writes `false`.
 *
 * Real `recipes`, `users` and `scraping_jobs` tables (PGlite). The session is
 * stubbed; the gates (`checkAdminAccess`, `requireAdmin`, cron auth) run for
 * real and read `users.is_admin`. Scrapers, LLMs and embeddings are stubbed.
 */

import type { PGlite } from '@electric-sql/pglite';
import { NextRequest } from 'next/server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  db: undefined as unknown,
  sessionUserId: null as string | null,
  scrape: vi.fn(),
  crawl: vi.fn(),
  llmCreate: vi.fn(),
  cronRun: vi.fn(),
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
vi.mock('@/lib/chef-recipe-count', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/chef-recipe-count')>()),
  recountChefRecipes: vi.fn(),
}));
vi.mock('@/app/actions/chefs', () => ({
  linkRecipeToChef: vi.fn(async () => ({ success: true })),
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
vi.mock('@/lib/services/discovery-run-reaper', () => ({
  reapStaleDiscoveryRunsFailOpen: vi.fn(async () => 0),
}));
vi.mock('@/lib/services/autonomous-recipe-ingestion.service', () => ({
  getAutonomousRecipeIngestionService: () => ({ runDailyDiscovery: state.cronRun }),
}));

import { createVisibilityDb } from '@/app/actions/__tests__/recipe-visibility-db';
import { adminToggleSystemRecipe } from '@/app/actions/admin';
import { scrapeSingleRecipe, startChefScraping } from '@/app/actions/chef-scraping';
import { discoverRecipeFromUrl } from '@/app/actions/recipe-discovery';
import { saveIngestedRecipe } from '@/app/actions/recipe-ingestion';
import { markAsSystemRecipe } from '@/app/actions/recipes';
import { GET, POST } from '@/app/api/cron/daily-recipe/route';
import { users } from '@/lib/db/auth-schema';
import { scrapingJobs } from '@/lib/db/chef-schema';
import { recipes } from '@/lib/db/schema';
import { storeCrawledRecipe } from '@/lib/recipe-crawl-store';
import { storeIngestedRecipe } from '@/lib/services/autonomous-ingestion-store';

const ADMIN = 'admin-1';
const USER = 'user-1';
const CHEF = '00000000-0000-4000-8000-000000000001';
const SECRET = 'cron-secret';

let client: PGlite;
const systemRows = async () =>
  (
    await client.query<{ id: string; user_id: string }>(
      'SELECT id, user_id FROM "recipes" WHERE is_system_recipe = true ORDER BY id'
    )
  ).rows;
const rowCount = async (table: string) =>
  (await client.query<{ n: number }>(`SELECT count(*)::int AS n FROM "${table}"`)).rows[0].n;
const isSystem = async (id: string) =>
  (
    await client.query<{ is_system_recipe: boolean }>(
      'SELECT is_system_recipe FROM "recipes" WHERE id = $1',
      [id]
    )
  ).rows[0].is_system_recipe;

beforeAll(async () => {
  const built = await createVisibilityDb(
    [users, recipes, scrapingJobs],
    { users, recipes, scrapingJobs },
    { constraints: true }
  );
  client = built.client;
  state.db = built.db;
});

afterAll(async () => {
  await client?.close();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

beforeEach(async () => {
  vi.clearAllMocks();
  await client.exec('DELETE FROM "recipes"; DELETE FROM "scraping_jobs"; DELETE FROM "users";');
  await client.exec(`INSERT INTO "users" (id, email, is_admin)
    VALUES ('${ADMIN}', 'admin@example.com', true), ('${USER}', 'user@example.com', false)`);
  // A user's own recipe, the target of the admin toggles.
  await client.exec(`INSERT INTO "recipes" (id, user_id, name, ingredients, instructions, is_public, is_system_recipe)
    VALUES ('r-1', '${USER}', 'Toast', '[]', '[]', false, false)`);
  state.sessionUserId = null;
  state.scrape.mockResolvedValue({ markdown: '# Scraped Soup' });
  state.crawl.mockResolvedValue({ data: [{ url: 'https://chef.com/soup', markdown: '# soup' }] });
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
  vi.stubEnv('CRON_SECRET', SECRET);
  for (const level of ['log', 'warn', 'error'] as const) {
    vi.spyOn(console, level).mockImplementation(() => undefined);
  }
});

describe('saveIngestedRecipe: checkAdminAccess (#248 case 1)', () => {
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
    source: 'https://a.com/stew',
  };

  it.each([
    ['signed out', null],
    ['a non-admin', USER],
  ])('%s is refused and writes no system recipe', async (_label, sessionUserId) => {
    state.sessionUserId = sessionUserId;
    const res = await saveIngestedRecipe({ ...input, is_system_recipe: true });
    expect(res).toEqual({ success: false, error: 'Admin access required' });
    expect(await systemRows()).toEqual([]);
  });

  it('an admin writes a system recipe', async () => {
    state.sessionUserId = ADMIN;
    const res = await saveIngestedRecipe(input);
    expect(res.success).toBe(true);
    expect(await systemRows()).toEqual([{ id: res.data?.id, user_id: ADMIN }]);
  });
});

describe('chef scraping: requireAdmin (#248 case 2)', () => {
  it('scrapeSingleRecipe refuses a non-admin before the scrape', async () => {
    state.sessionUserId = USER;
    await expect(
      scrapeSingleRecipe({ chefId: CHEF, url: 'https://chef.com/soup' })
    ).rejects.toThrow('Admin access required');
    expect(state.scrape).not.toHaveBeenCalled();
    expect(await systemRows()).toEqual([]);
  });

  it('scrapeSingleRecipe lets an admin write a system recipe', async () => {
    state.sessionUserId = ADMIN;
    const res = await scrapeSingleRecipe({ chefId: CHEF, url: 'https://chef.com/soup' });
    expect(res.success).toBe(true);
    expect(await systemRows()).toEqual([{ id: expect.any(String), user_id: 'system' }]);
  });

  it('startChefScraping refuses a non-admin before any job or crawl', async () => {
    state.sessionUserId = USER;
    await expect(
      startChefScraping({ chefId: CHEF, sourceUrl: 'https://chef.com' })
    ).rejects.toThrow('Admin access required');
    expect(state.crawl).not.toHaveBeenCalled();
    expect(await rowCount('scraping_jobs')).toBe(0);
    expect(await systemRows()).toEqual([]);
  });

  it('startChefScraping lets an admin write a system recipe', { timeout: 10_000 }, async () => {
    state.sessionUserId = ADMIN;
    const res = await startChefScraping({ chefId: CHEF, sourceUrl: 'https://chef.com' });
    expect(res.success).toBe(true);
    // The crawl runs in the background; wait for the job to finish.
    await vi.waitFor(
      async () => {
        const job = await client.query<{ status: string }>('SELECT status FROM "scraping_jobs"');
        expect(job.rows[0]?.status).toBe('completed');
      },
      { timeout: 5_000, interval: 50 }
    );
    expect(await systemRows()).toEqual([{ id: expect.any(String), user_id: 'system' }]);
  });
});

describe('admin system-recipe toggles (#248 case 3)', () => {
  it('adminToggleSystemRecipe refuses a non-admin; the row stays non-system', async () => {
    state.sessionUserId = USER;
    expect(await adminToggleSystemRecipe('r-1', true)).toEqual({
      success: false,
      error: 'Failed to update recipe status',
    });
    expect(await isSystem('r-1')).toBe(false);
  });

  it('adminToggleSystemRecipe lets an admin mark a system recipe', async () => {
    state.sessionUserId = ADMIN;
    expect(await adminToggleSystemRecipe('r-1', true)).toMatchObject({ success: true });
    expect(await isSystem('r-1')).toBe(true);
  });

  it.each([
    ['signed out', null, 'Authentication required'],
    ['a non-admin', USER, 'Admin access required'],
  ])(
    'markAsSystemRecipe refuses %s; the row stays non-system',
    async (_l, sessionUserId, error) => {
      state.sessionUserId = sessionUserId;
      expect(await markAsSystemRecipe('r-1', true)).toEqual({ success: false, error });
      expect(await isSystem('r-1')).toBe(false);
    }
  );

  it('markAsSystemRecipe lets an admin mark a system recipe', async () => {
    state.sessionUserId = ADMIN;
    expect(await markAsSystemRecipe('r-1', true)).toMatchObject({ success: true });
    expect(await isSystem('r-1')).toBe(true);
  });
});

describe('discoverRecipeFromUrl (#248 case 4)', () => {
  it('a signed-in non-admin import is stored as a non-system recipe', async () => {
    state.sessionUserId = USER;
    const res = await discoverRecipeFromUrl('https://a.com/chicken-soup');
    expect(res.success).toBe(true);
    expect(res.recipe).toMatchObject({ user_id: USER, is_system_recipe: false });
    expect(await systemRows()).toEqual([]);
  });

  it('a signed-out caller is refused and writes nothing', async () => {
    await expect(discoverRecipeFromUrl('https://a.com/chicken-soup')).rejects.toThrow(
      'Authentication required'
    );
    expect(await rowCount('recipes')).toBe(1);
  });
});

describe('storeCrawledRecipe (#248 case 5)', () => {
  const crawled = {
    name: 'Crawled Stew',
    description: 'A stew',
    ingredients: ['beef'],
    instructions: ['Simmer'],
    confidenceScore: 0.9,
    isValid: true,
  };

  it('with no session the crawl stores a system recipe', async () => {
    const res = await storeCrawledRecipe(crawled, { sourceUrl: 'https://a.com/stew' });
    expect(res.success).toBe(true);
    expect(await systemRows()).toEqual([{ id: res.recipeId, user_id: 'system' }]);
  });

  it("a signed-in user's crawl stores a non-system recipe", async () => {
    state.sessionUserId = USER;
    const res = await storeCrawledRecipe(crawled, { sourceUrl: 'https://a.com/stew' });
    expect(res.success).toBe(true);
    expect(await isSystem(res.recipeId as string)).toBe(false);
    expect(await systemRows()).toEqual([]);
  });
});

describe('daily-recipe cron route (#248 case 6)', () => {
  const cronRecipe = {
    title: 'Cron Stew',
    description: 'A stew',
    ingredients: ['beef'],
    instructions: ['Simmer'],
    tags: [],
  } as unknown as Parameters<typeof storeIngestedRecipe>[0];
  const request = (method: 'GET' | 'POST', authorization?: string) =>
    new NextRequest('http://localhost/api/cron/daily-recipe', {
      method,
      headers: authorization ? { authorization } : {},
      body: method === 'POST' ? JSON.stringify({}) : undefined,
    });

  beforeEach(() => {
    // The stubbed run stores one recipe through the real system-recipe store.
    state.cronRun.mockImplementation(async () => {
      await storeIngestedRecipe(cronRecipe, null, 'https://a.com/cron-stew', 'stew');
      return {
        runId: 'r1',
        status: 'completed',
        urlsDiscovered: 1,
        recipesExtracted: 1,
        recipesStored: 1,
        recipesSkipped: 0,
        chefsCreated: 0,
        errors: [],
        durationMs: 1,
        tracked: true,
      };
    });
  });

  const handlers = { GET, POST };

  it.each([
    ['GET', 'no bearer', undefined],
    ['GET', 'a wrong bearer', 'Bearer wrong'],
    ['POST', 'no bearer', undefined],
    ['POST', 'a wrong bearer', 'Bearer wrong'],
  ] as const)('%s with %s answers 401 and never stores', async (method, _label, auth) => {
    const res = await handlers[method](request(method, auth));
    expect(res.status).toBe(401);
    expect(state.cronRun).not.toHaveBeenCalled();
    expect(await systemRows()).toEqual([]);
  });

  it.each(['GET', 'POST'] as const)(
    '%s with the cron bearer stores a system recipe',
    async (method) => {
      const res = await handlers[method](request(method, `Bearer ${SECRET}`));
      expect(res.status).toBe(200);
      expect(state.cronRun).toHaveBeenCalledOnce();
      expect(await systemRows()).toEqual([{ id: expect.any(String), user_id: 'system' }]);
    }
  );
});
