// @vitest-environment node
/**
 * #135: `scrapeSingleRecipe` skips a duplicate instead of inserting it, against
 * a real `recipes` table (PGlite). Scrape and LLM parse are stubbed.
 */

import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  db: undefined as unknown,
  scraped: [] as string[],
  /** Title the stubbed LLM parser returns for the last scraped URL. */
  titles: {} as Record<string, string>,
}));

vi.mock('@/lib/db', () => ({
  get db() {
    return state.db;
  },
}));
vi.mock('@/lib/admin', () => ({ requireAdmin: vi.fn(async () => undefined) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/chef-recipe-count', () => ({ recountChefRecipes: vi.fn() }));
vi.mock('../chefs', () => ({ linkRecipeToChef: vi.fn(async () => ({ success: true })) }));
vi.mock('@/lib/firecrawl', () => ({
  crawlChefRecipes: vi.fn(),
  scrapeRecipePage: async (url: string) => {
    state.scraped.push(url);
    return { markdown: `# page ${url}` };
  },
}));
vi.mock('@/lib/ai/recipe-parser', () => ({
  parseRecipeWithAI: async () => ({
    name: state.titles[state.scraped[state.scraped.length - 1]],
    description: 'd',
    ingredients: ['1 onion'],
    instructions: ['Cook'],
  }),
}));

import { createVisibilityDb } from '@/app/actions/__tests__/recipe-visibility-db';
import { scrapeSingleRecipe } from '@/app/actions/chef-scraping';
import { recipes } from '@/lib/db/schema';

let client: PGlite;
const count = async () =>
  (await client.query<{ n: number }>('SELECT count(*)::int AS n FROM "recipes"')).rows[0].n;

beforeAll(async () => {
  const built = await createVisibilityDb([recipes], { recipes }, { constraints: true });
  client = built.client;
  state.db = built.db;
});

afterAll(async () => {
  await client?.close();
});

beforeEach(async () => {
  await client.exec('DELETE FROM "recipes";');
  await client.exec(`INSERT INTO "recipes" (id, user_id, name, ingredients, instructions, source, is_public)
    VALUES ('seed-1', 'system', 'Chicken Soup', '[]', '[]', 'https://www.chef.com/chicken-soup/', true)`);
  state.scraped = [];
  state.titles = {};
  for (const level of ['log', 'error'] as const) {
    vi.spyOn(console, level).mockImplementation(() => undefined);
  }
});

const scrape = (url: string, title: string) => {
  state.titles[url] = title;
  return scrapeSingleRecipe({ chefId: '00000000-0000-4000-8000-000000000001', url });
};

describe('scrapeSingleRecipe duplicate guard (#135)', () => {
  it('skips a URL variant before the paid scrape', async () => {
    const res = await scrape('http://chef.com/chicken-soup/print/?fbclid=1', 'Anything');
    expect(res).toEqual({
      success: false,
      error: 'skipped: duplicate of seed-1',
      duplicateOf: 'seed-1',
    });
    expect(state.scraped).toEqual([]);
    expect(await count()).toBe(1);
  });

  it('skips the same title on the same host', async () => {
    const res = await scrape('https://chef.com/soup-again', 'Chicken Soup!');
    expect(res).toMatchObject({ success: false, duplicateOf: 'seed-1' });
    expect(await count()).toBe(1);
  });

  it('inserts a new recipe, and the same title from another host', async () => {
    expect(await scrape('https://chef.com/beef-stew', 'Beef Stew')).toMatchObject({
      success: true,
    });
    expect(await scrape('https://other.com/soup', 'Chicken Soup')).toMatchObject({ success: true });
    expect(await count()).toBe(3);
  });
});
