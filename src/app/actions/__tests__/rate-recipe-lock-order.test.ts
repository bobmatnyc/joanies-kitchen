// @vitest-environment node
/**
 * #141: every rating write is one `db.batch` that locks the recipe row
 * (FOR NO KEY UPDATE), writes `recipe_ratings`, and recomputes the recipe's
 * aggregates from the table, in that order. Real `rateRecipe` / `deleteRating`
 * against PGlite tables carrying the production `recipe_ratings.recipe_id`
 * foreign key. The account purge's rating path is covered in
 * `src/lib/account-purge/__tests__/account-purge.test.ts`.
 */

import type { PGlite } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ db: undefined as unknown, userId: null as string | null }));

vi.mock('@/lib/auth', () => ({
  auth: async () => ({ userId: state.userId, sessionClaims: null }),
}));
vi.mock('@/lib/auth-users', () => ({ getUserAdminFlag: async () => false }));
vi.mock('@/lib/db', () => ({
  get db() {
    return state.db;
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

import { deleteRating, rateRecipe } from '@/app/actions/rate-recipe';
import * as schema from '@/lib/db/schema';
import { userProfiles } from '@/lib/db/user-discovery-schema';
import { createVisibilityDb } from './recipe-visibility-db';

const A = 'user_a';
const B = 'user_b';
const RECIPE = 'aaaaaaaa-0000-4000-8000-00000000000a';

let client: PGlite;

/** Stored aggregates next to the true ones from `recipe_ratings`, as Postgres renders them. */
async function aggregates() {
  const { rows } = await client.query<Record<string, unknown>>(
    `SELECT r.avg_user_rating AS avg, r.total_user_ratings AS total,
       (SELECT CAST(AVG(rating) AS DECIMAL(2,1)) FROM recipe_ratings WHERE recipe_id = r.id)::text AS true_avg,
       (SELECT count(*)::int FROM recipe_ratings WHERE recipe_id = r.id) AS true_total
     FROM recipes r WHERE r.id = $1`,
    [RECIPE]
  );
  const [row] = rows;
  return {
    stored: { avg: row.avg, total: row.total },
    truth: { avg: row.true_avg, total: row.true_total },
  };
}

beforeAll(async () => {
  const built = await createVisibilityDb(
    [schema.recipes, schema.recipeRatings, userProfiles],
    { ...schema, userProfiles },
    { constraints: true }
  );
  client = built.client;
  state.db = built.db;
  // The test tables carry no foreign keys; this is the production rating FK.
  await client.exec(`ALTER TABLE "recipe_ratings" ADD CONSTRAINT recipe_ratings_recipe_fk
    FOREIGN KEY ("recipe_id") REFERENCES "recipes" ("id") ON DELETE CASCADE`);
});

afterAll(async () => {
  await client?.close();
});

beforeEach(async () => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  await client.exec('DELETE FROM "recipe_ratings"; DELETE FROM "recipes";');
  // A drifted start: the stored aggregates claim 9 ratings averaging 1.0; there are none.
  await client.exec(`INSERT INTO "recipes" (id, user_id, name, ingredients, instructions,
      is_public, moderation_status, avg_user_rating, total_user_ratings)
    VALUES ('${RECIPE}', 'owner', 'Soup', '[]', '[]', true, 'approved', 1.0, 9)`);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('#141 rating batches: recipe lock, rating write, aggregate recompute', () => {
  const sqlsOf = (batch: { mock: { calls: unknown[][] } }) =>
    (batch.mock.calls[0][0] as { toSQL: () => { sql: string } }[]).map((q) => q.toSQL().sql);
  const LOCK = /^select "id" from "recipes" where "recipes"\."id" = \$1 for no key update$/;
  const RECOMPUTE =
    /^update "recipes" set "avg_user_rating" = \(SELECT CAST\(AVG\(rr\."rating"\) .+ "total_user_ratings" = \(SELECT COUNT\(\*\) FROM "recipe_ratings" rr WHERE rr\."recipe_id" = "recipes"\."id"\) where "recipes"\."id" = \$\d+ returning /;

  const UPSERT =
    /^insert into "recipe_ratings" .+ on conflict \("recipe_id","user_id"\) do update set /;
  const DELETE =
    /^delete from "recipe_ratings" where \("recipe_ratings"\."recipe_id" = \$1 and "recipe_ratings"\."user_id" = \$2\)$/;
  const noRating = async () => undefined;
  const rated = async () => {
    await rateRecipe(RECIPE, 5);
  };

  it.each([
    ['rateRecipe (insert)', noRating, () => rateRecipe(RECIPE, 4), UPSERT],
    ['rateRecipe (update)', rated, () => rateRecipe(RECIPE, 2), UPSERT],
    ['deleteRating', rated, () => deleteRating(RECIPE), DELETE],
  ])(
    '%s sends the lock, the rating write and the recompute, in that order',
    async (_n, setup, act, write) => {
      state.userId = A;
      await setup();
      const batch = vi.spyOn(state.db as { batch: (q: unknown[]) => Promise<unknown> }, 'batch');

      expect(await act()).toMatchObject({ success: true });

      expect(batch).toHaveBeenCalledTimes(1);
      const sqls = sqlsOf(batch);
      expect(sqls).toHaveLength(3);
      expect(sqls[0]).toMatch(LOCK);
      expect(sqls[1]).toMatch(write);
      expect(sqls[2]).toMatch(RECOMPUTE);
    }
  );
});

describe('#141 aggregates equal recipe_ratings after every rating write', () => {
  it('two raters, a changed rating and a delete, starting from a drifted aggregate', async () => {
    expect((await aggregates()).stored).toEqual({ avg: '1.0', total: 9 });

    state.userId = A;
    expect(await rateRecipe(RECIPE, 4)).toMatchObject({ avgUserRating: 4, totalRatings: 1 });
    let now = await aggregates();
    expect(now.truth).toEqual({ avg: '4.0', total: 1 });
    expect(now.stored).toEqual(now.truth);

    state.userId = B;
    expect(await rateRecipe(RECIPE, 1)).toMatchObject({ avgUserRating: 2.5, totalRatings: 2 });
    now = await aggregates();
    expect(now.truth).toEqual({ avg: '2.5', total: 2 });
    expect(now.stored).toEqual(now.truth);

    state.userId = A;
    expect(await rateRecipe(RECIPE, 5)).toMatchObject({ avgUserRating: 3, totalRatings: 2 });
    now = await aggregates();
    expect(now.truth).toEqual({ avg: '3.0', total: 2 });
    expect(now.stored).toEqual(now.truth);

    state.userId = B;
    expect(await deleteRating(RECIPE)).toEqual({ success: true });
    now = await aggregates();
    expect(now.truth).toEqual({ avg: '5.0', total: 1 });
    expect(now.stored).toEqual(now.truth);
  });

  it('a delete corrects an aggregate that drifted while ratings existed', async () => {
    state.userId = A;
    await rateRecipe(RECIPE, 4);
    state.userId = B;
    await rateRecipe(RECIPE, 2);
    await client.exec(
      `UPDATE recipes SET avg_user_rating = 1.0, total_user_ratings = 7 WHERE id = '${RECIPE}'`
    );

    expect(await deleteRating(RECIPE)).toEqual({ success: true });

    const now = await aggregates();
    expect(now.truth).toEqual({ avg: '4.0', total: 1 });
    expect(now.stored).toEqual(now.truth);
  });
});
