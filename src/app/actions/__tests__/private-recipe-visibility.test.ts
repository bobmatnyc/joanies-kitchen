// @vitest-environment node
/**
 * #32: a private recipe reaches only its owner and an admin.
 *
 * Every read path fixed under #32 runs against real Postgres (PGlite) with
 * one private recipe P owned by OWNER. Per path and caller:
 * - anonymous / other user: the result never contains P, and equals the
 *   result after P is deleted (the "nonexistent recipe" answer);
 * - owner / admin: the result contains P.
 */

import type { PGlite } from '@electric-sql/pglite';
import { and, inArray, type SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const OWNER = 'user_owner';
const OTHER = 'user_other';
const ADMIN = 'user_admin';
// UUIDs: getOriginalRecipe parses the fork source with a hex-only pattern.
const P = 'aaaaaaaa-0000-4000-8000-00000000000a';
const Q = 'bbbbbbbb-0000-4000-8000-00000000000b';
const R = 'cccccccc-0000-4000-8000-00000000000c';
const FORK = 'dddddddd-0000-4000-8000-00000000000d';
const INGREDIENT = '22222222-2222-4222-8222-222222222222';
const TOOL = '33333333-3333-4333-8333-333333333333';
const SECRET = 'Secret Stew';

const state = vi.hoisted(() => ({
  db: undefined as unknown,
  auth: undefined as unknown as ReturnType<typeof vi.fn>,
  embeddingStored: true,
}));

// #57: these tests cover other behaviour; the daily-cap guard has its own PGlite tests.
vi.mock('@/lib/costs/daily-cap', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/costs/daily-cap')>()),
  assertWithinDailyCap: vi.fn(async () => 0),
}));
// #17: the limiter has its own PGlite tests; allow every call here.
vi.mock('@/lib/rate-limit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rate-limit')>()),
  enforceRateLimit: vi.fn(async () => ({ allowed: true, count: 1, limit: 30 })),
}));
vi.mock('@/lib/auth', () => {
  state.auth = vi.fn();
  return { auth: (...args: unknown[]) => state.auth(...args) };
});
// #22: admin is read from users.is_admin; here only ADMIN carries the flag.
vi.mock('@/lib/auth-users', () => ({
  getUserAdminFlag: async (userId: string) => userId === ADMIN,
}));
vi.mock('@/lib/db', () => ({
  get db() {
    return state.db;
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock('@/app/actions/favorites', () => ({ addFavorite: vi.fn(async () => ({ success: true })) }));
vi.mock('@/lib/ai/meal-recommendations', () => ({
  generateMealRecommendations: vi.fn(async (recipe: { name: string }) => ({
    basedOn: recipe.name,
  })),
}));
vi.mock('@/lib/ai/embeddings', () => ({
  generateEmbedding: vi.fn(async () => [0.1, 0.2]),
  generateQueryEmbedding: vi.fn(async () => [0.1, 0.2]), // #96 D57
  generateRecipeEmbedding: vi.fn(async () => ({
    embedding: [0.1, 0.2],
    embeddingText: 'text',
    modelName: 'test-model',
  })),
}));
vi.mock('@/lib/db/embeddings', () => ({
  getRecipeEmbedding: vi.fn(async () => (state.embeddingStored ? { embedding: [0.1, 0.2] } : null)),
  saveRecipeEmbedding: vi.fn(async () => undefined),
  // Vector search knows nothing of visibility: it returns every candidate.
  findSimilarRecipes: vi.fn(async () => [
    { recipe_id: P, similarity: 0.95 },
    { recipe_id: Q, similarity: 0.9 },
    { recipe_id: R, similarity: 0.85 },
  ]),
}));

import { getRecipesUsingIngredient } from '@/app/actions/ingredients';
import { getRecipeRecommendations } from '@/app/actions/meals';
import * as cloning from '@/app/actions/recipe-cloning';
import { getRecipesPaginated } from '@/app/actions/recipes';
import { findSimilarToRecipe } from '@/app/actions/semantic-search';
import * as social from '@/app/actions/social';
import { getToolBySlug } from '@/app/actions/tools';
import { GET as paginatedGET } from '@/app/api/recipes/paginated/route';
import { searchCaches } from '@/lib/cache';
import { findSimilarRecipes } from '@/lib/db/embeddings';
import { recipeIngredients } from '@/lib/db/ingredients-schema';
import * as schema from '@/lib/db/schema';
import { enforceRateLimit } from '@/lib/rate-limit';
import { ANONYMOUS_VIEWER, recipeVisibilityCondition } from '@/lib/recipe-visibility';
import { ingredientService } from '@/lib/services/ingredient-service';
import { createVisibilityDb } from './recipe-visibility-db';

type Role = 'anonymous' | 'otherUser' | 'owner' | 'admin';
const ROLES: Role[] = ['anonymous', 'otherUser', 'owner', 'admin'];
const USER_OF: Record<Role, string | null> = {
  anonymous: null,
  otherUser: OTHER,
  owner: OWNER,
  admin: ADMIN,
};
const ALLOWED: Record<Role, boolean> = {
  anonymous: false,
  otherUser: false,
  owner: true,
  admin: true,
};

function signInAs(role: Role) {
  const userId = USER_OF[role];
  state.auth.mockResolvedValue(
    userId
      ? {
          userId,
          sessionClaims: { metadata: { isAdmin: role === 'admin' ? 'true' : 'false' } },
        }
      : { userId: null, sessionClaims: null }
  );
}

let client: PGlite;

function recipeRow(id: string, userId: string, isPublic: boolean, name: string, source?: string) {
  return {
    id,
    user_id: userId,
    name,
    description: `${name} description`,
    ingredients: '[]',
    instructions: '[]',
    is_public: isPublic,
    is_system_recipe: false,
    source: source ?? null,
    fork_count: 0,
    like_count: 0,
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
  };
}

async function seed() {
  const db = state.db as any;
  for (const table of ['recipes', 'recipe_forks', 'recipe_ingredients', 'tools', 'recipe_tools']) {
    await client.exec(`DELETE FROM "${table}";`);
  }
  await db.insert(schema.recipes).values([
    // P is a private fork of Q, owned by OWNER.
    recipeRow(P, OWNER, false, SECRET, `Forked from recipe ID: ${Q}`),
    recipeRow(Q, OTHER, true, 'Open Soup'),
    recipeRow(R, OTHER, true, 'Open Salad'),
    // FORK is a public fork of P.
    recipeRow(FORK, OTHER, true, 'Fork of stew', `Forked from recipe ID: ${P}`),
  ]);
  await db.insert(schema.recipeForks).values({
    id: '44444444-4444-4444-8444-444444444444',
    recipe_id: FORK,
    original_recipe_id: P,
    user_id: OTHER,
    created_at: new Date('2026-01-02T00:00:00Z'),
  });
  await db.insert(recipeIngredients).values([
    { id: '55555555-5555-4555-8555-555555555551', recipe_id: P, ingredient_id: INGREDIENT },
    { id: '55555555-5555-4555-8555-555555555552', recipe_id: Q, ingredient_id: INGREDIENT },
  ]);
  await db.insert(schema.tools).values({
    id: TOOL,
    name: 'whisk',
    display_name: 'Whisk',
    category: 'utensil',
    slug: 'whisk',
    is_essential: false,
    is_specialized: false,
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
  });
  await db.insert(schema.recipeTools).values([
    { id: '66666666-6666-4666-8666-666666666661', recipe_id: P, tool_id: TOOL },
    { id: '66666666-6666-4666-8666-666666666662', recipe_id: Q, tool_id: TOOL },
  ]);
}

/** Removes P the way a cascade delete would: the "nonexistent recipe" state. */
async function deletePrivateRecipe() {
  await client.exec(`
    DELETE FROM "recipes" WHERE id = '${P}';
    DELETE FROM "recipe_forks" WHERE original_recipe_id = '${P}' OR recipe_id = '${P}';
    DELETE FROM "recipe_ingredients" WHERE recipe_id = '${P}';
    DELETE FROM "recipe_tools" WHERE recipe_id = '${P}';
  `);
  searchCaches.similar.clear();
}

const hasP = (list: Array<{ id?: string; name?: string }> | undefined) =>
  (list ?? []).some((r) => r.id === P || r.name === SECRET);

async function paginatedRoute(query: string) {
  const response = await paginatedGET(
    new NextRequest(`http://localhost/api/recipes/paginated?${query}`)
  );
  return { body: await response.json(), cache: response.headers.get('cache-control') };
}

interface ReadPath {
  name: string;
  run: (role: Role) => Promise<any>;
  /** True when the result exposes P (its row, its name, or content derived from it). */
  sees: (result: any) => boolean;
  /** Owner/admin outcome when it is not "sees P" (e.g. cloning your own recipe is refused). */
  admitted?: (result: any, role: Role) => boolean;
  /** Fields that legitimately differ once P is deleted, removed before comparing. */
  normalize?: (result: any) => unknown;
}

const PATHS: ReadPath[] = [
  {
    name: 'findSimilarToRecipe — P as a candidate (stored embedding)',
    run: () => findSimilarToRecipe(Q, 10),
    sees: (r) => hasP(r.recipes),
  },
  {
    name: 'findSimilarToRecipe — P as a candidate (embedding generated on demand)',
    run: async () => {
      state.embeddingStored = false;
      return findSimilarToRecipe(Q, 10);
    },
    sees: (r) => hasP(r.recipes),
  },
  {
    name: 'findSimilarToRecipe — P as the source recipe',
    run: () => findSimilarToRecipe(P, 10),
    sees: (r) => r.success === true,
  },
  {
    name: 'getRecipesPaginated — filters.userId = owner',
    run: () => getRecipesPaginated({ filters: { userId: OWNER } }),
    sees: (r) => hasP(r.data?.recipes),
  },
  {
    name: 'getRecipesPaginated — filters.isPublic = false',
    run: () => getRecipesPaginated({ filters: { isPublic: false } }),
    sees: (r) => hasP(r.data?.recipes),
  },
  {
    name: 'GET /api/recipes/paginated?isPublic=false',
    run: () => paginatedRoute('isPublic=false'),
    sees: (r) => hasP(r.body.recipes),
    // A response carrying P must never be stored by a shared cache.
    admitted: (r) => hasP(r.body.recipes) && r.cache === 'private, no-store',
  },
  {
    name: 'getRecipesUsingIngredient (server action)',
    run: () => getRecipesUsingIngredient(INGREDIENT),
    sees: (r) => hasP(r.recipes),
  },
  {
    name: 'ingredientService.getRecipesUsingIngredient (v1 API)',
    run: (role) =>
      // The v1 route passes the caller resolved by requireScopes.
      (ingredientService.getRecipesUsingIngredient as any)(
        INGREDIENT,
        {},
        { userId: USER_OF[role], isAdmin: role === 'admin' }
      ),
    sees: (r) => hasP(r),
  },
  {
    name: 'getToolBySlug — recipesUsingTool',
    run: () => getToolBySlug('whisk'),
    sees: (r) => hasP(r.recipesUsingTool),
    // usageCount is a link count, outside #32 (see report).
    normalize: (r) => ({ ...r, tool: { ...r.tool, usageCount: undefined } }),
  },
  {
    name: 'recipe-cloning getRecipeForks(Q)',
    run: () => cloning.getRecipeForks(Q),
    sees: (r) => hasP(r),
  },
  {
    name: 'recipe-cloning getOriginalRecipe(FORK)',
    run: () => cloning.getOriginalRecipe(FORK),
    sees: (r) => r?.id === P,
  },
  {
    name: 'recipe-cloning getForkStats(P)',
    run: () => cloning.getForkStats(P),
    sees: (r) => r.name === SECRET,
  },
  {
    name: 'recipe-cloning cloneRecipe(P)',
    run: () => cloning.cloneRecipe(P),
    sees: (r) => typeof r.clonedRecipe?.name === 'string' && r.clonedRecipe.name.includes(SECRET),
    admitted: (r, role) =>
      role === 'owner'
        ? String(r.error).includes('cannot clone your own recipe')
        : r.clonedRecipe?.name?.includes(SECRET) === true,
  },
  {
    name: 'social forkRecipe(P)',
    run: () => social.forkRecipe(P),
    sees: (r) => typeof r.data?.name === 'string' && r.data.name.includes(SECRET),
  },
  {
    name: 'social getOriginalRecipe(FORK)',
    run: () => social.getOriginalRecipe(FORK),
    sees: (r) => r.data?.originalRecipe?.id === P,
  },
  {
    name: 'meals getRecipeRecommendations(P)',
    run: () => getRecipeRecommendations(P),
    sees: (r) => r.data?.basedOn === SECRET,
  },
];

beforeAll(async () => {
  const built = await createVisibilityDb(
    [schema.recipes, schema.recipeForks, recipeIngredients, schema.tools, schema.recipeTools],
    { ...schema, recipeIngredients }
  );
  client = built.client;
  state.db = built.db;
});

afterAll(async () => {
  await client?.close();
});

beforeEach(async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  state.embeddingStored = true;
  searchCaches.similar.clear();
  await seed();
});

describe.each(PATHS)('#32 $name', (path) => {
  it.each(ROLES)('%s', async (role) => {
    signInAs(role);
    const result = await path.run(role);

    if (ALLOWED[role]) {
      const admitted = path.admitted ? path.admitted(result, role) : path.sees(result);
      expect(admitted, JSON.stringify(result)).toBe(true);
      return;
    }

    expect(path.sees(result), JSON.stringify(result)).toBe(false);
    await deletePrivateRecipe();
    const nonexistent = await path.run(role);
    const normalize = path.normalize ?? ((r: unknown) => r);
    expect(normalize(result)).toEqual(normalize(nonexistent));
  });
});

describe('#32 findSimilarToRecipe cache', () => {
  it("does not serve the owner's cached result to an anonymous caller", async () => {
    signInAs('owner');
    const ownerResult = await findSimilarToRecipe(Q, 10);
    expect(hasP(ownerResult.recipes)).toBe(true);

    signInAs('anonymous');
    const anonymousResult = await findSimilarToRecipe(Q, 10);
    expect(hasP(anonymousResult.recipes)).toBe(false);
  });
});

describe('#17 findSimilarToRecipe rerank and rate limit', () => {
  const S1 = 'eeeeeeee-0000-4000-8000-00000000000e';
  const S2 = 'ffffffff-0000-4000-8000-00000000000f';
  const rerankCalls = () =>
    vi.mocked(fetch).mock.calls.filter(([url]) => String(url).includes('/v1/rerank')).length;

  beforeEach(async () => {
    await (state.db as any)
      .insert(schema.recipes)
      .values([recipeRow(S1, OTHER, true, 'Open Stew'), recipeRow(S2, OTHER, true, 'Open Pie')]);
    // Five candidates: an anonymous caller still sees four, enough to reach the rerank.
    vi.mocked(findSimilarRecipes).mockResolvedValue(
      [P, R, FORK, S1, S2].map((id) => ({
        recipe_id: id,
        similarity: 0.9,
      })) as never
    );
    vi.stubEnv('JINA_API_KEY', 'test-key');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ results: [] }), { status: 200 }))
    );
  });

  afterAll(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('anonymous callers never trigger a Jina rerank', async () => {
    signInAs('anonymous');
    const result = await findSimilarToRecipe(Q, 10);
    expect(result.success).toBe(true);
    expect(result.recipes.length).toBeGreaterThanOrEqual(3);
    expect(rerankCalls()).toBe(0);
  });

  it('signed-in users keep the Jina rerank', async () => {
    signInAs('otherUser');
    await findSimilarToRecipe(Q, 10);
    expect(rerankCalls()).toBe(1);
  });

  it('over the limit returns RATE_LIMITED and makes no paid call', async () => {
    vi.mocked(enforceRateLimit).mockResolvedValueOnce({
      allowed: false,
      reason: 'limited',
      retryAfterSec: 42,
      limit: 60,
    });
    vi.mocked(findSimilarRecipes).mockClear();
    signInAs('anonymous');
    const result = await findSimilarToRecipe(Q, 10);
    expect(result).toMatchObject({ success: false, errorCode: 'RATE_LIMITED', retryAfterSec: 42 });
    expect(vi.mocked(findSimilarRecipes)).not.toHaveBeenCalled();
    expect(rerankCalls()).toBe(0);
  });

  it('a limiter outage returns LIMITER_UNAVAILABLE, not RATE_LIMITED', async () => {
    vi.mocked(enforceRateLimit).mockResolvedValueOnce({
      allowed: false,
      reason: 'unavailable',
      retryAfterSec: 42,
      limit: 60,
    });
    vi.mocked(findSimilarRecipes).mockClear();
    signInAs('anonymous');
    const result = await findSimilarToRecipe(Q, 10);
    expect(result).toMatchObject({ success: false, errorCode: 'LIMITER_UNAVAILABLE' });
    expect(vi.mocked(findSimilarRecipes)).not.toHaveBeenCalled();
  });
});

