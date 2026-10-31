// @vitest-environment node
/**
 * #135: soft-deleted recipes never reach similarity search or embedding batches.
 *
 * Why: the #135 duplicate merge soft-deletes each loser (`recipes.deleted_at`)
 * and leaves its embedding beside its keeper's. Callers that pass no
 * visibility condition dropped deleted rows only after the SQL LIMIT, so the
 * losers filled result slots and lists came back short. The embedding batch
 * queries selected deleted recipes for (re-)embedding.
 * What: runs the real queries on PGlite. PGlite here ships no pgvector, so a
 * `vector` domain over text and a SQL cosine-distance `<=>` operator stand in
 * for it; the stored JSON text is what the custom column type writes.
 */

import type { PGlite } from '@electric-sql/pglite';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock('@/lib/db', () => ({
  get db() {
    return state.db;
  },
}));
vi.mock('@/lib/session-user', () => ({
  getSessionUserId: async () => null,
  getSessionUser: async () => null,
}));
vi.mock('@/lib/auth-users', () => ({ getUserAdminFlag: async () => false }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
// #17: the limiter has its own PGlite tests; allow every call here.
vi.mock('@/lib/rate-limit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rate-limit')>()),
  enforceRateLimit: vi.fn(async () => ({ allowed: true, count: 1, limit: 30 })),
}));
// The query embedding is the source direction e0 (see `vec`).
vi.mock('@/lib/ai/embeddings', () => ({
  generateQueryEmbedding: vi.fn(async () => vec({ 0: 1 })),
  generateRecipeEmbedding: vi.fn(),
}));
// v1 API: a session-authenticated caller with every scope.
vi.mock('@/lib/api-auth/middleware', () => ({
  authenticateRequest: async () => ({
    authenticated: true,
    userId: 'user_api',
    authType: 'session',
    scopes: ['*'],
  }),
  authHasAllScopes: () => true,
  authHasAnyScope: () => true,
}));

import { createVisibilityDb } from '@/app/actions/__tests__/recipe-visibility-db';
import { semanticSearchRecipes } from '@/app/actions/semantic-search';
import { GET as similarGET } from '@/app/api/v1/recipes/[id]/similar/route';
import { searchCaches } from '@/lib/cache';
import * as schema from '@/lib/db/schema';
import { getAllRecipeEmbeddings, getRecipesNeedingEmbedding } from '../embeddings';
import { installVectorStub, vec } from './pglite-vector-stub';

const OWNER = 'user_owner';
const SOURCE = '00000000-0000-4000-8000-000000000000';
const DELETED_AT = new Date('2026-10-01T00:00:00Z');

const id = (prefix: string, i: number) =>
  `${prefix}${String(i).padStart(7, '0')}-0000-4000-8000-000000000000`;

let client: PGlite;
let db: Awaited<ReturnType<typeof createVisibilityDb>>['db'];

function recipeRow(recipeId: string, name: string, deleted: boolean) {
  return {
    id: recipeId,
    user_id: OWNER,
    name,
    description: `${name} description`,
    ingredients: '[]',
    instructions: '[]',
    is_public: true,
    is_system_recipe: false,
    moderation_status: 'approved' as const,
    deleted_at: deleted ? DELETED_AT : null,
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
  };
}

async function addEmbedding(recipeId: string, embedding: number[], model = 'm1') {
  await client.query(
    `INSERT INTO "recipe_embeddings" ("recipe_id", "embedding", "embedding_text", "model_name")
     VALUES ($1, $2, 'text', $3)`,
    [recipeId, JSON.stringify(embedding), model]
  );
}

/**
 * Seeds `deleted` soft-deleted recipes nearer to e0 (cosine 0.995) than
 * `live` recipes (cosine 0.894): the post-merge shape, losers beside keepers.
 */
