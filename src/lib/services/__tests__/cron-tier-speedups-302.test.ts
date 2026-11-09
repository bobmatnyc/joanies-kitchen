/**
 * #302: daily-cron speedups. Covers the pre-fetch non-recipe path rule (b),
 * the same-host delay rule (e), the index-title verdict that stops the tier
 * chain (a), and the cron-only Firecrawl skip (f). The run-level wiring of
 * (b), (e) and (f) is in `run-accounting.test.ts` (`#302: cron tier speedups`).
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
import { RunTiming } from '@/lib/services/ingestion-timing';
import {
  needsHostDelay,
  nonRecipePathRule,
  skipsFirecrawlTier,
} from '@/lib/services/ingestion-url-rules';
import { nonRecipeSkipReason } from '@/lib/services/ingestion-url-triage';
import {
  type ExtractionReport,
  RecipeExtractionService,
} from '@/lib/services/recipe-extraction.service';
import { indexTitleVerdict } from '@/lib/services/recipe-extraction-verdict';

beforeEach(() => {
  for (const m of ['log', 'debug', 'warn', 'error'] as const) {
    vi.spyOn(console, m).mockImplementation(() => undefined);
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('nonRecipePathRule (#302 b)', () => {
  it.each([
    ['https://lidiasitaly.com/blog-categories/cooking-with-legends/', 'index-path'],
    ['https://thrivemarket.com/blog/c/food-recipes', 'index-path'],
    ['https://example.com/category/soups', 'index-path'],
    ['https://example.com/tags/vegan', 'index-path'],
    ['https://example.com/tag/vegan/', 'index-path'],
    ['https://food52.com/story/123-soup', 'media-path'],
    ['https://example.com/watch', 'media-path'],
    ['https://lidiasitaly.com/television', 'media-path'],
    ['https://example.com/video/knife-skills', 'media-path'],
    ['https://example.com/videos/knife-skills', 'media-path'],
    ['https://example.com/2020/01/an-interview-with-tamar-adler', 'interview'],
    ['https://permies.com/t/174706/Tips-recipes-reduce-food-waste', 'forum-thread'],
    ['https://example.com/forum/scraps', 'forum-thread'],
    ['https://example.com/threads/scraps.123/', 'forum-thread'],
    ['https://grownupdish.com/fab-four-smoothie-recipe-roundup', 'roundup'],
    ['https://zerowastechef.com/2018/05/02/15-creative-uses-food-scraps', 'listicle'],
  ])('rejects every #302 non-recipe path: %s', (url, rule) => {
    expect(nonRecipePathRule(url)).toBe(rule);
  });

  it.each([
    'https://www.theedibleflower.com/recipes/2018/05/25/recipe-wilted-greens-with-garlic-soy',
    'https://www.businessinsider.com/popular-chefs-recipes-for-fruit-salad-reviewed-photos-2021-8',
    'https://example.com/recipes/5-minute-hummus',
    'https://example.com/3-ingredient-peanut-butter-cookies',
    'not a url',
  ])('passes real recipe paths: %s', (url) => {
    expect(nonRecipePathRule(url)).toBeNull();
  });
});

describe('needsHostDelay (#302 e)', () => {
  it('delays only between URLs on the same host', () => {
    expect(needsHostDelay('https://www.a.com/x', 'https://a.com/y')).toBe(true);
    expect(needsHostDelay('https://a.com/x', 'https://b.com/y')).toBe(false);
    expect(needsHostDelay('not a url', 'https://b.com/y')).toBe(true); // unknown keeps the pause
  });
});

describe('indexTitleVerdict (#302 a)', () => {
  it.each([
    "Lidia's Blog Archives - Lidia",
    'Category: Soups - Example',
    'Tag: vegan',
    'Posts tagged leeks',
    'Soups - Page 2 of 9',
  ])('reads an index title as a verdict: %s', (title) => {
    expect(indexTitleVerdict(title)).toBe('index-title');
  });

  it.each([
    undefined,
    '',
    'Wilted greens with garlic & soy — The Edible Flower',
    'Television - Lidia',
  ])('gives no verdict for %s', (title) => {
    expect(indexTitleVerdict(title)).toBeNull();
  });
});

const PAGE = `# Page\n\n${'Some words about food and cooking. '.repeat(20)}`;
const URL_ = 'https://lidiasitaly.com/some-page';

/** A service with Firecrawl, Jina, Tavily and the LLM all configured and spied. */
function buildExtraction(jinaTitle: string) {
  vi.stubEnv('FIRECRAWL_API_KEY', 'fc-key');
  vi.stubEnv('JINA_API_KEY', 'jina-key');
  vi.stubEnv('TAVILY_API_KEY', 'tv-key');
  vi.stubEnv('OPENROUTER_API_KEY', 'or-key');
  vi.mocked(fetchContentWithJina).mockImplementation(async (_url, _max, meta) => {
    if (meta) meta.title = jinaTitle;
    return PAGE;
  });
  const svc = new RecipeExtractionService();
  const internals = svc as unknown as Record<string, unknown>;
  const scrape = vi.fn(async () => ({
    metadata: { statusCode: 200, title: 'Page' },
    markdown: '',
  }));
  const tavily = vi.fn(async () => PAGE);
  const llm = vi.fn(async () => ({ choices: [{ message: { content: '{}' } }] }));
  internals._firecrawl = { scrape };
  internals.fetchWithTavilyExtract = tavily;
  internals._openrouter = { chat: { completions: { create: llm } } };
  return { svc, scrape, tavily, llm };
}

