// @vitest-environment node
/**
 * #96 D57: semantic search and "Recipes Like This" use the calibrated
 * bge-small cutoffs from `@/lib/search/similarity-cutoffs`.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const A = 'aaaaaaaa-0000-4000-8000-00000000000a';
const B = 'bbbbbbbb-0000-4000-8000-00000000000b';
const C = 'cccccccc-0000-4000-8000-00000000000c';
const D = 'dddddddd-0000-4000-8000-00000000000d';

const state = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock('@/lib/auth', () => ({ auth: async () => ({ userId: null, sessionClaims: null }) }));
vi.mock('@/lib/auth-users', () => ({ getUserAdminFlag: async () => false }));
vi.mock('@/lib/db', () => ({
  get db() {
    return state.db;
  },
}));
vi.mock('@/lib/rate-limit', () => ({ enforceRateLimit: async () => ({ allowed: true }) }));
vi.mock('@/lib/ai/embeddings', () => ({
  generateQueryEmbedding: async () => [0.1, 0.2],
  generateRecipeEmbedding: vi.fn(),
}));
vi.mock('@/lib/db/embeddings', () => ({
  findSimilarRecipes: vi.fn(async () => []),
  getRecipeEmbedding: async () => ({ embedding: [0.1, 0.2] }),
}));

import { getSmartMealSuggestions } from '@/app/actions/meal-suggestions';
import { findSimilarToRecipe, semanticSearchRecipes } from '@/app/actions/semantic-search';
import { searchCaches } from '@/lib/cache';
import { findSimilarRecipes } from '@/lib/db/embeddings';
import * as schema from '@/lib/db/schema';
import {
  RECIPE_SIMILAR_MIN_SIMILARITY,
  SEARCH_MIN_SIMILARITY,
} from '@/lib/search/similarity-cutoffs';
import { createVisibilityDb } from './recipe-visibility-db';

function row(id: string) {
  return {
    id,
    user_id: 'user_other',
    name: `Recipe ${id.slice(0, 1)}`,
    ingredients: '[]',
    instructions: '[]',
    tags: '["main"]', // getSmartMealSuggestions drops recipes it cannot assign a course
    is_public: true,
    is_system_recipe: false,
    moderation_status: 'approved' as const,
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
  };
}

/** The vector search returns these scores, as pgvector would above its SQL floor. */
function vectorScores(scores: Array<[string, number]>) {
  vi.mocked(findSimilarRecipes).mockResolvedValue(
    scores.map(([recipe_id, similarity]) => ({ recipe_id, similarity })) as never
  );
}

const similarities = (recipes: Array<{ id: string; similarity: number }>) =>
  Object.fromEntries(recipes.map((r) => [r.id, r.similarity]));

beforeAll(async () => {
  const made = await createVisibilityDb([schema.recipes], schema);
  state.db = made.db;
  await made.db.insert(schema.recipes).values([row(A), row(B), row(C), row(D)]);
});

beforeEach(() => {
  searchCaches.semantic.clear();
  searchCaches.similar.clear();
  vi.mocked(findSimilarRecipes).mockClear();
});

describe('#96 D57 semantic search cutoffs', () => {
  it('a nonsense-like score set returns no results, not an error', async () => {
    vectorScores([
      [A, 0.62],
      [B, 0.6],
      [C, 0.58],
      [D, 0.55],
    ]);
    const result = await semanticSearchRecipes('purple monkey dishwasher');
    expect(result).toMatchObject({ success: true, recipes: [] });
  });

  it('defaults the SQL floor to SEARCH_MIN_SIMILARITY and trims below top1 - 0.10', async () => {
    vectorScores([
      [A, 0.84],
      [B, 0.78],
      [C, 0.73],
      [D, 0.7],
    ]);
    const result = await semanticSearchRecipes('braised short ribs');
    expect(vi.mocked(findSimilarRecipes).mock.calls[0][2]).toBe(SEARCH_MIN_SIMILARITY);
    expect(similarities(result.recipes)).toEqual({ [A]: 0.84, [B]: 0.78 });
  });

  it('an explicit minSimilarity of 0 is the only cutoff: all three scores kept', async () => {
    vectorScores([
      [A, 0.4],
      [B, 0.35],
      [C, 0.2],
    ]);
    const result = await semanticSearchRecipes('anything', { minSimilarity: 0 });
    expect(vi.mocked(findSimilarRecipes).mock.calls[0][2]).toBe(0);
    expect(similarities(result.recipes)).toEqual({ [A]: 0.4, [B]: 0.35, [C]: 0.2 });
  });

  it('an explicit minSimilarity of 0.5 keeps every score >= 0.5 with no delta trim', async () => {
    // pgvector would drop D (0.45) in SQL; the mock returns it to show the floor still applies.
    vectorScores([
      [A, 0.88],
      [B, 0.7],
      [C, 0.5],
      [D, 0.45],
    ]);
    const result = await semanticSearchRecipes('braised short ribs', { minSimilarity: 0.5 });
    expect(vi.mocked(findSimilarRecipes).mock.calls[0][2]).toBe(0.5);
    expect(similarities(result.recipes)).toEqual({ [A]: 0.88, [B]: 0.7, [C]: 0.5 });
  });
});

describe('#96 D57 default callers get floor + delta', () => {
  it('getSmartMealSuggestions omits minSimilarity, so the top1 - 0.10 trim applies', async () => {
    vectorScores([
      [A, 0.84],
      [B, 0.78],
      [C, 0.73],
      [D, 0.7],
    ]);
    const result = await getSmartMealSuggestions({ description: 'cozy winter dinner', limit: 4 });
    expect(result.success).toBe(true);
    for (const call of vi.mocked(findSimilarRecipes).mock.calls) {
      expect(call[2]).toBe(SEARCH_MIN_SIMILARITY);
    }
    const courses = Object.values(result.suggestions ?? {}) as Array<Array<{ id: string }>>;
    const ids = new Set(courses.flatMap((course) => course.map((r) => r.id)));
    expect([...ids].sort()).toEqual([A, B]);
  });
});

describe('#96 D57 findSimilarToRecipe cutoff', () => {
  it('passes RECIPE_SIMILAR_MIN_SIMILARITY (0.72) to the vector search', async () => {
    vectorScores([]);
    const result = await findSimilarToRecipe(A, 6);
    expect(vi.mocked(findSimilarRecipes).mock.calls[0][2]).toBe(RECIPE_SIMILAR_MIN_SIMILARITY);
    expect(RECIPE_SIMILAR_MIN_SIMILARITY).toBe(0.72);
    // 0 neighbours is a clean empty success; SimilarRecipesWidget renders nothing for it.
    expect(result).toMatchObject({ success: true, recipes: [] });
  });
});
