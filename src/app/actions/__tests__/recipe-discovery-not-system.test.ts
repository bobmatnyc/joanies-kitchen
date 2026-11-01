/**
 * #259: discovery stores the caller's own recipe. `saveDiscoveredRecipe` is reached only
 * after `requireAuth` and re-checks the session itself, so a stored discovery is never
 * a system recipe and never public. Storing `is_system_recipe: true` (or `is_public: true`)
 * from either entry point makes these tests fail.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  sessionUserId: vi.fn(),
  inserted: [] as Array<Record<string, unknown>>,
}));

vi.mock('@/lib/session-user', () => ({ getSessionUserId: mocks.sessionUserId }));
vi.mock('@/lib/account-deletion/guarded-insert', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/account-deletion/guarded-insert')>()),
  insertUnlessPendingDeletion: vi.fn(async (_table: unknown, values: Record<string, unknown>) => {
    mocks.inserted.push(values);
    return { allowed: true, row: { id: 'recipe_1', ...values } };
  }),
}));
vi.mock('@/lib/rate-limit/refusal', () => ({
  rateLimitRefusal: vi.fn(async () => null),
  paidCallRefusal: vi.fn(() => null),
}));
vi.mock('@/lib/recipes/dedup', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/recipes/dedup')>()),
  findDuplicateRecipe: vi.fn(async () => null),
}));
vi.mock('@/lib/ai/embeddings', () => ({
  generateRecipeEmbedding: vi.fn(async () => null),
}));
vi.mock('@/lib/db/embeddings', () => ({ saveRecipeEmbedding: vi.fn() }));
vi.mock('@/lib/db', () => ({
  db: { query: { recipes: { findFirst: vi.fn(async () => ({ id: 'recipe_1' })) } } },
}));
vi.mock('@/lib/recipe-discovery-steps', () => ({
  discoverRecipeUrls: vi.fn(async () => [{ url: 'https://example.com/a', title: 'A' }]),
  extractAndValidateRecipe: vi.fn(async () => ({
    success: true,
    confidenceScore: 0.9,
    recipe: {
      name: 'Soup',
      description: 'Warm',
      ingredients: ['water'],
      instructions: ['boil'],
      isValid: true,
      confidenceScore: 0.9,
    },
  })),
  generateRecipeMetadata: vi.fn(async () => ({
    cuisine: 'any',
    tags: [],
    difficulty: 'easy',
    dietaryInfo: [],
  })),
}));

import { discoverRecipeFromUrl, discoverRecipes } from '@/app/actions/recipe-discovery';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.inserted.length = 0;
  mocks.sessionUserId.mockResolvedValue('user_1');
});

describe('discovery stores the caller own, private, non-system recipe', () => {
  it('discoverRecipeFromUrl', async () => {
    await discoverRecipeFromUrl('https://example.com/a');
    expect(mocks.inserted).toHaveLength(1);
    expect(mocks.inserted[0]).toMatchObject({
      user_id: 'user_1',
      is_system_recipe: false,
      is_public: false,
    });
  });

  it('discoverRecipes', async () => {
    await discoverRecipes('soup', { maxResults: 1 });
    expect(mocks.inserted).toHaveLength(1);
    expect(mocks.inserted[0]).toMatchObject({
      user_id: 'user_1',
      is_system_recipe: false,
      is_public: false,
    });
  });

  it('a signed-out caller is refused and nothing is stored', async () => {
    mocks.sessionUserId.mockResolvedValue(null);
    await expect(discoverRecipeFromUrl('https://example.com/a')).rejects.toThrow(
      /Authentication required/
    );
    await expect(discoverRecipes('soup')).rejects.toThrow(/Authentication required/);
    expect(mocks.inserted).toHaveLength(0);
  });
});
