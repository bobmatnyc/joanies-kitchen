// @vitest-environment node
/**
 * #142: chef scraping links a stored source-URL duplicate to the chef and
 * counts it as skipped; a failed link fails the page and writes nothing.
 * Real `linkRecipeToChef` against PGlite tables; scrape, crawl and LLM parse
 * are stubbed.
 */

import type { PGlite } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  db: undefined as unknown,
  scraped: [] as string[],
  /** Pages the stubbed Firecrawl crawl returns. */
  pages: [] as Array<{ url: string; markdown: string }>,
  /** Title the stubbed LLM parser returns, keyed by page markdown. */
  titles: {} as Record<string, string>,
}));

vi.mock('@/lib/db', () => ({
  get db() {
    return state.db;
  },
}));
vi.mock('@/lib/admin', () => ({ requireAdmin: vi.fn(async () => undefined) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/firecrawl', () => ({
  crawlChefRecipes: async () => ({ data: state.pages }),
  scrapeRecipePage: async (url: string) => {
    state.scraped.push(url);
    return { markdown: `# page ${url}` };
  },
}));
vi.mock('@/lib/ai/recipe-parser', () => ({
  parseRecipeWithAI: async ({ markdown }: { markdown: string }) => ({
    name: state.titles[markdown] ?? 'New Dish',
    description: 'd',
    ingredients: ['1 onion'],
    instructions: ['Cook'],
  }),
}));

import { createVisibilityDb } from '@/app/actions/__tests__/recipe-visibility-db';
import { scrapeSingleRecipe, startChefScraping } from '@/app/actions/chef-scraping';
import { requireAdmin } from '@/lib/admin';
import { chefRecipes, chefs, scrapingJobs } from '@/lib/db/chef-schema';
import { recipes } from '@/lib/db/schema';

const CHEF = '00000000-0000-4000-8000-000000000001';
const OTHER_CHEF = '00000000-0000-4000-8000-000000000002';
const MISSING_CHEF = '00000000-0000-4000-8000-0000000000ff';
const SEED_URL = 'https://www.chef.com/chicken-soup/';
const VARIANT = 'http://chef.com/chicken-soup/print/?fbclid=1';

let client: PGlite;
const rows = async <T>(sql: string) => (await client.query<T>(sql)).rows;
const links = () =>
  rows<{ chef_id: string; recipe_id: string; original_url: string }>(
    'SELECT chef_id, recipe_id, original_url FROM "chef_recipes" ORDER BY recipe_id'
  );
const seedChefId = async () =>
  (await rows<{ chef_id: string | null }>(`SELECT chef_id FROM "recipes" WHERE id = 'seed-1'`))[0]
    .chef_id;
const recipeCount = async () =>
  (await rows<{ n: number }>('SELECT count(*)::int AS n FROM "recipes"'))[0].n;

beforeAll(async () => {
  const tables = { recipes, chefs, chefRecipes, scrapingJobs };
  const built = await createVisibilityDb(Object.values(tables), tables, { constraints: true });
  client = built.client;
  state.db = built.db;
});

afterAll(async () => {
  await client?.close();
});

beforeEach(async () => {
  await client.exec('DELETE FROM "chef_recipes"; DELETE FROM "recipes"; DELETE FROM "chefs";');
  await client.exec('DELETE FROM "scraping_jobs";');
  await client.exec(`INSERT INTO "chefs" (id, slug, name) VALUES
    ('${CHEF}', 'chef-a', 'Chef A'), ('${OTHER_CHEF}', 'chef-b', 'Chef B')`);
  await client.exec(`INSERT INTO "recipes" (id, user_id, name, ingredients, instructions, source, is_public)
    VALUES ('seed-1', 'system', 'Chicken Soup', '[]', '[]', '${SEED_URL}', true)`);
  state.scraped = [];
  state.pages = [];
  state.titles = {};
  for (const level of ['log', 'error'] as const) {
    vi.spyOn(console, level).mockImplementation(() => undefined);
  }
});

afterEach(() => {
  vi.restoreAllMocks(); // #142: drop per-test db.batch / db.delete spies
});

const scrapeOne = (url: string, chefId = CHEF) => scrapeSingleRecipe({ chefId, url });

