// @vitest-environment node
/**
 * #103: a soft-deleted recipe (`deleted_at` set) is public to no one on the
 * shared public surfaces — semantic search, the sitemap and ingredient
 * search. Covers both ways a recipe gets `deleted_at`: a pending account
 * deletion (`markAccountDeleted`) and an admin removal (#110).
 */

import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const OWNER = 'user_leaving';
const OTHER = 'user_staying';
const MINE = 'mine-public';
const REMOVED = 'admin-removed-system';
const KEPT = 'other-public';
const ING = '77777777-7777-4777-8777-777777777777';

const state = vi.hoisted(() => ({ db: undefined as unknown, ids: [] as string[] }));

vi.mock('@/lib/auth', () => ({ auth: async () => ({ userId: null, sessionClaims: null }) }));
vi.mock('@/lib/auth-users', () => ({ getUserAdminFlag: async () => false }));
vi.mock('@/lib/db', () => ({
  get db() {
    return state.db;
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({ enforceRateLimit: async () => ({ allowed: true }) }));
vi.mock('@/lib/ai/embeddings', () => ({
  generateEmbedding: async () => [0.1, 0.2],
  generateRecipeEmbedding: vi.fn(),
}));
// Vector search ignores visibility; it returns every seeded id, as a real index would.
vi.mock('@/lib/db/embeddings', () => ({
  findSimilarRecipes: async () => state.ids.map((recipe_id) => ({ recipe_id, similarity: 0.9 })),
  getRecipeEmbedding: async () => null,
}));

import { searchRecipesByIngredients } from '@/app/actions/ingredient-search';
import { semanticSearchRecipes } from '@/app/actions/semantic-search';
import sitemap from '@/app/sitemap';
import { markAccountDeleted } from '@/lib/account-deletion';
import { searchCaches } from '@/lib/cache';
import { users } from '@/lib/db/auth-schema';
import { ingredients, recipeIngredients } from '@/lib/db/ingredients-schema';
import * as schema from '@/lib/db/schema';
import { userProfiles } from '@/lib/db/user-discovery-schema';
import { createVisibilityDb } from './recipe-visibility-db';

let client: PGlite;

type TestDb = Awaited<ReturnType<typeof createVisibilityDb>>['db'] & {
  batch?: (queries: PromiseLike<unknown>[]) => Promise<unknown[]>;
};

function row(id: string, over: Record<string, unknown>) {
  return {
    id,
    user_id: OTHER,
    name: id,
    slug: id,
    ingredients: '[]',
    instructions: '[]',
    is_public: true,
    is_system_recipe: false,
    moderation_status: 'approved' as const,
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
    ...over,
  };
}

beforeAll(async () => {
  const made = await createVisibilityDb(
    [users, userProfiles, schema.recipes, ingredients, recipeIngredients],
    { ...schema, users, userProfiles, ingredients, recipeIngredients }
  );
  client = made.client;
  const db: TestDb = made.db;
  // neon-http's db.batch is one HTTP transaction; mirror that on PGlite.
  db.batch = async (queries) => {
    await client.exec('BEGIN');
    try {
      const out: unknown[] = [];
      for (const q of queries) out.push(await q);
      await client.exec('COMMIT');
      return out;
    } catch (error) {
      await client.exec('ROLLBACK');
      throw error;
    }
  };
  state.db = db;
});

beforeEach(async () => {
  searchCaches.semantic.clear();
  searchCaches.ingredient.clear();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  for (const t of ['users', 'user_profiles', 'recipes', 'ingredients', 'recipe_ingredients']) {
    await client.exec(`DELETE FROM "${t}";`);
  }
  const db = state.db as TestDb;
  await db.insert(users).values([
    { id: OWNER, email: 'leaving@example.test', is_admin: false },
    { id: OTHER, email: 'staying@example.test', is_admin: false },
  ]);
  await db.insert(schema.recipes).values([
    row(MINE, { user_id: OWNER }),
    row(REMOVED, {
      user_id: 'system',
      is_public: true,
      is_system_recipe: true,
      deleted_at: new Date('2026-02-01T00:00:00Z'),
      deleted_by: 'user_admin',
    }),
    row(KEPT, {}),
  ]);
  state.ids = [MINE, REMOVED, KEPT];
  await db
    .insert(ingredients)
    .values({ id: ING, name: 'salt', display_name: 'Salt', slug: 'salt' });
  await db.insert(recipeIngredients).values(
    state.ids.map((recipe_id, i) => ({
      id: `88888888-8888-4888-8888-88888888888${i}`,
      recipe_id,
      ingredient_id: ING,
    }))
  );
  await markAccountDeleted(OWNER, false, new Date());
});

describe('soft-deleted recipes on anonymous public surfaces', () => {
  it('semantic search returns neither a pending-deletion nor an admin-removed recipe', async () => {
    const result = await semanticSearchRecipes('salty');
    expect(result.success).toBe(true);
    expect(result.recipes.map((r) => r.id)).toEqual([KEPT]);
  });

  it('the sitemap lists neither', async () => {
    const seeded = new Set(state.ids.map((id) => `https://joanies.kitchen/recipes/${id}`));
    const urls = (await sitemap()).map((e) => e.url).filter((u) => seeded.has(u));
    expect(urls).toEqual([`https://joanies.kitchen/recipes/${KEPT}`]);
  });

  it('ingredient search returns neither', async () => {
    const result = await searchRecipesByIngredients(['salt'], { matchMode: 'any' });
    expect(result.success).toBe(true);
    expect(result.recipes.map((r) => r.id)).toEqual([KEPT]);
  });
});
