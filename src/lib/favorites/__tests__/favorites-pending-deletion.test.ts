// @vitest-environment node
/**
 * #208: `addFavorite` refuses a caller whose account has a pending deletion
 * (`users.deletion_requested_at` set). The check rides in the favorite insert's
 * own statement, so the account purge cannot interleave a favorite (and its
 * `like_count` bump on a recipe it never locked) between check and write.
 * Real core, server action and v1 routes against PGlite tables carrying the
 * production `favorites` foreign keys.
 */

import type { PGlite } from '@electric-sql/pglite';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
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
// No apiKeyId, so the wrappers skip api_key_usage tracking.
vi.mock('@/lib/api-auth/middleware', () => ({
  authenticateRequest: async () =>
    state.userId
      ? { authenticated: true, userId: state.userId, authType: 'api_key', scopes: ['*'] }
      : { authenticated: false, error: 'Authentication required' },
  authHasAllScopes: () => true,
  authHasAnyScope: () => true,
}));

import { createVisibilityDb } from '@/app/actions/__tests__/recipe-visibility-db';
import { addFavorite as addFavoriteAction } from '@/app/actions/favorites';
import { POST as favoritePOST } from '@/app/api/v1/favorites/[recipeId]/route';
import { POST as likePOST } from '@/app/api/v1/recipes/[id]/like/route';
import type { RouteContext } from '@/lib/api-auth/types';
import { users } from '@/lib/db/auth-schema';
import * as schema from '@/lib/db/schema';
import { favorites, userProfiles } from '@/lib/db/user-discovery-schema';
import * as core from '@/lib/favorites';

const PENDING = 'user_pending';
const NORMAL = 'user_normal';
const LEGACY = 'user_legacy_no_users_row';
const NEW_RECIPE = 'aaaaaaaa-0000-4000-8000-00000000000a';
const FAVED_RECIPE = 'bbbbbbbb-0000-4000-8000-00000000000b';
const MESSAGE =
  'Your account is scheduled for deletion, so you cannot favorite recipes. Cancel the deletion to favorite again.';

let client: PGlite;
type ExecDb = { execute: (q: SQL) => Promise<unknown> };

async function rows(query: string, params: unknown[] = []) {
  return (await client.query(query, params)).rows as Record<string, unknown>[];
}

/** Every favorite and every recipe's like_count, to prove a refusal wrote nothing. */
async function snapshot() {
  return {
    favorites: await rows('SELECT user_id, recipe_id FROM favorites ORDER BY user_id, recipe_id'),
    recipes: await rows('SELECT id, like_count FROM recipes ORDER BY id'),
  };
}

const isFavoriteInsert = (q: SQL) =>
  /INSERT INTO "favorites"/.test(new PgDialect().sqlToQuery(q).sql);

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
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  await client.exec(
    'DELETE FROM "favorites"; DELETE FROM "user_profiles"; DELETE FROM "recipes"; DELETE FROM "users";'
  );
  await rows(
    `INSERT INTO users (id, email, deletion_requested_at) VALUES
      ($1, 'p@example.test', '2026-10-01T00:00:00Z'), ($2, 'n@example.test', NULL)`,
    [PENDING, NORMAL]
  );
  await client.exec(`INSERT INTO "user_profiles" (user_id, username, display_name, is_public) VALUES
    ('${PENDING}', 'pending', 'Pending', false), ('${NORMAL}', 'normal', 'Normal', true)`);
  // like_count deliberately differs from the favorites count, so any write shows.
  await client.exec(`INSERT INTO "recipes" (id, user_id, name, ingredients, instructions,
      is_public, moderation_status, like_count) VALUES
    ('${NEW_RECIPE}', 'owner', 'Soup', '[]', '[]', true, 'approved', 5),
    ('${FAVED_RECIPE}', 'owner', 'Stew', '[]', '[]', true, 'approved', 3)`);
  await client.exec(`INSERT INTO "favorites" (user_id, recipe_id) VALUES
    ('${PENDING}', '${FAVED_RECIPE}'), ('${NORMAL}', '${FAVED_RECIPE}')`);
});

afterEach(() => {
  vi.restoreAllMocks();
  state.userId = null;
});

