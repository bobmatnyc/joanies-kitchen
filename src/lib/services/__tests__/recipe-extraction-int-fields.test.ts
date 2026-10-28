/**
 * #12 regression: the LLM structuring path returned `servings: "4 to 6"`
 * unchecked, and the daily-cron INSERT failed with Postgres 22P02. The
 * ScrapedRecipe it returns must carry integers (or undefined) only.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/costs', () => ({
  trackCost: vi.fn(),
  withChatCostTracking: <T>(client: T) => client,
}));
vi.mock('@/lib/ai/jina-scraper', () => ({ fetchContentWithJina: vi.fn() }));

import { RecipeExtractionService } from '@/lib/services/recipe-extraction.service';

type StructureFn = (content: string, url: string) => Promise<Record<string, unknown> | null>;

/** Runs the private LLM structuring step against a canned model reply. */
async function structure(reply: Record<string, unknown>) {
  const svc = new RecipeExtractionService();
  const fakeClient = {
    chat: {
      completions: {
        create: vi.fn(async () => ({
          choices: [{ message: { content: JSON.stringify(reply) } }],
        })),
      },
    },
  };
  (svc as unknown as { _openrouter: unknown })._openrouter = fakeClient;
  const fn = (svc as unknown as { structureWithClaude: StructureFn }).structureWithClaude.bind(svc);
  return fn('page text', 'https://example.com/soup');
}

const BASE = {
  title: 'Leftover Soup',
  ingredients: ['1 onion'],
  instructions: ['Cook it'],
};

beforeEach(() => {
  vi.stubEnv('OPENROUTER_API_KEY', 'test-key');
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('structureWithClaude integer fields (#12)', () => {
  it('coerces servings "4 to 6" to 4', async () => {
    const recipe = await structure({ ...BASE, servings: '4 to 6' });
    expect(recipe?.servings).toBe(4);
  });

  it('coerces string times and drops non-numeric ones', async () => {
    const recipe = await structure({
      ...BASE,
      prep_time: '15 minutes',
      cook_time: 'until done',
      servings: 'a crowd',
    });
    expect(recipe?.prep_time).toBe(15);
    expect(recipe?.cook_time).toBeUndefined();
    expect(recipe?.servings).toBeUndefined();
  });
});
