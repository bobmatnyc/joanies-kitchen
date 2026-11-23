/**
 * #318: when every tier fails, one error line names each tier's result kind,
 * with a short reason for errors, and carries no page content or secrets.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

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
import {
  type ExtractionReport,
  RecipeExtractionService,
} from '@/lib/services/recipe-extraction.service';

const URL_ = 'https://www.example-kitchen.com/recipes/soup';
const PAGE_MARKER = 'Notes about leeks.';
const PARTIAL_RECIPE_MARKDOWN = `# Leek soup\n\n## Ingredients\n- 2 leeks\n\n${`${PAGE_MARKER} `.repeat(20)}`;
const SECRET = 'fc-supersecretkey123456';
const PARTIAL_LLM_REPLY = {
  isRecipe: true,
  title: 'Leek soup',
  ingredients: ['2 leeks'],
  instructions: [],
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('#318 all-tiers-failed log line', () => {
  it('lists each tier as tier:kind(reason) on one line', async () => {
    vi.stubEnv('FIRECRAWL_API_KEY', 'fc-key');
    vi.stubEnv('JINA_API_KEY', 'jina-key');
    vi.stubEnv('TAVILY_API_KEY', '');
    vi.stubEnv('OPENROUTER_API_KEY', 'or-key');
    vi.mocked(fetchContentWithJina).mockResolvedValue(PARTIAL_RECIPE_MARKDOWN);
    const errors: string[] = [];
    vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => {
      errors.push(a.map(String).join(' '));
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});

    const svc = new RecipeExtractionService();
    const internals = svc as unknown as Record<string, unknown>;
    internals._firecrawl = {
      scrape: async () => {
        throw new Error(
          `Rate limit exceeded at https://api.firecrawl.dev/v1/scrape?key=${SECRET} ${'x'.repeat(200)}`
        );
      },
    };
    internals._openrouter = {
      chat: {
        completions: {
          create: async () => ({
            choices: [{ message: { content: JSON.stringify(PARTIAL_LLM_REPLY) } }],
          }),
        },
      },
    };

    const report: ExtractionReport = { attempts: [] };
    const recipe = await svc.extractRecipe(URL_, report);

    expect(recipe).toBeNull();
    expect(report.attempts.map((a) => a.tier)).toEqual(['firecrawl', 'jina']);
    const line = errors.find((e) => e.includes('All available extraction tiers failed'));
    expect(line).toBeDefined();
    expect(line).not.toContain('\n');
    expect(line).toMatch(/tiers=\[firecrawl:error\(Rate limit exceeded at <url> x+\.\.\.\) jina:\w+\]/);
    const jinaKind = report.attempts[1].result;
    expect(line).toContain(`jina:${jinaKind}`);
    expect(line).not.toContain(SECRET);
    expect(line).not.toContain(PAGE_MARKER);
    expect(line!.length).toBeLessThan(300);
  });
});
