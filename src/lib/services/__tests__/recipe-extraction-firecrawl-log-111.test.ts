/** #111: the Tier1/Firecrawl warn line names the URL (no query), status and cause, never the key. */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/costs', () => ({
  assertWithinDailyCap: vi.fn(),
  trackCost: vi.fn(),
  unitsOrFloor: vi.fn(),
  TAVILY_EXTRACT_FLOOR_URLS: 1,
  withChatCostTracking: <T>(client: T) => client,
}));
vi.mock('@/lib/ai/jina-scraper', () => ({ fetchContentWithJina: vi.fn() }));

import { RecipeExtractionService } from '@/lib/services/recipe-extraction.service';

const KEY = 'fc-secret-key-123';
const URL_WITH_QUERY = 'https://blocked.example.com/recipes/soup?token=abc&utm=1';

async function runWith(scrape: () => Promise<unknown>) {
  const svc = new RecipeExtractionService();
  (svc as unknown as { _firecrawl: unknown })._firecrawl = { scrape };
  const result = await svc.extractRecipe(URL_WITH_QUERY);
  const warn = vi
    .mocked(console.warn)
    .mock.calls.map((c) => String(c[0]))
    .find((l) => l.includes('Tier1/Firecrawl failed'));
  return { result, warn };
}

beforeEach(() => {
  vi.stubEnv('FIRECRAWL_API_KEY', KEY);
  vi.stubEnv('JINA_API_KEY', '');
  vi.stubEnv('TAVILY_API_KEY', '');
  vi.stubEnv('OPENROUTER_API_KEY', '');
  for (const m of ['log', 'debug', 'warn', 'error'] as const) {
    vi.spyOn(console, m).mockImplementation(() => undefined);
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('Tier1/Firecrawl failure log (#111)', () => {
  it('logs host+path, status and the response error; falls through to null', async () => {
    const long = `Insufficient credits ${KEY} ${'x'.repeat(400)}`;
    const { result, warn } = await runWith(async () => ({
      metadata: { statusCode: 403, error: long },
    }));
    expect(result).toBeNull(); // behaviour unchanged: no later tier configured
    expect(warn).toContain('HTTP 403 from Firecrawl');
    expect(warn).toContain('url=blocked.example.com/recipes/soup');
    expect(warn).toContain('status=403');
    expect(warn).toContain('cause="Insufficient credits');
    expect(warn).not.toContain('token=abc');
    expect(warn).not.toContain(KEY);
    expect(warn?.length).toBeLessThan(500);
  });

  it('logs status and code for an SDK error and still returns null', async () => {
    const err = Object.assign(new Error('Unauthorized'), { status: 401, code: 'unauthorized' });
    const { result, warn } = await runWith(async () => {
      throw err;
    });
    expect(result).toBeNull();
    expect(warn).toContain('status=401');
    expect(warn).toContain('cause="unauthorized: Unauthorized"');
    expect(warn).not.toContain(KEY);
  });
});
