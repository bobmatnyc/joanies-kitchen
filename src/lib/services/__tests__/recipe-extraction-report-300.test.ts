/**
 * #300: `extractRecipe(url, report)` records what each tier saw when it
 * missed, so the crawl can tell a page with no recipe from a failure. A tier
 * says `no_recipe` only on a reliable verdict: a Firecrawl schema read with no
 * Recipe in it, or an LLM that ran and judged the content not a recipe.
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
vi.mock('@/lib/db', () => ({ db: {} }));

import { fetchContentWithJina } from '@/lib/ai/jina-scraper';
import { nonRecipeSkipReason } from '@/lib/services/ingestion-url-triage';
import {
  type ExtractionReport,
  RecipeExtractionService,
} from '@/lib/services/recipe-extraction.service';

const URL_ = 'https://www.example-kitchen.com/recipes/soup';
/** A hub page in markdown: a heading and links, no ingredient or method section. */
const HUB_MARKDOWN = `# Our favourite soups\n\n${'[A soup](https://x.example/s) and more. '.repeat(20)}`;
/** A recipe page whose ingredient list parses short of the quality gate. */
const PARTIAL_RECIPE_MARKDOWN = `# Leek soup\n\n## Ingredients\n- 2 leeks\n\n${'Notes about leeks. '.repeat(20)}`;
/** Probe A: a real recipe with bold labels, which the heading regex misses. */
const BOLD_LABEL_RECIPE = `# Leek and potato soup\n\n**Ingredients**\n- 2 leeks\n- 3 potatoes\n- 1 litre stock\n\n**Method**\n1. Chop the leeks and potatoes finely.\n2. Simmer in the stock for thirty minutes.\n`;
/** Probe C: a Cloudflare challenge served with HTTP 200. */
const CHALLENGE = `# Just a moment...\n\nChecking your browser before accessing www.example-kitchen.com. Enable JavaScript and cookies to continue. ${'.'.repeat(200)}`;

type Scrape = () => Promise<unknown>;

async function run(opts: { scrape?: Scrape; jina?: string | Error; llm?: 'throws' | string }) {
  vi.stubEnv('FIRECRAWL_API_KEY', opts.scrape ? 'fc-key' : '');
  vi.stubEnv('JINA_API_KEY', opts.jina === undefined ? '' : 'jina-key');
  vi.stubEnv('OPENROUTER_API_KEY', opts.llm ? 'or-key' : '');
  if (opts.jina instanceof Error) vi.mocked(fetchContentWithJina).mockRejectedValue(opts.jina);
  else if (opts.jina !== undefined) vi.mocked(fetchContentWithJina).mockResolvedValue(opts.jina);

  const svc = new RecipeExtractionService();
  const internals = svc as unknown as Record<string, unknown>;
  if (opts.scrape) internals._firecrawl = { scrape: opts.scrape };
  if (opts.llm) {
    const reply = opts.llm;
    internals._openrouter = {
      chat: {
        completions: {
          create: async () => {
            if (reply === 'throws') throw new Error('429 rate limited');
            return { choices: [{ message: { content: reply } }] };
          },
        },
      },
    };
  }
  const report: ExtractionReport = { attempts: [] };
  const recipe = await svc.extractRecipe(URL_, report);
  return { recipe, attempts: report.attempts, skip: nonRecipeSkipReason(report, URL_) };
}

const rateLimited: Scrape = async () => {
  throw Object.assign(new Error('Rate limit exceeded'), { status: 429 });
};
const scrapeMarkdown =
  (markdown: string, title: string): Scrape =>
  async () => ({ metadata: { statusCode: 200, title }, markdown });
/** The LLM read the page and found no recipe in it. */
const LLM_NO_RECIPE = '{}';

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
  it('11-07 case: a rate-limited Firecrawl, then a Jina read the LLM judges non-recipe, is a skip', async () => {
    const { recipe, attempts, skip } = await run({
      scrape: rateLimited,
      jina: HUB_MARKDOWN,
      llm: LLM_NO_RECIPE,
    });
    expect(recipe).toBeNull();
    expect(attempts).toEqual([
      { tier: 'firecrawl', result: 'error' },
      { tier: 'jina', result: 'no_recipe' },
    ]);
    expect(skip).toMatch(/^non-recipe page: /);
  });

  it('a Firecrawl schema read with no Recipe in it is no_recipe', async () => {
    const { attempts, skip } = await run({
      scrape: async () => ({
        metadata: { statusCode: 200, title: 'Soups', schema: { '@type': 'ItemList' } },
        markdown: HUB_MARKDOWN,
      }),
    });
    expect(attempts).toEqual([{ tier: 'firecrawl', result: 'no_recipe' }]);
    expect(skip).not.toBeNull();
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

// Fail-Open Check (critic probes A-D): each is a real recipe page or an
// unreadable page, so it must stay an error (no skip reason).
describe('extractRecipe report (#300): misses without a reliable verdict stay errors', () => {
  it('A: Firecrawl only, no JSON-LD, bold labels the regex misses → empty, error', async () => {
    const { attempts, skip } = await run({
      scrape: scrapeMarkdown(BOLD_LABEL_RECIPE, 'Leek and potato soup'),
    });
    expect(attempts).toEqual([{ tier: 'firecrawl', result: 'empty' }]);
    expect(skip).toBeNull();
  });

  it('B: a Firecrawl regex miss, then Jina 429 → error', async () => {
    const { attempts, skip } = await run({
      scrape: scrapeMarkdown(BOLD_LABEL_RECIPE, 'Leek and potato soup'),
      jina: Object.assign(new Error('Jina 429 Too Many Requests'), { status: 429 }),
    });
    expect(attempts).toEqual([
      { tier: 'firecrawl', result: 'empty' },
      { tier: 'jina', result: 'error' },
    ]);
    expect(skip).toBeNull();
  });

  it('C: a Cloudflare interstitial with HTTP 200 → empty on Firecrawl, error', async () => {
    const { attempts, skip } = await run({ scrape: scrapeMarkdown(CHALLENGE, 'Just a moment...') });
    expect(attempts).toEqual([{ tier: 'firecrawl', result: 'empty' }]);
    expect(skip).toBeNull();
  });

  it('C: a Cloudflare interstitial the LLM judges non-recipe → empty on Jina, error', async () => {
    const { attempts, skip } = await run({ jina: CHALLENGE, llm: LLM_NO_RECIPE });
    expect(attempts).toEqual([{ tier: 'jina', result: 'empty' }]);
    expect(skip).toBeNull();
  });

  it('D: the LLM returns a title and ingredients but no instructions → recipe_partial, error', async () => {
    const { attempts, skip } = await run({
      jina: HUB_MARKDOWN,
      llm: JSON.stringify({ title: 'Leek soup', ingredients: ['2 leeks', '1 onion'] }),
    });
    expect(attempts).toEqual([{ tier: 'jina', result: 'recipe_partial' }]);
    expect(skip).toBeNull();
  });

  it('D: no LLM key, a regex miss → empty, error', async () => {
    const { attempts, skip } = await run({ jina: HUB_MARKDOWN });
    expect(attempts).toEqual([{ tier: 'jina', result: 'empty' }]);
    expect(skip).toBeNull();
  });
});
