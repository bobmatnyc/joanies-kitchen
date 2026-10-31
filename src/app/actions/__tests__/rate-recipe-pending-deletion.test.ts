// @vitest-environment node
/**
 * #197: `rateRecipe` refuses a rater whose account has a pending deletion
 * (`users.deletion_requested_at` set). The check rides in the rating write's
 * own statement inside the #141 batch, so the account purge cannot interleave
 * a rating between check and write. Real `rateRecipe` against PGlite tables
 * carrying the production `recipe_ratings.recipe_id` foreign key;
 * `recipe_ratings.user_id` has no foreign key in production either.
 */

import type { PGlite } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ db: undefined as unknown, userId: null as string | null }));

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
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

import { rateRecipe } from '@/app/actions/rate-recipe';
import { users } from '@/lib/db/auth-schema';
import * as schema from '@/lib/db/schema';
import { userProfiles } from '@/lib/db/user-discovery-schema';
import { createVisibilityDb } from './recipe-visibility-db';

const PENDING = 'user_pending';
const NORMAL = 'user_normal';
const LEGACY = 'user_legacy_no_users_row';
const RATED = 'aaaaaaaa-0000-4000-8000-00000000000a';
const UNRATED = 'bbbbbbbb-0000-4000-8000-00000000000b';
const REFUSED = {
  success: false,
  error:
    'Your account is scheduled for deletion, so you cannot rate recipes. Cancel the deletion to rate again.',
};

let client: PGlite;
type BatchDb = { batch: (q: unknown[]) => Promise<unknown[]> };

async function rows(query: string, params: unknown[] = []) {
  return (await client.query(query, params)).rows as Record<string, unknown>[];
}

/** Every rating row and every recipe's stored aggregates, to prove a refusal wrote nothing. */
async function snapshot() {
  return {
    ratings: await rows(
      'SELECT recipe_id, user_id, rating, review, updated_at FROM recipe_ratings ORDER BY recipe_id, user_id'
    ),
    recipes: await rows('SELECT id, avg_user_rating, total_user_ratings FROM recipes ORDER BY id'),
  };
}

beforeAll(async () => {
  const built = await createVisibilityDb(
    [users, schema.recipes, schema.recipeRatings, userProfiles],
    { ...schema, userProfiles },
    { constraints: true }
  );
  client = built.client;
  state.db = built.db;
  // The production rating FK; recipe_ratings.user_id has none, in prod as here.
  await client.exec(`ALTER TABLE "recipe_ratings" ADD CONSTRAINT recipe_ratings_recipe_fk
    FOREIGN KEY ("recipe_id") REFERENCES "recipes" ("id") ON DELETE CASCADE`);
});

afterAll(async () => {
  await client?.close();
});

beforeEach(async () => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  await client.exec('DELETE FROM "recipe_ratings"; DELETE FROM "recipes"; DELETE FROM "users";');
  await rows(
    `INSERT INTO users (id, email, deletion_requested_at) VALUES
      ($1, 'p@example.test', '2026-10-01T00:00:00Z'), ($2, 'n@example.test', NULL)`,
    [PENDING, NORMAL]
  );
  // Stored aggregates deliberately differ from recipe_ratings: any recompute
  // (even one over unchanged ratings) would rewrite them, so a refusal must leave them.
  await client.exec(`INSERT INTO "recipes" (id, user_id, name, ingredients, instructions,
      is_public, moderation_status, avg_user_rating, total_user_ratings) VALUES
    ('${RATED}', 'owner', 'Soup', '[]', '[]', true, 'approved', 1.0, 9),
    ('${UNRATED}', 'owner', 'Stew', '[]', '[]', true, 'approved', 2.0, 7)`);
  await client.exec(`INSERT INTO "recipe_ratings" (recipe_id, user_id, rating, review, updated_at) VALUES
    ('${RATED}', '${PENDING}', 4, 'old review', '2026-09-01T00:00:00Z'),
    ('${RATED}', '${NORMAL}', 2, NULL, '2026-09-01T00:00:00Z')`);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('#197 rateRecipe refuses an account with a pending deletion', () => {
  it.each([
    ['a new rating', UNRATED],
    ['a change to an existing rating', RATED],
  ])('%s: returns the error, writes no row and leaves the aggregates', async (_n, recipeId) => {
    state.userId = PENDING;
    const before = await snapshot();

    expect(await rateRecipe(recipeId, 5, 'new review')).toEqual(REFUSED);

    expect(await snapshot()).toEqual(before);
  });

  it('refuses when the deletion is requested after every pre-batch read, before the batch runs', async () => {
    // A guard in a separate query before the batch passes here and the write lands.
    state.userId = NORMAL;
    const original = (state.db as BatchDb).batch;
    vi.spyOn(state.db as BatchDb, 'batch').mockImplementationOnce(async (queries) => {
      await rows(`UPDATE users SET deletion_requested_at = now() WHERE id = $1`, [NORMAL]);
      return original(queries);
    });
    const before = await snapshot();

    expect(await rateRecipe(UNRATED, 5)).toEqual(REFUSED);

    expect((await snapshot()).ratings).toEqual(before.ratings);
    expect((await snapshot()).recipes).toEqual(before.recipes);
  });

  it('carries the guard in the batch write statement, not in a query of its own', async () => {
    state.userId = PENDING;
    const batch = vi.spyOn(state.db as BatchDb, 'batch');

    await rateRecipe(UNRATED, 5);

    expect(batch).toHaveBeenCalledTimes(1);
    const sqls = (batch.mock.calls[0][0] as { toSQL: () => { sql: string } }[]).map(
      (q) => q.toSQL().sql
    );
    expect(sqls).toHaveLength(3);
    expect(sqls[0]).toMatch(/^select "id" from "recipes" where .+ for no key update$/);
    expect(sqls[1]).toMatch(
      /^insert into "recipe_ratings" .+ select .+ from "recipes" where \("recipes"\."id" = \$\d+ and NOT EXISTS \(SELECT 1 FROM "users" WHERE "users"\."id" = \$\d+ AND "users"\."deletion_requested_at" IS NOT NULL\)\) on conflict /
    );
    expect(sqls[2]).toMatch(
      /^update "recipes" set .+ and exists \(select 1 from "recipe_ratings" /
    );
  });
});

describe('#197 rateRecipe is unchanged for other accounts', () => {
  it.each([
    ['a users row with no pending deletion', NORMAL],
    ['a legacy id with no users row', LEGACY],
  ])('%s rates and the aggregates follow recipe_ratings', async (_n, userId) => {
    state.userId = userId;

    expect(await rateRecipe(UNRATED, 3, 'fine')).toEqual({
      success: true,
      rating: 3,
      avgUserRating: 3,
      totalRatings: 1,
    });
    expect(await rateRecipe(RATED, 5)).toMatchObject({ success: true, rating: 5 });

    const recipes = await rows(
      'SELECT avg_user_rating::text AS avg, total_user_ratings AS total FROM recipes ORDER BY id'
    );
    // RATED holds PENDING's 4 plus this rater's 5 (NORMAL's 2 is overwritten when the rater is NORMAL).
    expect(recipes[0]).toEqual(
      userId === NORMAL ? { avg: '4.5', total: 2 } : { avg: '3.7', total: 3 }
    );
    expect(recipes[1]).toEqual({ avg: '3.0', total: 1 });
    expect(
      await rows(
        'SELECT rating, review FROM recipe_ratings WHERE user_id = $1 AND recipe_id = $2',
        [userId, UNRATED]
      )
    ).toEqual([{ rating: 3, review: 'fine' }]);
  });
});