describe('#208 addFavorite refuses an account with a pending deletion', () => {
  it.each([
    ['a new favorite', NEW_RECIPE],
    ['a recipe already favorited', FAVED_RECIPE],
  ])('core, %s: answers pending-deletion, writes no row, leaves like_count', async (_n, id) => {
    const before = await snapshot();

    expect(await core.addFavorite(PENDING, id)).toEqual({ status: 'pending-deletion' });

    expect(await snapshot()).toEqual(before);
  });

  it('server action: returns the refusal error in its { success, error } shape', async () => {
    state.userId = PENDING;
    const before = await snapshot();

    expect(await addFavoriteAction(NEW_RECIPE)).toEqual({ success: false, error: MESSAGE });
    expect(core.PENDING_DELETION_FAVORITE_ERROR).toBe(MESSAGE);

    expect(await snapshot()).toEqual(before);
  });

  it('refuses when the deletion is requested after every read that runs before the statement', async () => {
    // A guard in a separate query before the statement passes here and the write lands.
    const db = state.db as ExecDb;
    const original = db.execute.bind(db);
    vi.spyOn(db, 'execute').mockImplementation(async (q) => {
      if (isFavoriteInsert(q)) {
        await rows('UPDATE users SET deletion_requested_at = now() WHERE id = $1', [NORMAL]);
      }
      return original(q);
    });
    const before = await snapshot();

    expect(await core.addFavorite(NORMAL, NEW_RECIPE)).toEqual({ status: 'pending-deletion' });

    expect(await snapshot()).toEqual(before);
  });

  it('carries the guard in the favorite insert statement, not in a query of its own', async () => {
    const db = state.db as ExecDb;
    const execute = vi.spyOn(db, 'execute');

    await core.addFavorite(PENDING, NEW_RECIPE);

    const inserts = execute.mock.calls.map(([q]) => q).filter(isFavoriteInsert);
    expect(inserts).toHaveLength(1);
    const text = new PgDialect().sqlToQuery(inserts[0]).sql.replace(/\s+/g, ' ');
    expect(text).toMatch(
      /^ WITH allowed AS \( SELECT 1 AS ok WHERE NOT EXISTS \(SELECT 1 FROM "users" WHERE "users"\."id" = \$\d+ AND "users"\."deletion_requested_at" IS NOT NULL\) \), inserted AS \( INSERT INTO "favorites" \(user_id, recipe_id\) SELECT \$\d+::text, \$\d+::text FROM allowed ON CONFLICT DO NOTHING /
    );
  });
});

describe('#208 v1 API answers a pending-deletion add with 403', () => {
  const ctx = (params: Record<string, string>): RouteContext => ({
    params: Promise.resolve(params),
  });

  it.each([
    [
      'POST /api/v1/favorites/:recipeId',
      () =>
        favoritePOST(
          new NextRequest(`http://localhost/api/v1/favorites/${NEW_RECIPE}`, { method: 'POST' }),
          ctx({ recipeId: NEW_RECIPE })
        ),
    ],
    [
      'POST /api/v1/recipes/:id/like (deprecated)',
      () =>
        likePOST(
          new NextRequest(`http://localhost/api/v1/recipes/${NEW_RECIPE}/like`, { method: 'POST' }),
          ctx({ id: NEW_RECIPE })
        ),
    ],
  ])('%s', async (_n, call) => {
    state.userId = PENDING;
    const before = await snapshot();

    const res = await call();

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ success: false, error: MESSAGE, reason: 'forbidden' });
    expect(await snapshot()).toEqual(before);
  });
});

describe('#208 addFavorite is unchanged for other accounts', () => {
  it.each([
    ['a users row with no pending deletion', NORMAL],
    ['a legacy id with no users row', LEGACY],
  ])('%s adds once, counts once, and a repeat is "exists"', async (_n, userId) => {
    const first = await core.addFavorite(userId, NEW_RECIPE);
    const second = await core.addFavorite(userId, NEW_RECIPE);

    expect(first).toMatchObject({
      status: 'added',
      favorite: { user_id: userId, recipe_id: NEW_RECIPE },
    });
    expect(second).toEqual({ status: 'exists' });
    expect(await rows('SELECT like_count FROM recipes WHERE id = $1', [NEW_RECIPE])).toEqual([
      { like_count: 6 },
    ]);
  });

  it('an add the caller already made answers "exists" and changes nothing', async () => {
    const before = await snapshot();

    expect(await core.addFavorite(NORMAL, FAVED_RECIPE)).toEqual({ status: 'exists' });

    expect(await snapshot()).toEqual(before);
  });
});
