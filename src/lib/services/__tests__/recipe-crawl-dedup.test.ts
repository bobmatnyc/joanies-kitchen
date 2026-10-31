// @vitest-environment node
/**
 * #135: the weekly crawl skips a duplicate instead of inserting it, against a
 * real `recipes` table (PGlite). A URL variant is skipped before the paid
 * scrape; a same-title, same-host page is skipped at store time; the same
 * title from another host is stored.
 */

import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  db: undefined as unknown,
  scraped: [] as string[],
  /** Title the stubbed LLM extracts for each URL. */
  titles: {} as Record<string, string>,
  urls: [] as string[],
}));

vi.mock('@/lib/db', () => ({
  get db() {
    return state.db;
  },
}));
vi.mock('@/lib/firecrawl', () => ({
  scrapeRecipePage: async (url: string) => {
    state.scraped.push(url);
    return { success: true, markdown: `# page ${url}` };
  },
}));
vi.mock('@/lib/ai/openrouter-server', () => ({
  getOpenRouterClient: () => ({
    chat: {
      completions: {
        create: async () => {
          const name = state.titles[state.scraped[state.scraped.length - 1]];
          const recipe = {
            name,
            description: 'd',
            ingredients: ['1 onion'],
            instructions: ['Cook'],
          };
          const body = { ...recipe, confidenceScore: 0.9, isValid: true };
          return { choices: [{ message: { content: JSON.stringify(body) } }] };
        },
      },
    },
  }),
}));
vi.mock('@/lib/perplexity-discovery', () => ({
  discoverWeeklyRecipes: async () => ({
    success: true,
    recipes: state.urls.map((url) => ({ title: `listing ${url}`, url })),
  }),
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
vi.mock('@/lib/session-user', () => ({
  getSessionUserId: async () => null,
  getSessionUser: async () => null,
}));
vi.mock('@/lib/serpapi', () => ({ filterRecipeSites: vi.fn(), searchRecipesWithSerpAPI: vi.fn() }));

import { createVisibilityDb } from '@/app/actions/__tests__/recipe-visibility-db';
import { recipes } from '@/lib/db/schema';
import { crawlWeeklyRecipes } from '@/lib/recipe-crawl';

let client: PGlite;

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
    VALUES ('seed-1', 'system', 'Chicken Soup', '[]', '[]', 'https://www.a.com/chicken-soup/', true)`);
  state.scraped = [];
  state.titles = {};
  for (const level of ['log', 'warn', 'error'] as const) {
    vi.spyOn(console, level).mockImplementation(() => undefined);
  }
  const realSetTimeout = globalThis.setTimeout;
  vi.spyOn(globalThis, 'setTimeout').mockImplementation(((fn: () => void, ms?: number) =>
    realSetTimeout(fn, ms === 2000 ? 0 : ms)) as typeof setTimeout);
});

describe('crawlWeeklyRecipes duplicate guard (#135)', () => {
  it('skips URL variants and same-host titles, and stores the same title from another host', async () => {
    const variant = 'https://a.com/chicken-soup/comment-page-2/#comments';
    const sameHost = 'https://www.a.com/soup-again';
    const otherHost = 'https://b.com/chicken-soup';
    state.urls = [variant, sameHost, otherHost];
    state.titles = { [sameHost]: 'Chicken soup', [otherHost]: 'Chicken Soup' };

    const result = await crawlWeeklyRecipes(0, { autoApprove: true });

    expect(state.scraped).toEqual([sameHost, otherHost]); // the variant never reached the scraper
    expect(result.recipes.map((r) => [r.url, r.status, r.reason, r.duplicateOf])).toEqual([
      [variant, 'rejected', 'skipped: duplicate of seed-1', 'seed-1'],
      [sameHost, 'rejected', 'skipped: duplicate of seed-1', 'seed-1'],
      [otherHost, 'stored', undefined, undefined],
    ]);
    expect(result.stats).toMatchObject({ stored: 1, failed: 0 });
    const rows = await client.query<{ source: string }>(
      'SELECT source FROM "recipes" ORDER BY source'
    );
    expect(rows.rows.map((r) => r.source)).toEqual([otherHost, 'https://www.a.com/chicken-soup/']);
  });
});
