/**
 * #314: more non-recipe rejects on the daily cron. Covers the new pre-fetch
 * path rules (with the 11-11 stored recipe URLs as negatives) and the
 * `challenge` verdict on Jina/Tavily bot-check pages.
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
import { nonRecipePathRule } from '@/lib/services/ingestion-url-rules';
import { nonRecipeSkipReason } from '@/lib/services/ingestion-url-triage';
import {
  type ExtractionReport,
  RecipeExtractionService,
} from '@/lib/services/recipe-extraction.service';
import {
  CHALLENGE_MAX_CHARS,
  challengeChainVerdict,
  isChallengeResponse,
} from '@/lib/services/recipe-extraction-verdict';

beforeEach(() => {
  for (const m of ['log', 'debug', 'warn', 'error'] as const) {
    vi.spyOn(console, m).mockImplementation(() => undefined);
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('nonRecipePathRule (#314)', () => {
  it.each([
    ['https://minuterice.com/cooking/quick-and-hearty-salads/', 'article-section'],
    [
      'https://www.101cookbooks.com/archives/letter-setting-up-your-first-kitchen-recipe.html',
      'newsletter',
    ],
    ['https://www.abrowntable.com/home', 'host-homepage'],
    ['https://www.abrowntable.com/home/', 'host-homepage'],
    ['https://bryant-terry.com/c-v', 'author-page'],
    ['https://bryant-terry.com/books', 'author-page'],
    ['https://bryant-terry.com/moad-chef-in-residence', 'author-page'],
    ['https://bryant-terry.com/books-featuring-bryant', 'author-page'],
    ['https://example.com/cv', 'author-page'],
    ['https://example.com/about', 'author-page'],
    ['https://example.com/about-us/', 'author-page'],
    ['https://example.com/press/2024-review', 'author-page'],
    ['https://example.com/events/', 'author-page'],
  ])('rejects every #314 non-recipe path: %s', (url, rule) => {
    expect(nonRecipePathRule(url)).toBe(rule);
  });

  it.each([
    // Stored by the 11-11 cron run.
    'https://minuterice.com/recipes/quick-italian-chicken-and-rice/',
    'https://minuterice.com/recipes/chicken-tortilla-soup/',
    'https://minuterice.com/recipes/jalapeno-lime-butter-steak-bowl/',
    'https://minuterice.com/recipes/quick-chicken-stir-fry/',
    // Dated recipe posts: no /YYYY/MM/ blanket rule.
    'https://smittenkitchen.com/2019/05/potato-vareniki/',
    'https://smittenkitchen.com/2016/09/baked-alaska-smitten-kitchen-turns-10/',
    'https://food52.com/recipes/12345-roasted-carrots',
    'https://www.101cookbooks.com/archives/lemon-ricotta-pancakes-recipe.html',
    // An old /home/<slug> URL redirects to a recipe (niksharmacooks.com).
    'https://www.abrowntable.com/home/almond-apricot-honey-cake',
    'https://www.abrowntable.com/home/the-chemistry-of-a-vegetable-stock',
    // A recipe nested under a matched section is still fetched.
    'https://example.com/cooking/recipes/weeknight-dal',
    'https://example.com/books/salt-fat-acid-heat/recipes/caesar',
    'https://example.com/recipes/about-time-chili',
    'https://example.com/2020/05/letter-cookies',
    'https://example.com/cv-salad',
    'https://example.com/booksellers-banana-bread',
    // No generic rule fits these 11-10/11-11 pages; they still reach the tiers.
    'https://bryant-terry.com/4color',
    'https://bryant-terry.com/creative-essentials',
    'https://www.frei-style.com/en/leftover-recipes',
  ])('keeps #314 recipe paths: %s', (url) => {
    expect(nonRecipePathRule(url)).toBeNull();
  });
});

/** Jina's 11-11 body for abrowntable.com/seasoncookbook was 56 chars. */
const CF_BODY = 'Verifying you are human. This may take a few seconds.';
const PAGE = `# Page\n\n${'Some words about food and cooking. '.repeat(20)}`;
/** A short recipe page whose comment form mentions a captcha. */
const SHORT_RECIPE = `# Leek soup\n\n## Ingredients\n- 2 leeks\n- 3 potatoes\n- 1 litre stock\n\n## Instructions\n1. Chop the leeks and potatoes.\n2. Simmer in the stock for thirty minutes.\n\nA soup for cold nights. Solve the captcha to leave a comment.`;

describe('isChallengeResponse (#314)', () => {
  it.each([
    ['Just a moment...', CF_BODY],
    ['Just a moment…', ''],
    ['Attention Required! | Cloudflare', 'Sorry, you have been blocked.'],
    [undefined, 'Checking your browser before accessing example.com.'],
    [undefined, 'Enable JavaScript and cookies to continue'],
  ])('reads a challenge response: %s', (title, body) => {
    expect(isChallengeResponse(title, body)).toBe(true);
  });

  it.each([
    ['Just a Moment Cake', 'A cake recipe.'],
    ['Leek soup', PAGE],
    // A long recipe page with a challenge phrase in it is never a challenge.
    ['Leek soup', `${PAGE}\nJust a moment... captcha ${'x'.repeat(CHALLENGE_MAX_CHARS)}`],
  ])('does not read a recipe page as a challenge: %s', (title, body) => {
    expect(isChallengeResponse(title, body)).toBe(false);
  });
});

