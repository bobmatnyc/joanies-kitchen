/**
 * #12 regression: `discoverRecipeFromUrl` saved `servings: recipe.servings || null`
 * straight from unvalidated LLM JSON, so "4 to 6" hit Postgres 22P02. The
 * INSERT must now receive integers or null.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  llmCreate: vi.fn(),
  insertValues: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ auth: async () => ({ userId: 'user_1' }) }));
// The limiter has its own PGlite tests (paid-paths-rate-limit); allow every call here.
vi.mock('@/lib/rate-limit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rate-limit')>()),
  enforceRateLimit: vi.fn(async () => ({ allowed: true, count: 1, limit: 30 })),
}));
vi.mock('@/lib/brave-search', () => ({ searchRecipes: vi.fn() }));
vi.mock('@/lib/ai/openrouter-server', () => ({
  getOpenRouterClient: () => ({ chat: { completions: { create: mocks.llmCreate } } }),
  MODELS: { CLAUDE_3_HAIKU: 'anthropic/claude-3-haiku' },
}));
vi.mock('@/lib/ai/embeddings', () => ({
  generateRecipeEmbedding: async () => {
    throw new Error('no embeddings in test');
  },
}));
vi.mock('@/lib/db/embeddings', () => ({ saveRecipeEmbedding: vi.fn() }));
// #135: the duplicate query has its own PGlite test (recipe-discovery-dedup); nothing is a duplicate here.
vi.mock('@/lib/recipes/dedup', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/recipes/dedup')>()),
  findDuplicateRecipe: async () => null,
}));
vi.mock('@/lib/db', () => ({
  db: {
    insert: () => ({
      values: (row: Record<string, unknown>) => {
        mocks.insertValues(row);
        return { returning: async () => [{ id: 'recipe_1' }] };
      },
    }),
    query: { recipes: { findFirst: async () => ({ id: 'recipe_1' }) } },
  },
}));

import { discoverRecipeFromUrl } from '@/app/actions/recipe-discovery';

function llmReply(body: Record<string, unknown>) {
  return { choices: [{ message: { content: JSON.stringify(body) } }] };
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () => new Response(`<html><body>${'Leftover soup recipe. '.repeat(20)}</body></html>`)
    )
  );
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  mocks.llmCreate.mockReset();
  mocks.insertValues.mockReset();
});

/** Runs the action against one canned extraction reply; returns the INSERT row. */
async function insertedRow(fields: Record<string, unknown>) {
  mocks.llmCreate
    .mockResolvedValueOnce(
      llmReply({
        name: 'Leftover Soup',
        description: 'Soup',
        ingredients: ['1 onion'],
        instructions: ['Cook it'],
        confidenceScore: 0.9,
        isValid: true,
        ...fields,
      })
    )
    .mockResolvedValueOnce(llmReply({ cuisine: 'American', tags: [], difficulty: 'easy' }));

  const result = await discoverRecipeFromUrl('https://example.com/soup');

  expect(result.success).toBe(true);
  expect(mocks.insertValues).toHaveBeenCalledTimes(1);
  return mocks.insertValues.mock.calls[0][0];
}

describe('discoverRecipeFromUrl integer fields (#12)', () => {
  it('writes servings "4 to 6" as 4', async () => {
    const row = await insertedRow({
      prepTime: '15 minutes',
      cookTime: '30 minutes',
      servings: '4 to 6',
    });
    expect(row.servings).toBe(4);
    expect(row.prep_time).toBe(15);
    expect(row.cook_time).toBe(30);
  });

  it('accepts bare-number times from the LLM', async () => {
    const row = await insertedRow({ prepTime: 15, cookTime: 30, servings: 4 });
    expect(row.prep_time).toBe(15);
    expect(row.cook_time).toBe(30);
    expect(row.servings).toBe(4);
  });
});
