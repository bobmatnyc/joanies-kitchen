// @vitest-environment node
/**
 * #205: trackRecipeView adds at most one recipe_views row per signed-in user
 * and recipe per minute. #199 was a client loop that wrote 224 rows for one
 * user on one recipe; the view count is count(*), so each row was a view.
 * Anonymous views carry no identity and are still recorded on every call.
 * Runs against real Postgres (PGlite) with the table's real defaults.
 */

import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const ALICE = 'user_alice';
const BOB = 'user_bob';
const RECIPE = 'aaaaaaaa-0000-4000-8000-00000000000a';
const OTHER_RECIPE = 'bbbbbbbb-0000-4000-8000-00000000000b';

const state = vi.hoisted(() => ({
  db: undefined as unknown,
  userId: null as string | null,
}));

vi.mock('@/lib/session-user', () => ({
  getSessionUserId: async () => state.userId,
  getSessionUser: async () => (state.userId ? { id: state.userId } : null),
}));
vi.mock('@/lib/auth-users', () => ({ getUserAdminFlag: async () => false }));
vi.mock('@/lib/db', () => ({
  get db() {
    return state.db;
  },
}));
vi.mock('@/app/actions/user-profiles', () => ({ ensureUserProfile: vi.fn(async () => ({})) }));

import { getRecipeViewCount, trackRecipeView } from '@/app/actions/recipe-views';
import * as schema from '@/lib/db/schema';
import * as discovery from '@/lib/db/user-discovery-schema';
import { createVisibilityDb } from './recipe-visibility-db';

let client: PGlite;

async function viewRows(userId: string | null, recipeId = RECIPE): Promise<number> {
  const where = userId === null ? 'user_id IS NULL' : `user_id = '${userId}'`;
  const res = await client.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM "recipe_views" WHERE recipe_id = '${recipeId}' AND ${where};`
  );
  return res.rows[0].n;
}

beforeAll(async () => {
  const created = await createVisibilityDb(
    [schema.recipes, discovery.userProfiles, discovery.recipeViews],
    { ...schema, ...discovery },
    { constraints: true }
  );
  client = created.client;
  state.db = created.db;
  const t0 = new Date('2026-01-01T00:00:00Z');
  await (state.db as any).insert(schema.recipes).values(
    [RECIPE, OTHER_RECIPE].map((id) => ({
      id,
      user_id: ALICE,
      name: `Recipe ${id.slice(0, 4)}`,
      ingredients: '[]',
      instructions: '[]',
      is_public: true,
      is_system_recipe: false,
      created_at: t0,
      updated_at: t0,
    }))
  );
});

afterAll(async () => {
  await client.close();
});

beforeEach(async () => {
  await client.exec(`DELETE FROM "recipe_views";`);
  state.userId = null;
});

describe('#205 trackRecipeView dedup', () => {
  it('records one row for repeated signed-in views of a recipe within a minute', async () => {
    state.userId = ALICE;
    // #199: a refetch loop re-called the action many times in a burst.
    for (let i = 0; i < 25; i++) await trackRecipeView(RECIPE);
    expect(await viewRows(ALICE)).toBe(1);
    expect(await getRecipeViewCount(RECIPE)).toBe(1);
  });

  it('counts each user and each recipe separately', async () => {
    state.userId = ALICE;
    await trackRecipeView(RECIPE);
    await trackRecipeView(OTHER_RECIPE);
    state.userId = BOB;
    await trackRecipeView(RECIPE);
    await trackRecipeView(RECIPE);
    expect(await viewRows(ALICE)).toBe(1);
    expect(await viewRows(ALICE, OTHER_RECIPE)).toBe(1);
    expect(await viewRows(BOB)).toBe(1);
  });

  it('records a new view once the earlier one is older than a minute', async () => {
    await client.exec(
      `INSERT INTO "recipe_views" (recipe_id, user_id, viewed_at)
       VALUES ('${RECIPE}', '${ALICE}', now() - interval '2 minutes');`
    );
    state.userId = ALICE;
    await trackRecipeView(RECIPE);
    await trackRecipeView(RECIPE);
    expect(await viewRows(ALICE)).toBe(2);
  });

  it('records every anonymous view (no identity to dedup on)', async () => {
    await trackRecipeView(RECIPE);
    await trackRecipeView(RECIPE);
    await trackRecipeView(RECIPE);
    expect(await viewRows(null)).toBe(3);
  });
});