async function seedNeighbours(deleted: number, live: number) {
  const deletedIds = Array.from({ length: deleted }, (_, i) => id('d', i));
  const liveIds = Array.from({ length: live }, (_, i) => id('1', i));
  await db
    .insert(schema.recipes)
    .values([
      ...deletedIds.map((rid, i) => recipeRow(rid, `Deleted ${i}`, true)),
      ...liveIds.map((rid, i) => recipeRow(rid, `Live ${i}`, false)),
    ]);
  for (const [i, rid] of deletedIds.entries()) await addEmbedding(rid, vec({ 0: 1, [1 + i]: 0.1 }));
  for (const [i, rid] of liveIds.entries()) await addEmbedding(rid, vec({ 0: 1, [100 + i]: 0.5 }));
  return { deletedIds, liveIds };
}

beforeAll(async () => {
  const built = await createVisibilityDb([schema.recipes], schema);
  client = built.client;
  db = built.db;
  state.db = db;
  // #131: shared stub; PGlite ships no pgvector.
  await installVectorStub(client);
});

afterAll(async () => {
  await client?.close();
});

beforeEach(async () => {
  await client.exec(`DELETE FROM "recipe_embeddings"; DELETE FROM "recipes";`);
  searchCaches.semantic.clear();
  searchCaches.similar.clear();
});

describe('#135 similarity search with soft-deleted near neighbours', () => {
  it('semanticSearchRecipes returns k live results when deleted rows outrank them', async () => {
    // limit 2 → SQL LIMIT 6; six deleted rows rank above both live ones.
    const { liveIds } = await seedNeighbours(6, 2);
    const result = await semanticSearchRecipes('soup', { limit: 2, minSimilarity: 0 });
    expect(result.success).toBe(true);
    expect(result.recipes.map((r) => r.id).sort()).toEqual([...liveIds].sort());
  });

  it('GET /api/v1/recipes/:id/similar returns k live results when deleted rows outrank them', async () => {
    // limit 2 → SQL LIMIT 3 (source + 2); three deleted rows rank above both live ones.
    await db.insert(schema.recipes).values(recipeRow(SOURCE, 'Source', false));
    await addEmbedding(SOURCE, vec({ 0: 1 }));
    const { liveIds } = await seedNeighbours(3, 2);
    const response = await similarGET(
      new NextRequest(
        `http://localhost/api/v1/recipes/${SOURCE}/similar?limit=2&minSimilarity=0.5`
      ),
      { params: Promise.resolve({ id: SOURCE }) }
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    const ids = body.data.similarRecipes.map((r: { id: string }) => r.id);
    expect(ids.sort()).toEqual([...liveIds].sort());
  });
});

describe('#135 embedding batch queries skip soft-deleted recipes', () => {
  it('getAllRecipeEmbeddings omits embeddings of soft-deleted recipes', async () => {
    const { deletedIds, liveIds } = await seedNeighbours(1, 1);
    const ids = (await getAllRecipeEmbeddings(100, 0)).map((e) => e.recipe_id);
    expect(ids).toEqual(liveIds);
    expect(ids).not.toContain(deletedIds[0]);
  });

  it('getRecipesNeedingEmbedding() omits soft-deleted recipes with no embedding', async () => {
    await db
      .insert(schema.recipes)
      .values([recipeRow(id('a', 0), 'Live', false), recipeRow(id('b', 0), 'Gone', true)]);
    const ids = (await getRecipesNeedingEmbedding()).map((r) => r.id);
    expect(ids).toEqual([id('a', 0)]);
  });

  it('getRecipesNeedingEmbedding(model) omits soft-deleted recipes on an old model', async () => {
    await db
      .insert(schema.recipes)
      .values([recipeRow(id('c', 0), 'Live', false), recipeRow(id('e', 0), 'Gone', true)]);
    await addEmbedding(id('c', 0), vec({ 0: 1 }), 'old-model');
    await addEmbedding(id('e', 0), vec({ 0: 1 }), 'old-model');
    const ids = (await getRecipesNeedingEmbedding('new-model')).map((r) => r.id);
    expect(ids).toEqual([id('c', 0)]);
  });
});