describe('#96 findSimilarToRecipe — hidden neighbours outrank public', () => {
  // Twelve hidden neighbours (private, rejected, deleted) rank above PUB.
  const hiddenIds = Array.from(
    { length: 12 },
    (_, i) => `9${String(i).padStart(7, '0')}-0000-4000-8000-000000000000`
  );
  const PUB = '99999999-0000-4000-8000-000000000099';
  const ranked = [...hiddenIds, PUB];

  beforeEach(async () => {
    const db = state.db as any;
    await db.insert(schema.recipes).values([
      ...hiddenIds.map((id, i) => ({
        ...recipeRow(id, OWNER, i % 3 !== 0, `Hidden ${i}`),
        moderation_status: i % 3 === 1 ? 'rejected' : 'approved',
        deleted_at: i % 3 === 2 ? new Date('2026-02-01T00:00:00Z') : null,
      })),
      recipeRow(PUB, OTHER, true, 'Open Neighbour'),
    ]);
    // Emulates the pgvector query: ranked candidates (source first), the
    // optional SQL filters evaluated by real Postgres, then LIMIT.
    vi.mocked(findSimilarRecipes).mockImplementation((async (
      _embedding: number[],
      limit = 10,
      _min = 0.3,
      options: { visibility?: SQL; excludeRecipeId?: string } = {}
    ) => {
      const candidates = [Q, ...ranked];
      const rows: Array<{ id: string }> = await db
        .select({ id: schema.recipes.id })
        .from(schema.recipes)
        .where(and(inArray(schema.recipes.id, candidates), options.visibility));
      const allowed = new Set(rows.map((r) => r.id));
      return candidates
        .filter((id) => allowed.has(id) && id !== options.excludeRecipeId)
        .slice(0, limit)
        .map((id) => ({ recipe_id: id, similarity: 0.9 }));
    }) as never);
  });

  it('anonymous viewer gets the public neighbour and nothing hidden', async () => {
    signInAs('anonymous');
    const result = await findSimilarToRecipe(Q, 6);
    expect(result.recipes.map((r) => r.id)).toEqual([PUB]);
  });

  it('the owner still sees their private and rejected neighbours, never the source', async () => {
    signInAs('owner');
    const ids = (await findSimilarToRecipe(Q, 6)).recipes.map((r) => r.id);
    expect(ids).not.toContain(Q);
    expect(ids).toContain(hiddenIds[0]);
  });
});

