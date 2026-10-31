// @vitest-environment node
/**
 * #131: the kNN rewrite of findSimilarRecipes and the /similar route.
 *
 * Why: the HNSW index (migration 0006) needs a kNN step that reads only ids
 * and distance, with filters applied after it. Over-fetch must keep lists
 * full, and the `SET LOCAL hnsw.*` settings only work inside the SELECT's
 * own transaction.
 * What: runs the real queries on PGlite with the pgvector stand-in
 * (`pglite-vector-stub.ts`). PGlite has no pgvector, so the HNSW plan itself
 * is not asserted here; the Neon dry run on #131 covers it.
 */

import type { PGlite } from '@electric-sql/pglite';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ db: undefined as unknown, userId: null as string | null }));

vi.mock('@/lib/db', () => ({
  get db() {
    return state.db;
  },
}));
vi.mock('@/lib/session-user', () => ({
  getSessionUserId: async () => state.userId,
  getSessionUser: async () => (state.userId ? { id: state.userId } : null),
}));
vi.mock('@/lib/auth-users', () => ({ getUserAdminFlag: async () => false }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock('@/lib/rate-limit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rate-limit')>()),
  enforceRateLimit: vi.fn(async () => ({ allowed: true, count: 1, limit: 30 })),
}));
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
import { GET as similarGET } from '@/app/api/v1/recipes/[id]/similar/route';
import * as schema from '@/lib/db/schema';
import { ANONYMOUS_VIEWER, recipeVisibilityCondition } from '@/lib/recipe-visibility';
import { findSimilarRecipes, HNSW_EF_SEARCH, knnCandidateCount } from '../embeddings';
import { COSINE_DISTANCE_SQL, installVectorStub, vec } from './pglite-vector-stub';

const OWNER = 'user_owner';
const OTHER = 'user_other';
const SOURCE = '00000000-0000-4000-8000-000000000000';

const id = (prefix: string, i: number) =>
  `${prefix}${String(i).padStart(7, '0')}-0000-4000-8000-000000000000`;

let client: PGlite;
let db: Awaited<ReturnType<typeof createVisibilityDb>>['db'];

type Kind = 'deleted' | 'private' | 'public';

function recipeRow(recipeId: string, kind: Kind) {
  return {
    id: recipeId,
    user_id: kind === 'private' ? OTHER : OWNER,
    name: `${kind} ${recipeId.slice(0, 8)}`,
    description: 'd',
    ingredients: '[]',
    instructions: '[]',
    is_public: kind !== 'private',
    is_system_recipe: false,
    moderation_status: 'approved' as const,
    deleted_at: kind === 'deleted' ? new Date('2026-10-01T00:00:00Z') : null,
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
  };
}

async function addEmbedding(recipeId: string, embedding: number[]) {
  await client.query(
    `INSERT INTO "recipe_embeddings" ("recipe_id", "embedding", "embedding_text", "model_name")
     VALUES ($1, $2, 'text', 'm1')`,
    [recipeId, JSON.stringify(embedding)]
  );
}

/**
 * Seeds recipes of `kind` near e0. `near` rows (cosine 0.995) outrank the
 * others (cosine 0.894), so hidden rows come first in the kNN order.
 */
async function seed(kind: Kind, count: number, near: boolean) {
  const prefix = { deleted: 'd', private: 'a', public: near ? 'b' : 'c' }[kind];
  const ids = Array.from({ length: count }, (_, i) => id(prefix, i));
  if (ids.length === 0) return ids;
  await db.insert(schema.recipes).values(ids.map((rid) => recipeRow(rid, kind)));
  const base = { deleted: 1, private: 50, public: near ? 150 : 100 }[kind];
  for (const [i, rid] of ids.entries()) {
    await addEmbedding(rid, vec({ 0: 1, [base + i]: near ? 0.1 : 0.5 }));
  }
  return ids;
}

async function getSimilar(limit: number) {
  const response = await similarGET(
    new NextRequest(
      `http://localhost/api/v1/recipes/${SOURCE}/similar?limit=${limit}&minSimilarity=0.5`
    ),
    { params: Promise.resolve({ id: SOURCE }) }
  );
  expect(response.status).toBe(200);
  const body = await response.json();
  return body.data.similarRecipes.map((r: { id: string }) => r.id) as string[];
}

