// @vitest-environment node
/**
 * #231: removing a recipe from a collection lowers `collections.recipe_count`
 * and `recipes.collection_count` only when the DELETE removed a row. A repeat
 * remove, or a row a concurrent remove or the account purge deleted after the
 * caller's checks, used to lower both counts anyway.
 * Real server action, service and v1 DELETE route against PGlite tables
 * carrying the production foreign keys.
 */

import type { PGlite } from '@electric-sql/pglite';
import { NextRequest } from 'next/server';
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
// No apiKeyId, so the wrapper skips api_key_usage tracking.
vi.mock('@/lib/api-auth/middleware', () => ({
  authenticateRequest: async () =>
    state.userId
      ? { authenticated: true, userId: state.userId, authType: 'api_key', scopes: ['*'] }
      : { authenticated: false, error: 'Authentication required' },
  authHasAllScopes: () => true,
  authHasAnyScope: () => true,
}));

import { createVisibilityDb } from '@/app/actions/__tests__/recipe-visibility-db';
import { removeRecipeFromCollection } from '@/app/actions/collections';
import { DELETE as collectionRecipeDELETE } from '@/app/api/v1/collections/[id]/recipes/[recipeId]/route';
import type { RouteContext } from '@/lib/api-auth/types';
import * as schema from '@/lib/db/schema';
import { collectionRecipes, collections, userProfiles } from '@/lib/db/user-discovery-schema';
import { collectionService } from '@/lib/services/collection-service';

const OWNER = 'user_owner';
const OTHER = 'user_other';
const RECIPE = 'aaaaaaaa-0000-4000-8000-00000000000a';
const MINE = '11111111-0000-4000-8000-000000000001';
const SECOND = '11111111-0000-4000-8000-000000000002';
const THEIRS = '11111111-0000-4000-8000-000000000003';

let client: PGlite;

async function rows(query: string, params: unknown[] = []) {
  return (await client.query(query, params)).rows as Record<string, unknown>[];
}

async function counts() {
  return {
    collectionCount: (await rows('SELECT collection_count FROM recipes WHERE id = $1', [RECIPE]))[0]
      .collection_count,
    recipeCounts: await rows('SELECT id, recipe_count FROM collections ORDER BY id'),
    links: await rows('SELECT collection_id FROM collection_recipes ORDER BY collection_id'),
  };
}

/**
 * Runs `DELETE FROM collection_recipes` for the pair just before the first
 * statement that deletes from that table: a concurrent remove (or the purge)
 * that committed after the caller's own checks.
 */
function removeConcurrentlyFirst() {
  const original = client.query.bind(client);
  let fired = false;
  vi.spyOn(client, 'query').mockImplementation((async (q: string, ...rest: unknown[]) => {
    if (!fired && /delete from "collection_recipes"/i.test(q)) {
      fired = true;
      await original('DELETE FROM collection_recipes WHERE collection_id = $1 AND recipe_id = $2', [
        MINE,
        RECIPE,
      ]);
    }
    return (original as (q: string, ...r: unknown[]) => Promise<unknown>)(q, ...rest);
  }) as typeof client.query);
}

const viaAction = async () => removeRecipeFromCollection(MINE, RECIPE);
const viaService = async () => collectionService.removeRecipe(MINE, RECIPE);
const viaRoute = async () =>
  collectionRecipeDELETE(
    new NextRequest(`http://localhost/api/v1/collections/${MINE}/recipes/${RECIPE}`, {
      method: 'DELETE',
    }),
    { params: Promise.resolve({ id: MINE, recipeId: RECIPE }) } as RouteContext
  );

const PATHS = [
  ['removeRecipeFromCollection (server action)', viaAction],
  ['collectionService.removeRecipe', viaService],
  ['DELETE /api/v1/collections/:id/recipes/:recipeId', viaRoute],
] as const;

beforeAll(async () => {
  const built = await createVisibilityDb(
    [schema.recipes, userProfiles, collections, collectionRecipes],
    { ...schema, userProfiles, collections, collectionRecipes },
    { constraints: true }
  );
  client = built.client;
  state.db = built.db;
  await client.exec(`
    ALTER TABLE "collections" ADD FOREIGN KEY ("user_id") REFERENCES "user_profiles" ("user_id") ON DELETE CASCADE;
    ALTER TABLE "collection_recipes" ADD FOREIGN KEY ("collection_id") REFERENCES "collections" ("id") ON DELETE CASCADE;
    ALTER TABLE "collection_recipes" ADD FOREIGN KEY ("recipe_id") REFERENCES "recipes" ("id") ON DELETE CASCADE;`);
});

afterAll(async () => {
  await client?.close();
});

