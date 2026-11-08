/**
 * #300: `extractRecipe(url, report)` records what each tier saw when it
 * missed, so the crawl can tell a page with no recipe from a failure.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/costs', () => ({
  assertWithinDailyCap: vi.fn(),
  trackCost: vi.fn(),
  unitsOrFloor: vi.fn(),
  TAVILY_EXTRACT_FLOOR_URLS: 1,
  withChatCostTracking: <T>(client: T) => client,
}));
vi.mock('@/lib/ai/jina-scraper', () => ({ fetchContentWithJina: vi.fn() }));

import { fetchContentWithJina } from '@/lib/ai/jina-scraper';
import {
  type ExtractionReport,
  RecipeExtractionService,
} from '@/lib/services/recipe-extraction.service';

const URL_ = 'https://www.example-kitchen.com/recipes/soup';
/** A hub page in markdown: a heading and links, no ingredient or method section. */
const HUB_MARKDOWN = `# Our favourite soups\n\n${'[A soup](https://x.example/s) and more. '.repeat(20)}`;
/** A recipe page whose ingredient list parses short of the quality gate. */
const PARTIAL_RECIPE_MARKDOWN = `# Leek soup\n\n## Ingredients\n- 2 leeks\n\n${'Notes about leeks. '.repeat(20)}`;

type Scrape = () => Promise<unknown>;

async function run(opts: { scrape?: Scrape; jina?: string | Error; llm?: 'throws' }) {
  vi.stubEnv('FIRECRAWL_API_KEY', opts.scrape ? 'fc-key' : '');
  vi.stubEnv('JINA_API_KEY', opts.jina === undefined ? '' : 'jina-key');
  vi.stubEnv('OPENROUTER_API_KEY', opts.llm ? 'or-key' : '');
  if (opts.jina instanceof Error) vi.mocked(fetchContentWithJina).mockRejectedValue(opts.jina);
  else if (opts.jina !== undefined) vi.mocked(fetchContentWithJina).mockResolvedValue(opts.jina);

  const svc = new RecipeExtractionService();
  const internals = svc as unknown as Record<string, unknown>;
  if (opts.scrape) internals._firecrawl = { scrape: opts.scrape };
  if (opts.llm === 'throws') {
    internals._openrouter = {
      chat: {
        completions: {
          create: async () => {
            throw new Error('429 rate limited');
          },
        },
      },
    };
  }
  const report: ExtractionReport = { attempts: [] };
  const recipe = await svc.extractRecipe(URL_, report);
  return { recipe, attempts: report.attempts };
}

const rateLimited: Scrape = async () => {
  throw Object.assign(new Error('Rate limit exceeded'), { status: 429 });
};

beforeEach(() => {
  vi.stubEnv('TAVILY_API_KEY', '');
  for (const m of ['log', 'debug', 'warn', 'error'] as const) {
    vi.spyOn(console, m).mockImplementation(() => undefined);
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('extractRecipe report (#300)', () => {
  it('a rate-limited Firecrawl is an error and a Jina read with no recipe is no_recipe', async () => {
    const { recipe, attempts } = await run({ scrape: rateLimited, jina: HUB_MARKDOWN });
    expect(recipe).toBeNull();
    expect(attempts).toEqual([
      { tier: 'firecrawl', result: 'error' },
      { tier: 'jina', result: 'no_recipe' },
    ]);
  });

  it('a schema.org Recipe that maps to too little is recipe_partial, not no_recipe', async () => {
    const { attempts } = await run({
      scrape: async () => ({
        metadata: { statusCode: 200, schema: { '@type': 'Recipe', name: 'Leek soup' } },
      }),
    });
    expect(attempts).toEqual([{ tier: 'firecrawl', result: 'recipe_partial' }]);
  });

  it('a page with some ingredients but short of the gate is recipe_partial', async () => {
    const { attempts } = await run({ jina: PARTIAL_RECIPE_MARKDOWN });
    expect(attempts).toEqual([{ tier: 'jina', result: 'recipe_partial' }]);
  });

  it('too little content is empty, and a fetch that throws is error', async () => {
    expect((await run({ jina: 'Access denied' })).attempts).toEqual([
      { tier: 'jina', result: 'empty' },
    ]);
    expect((await run({ jina: new Error('ECONNRESET') })).attempts).toEqual([
      { tier: 'jina', result: 'error' },
    ]);
  });

  it('a failed LLM structuring step makes the tier an error, never no_recipe', async () => {
    const { attempts } = await run({ jina: HUB_MARKDOWN, llm: 'throws' });
    expect(attempts).toEqual([{ tier: 'jina', result: 'error' }]);
  });

  it('a viable recipe records no miss and returns the recipe', async () => {
    const { recipe, attempts } = await run({
      scrape: async () => ({
        metadata: {
          statusCode: 200,
          schema: {
            '@type': 'Recipe',
            name: 'Leek and potato soup',
            recipeIngredient: ['2 leeks', '3 potatoes', '1 litre stock'],
            recipeInstructions: ['Chop the vegetables', 'Simmer for 30 minutes'],
          },
        },
      }),
    });
    expect(recipe?.title).toBe('Leek and potato soup');
    expect(attempts).toEqual([]);
  });
});