describe('#96 findSimilarToRecipe — empty results and failures are not cached', () => {
  it('does not cache an empty result', async () => {
    // Only P comes back; the anonymous post-filter drops it, leaving an empty list.
    vi.mocked(findSimilarRecipes).mockResolvedValue([{ recipe_id: P, similarity: 0.9 }] as never);
    signInAs('anonymous');
    expect((await findSimilarToRecipe(Q, 6)).recipes).toEqual([]);
    expect(searchCaches.similar.size()).toBe(0);

    vi.mocked(findSimilarRecipes).mockResolvedValue([{ recipe_id: R, similarity: 0.9 }] as never);
    const second = await findSimilarToRecipe(Q, 6);
    expect(second.recipes.map((r) => r.id)).toEqual([R]);
  });

  it('a vector-search failure returns success:false and caches nothing', async () => {
    vi.mocked(findSimilarRecipes).mockRejectedValueOnce(new Error('db down'));
    signInAs('anonymous');
    const result = await findSimilarToRecipe(Q, 6);
    expect(result.success).toBe(false);
    expect(searchCaches.similar.size()).toBe(0);
  });
});

describe('#96 findSimilarRecipes SQL', () => {
  it('filters visibility and the source before LIMIT; no options means no filter', async () => {
    const actual =
      await vi.importActual<typeof import('@/lib/db/embeddings')>('@/lib/db/embeddings');
    const captured: string[] = [];
    const realDb = state.db;
    state.db = {
      execute: async (query: SQL) => {
        captured.push(new PgDialect().sqlToQuery(query).sql);
        return { rows: [] };
      },
    };
    try {
      const vector = new Array(384).fill(0);
      await actual.findSimilarRecipes(vector, 5, 0.5, {
        visibility: recipeVisibilityCondition(ANONYMOUS_VIEWER),
        excludeRecipeId: Q,
      });
      await actual.findSimilarRecipes(vector, 5, 0.5);
    } finally {
      state.db = realDb;
    }
    const [filtered, plain] = captured;
    expect(filtered).toMatch(
      /AND e\.recipe_id IN \(SELECT "recipes"\."id" FROM "recipes" WHERE [\s\S]*"recipes"\."is_public"/
    );
    expect(filtered).toMatch(/"recipes"\."deleted_at" is null/);
    expect(filtered).toMatch(/AND e\.recipe_id <> \$\d+/);
    expect(filtered.indexOf('e.recipe_id IN')).toBeLessThan(filtered.indexOf('LIMIT'));
    expect(plain).not.toContain('e.recipe_id IN');
    expect(plain).not.toContain('e.recipe_id <>');
  });
});
