/**
 * #216 regression: the daily cron's Claude structuring step failed with
 * "Unexpected non-whitespace character after JSON" when the model reply held
 * the recipe object followed by more text containing a `}`. A greedy
 * `/\{[\s\S]*\}/` spanned both values and JSON.parse rejected the span.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/costs', () => ({
  trackCost: vi.fn(),
  withChatCostTracking: <T>(client: T) => client,
}));
vi.mock('@/lib/ai/jina-scraper', () => ({ fetchContentWithJina: vi.fn() }));

import { RecipeExtractionService } from '@/lib/services/recipe-extraction.service';

type StructureFn = (content: string, url: string) => Promise<Record<string, unknown> | null>;

/** Runs the private LLM structuring step against a raw model reply string. */
async function structureRaw(replyText: string) {
  const svc = new RecipeExtractionService();
  const fakeClient = {
    chat: {
      completions: {
        create: vi.fn(async () => ({ choices: [{ message: { content: replyText } }] })),
      },
    },
  };
  (svc as unknown as { _openrouter: unknown })._openrouter = fakeClient;
  const fn = (svc as unknown as { structureWithClaude: StructureFn }).structureWithClaude.bind(svc);
  return fn('page text', 'https://example.com/soup');
}

const RECIPE = {
  title: 'Leftover Soup',
  ingredients: ['1 onion', '2 carrots', '1 {cup} stock'],
  instructions: ['Chop it', 'Cook it'],
};

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.stubEnv('OPENROUTER_API_KEY', 'test-key');
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('structureWithClaude reply parsing (#216)', () => {
  it('parses a reply with the recipe object followed by trailing text', async () => {
    const reply = `${JSON.stringify(RECIPE)}\n\nNote: I omitted {optional} garnish fields.`;
    const recipe = await structureRaw(reply);
    expect(errorSpy.mock.calls.flat().join('\n')).toBe('');
    expect(recipe?.title).toBe('Leftover Soup');
    expect(recipe?.ingredients).toEqual(RECIPE.ingredients);
  });

  it('still refuses a reply whose JSON is truncated', async () => {
    const recipe = await structureRaw('{"title": "Leftover Soup", "ingredients": ["1 onion"');
    expect(recipe).toBeNull();
    expect(errorSpy.mock.calls.flat().join('\n')).toContain('Claude structuring failed');
  });
});
