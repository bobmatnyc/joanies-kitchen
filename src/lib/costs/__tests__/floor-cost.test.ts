/**
 * #77: a paid call with missing or zero usage books a floor cost, never $0.
 * Each test drives a real call site against a mocked provider and reads the
 * ledger row that would be inserted.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { insertedRows, crawlStatus } = vi.hoisted(() => ({
  insertedRows: [] as Record<string, unknown>[],
  crawlStatus: { value: {} as Record<string, unknown> },
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/costs/daily-cap', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/costs/daily-cap')>()),
  assertWithinDailyCap: vi.fn(async () => 0),
}));
vi.mock('@/lib/db', () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(async (row: Record<string, unknown>) => {
        insertedRows.push(row);
      }),
    })),
  },
}));
vi.mock('@/lib/db/autonomous-scraper-schema', () => ({ crawlCostEvents: {} }));
vi.mock('@mendable/firecrawl-js', () => ({
  default: class {
    crawl = vi.fn(async () => ({ id: 'job-1' }));
    getCrawlStatus = vi.fn(async () => crawlStatus.value);
  },
}));

import {
  COST_RATES,
  computeLlmCost,
  FIRECRAWL_CRAWL_FLOOR_CREDITS,
  JINA_READER_FLOOR_TOKENS,
  LEDGER_USD_RESOLUTION,
  LLM_FLOOR_COMPLETION_TOKENS,
  LLM_FLOOR_PROMPT_TOKENS,
  TAVILY_EXTRACT_FLOOR_URLS,
  trackLlmResponse,
} from '..';

function mockFetchJson(body: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }))
  );
}

function bookedUsd(): number {
  expect(insertedRows).toHaveLength(1);
  return Number(insertedRows[0].usd);
}

beforeEach(() => {
  insertedRows.length = 0;
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('#77 floor cost for missing or zero usage', () => {
  it('LLM response with no usage books the model floor', async () => {
    const model = 'google/gemini-3.1-flash-lite';
    await trackLlmResponse('openrouter', { choices: [] }, { model });
    const floor = computeLlmCost(model, LLM_FLOOR_PROMPT_TOKENS, LLM_FLOOR_COMPLETION_TOKENS);
    expect(floor).toBeGreaterThan(LEDGER_USD_RESOLUTION);
    expect(bookedUsd()).toBeCloseTo(floor ?? 0, 6);
  });

  it('LLM response with real usage is booked exactly as before', async () => {
    const model = 'google/gemini-3.1-flash-lite';
    await trackLlmResponse(
      'openrouter',
      { usage: { prompt_tokens: 200, completion_tokens: 100 } },
      { model }
    );
    expect(insertedRows[0]).toMatchObject({
      units: '300',
      usd: (computeLlmCost(model, 200, 100) ?? 0).toFixed(6),
    });
  });

  it('Jina reader with empty content books the floor cost', async () => {
    vi.stubEnv('JINA_API_KEY', 'test-key');
    vi.resetModules();
    const { scrapeWithJina } = await import('@/lib/ai/jina-scraper');
    mockFetchJson({ code: 200, data: { content: '' } });
    await scrapeWithJina('https://example.com/r');
    const floor = JINA_READER_FLOOR_TOKENS * (COST_RATES['jina:reader']?.usdPerUnit ?? 0);
    expect(bookedUsd()).toBeCloseTo(floor, 6);
  });

  it('Jina reader with short content never rounds to $0', async () => {
    vi.stubEnv('JINA_API_KEY', 'test-key');
    vi.resetModules();
    const { scrapeWithJina } = await import('@/lib/ai/jina-scraper');
    mockFetchJson({ code: 200, data: { content: 'short page' } });
    await scrapeWithJina('https://example.com/r');
    expect(bookedUsd()).toBeGreaterThanOrEqual(LEDGER_USD_RESOLUTION);
  });

  it('Firecrawl crawl with no creditsUsed and no pages books one credit', async () => {
    vi.stubEnv('FIRECRAWL_API_KEY', 'test-key');
    crawlStatus.value = { status: 'completed', data: [] };
    const { crawlChefRecipes } = await import('@/lib/firecrawl');
    await crawlChefRecipes({ baseUrl: 'https://example.com' });
    const floor = FIRECRAWL_CRAWL_FLOOR_CREDITS * (COST_RATES['firecrawl:crawl']?.usdPerUnit ?? 0);
    expect(bookedUsd()).toBeCloseTo(floor, 6);
  });

  it('Tavily extract with nothing extracted books one URL', async () => {
    const { RecipeExtractionService } = await import('@/lib/services/recipe-extraction.service');
    const service = new RecipeExtractionService() as unknown as {
      fetchWithTavilyExtract(url: string): Promise<string | null>;
    };
    mockFetchJson({ results: [], failed_results: [] });
    await service.fetchWithTavilyExtract('https://example.com/r');
    const floor =
      TAVILY_EXTRACT_FLOOR_URLS * (COST_RATES['tavily:extract.advanced']?.usdPerUnit ?? 0);
    expect(bookedUsd()).toBeCloseTo(floor, 6);
  });
});