describe('scrapeSingleRecipe chef linking (#142)', () => {
  it('links a source-URL duplicate to the chef and skips it', async () => {
    const res = await scrapeOne(VARIANT);
    expect(res).toEqual({
      success: false,
      error: 'skipped: duplicate of seed-1',
      duplicateOf: 'seed-1',
      linkedToChef: true,
    });
    expect(state.scraped).toEqual([]);
    expect(await links()).toEqual([{ chef_id: CHEF, recipe_id: 'seed-1', original_url: VARIANT }]);
    expect(await seedChefId()).toBe(CHEF);
    expect(await recipeCount()).toBe(1);
  });

  it('is idempotent: a second scrape of a linked duplicate keeps one link', async () => {
    await scrapeOne(VARIANT);
    expect(await scrapeOne(SEED_URL)).toMatchObject({ duplicateOf: 'seed-1', linkedToChef: true });
    expect(await links()).toHaveLength(1);
  });

  it("adds the link but keeps another chef's chef_id on the recipe", async () => {
    await client.exec(`UPDATE "recipes" SET chef_id = '${OTHER_CHEF}' WHERE id = 'seed-1'`);
    expect(await scrapeOne(VARIANT)).toMatchObject({ linkedToChef: true });
    expect(await links()).toEqual([{ chef_id: CHEF, recipe_id: 'seed-1', original_url: VARIANT }]);
    expect(await seedChefId()).toBe(OTHER_CHEF);
  });

  it('does not link a title-and-host match', async () => {
    state.titles['# page https://chef.com/soup-again'] = 'Chicken Soup!';
    const res = await scrapeOne('https://chef.com/soup-again');
    expect(res).toEqual({
      success: false,
      error: 'skipped: duplicate of seed-1',
      duplicateOf: 'seed-1',
    });
    expect(await links()).toEqual([]);
  });

  it('fails visibly and writes nothing when the chef lookup fails on a duplicate', async () => {
    const res = await scrapeOne(VARIANT, MISSING_CHEF);
    expect(res).toEqual({
      success: false,
      error: `failed to link duplicate seed-1 to chef ${MISSING_CHEF}: Chef not found: ${MISSING_CHEF}`,
    });
    expect(await links()).toEqual([]);
    expect(await seedChefId()).toBeNull();
  });

  it('deletes a new recipe and fails when its chef link fails', async () => {
    const res = await scrapeOne('https://chef.com/beef-stew', MISSING_CHEF);
    expect(res).toEqual({
      success: false,
      error: `failed to link recipe to chef ${MISSING_CHEF}: Chef not found: ${MISSING_CHEF}`,
    });
    expect(await recipeCount()).toBe(1);
    expect(await links()).toEqual([]);
  });
});

/** Starts a crawl job over `state.pages` and waits for it to finish. */
async function runJob(chefId: string) {
  const started = await startChefScraping({ chefId, sourceUrl: 'https://chef.com' });
  if (!started.success || !started.job) throw new Error('job did not start');
  const id = started.job.id;
  let job: Record<string, unknown> = {};
  await vi.waitFor(
    async () => {
      job = (
        await rows<Record<string, unknown>>(`SELECT * FROM "scraping_jobs" WHERE id = '${id}'`)
      )[0];
      expect(job.status).not.toMatch(/pending|running/);
    },
    { timeout: 5000, interval: 25 }
  );
  return job;
}

describe('chef scraping job chef linking (#142)', () => {
  it('links a source-URL duplicate, counts it as skipped, and stores a new page', async () => {
    state.pages = [
      { url: VARIANT, markdown: 'dup' },
      { url: 'https://chef.com/beef-stew', markdown: 'new' },
    ];
    const job = await runJob(CHEF);
    expect(job).toMatchObject({
      status: 'completed',
      recipes_scraped: 1,
      recipes_failed: 0,
      metadata: { recipes_skipped: 1 },
    });
    const linked = await links();
    expect(linked).toHaveLength(2);
    expect(linked).toContainEqual({ chef_id: CHEF, recipe_id: 'seed-1', original_url: VARIANT });
  });

  it('counts a duplicate whose chef link fails as failed, not skipped', async () => {
    state.pages = [{ url: VARIANT, markdown: 'dup' }];
    const job = await runJob(MISSING_CHEF);
    expect(job).toMatchObject({
      status: 'completed',
      recipes_scraped: 0,
      recipes_failed: 1,
      metadata: { recipes_skipped: 0 },
    });
    expect(await links()).toEqual([]);
    expect(await seedChefId()).toBeNull();
  });
});

type SpiedDb = {
  batch: (...args: unknown[]) => Promise<unknown>;
  delete: (...args: unknown[]) => unknown;
};
const NEW_URL = 'https://chef.com/beef-stew';
const newRecipeRows = () =>
  rows<{ id: string }>(`SELECT id FROM "recipes" WHERE source = '${NEW_URL}'`);

describe('a failed link on a newly inserted recipe, chef exists (#142)', () => {
  it('deletes the recipe and fails the page when the link batch rejects', async () => {
    vi.spyOn(state.db as SpiedDb, 'batch').mockRejectedValueOnce(new Error('batch down'));
    state.pages = [{ url: NEW_URL, markdown: 'new' }];
    const job = await runJob(CHEF);
    expect(job).toMatchObject({ status: 'completed', recipes_scraped: 0, recipes_failed: 1 });
    expect(await newRecipeRows()).toEqual([]);
    expect(await links()).toEqual([]);
  });

  it('deletes the recipe and fails the page when requireAdmin throws inside the link', async () => {
    // Call 1 is startChefScraping's own check; call 2 is linkRecipeToChef's.
    vi.mocked(requireAdmin)
      .mockResolvedValueOnce(undefined as never)
      .mockRejectedValueOnce(new Error('admin check: db timeout'));
    state.pages = [{ url: NEW_URL, markdown: 'new' }];
    const job = await runJob(CHEF);
    expect(job).toMatchObject({ status: 'completed', recipes_scraped: 0, recipes_failed: 1 });
    expect(await newRecipeRows()).toEqual([]);
    expect(await links()).toEqual([]);
  });

  it('reports both the link error and the delete error when the cleanup delete fails', async () => {
    vi.spyOn(state.db as SpiedDb, 'batch').mockRejectedValueOnce(new Error('batch down'));
    vi.spyOn(state.db as SpiedDb, 'delete').mockReturnValueOnce({
      where: async () => {
        throw new Error('delete down');
      },
    });
    const res = await scrapeOne(NEW_URL);
    expect(res).toEqual({
      success: false,
      error: expect.stringMatching(/^failed to link recipe to chef .*batch down.*delete down/),
    });
  });
});
