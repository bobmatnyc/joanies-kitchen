/**
 * #6 S2: the real `crawlWeeklyRecipes` loop checks `shouldContinue` before
 * each paid URL. Discovery and the paid Firecrawl scrape are stubbed; the
 * scrape fails so each URL ends `failed` without reaching the LLM or the DB.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

const scrapeRecipePage = vi.hoisted(() => vi.fn(async () => ({ error: 'stub: no content' })));

vi.mock('@/lib/firecrawl', () => ({ scrapeRecipePage }));
vi.mock('@/lib/perplexity-discovery', () => ({
  discoverWeeklyRecipes: async () => ({
    success: true,
    recipes: ['a', 'b', 'c', 'd', 'e'].map((s) => ({
      title: s,
      url: `https://www.example.com/r/${s}`,
    })),
  }),
}));
vi.mock('@/lib/db', () => ({ db: {} }));
vi.mock('@/lib/db/embeddings', () => ({ saveRecipeEmbedding: vi.fn() }));
vi.mock('@/lib/ai/embeddings', () => ({ generateRecipeEmbedding: vi.fn() }));
vi.mock('@/lib/ai/openrouter-server', () => ({ getOpenRouterClient: vi.fn() }));
vi.mock('@/lib/ai/recipe-quality-evaluator', () => ({ evaluateRecipeQuality: vi.fn() }));
vi.mock('@/lib/auth', () => ({ auth: async () => ({ userId: null }) }));
vi.mock('@/lib/serpapi', () => ({ filterRecipeSites: vi.fn(), searchRecipesWithSerpAPI: vi.fn() }));

import { crawlWeeklyRecipes } from '@/lib/recipe-crawl';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('crawlWeeklyRecipes shouldContinue', () => {
  it('stops before the next paid URL once shouldContinue returns false', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let checks = 0;

    const result = await crawlWeeklyRecipes(0, {
      maxResults: 5,
      autoApprove: true,
      shouldContinue: () => ++checks <= 2,
    });

    expect(scrapeRecipePage).toHaveBeenCalledTimes(2);
    expect(result.recipes.map((r) => r.url)).toEqual([
      'https://www.example.com/r/a',
      'https://www.example.com/r/b',
    ]);
    expect(result.stoppedUrls).toEqual([
      'https://www.example.com/r/c',
      'https://www.example.com/r/d',
      'https://www.example.com/r/e',
    ]);
  });
});