describe('challengeChainVerdict (#314)', () => {
  const at = (...r: ('empty' | 'no_recipe' | 'error' | 'recipe_partial')[]) =>
    r.map((result, i) => ({
      tier: i === 0 ? ('jina' as const) : ('tavily_extract' as const),
      result,
    }));
  it('challenge only when a tier was challenged and every attempt is empty', () => {
    expect(challengeChainVerdict(at('empty', 'empty'), 1)).toBe('challenge');
    expect(challengeChainVerdict(at('empty', 'empty'), 0)).toBeNull();
    expect(challengeChainVerdict(at('empty', 'no_recipe'), 1)).toBeNull();
    expect(challengeChainVerdict(at('empty', 'error'), 1)).toBeNull();
    expect(challengeChainVerdict(at('empty', 'recipe_partial'), 1)).toBeNull();
  });
});

const URL_ = 'https://abrowntable.com/seasoncookbook';

/** Jina, Tavily and the LLM configured; Firecrawl skipped as on the cron. */
function build(jina: { title?: string; body: string }, tavily: string | Error) {
  vi.stubEnv('FIRECRAWL_API_KEY', 'fc-key');
  vi.stubEnv('JINA_API_KEY', 'jina-key');
  vi.stubEnv('TAVILY_API_KEY', 'tv-key');
  vi.stubEnv('OPENROUTER_API_KEY', 'or-key');
  vi.mocked(fetchContentWithJina).mockImplementation(async (_url, _max, meta) => {
    if (meta) meta.title = jina.title;
    return jina.body;
  });
  const svc = new RecipeExtractionService();
  const internals = svc as unknown as Record<string, unknown>;
  const tavilyFn = vi.fn(async () => {
    if (tavily instanceof Error) throw tavily;
    return tavily;
  });
  const llm = vi.fn(async () => ({ choices: [{ message: { content: '{}' } }] }));
  internals.fetchWithTavilyExtract = tavilyFn;
  internals._openrouter = { chat: { completions: { create: llm } } };
  return { svc, tavily: tavilyFn, llm };
}

async function extract(svc: RecipeExtractionService) {
  const report: ExtractionReport = { attempts: [] };
  const recipe = await svc.extractRecipe(URL_, report, { skipFirecrawl: true });
  return { recipe, report, skip: nonRecipeSkipReason(report, URL_) };
}

describe('extractRecipe challenge verdict (#314)', () => {
  it('a challenge on Jina and Tavily: no LLM call, a challenge skip, not an error', async () => {
    const { svc, tavily, llm } = build({ title: 'Just a moment...', body: CF_BODY }, CF_BODY);
    const { recipe, report, skip } = await extract(svc);

    expect(recipe).toBeNull();
    expect(tavily).toHaveBeenCalledTimes(1);
    expect(llm).not.toHaveBeenCalled();
    expect(report).toEqual({
      attempts: [
        { tier: 'jina', result: 'empty' },
        { tier: 'tavily_extract', result: 'empty' },
      ],
      verdict: 'challenge',
    });
    expect(skip).toBe('non-recipe page: challenge verdict (read by jina, tavily_extract)');
    expect(console.error).not.toHaveBeenCalled();
  });

  it('11-11 shape: a challenge on Jina, a real page on Tavily: Tavily and the LLM still read it', async () => {
    const { svc, tavily, llm } = build({ title: 'Just a moment...', body: CF_BODY }, PAGE);
    const { report, skip } = await extract(svc);

    expect(tavily).toHaveBeenCalledTimes(1);
    expect(llm).toHaveBeenCalledTimes(1); // on Tavily's content only
    expect(report.verdict).toBeUndefined();
    expect(skip).toMatch(/^non-recipe page: no recipe schema/);
  });

  it('a long-enough Jina challenge body gets no LLM call', async () => {
    const body = `Verify you are human by completing the action below. ${'.'.repeat(300)}`;
    const { svc, llm } = build({ title: 'Just a moment...', body }, new Error('Tavily 500'));
    const { report, skip } = await extract(svc);

    expect(llm).not.toHaveBeenCalled();
    // A Tavily error keeps the #300 reading: an error, not a skip.
    expect(report.verdict).toBeUndefined();
    expect(skip).toBeNull();
  });

  it('a short recipe page that mentions a captcha is stored, not read as a challenge', async () => {
    const { svc, tavily, llm } = build({ title: 'Leek soup', body: SHORT_RECIPE }, PAGE);
    const { recipe, report } = await extract(svc);

    expect(recipe?.title).toBe('Leek soup');
    expect(recipe?.ingredients).toHaveLength(3);
    expect(tavily).not.toHaveBeenCalled();
    expect(llm).not.toHaveBeenCalled();
    expect(report.verdict).toBeUndefined();
  });

  it('logs verdict=challenge on the url-timing line', async () => {
    const run = new RunTiming();
    const { svc } = build({ title: 'Just a moment...', body: CF_BODY }, CF_BODY);
    await run.timeUrl(URL_, () => svc.extractRecipe(URL_, undefined, { skipFirecrawl: true }));

    const lines = vi
      .mocked(console.log)
      .mock.calls.map((c) => String(c[0]))
      .filter((l) => l.startsWith('[AutonomousIngestion] url-timing '));
    expect(lines[0]).toMatch(/ llmMs=0 .* tiers=jina,tavily verdict=challenge$/);
  });
});