beforeEach(async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  await client.exec(`DELETE FROM "collection_recipes"; DELETE FROM "collections";
    DELETE FROM "user_profiles"; DELETE FROM "recipes";`);
  await client.exec(`INSERT INTO "user_profiles" (user_id, username, display_name, is_public) VALUES
    ('${OWNER}', 'owner', 'Owner', true), ('${OTHER}', 'other', 'Other', true)`);
  await client.exec(`INSERT INTO "recipes" (id, user_id, name, ingredients, instructions,
      is_public, moderation_status, collection_count)
    VALUES ('${RECIPE}', 'author', 'Soup', '[]', '[]', true, 'approved', 3)`);
  // The recipe sits in three collections: two of the owner's, one of another user's.
  await client.exec(`INSERT INTO "collections" (id, user_id, name, slug, recipe_count) VALUES
    ('${MINE}', '${OWNER}', 'Mine', 'mine', 1), ('${SECOND}', '${OWNER}', 'Second', 'second', 1),
    ('${THEIRS}', '${OTHER}', 'Theirs', 'theirs', 1)`);
  await client.exec(`INSERT INTO "collection_recipes" (collection_id, recipe_id, position) VALUES
    ('${MINE}', '${RECIPE}', 0), ('${SECOND}', '${RECIPE}', 0), ('${THEIRS}', '${RECIPE}', 0)`);
  state.userId = OWNER;
});

afterEach(() => {
  vi.restoreAllMocks();
  state.userId = null;
});

const AFTER_ONE_REMOVE = {
  collectionCount: 2,
  recipeCounts: [
    { id: MINE, recipe_count: 0 },
    { id: SECOND, recipe_count: 1 },
    { id: THEIRS, recipe_count: 1 },
  ],
  links: [{ collection_id: SECOND }, { collection_id: THEIRS }],
};

describe('#231 removing a recipe from a collection', () => {
  it.each(PATHS)('%s: one remove lowers each count by 1', async (_n, run) => {
    await run();

    expect(await counts()).toEqual(AFTER_ONE_REMOVE);
  });

  it.each(PATHS)('%s: a second remove changes nothing', async (_n, run) => {
    await run();
    await run();

    expect(await counts()).toEqual(AFTER_ONE_REMOVE);
  });

  it.each(PATHS)('%s: a recipe not in the collection changes nothing', async (_n, run) => {
    await rows('DELETE FROM collection_recipes WHERE collection_id = $1', [MINE]);
    const before = await counts();

    await run();

    expect(await counts()).toEqual(before);
  });

  it.each(PATHS)(
    '%s: a row removed concurrently after the checks is counted once',
    async (_n, run) => {
      // The concurrent remove lowered both counts for its own row already.
      await rows('UPDATE recipes SET collection_count = 2 WHERE id = $1', [RECIPE]);
      await rows('UPDATE collections SET recipe_count = 0 WHERE id = $1', [MINE]);
      removeConcurrentlyFirst();

      await run();

      expect(await counts()).toEqual(AFTER_ONE_REMOVE);
    }
  );

  it.each(PATHS)('%s: a count already at 0 stays at 0', async (_n, run) => {
    await rows('UPDATE recipes SET collection_count = 0 WHERE id = $1', [RECIPE]);
    await rows('UPDATE collections SET recipe_count = 0 WHERE id = $1', [MINE]);

    await run();

    expect((await counts()).collectionCount).toBe(0);
    expect((await counts()).recipeCounts[0]).toEqual({ id: MINE, recipe_count: 0 });
  });

  it('one batch: the recipe lock first, then the delete-and-decrement', async () => {
    type Item = { toSQL?: () => { sql: string }; getQuery?: () => { sql: string } };
    const sqlOf = (q: Item) =>
      (q.toSQL ? q.toSQL().sql : (q.getQuery as () => { sql: string })().sql)
        .replace(/\s+/g, ' ')
        .trim();
    const batch = vi.spyOn(state.db as { batch: (q: unknown[]) => Promise<unknown> }, 'batch');

    await viaService();

    expect(batch).toHaveBeenCalledTimes(1);
    const sqls = (batch.mock.calls[0][0] as Item[]).map(sqlOf);
    expect(sqls).toHaveLength(2);
    expect(sqls[0]).toMatch(
      /^select "id" from "recipes" where "recipes"\."id" = \$1 for no key update$/
    );
    expect(sqls[1]).toMatch(/^WITH removed AS \( DELETE FROM "collection_recipes" .* RETURNING /);
  });

  it('the service answers whether a row was removed', async () => {
    expect(await collectionService.removeRecipe(MINE, RECIPE)).toBe(true);
    expect(await collectionService.removeRecipe(MINE, RECIPE)).toBe(false);
  });

  it('ownership checks and responses are unchanged', async () => {
    expect(await removeRecipeFromCollection(MINE, RECIPE)).toEqual({ success: true });
    state.userId = OTHER;
    const before = await counts();

    expect(await removeRecipeFromCollection(SECOND, RECIPE)).toEqual({
      success: false,
      error: 'You can only modify your own collections',
    });
    const res = await viaRoute();
    expect(res.status).toBe(403);
    expect(await counts()).toEqual(before);
  });
});
