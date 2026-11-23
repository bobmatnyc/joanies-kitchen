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
  shortReason,
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

describe('#318 shortReason', () => {
  const throwingToString = {
    toString(): string {
      throw new Error('boom');
    },
  };
  const badMessage = Object.assign(new Error('x'), { message: 42 as unknown as string });

  it.each([
    ['a null-prototype object', Object.create(null)],
    ['an object whose toString throws', throwingToString],
    ['an Error with a non-string message', badMessage],
  ])('returns a placeholder, not a throw, for %s', (_name, reason) => {
    expect(shortReason(reason)).toBe('<unprintable>');
  });

  it.each([
    ['Bearer', 'auth failed: Bearer abc123SECRETxyz', 'abc123SECRETxyz', 'Bearer <token>'],
    ['JWT', 'bad jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl', 'eyJhbGci', '<jwt>'],
    ['token=', 'denied token=s3cr3tvalue&x=1', 's3cr3tvalue', 'token=<redacted>'],
    ['apikey=', 'denied apikey=s3cr3tvalue', 's3cr3tvalue', 'apikey=<redacted>'],
  ])('masks a %s value', (_name, input, secret, mask) => {
    const out = shortReason(input);
    expect(out).not.toContain(secret);
    expect(out).toContain(mask);
  });

  it('masks before truncating, so a cut secret never leaks', () => {
    const out = shortReason(`${'a'.repeat(50)} Bearer ${'S'.repeat(40)}`);
    expect(out).not.toMatch(/S{3}/);
  });

  it('logs a line, not a throw, when a tier fails with an unprintable reason', async () => {
    vi.stubEnv('FIRECRAWL_API_KEY', 'fc-key');
    vi.stubEnv('JINA_API_KEY', '');
    vi.stubEnv('TAVILY_API_KEY', '');
    vi.stubEnv('OPENROUTER_API_KEY', '');
    const errors: string[] = [];
    vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => {
      errors.push(a.map(String).join(' '));
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    const svc = new RecipeExtractionService();
    (svc as unknown as Record<string, unknown>)._firecrawl = {
      scrape: async () => {
        throw Object.create(null);
      },
    };
    await expect(svc.extractRecipe(URL_)).resolves.toBeNull();
    const line = errors.find((e) => e.includes('All available extraction tiers failed'));
    expect(line).toContain('tiers=[firecrawl:error(<unprintable>)]');
  });
});