beforeAll(async () => {
  const built = await createVisibilityDb([schema.recipes], schema);
  client = built.client;
  db = built.db;
  state.db = db;
  await installVectorStub(client);
});

afterAll(async () => {
  await client?.close();
});

beforeEach(async () => {
  await client.exec(`DELETE FROM "recipe_embeddings"; DELETE FROM "recipes";`);
  state.userId = null;
});

describe('#131 findSimilarRecipes kNN rewrite', () => {
  it('over-fetches K = max(100, limit * 4) candidates', () => {
    expect(knnCandidateCount(1)).toBe(100);
    expect(knnCandidateCount(25)).toBe(100);
    expect(knnCandidateCount(30)).toBe(120);
  });

  it('returns limit visible rows when soft-deleted and private neighbours outrank them', async () => {
    await seed('deleted', 6, true);
    await seed('private', 6, true);
    const publicIds = await seed('public', 4, false);
    const rows = await findSimilarRecipes(vec({ 0: 1 }), 3, 0, {
      visibility: recipeVisibilityCondition(ANONYMOUS_VIEWER),
    });
    expect(rows).toHaveLength(3);
    for (const row of rows) expect(publicIds).toContain(row.recipe_id);
    // Shape callers read: e.* columns plus similarity and recipe_* fields.
    expect(rows[0]).toMatchObject({ recipe_name: expect.any(String), model_name: 'm1' });
    expect(rows[0].similarity).toBeGreaterThan(0.85);
    const sims = rows.map((r) => Number(r.similarity));
    expect([...sims].sort((a, b) => b - a)).toEqual(sims);
  });

  it('runs the SELECT in the transaction that holds SET LOCAL hnsw.ef_search and iterative_scan', async () => {
    await seed('public', 2, true);
    // The distance function records the settings it runs under.
    await client.exec(`
      CREATE TABLE jk_settings_seen (ef text, scan text);
      CREATE OR REPLACE FUNCTION jk_cosine_distance(a text, b text) RETURNS float8
        LANGUAGE plpgsql VOLATILE AS $$
        BEGIN
          INSERT INTO jk_settings_seen VALUES (
            current_setting('hnsw.ef_search', true), current_setting('hnsw.iterative_scan', true));
          RETURN (${COSINE_DISTANCE_SQL});
        END $$;
    `);
    try {
      const rows = await findSimilarRecipes(vec({ 0: 1 }), 2, 0);
      expect(rows).toHaveLength(2);
      const seen = await client.query<{ ef: string; scan: string }>(
        'SELECT DISTINCT ef, scan FROM jk_settings_seen'
      );
      expect(seen.rows).toEqual([{ ef: String(HNSW_EF_SEARCH), scan: 'relaxed_order' }]);
      // SET LOCAL ended with the transaction: the session is not left changed.
      const after = await client.query<{ ef: string | null }>(
        `SELECT current_setting('hnsw.ef_search', true) AS ef`
      );
      expect(after.rows[0].ef ?? '').not.toBe(String(HNSW_EF_SEARCH));
    } finally {
      await client.exec(`
        DROP TABLE jk_settings_seen;
        CREATE OR REPLACE FUNCTION jk_cosine_distance(a text, b text) RETURNS float8
          LANGUAGE sql IMMUTABLE AS $$ ${COSINE_DISTANCE_SQL} $$;
      `);
    }
  });
});

describe('#131 GET /api/v1/recipes/:id/similar applies visibility in the kNN query', () => {
  beforeEach(async () => {
    await db.insert(schema.recipes).values(recipeRow(SOURCE, 'public'));
    await addEmbedding(SOURCE, vec({ 0: 1 }));
  });

  it('an anonymous caller gets limit public rows when private ones rank higher', async () => {
    const privateIds = await seed('private', 3, true);
    const publicIds = await seed('public', 2, false);
    const ids = await getSimilar(2);
    expect(ids.sort()).toEqual([...publicIds].sort());
    for (const p of privateIds) expect(ids).not.toContain(p);
  });

  it('the owner of the private recipes sees them, and never the source', async () => {
    const privateIds = await seed('private', 3, true);
    await seed('public', 2, false);
    state.userId = OTHER;
    const ids = await getSimilar(3);
    expect(ids.sort()).toEqual([...privateIds].sort());
    expect(ids).not.toContain(SOURCE);
  });
});
