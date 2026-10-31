// @vitest-environment node
/**
 * #211: `removeFavorite` locks the recipe row before it touches the favorite.
 * The account purge and recipe deletes (#174) lock recipes first and delete
 * favorites later; the old single statement locked the favorite first, so the
 * two could deadlock (40P01). Now one `db.batch`: `lockRecipeForRating`
 * (FOR NO KEY UPDATE), then the unchanged delete-and-decrement statement.
 * Real core against PGlite tables carrying the production `favorites` FKs.
 */

import type { PGlite } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock('@/lib/db', () => ({
  get db() {
    return state.db;
  },
}));

import { createVisibilityDb } from '@/app/actions/__tests__/recipe-visibility-db';
import { users } from '@/lib/db/auth-schema';
import * as schema from '@/lib/db/schema';
import { favorites, userProfiles } from '@/lib/db/user-discovery-schema';
import { removeFavorite } from '@/lib/favorites';

const USER = 'user_a';
const OTHER = 'user_b';
const RECIPE = 'aaaaaaaa-0000-4000-8000-00000000000a';
const MISSING = 'ffffffff-0000-4000-8000-00000000000f';

let client: PGlite;

async function rows(query: string, params: unknown[] = []) {
  return (await client.query(query, params)).rows as Record<string, unknown>[];
}

async function likeCount(): Promise<number> {
  const [row] = await rows('SELECT like_count FROM recipes WHERE id = $1', [RECIPE]);
  return row.like_count as number;
}

async function favoriteRows() {
  return rows('SELECT user_id, recipe_id FROM favorites ORDER BY user_id, recipe_id');
}

async function seed(likeCountValue: number, favoritedBy: string[]) {
  await client.exec(`INSERT INTO "recipes" (id, user_id, name, ingredients, instructions,
      is_public, moderation_status, like_count)
    VALUES ('${RECIPE}', 'owner', 'Soup', '[]', '[]', true, 'approved', ${likeCountValue})`);
  for (const user of favoritedBy) {
    await rows('INSERT INTO favorites (user_id, recipe_id) VALUES ($1, $2)', [user, RECIPE]);
  }
}

beforeAll(async () => {
  const built = await createVisibilityDb(
    [users, schema.recipes, userProfiles, favorites],
    { ...schema, userProfiles, favorites },
    { constraints: true }
  );
  client = built.client;
  state.db = built.db;
  // The production favorites FKs (user-discovery-schema.ts).
  await client.exec(`
    ALTER TABLE "favorites" ADD CONSTRAINT favorites_user_fk FOREIGN KEY ("user_id")
      REFERENCES "user_profiles" ("user_id") ON DELETE CASCADE;
    ALTER TABLE "favorites" ADD CONSTRAINT favorites_recipe_fk FOREIGN KEY ("recipe_id")
      REFERENCES "recipes" ("id") ON DELETE CASCADE;`);
});

afterAll(async () => {
  await client?.close();
});

beforeEach(async () => {
  await client.exec('DELETE FROM "favorites"; DELETE FROM "user_profiles"; DELETE FROM "recipes";');
  await client.exec(`INSERT INTO "user_profiles" (user_id, username, display_name, is_public) VALUES
    ('${USER}', 'a', 'A', true), ('${OTHER}', 'b', 'B', true)`);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('#211 removeFavorite statement order', () => {
  type Item = { toSQL?: () => { sql: string }; getQuery?: () => { sql: string } };
  const sqlOf = (q: Item) =>
    (q.toSQL ? q.toSQL().sql : (q.getQuery as () => { sql: string })().sql)
      .replace(/\s+/g, ' ')
      .trim();
  const LOCK = /^select "id" from "recipes" where "recipes"\."id" = \$1 for no key update$/;
  const DELETE_AND_DECREMENT =
    /^WITH removed AS \( DELETE FROM "favorites" WHERE "favorites"\."user_id" = \$1 AND "favorites"\."recipe_id" = \$2 RETURNING 1 \), dropped AS \( UPDATE "recipes" SET like_count = GREATEST\("recipes"\."like_count" - 1, 0\) WHERE "recipes"\."id" = \$3 AND EXISTS \(SELECT 1 FROM removed\) RETURNING 1 \) SELECT count\(\*\)::int AS removed FROM removed$/;

  it.each([
    ['an existing favorite', RECIPE, true],
    ['a missing recipe', MISSING, false],
  ])(
    '%s: one batch, the recipe lock first, then the delete-and-decrement',
    async (_n, recipeId, removed) => {
      await seed(1, [USER]);
      const batch = vi.spyOn(state.db as { batch: (q: unknown[]) => Promise<unknown> }, 'batch');

      expect(await removeFavorite(USER, recipeId)).toBe(removed);

      expect(batch).toHaveBeenCalledTimes(1);
      const sqls = (batch.mock.calls[0][0] as Item[]).map(sqlOf);
      expect(sqls).toHaveLength(2);
      expect(sqls[0]).toMatch(LOCK);
      expect(sqls[1]).toMatch(DELETE_AND_DECREMENT);
      // #211: a lock on any other id matches no row and changes no result, so
      // only the bound parameter shows the batch locks this recipe.
      const lock = (batch.mock.calls[0][0] as { toSQL: () => { params: unknown[] } }[])[0];
      expect(lock.toSQL().params).toEqual([recipeId]);
    }
  );
});

describe('#211 removeFavorite behaviour is unchanged', () => {
  it('removes an existing favorite and decrements like_count by one', async () => {
    await seed(2, [USER, OTHER]);

    expect(await removeFavorite(USER, RECIPE)).toBe(true);

    expect(await favoriteRows()).toEqual([{ user_id: OTHER, recipe_id: RECIPE }]);
    expect(await likeCount()).toBe(1);
  });

  it('a favorite that does not exist is a no-op answering false', async () => {
    await seed(4, [OTHER]);

    expect(await removeFavorite(USER, RECIPE)).toBe(false);

    expect(await favoriteRows()).toEqual([{ user_id: OTHER, recipe_id: RECIPE }]);
    expect(await likeCount()).toBe(4);
  });

  it('a missing recipe answers false, throws nothing and writes nothing', async () => {
    await seed(3, [USER]);

    expect(await removeFavorite(USER, MISSING)).toBe(false);

    expect(await favoriteRows()).toEqual([{ user_id: USER, recipe_id: RECIPE }]);
    expect(await likeCount()).toBe(3);
  });

  it.each([
    ['drifted to 0: the floor holds at 0', 0, 0],
    ['drifted high: still one decrement', 7, 6],
  ])('a drifted like_count, %s', async (_n, start, expected) => {
    await seed(start, [USER]);

    expect(await removeFavorite(USER, RECIPE)).toBe(true);

    expect(await favoriteRows()).toEqual([]);
    expect(await likeCount()).toBe(expected);
  });
});
