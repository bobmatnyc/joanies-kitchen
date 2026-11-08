/**
 * #302: per-stage timing for the daily recipe cron. A stepping clock (each
 * read +10ms) makes every number exact. Covers the `url-timing` line (host and
 * path only, never a query), tier time net of the structuring step, and that
 * `extractRecipe` returns and reports exactly the same inside a timer scope.
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
import { DEADLINE_HIT } from '@/lib/services/crawl-run-deadline';
import {
  currentUrlTimer,
  endTier,
  noteUrlOutcome,
  RunTiming,
  startTier,
  timeStage,
  timingClock,
  urlHostPath,
} from '@/lib/services/ingestion-timing';
import {
  type ExtractionReport,
  RecipeExtractionService,
} from '@/lib/services/recipe-extraction.service';

const HUB_MARKDOWN = `# Our favourite soups\n\n${'[A soup](https://x.example/s) and more. '.repeat(20)}`;

function steppingClock(stepMs = 10) {
  let t = 0;
  return vi.spyOn(timingClock, 'now').mockImplementation(() => {
    t += stepMs;
    return t;
  });
}

function timingLines(): string[] {
  return vi
    .mocked(console.log)
    .mock.calls.map((c) => String(c[0]))
    .filter((l) => l.startsWith('[AutonomousIngestion] url-timing '));
}

beforeEach(() => {
  for (const m of ['log', 'debug', 'warn', 'error'] as const) {
    vi.spyOn(console, m).mockImplementation(() => undefined);
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('urlHostPath (#302)', () => {
  it('keeps host and path and drops the query and fragment', () => {
    expect(urlHostPath('https://food52.com/story/123-soup?token=s3cret&utm=x#respond')).toEqual({
      host: 'food52.com',
      path: '/story/123-soup',
    });
    expect(urlHostPath('not a url?token=s3cret')).toEqual({ host: 'invalid', path: '-' });
  });
});

describe('RunTiming url-timing line (#302)', () => {
  it('logs one self-contained line with host, query-free path, outcome, offset and stages', async () => {
    steppingClock();
    const run = new RunTiming(); // run start: 10
    const result = await run.timeUrl(
      'https://www.example.com/recipes/leek-soup?token=s3cret#x', // url start: 20
      async () => {
        const h = startTier('jina'); // 30
        await timeStage('llmMs', async () => undefined); // 40 -> 50: llm 10
        endTier(h); // 60: jina 30 less 10 llm = 20
        await timeStage('storeMs', async () => undefined); // 70 -> 80: store 10
        noteUrlOutcome('stored');
        return 'done';
      }
    ); // 90: total 70

    expect(result).toBe('done');
    expect(timingLines()).toEqual([
      '[AutonomousIngestion] url-timing host=www.example.com path=/recipes/leek-soup ' +
        'outcome=stored startOffsetMs=10 totalMs=70 firecrawlMs=0 jinaMs=20 tavilyMs=0 ' +
        'llmMs=10 storeMs=10 otherMs=30 tiers=jina',
    ]);
    expect(timingLines()[0]).not.toMatch(/token|s3cret|#x/);
    expect(run.totals()).toMatchObject({ jinaMs: 20, llmMs: 10, storeMs: 10, urlTimed: 1 });
  });

  it('reads abandoned on a deadline cut and still logs when the work throws', async () => {
    steppingClock();
    const run = new RunTiming();
    await expect(
      run.timeUrl('https://www.example.com/a', async () => {
        noteUrlOutcome('stored');
        return DEADLINE_HIT;
      })
    ).resolves.toBe(DEADLINE_HIT);
    await expect(
      run.timeUrl('https://www.example.com/b', async () => {
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');

    expect(timingLines().map((l) => l.match(/path=(\S+) outcome=(\w+)/)?.slice(1))).toEqual([
      ['/a', 'abandoned'],
      ['/b', 'unrecorded'],
    ]);
    expect(timingLines()[0]).toContain('tiers=none');
    expect(run.totals().urlTimed).toBe(2);
  });

  it('outside a URL scope the helpers only call through and read no clock', async () => {
    const now = vi.spyOn(timingClock, 'now');
    expect(currentUrlTimer()).toBeUndefined();
    await expect(timeStage('llmMs', async () => 7)).resolves.toBe(7);
    await expect(
      timeStage('storeMs', async () => {
        throw new Error('db down');
      })
    ).rejects.toThrow('db down');
    endTier(startTier('firecrawl'));
    noteUrlOutcome('stored');
    expect(now).not.toHaveBeenCalled();
  });
});

describe('extractRecipe tier timing (#302)', () => {
  async function extract() {
    vi.stubEnv('FIRECRAWL_API_KEY', 'fc-key');
    vi.stubEnv('JINA_API_KEY', 'jina-key');
    vi.stubEnv('TAVILY_API_KEY', '');
    vi.stubEnv('OPENROUTER_API_KEY', 'or-key');
    vi.mocked(fetchContentWithJina).mockResolvedValue(HUB_MARKDOWN);
    const svc = new RecipeExtractionService();
    const internals = svc as unknown as Record<string, unknown>;
    internals._firecrawl = {
      scrape: async () => {
        throw Object.assign(new Error('Rate limit exceeded'), { status: 429 });
      },
    };
    internals._openrouter = {
      chat: {
        completions: { create: async () => ({ choices: [{ message: { content: '{}' } }] }) },
      },
    };
    const report: ExtractionReport = { attempts: [] };
    const recipe = await svc.extractRecipe('https://www.example.com/soups', report);
    return { recipe, report, stages: currentUrlTimer()?.stages };
  }

  it('times each tier that ran, net of the LLM step, and leaves the result unchanged', async () => {
    const plain = await extract();
    steppingClock();
    const run = new RunTiming(); // 10
    const timed = await run.timeUrl('https://www.example.com/soups', extract); // url start 20

    expect(plain.stages).toBeUndefined();
    expect(timed.recipe).toEqual(plain.recipe);
    expect(timed.report).toEqual(plain.report);
    // Firecrawl: 30 -> 40. Jina: start 50, LLM 60 -> 70, end 80 (30 less 10 LLM).
    expect(timed.stages).toEqual({
      firecrawlMs: 10,
      jinaMs: 20,
      tavilyMs: 0,
      llmMs: 10,
      storeMs: 0,
      tiers: ['firecrawl', 'jina'],
    });
  });
});