describe('extractRecipe verdict short-circuit (#302 a)', () => {
  it('stops after an index-title verdict: Tavily and the LLM are not called, and it is a non-recipe skip', async () => {
    const { svc, tavily, llm } = buildExtraction("Lidia's Blog Archives - Lidia");
    const report: ExtractionReport = { attempts: [] };

    const recipe = await svc.extractRecipe(URL_, report, { skipFirecrawl: true });

    expect(recipe).toBeNull();
    expect(tavily).not.toHaveBeenCalled();
    expect(llm).not.toHaveBeenCalled();
    expect(report).toEqual({
      attempts: [{ tier: 'jina', result: 'no_recipe' }],
      verdict: 'index-title',
    });
    expect(nonRecipeSkipReason(report, URL_)).toBe(
      'non-recipe page: index-title verdict (read by jina)'
    );
    expect(console.error).not.toHaveBeenCalled();
  });

  it('runs Tavily and the LLM when there is no verdict', async () => {
    const { svc, tavily, llm } = buildExtraction("Where's Lidia? - Lidia");
    const report: ExtractionReport = { attempts: [] };

    await svc.extractRecipe(URL_, report, { skipFirecrawl: true });

    expect(tavily).toHaveBeenCalledTimes(1);
    expect(llm).toHaveBeenCalledTimes(2); // once on the Jina content, once on Tavily's
    expect(report.verdict).toBeUndefined();
  });

  it('logs verdict= on the url-timing line: index-title when it stopped, none otherwise', async () => {
    const run = new RunTiming();
    const stopped = buildExtraction('Grandma’s garden Archives - Lidia');
    await run.timeUrl(URL_, () =>
      stopped.svc.extractRecipe(URL_, undefined, { skipFirecrawl: true })
    );
    const plain = buildExtraction('Some recipe');
    await run.timeUrl(URL_, () =>
      plain.svc.extractRecipe(URL_, undefined, { skipFirecrawl: true })
    );

    const lines = vi
      .mocked(console.log)
      .mock.calls.map((c) => String(c[0]))
      .filter((l) => l.startsWith('[AutonomousIngestion] url-timing '));
    expect(lines[0]).toMatch(/ firecrawlMs=0 .* tiers=jina verdict=index-title$/);
    expect(lines[1]).toMatch(/ firecrawlMs=0 .* tiers=jina,tavily verdict=none$/);
  });
});

describe('Firecrawl tier on the cron path only (#302 f)', () => {
  it('only the daily run type skips Firecrawl', () => {
    expect(skipsFirecrawlTier('daily')).toBe(true);
    expect(skipsFirecrawlTier('manual')).toBe(false);
    expect(skipsFirecrawlTier('local')).toBe(false);
  });

  it('skipFirecrawl makes no Firecrawl scrape call; the default (manual, admin) still scrapes first', async () => {
    const cron = buildExtraction('Some recipe');
    await cron.svc.extractRecipe(URL_, undefined, { skipFirecrawl: true });
    expect(cron.scrape).not.toHaveBeenCalled();

    const manual = buildExtraction('Some recipe');
    const report: ExtractionReport = { attempts: [] };
    await manual.svc.extractRecipe(URL_, report);
    expect(manual.scrape).toHaveBeenCalledTimes(1);
    expect(report.attempts.map((a) => a.tier)).toEqual(['firecrawl', 'jina', 'tavily_extract']);
  });
});
