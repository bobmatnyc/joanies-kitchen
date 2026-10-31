// @vitest-environment node
/**
 * #210: no path creates a `user_profiles` row, or makes one public, for an
 * account whose `users.deletion_requested_at` is set. Profile inserts carry the
 * check in their own statement (as #197 and #208 do), so a deletion requested
 * after every read that runs first still refuses the write.
 * Real core, server actions and v1 route against PGlite.
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
import { createCollection } from '@/app/actions/collections';
import { addFavorite as addFavoriteAction } from '@/app/actions/favorites';
import { trackRecipeView } from '@/app/actions/recipe-views';
import { createOrUpdateProfile, updateProfileSettings } from '@/app/actions/user-profiles';
import { POST as favoritePOST } from '@/app/api/v1/favorites/[recipeId]/route';
import { markAccountDeleted, restoreAccount } from '@/lib/account-deletion';
import type { RouteContext } from '@/lib/api-auth/types';
import { users } from '@/lib/db/auth-schema';
import * as schema from '@/lib/db/schema';
import { collections, favorites, recipeViews, userProfiles } from '@/lib/db/user-discovery-schema';
import {
  ensureUserProfileFor,
  ensureUserProfileStatus,
  PENDING_DELETION_PROFILE_ERROR,
} from '@/lib/ensure-user-profile';
import * as core from '@/lib/favorites';

const PENDING = 'user_pending_no_profile';
const HIDDEN = 'user_pending_hidden_profile';
const NORMAL = 'user_normal';
const LEGACY = 'user_legacy_no_users_row';
const RECIPE = 'aaaaaaaa-0000-4000-8000-00000000000a';
const REQUESTED_AT = new Date('2026-10-01T00:00:00.000Z');

let client: PGlite;
type TestDb = Awaited<ReturnType<typeof createVisibilityDb>>['db'] & {
  batch?: (queries: PromiseLike<unknown>[]) => Promise<unknown[]>;
};
type ExecDb = { execute: (q: SQL) => Promise<unknown> };

async function rows(query: string, params: unknown[] = []) {
  return (await client.query(query, params)).rows as Record<string, unknown>[];
}

/**
 * Every profile row, to prove a refusal created or published nothing. updated_at
 * is included: restoreAccount re-publishes only while it still equals the request time.
 */
async function profiles() {
  return rows(
    'SELECT user_id, username, display_name, is_public, updated_at FROM user_profiles ORDER BY user_id'
  );
}

const sqlText = (q: SQL) => new PgDialect().sqlToQuery(q).sql;
const isProfileInsert = (q: SQL) => /INSERT INTO "user_profiles"/.test(sqlText(q));

/** Sets the deletion flag inside the profile INSERT's call, after every earlier read. */
function requestDeletionAtProfileInsert(userId: string) {
  const db = state.db as ExecDb;
  const original = db.execute.bind(db);
  vi.spyOn(db, 'execute').mockImplementation(async (q) => {
    if (isProfileInsert(q)) {
      await rows('UPDATE users SET deletion_requested_at = now() WHERE id = $1', [userId]);
    }
    return original(q);
  });
}

beforeAll(async () => {
  const built = await createVisibilityDb(
    [users, schema.recipes, userProfiles, favorites, collections, recipeViews],
    { ...schema, userProfiles, favorites, collections, recipeViews },
    { constraints: true }
  );
  client = built.client;
  // neon-http's db.batch is one HTTP transaction; mirror that on PGlite.
  const db: TestDb = built.db;
  db.batch = async (queries: PromiseLike<unknown>[]) => {
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

afterAll(async () => {
  await client?.close();
});

beforeEach(async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  await client.exec(
    'DELETE FROM recipe_views; DELETE FROM collections; DELETE FROM favorites; DELETE FROM user_profiles; DELETE FROM recipes; DELETE FROM users;'
  );
  await rows(
    `INSERT INTO users (id, name, email, deletion_requested_at) VALUES
      ($1, 'Pending Person', 'p@example.test', $4), ($2, 'Hidden Person', 'h@example.test', $4),
      ($3, 'Normal Person', 'n@example.test', NULL)`,
    [PENDING, HIDDEN, NORMAL, REQUESTED_AT]
  );
  // The hidden profile is what markAccountDeleted leaves behind.
  await rows(
    `INSERT INTO user_profiles (user_id, username, display_name, is_public, updated_at)
      VALUES ($1, 'hidden', 'Hidden', false, $2)`,
    [HIDDEN, REQUESTED_AT]
  );
  await client.exec(`INSERT INTO recipes (id, user_id, name, ingredients, instructions,
      is_public, moderation_status) VALUES
    ('${RECIPE}', 'owner', 'Soup', '[]', '[]', true, 'approved')`);
});

afterEach(() => {
  vi.restoreAllMocks();
  state.userId = null;
});

describe('#210 a pending account with no profile gets none, and each caller refuses', () => {
  it('ensureUserProfileStatus answers pending-deletion; ensureUserProfileFor answers null', async () => {
    const before = await profiles();

    expect(await ensureUserProfileStatus(PENDING)).toEqual({ status: 'pending-deletion' });
    expect(await ensureUserProfileFor(PENDING, { name: 'Session Name' })).toBeNull();

    expect(await profiles()).toEqual(before);
  });

  it('favorites core answers pending-deletion, not no-profile', async () => {
    const before = await profiles();

    expect(await core.addFavorite(PENDING, RECIPE)).toEqual({ status: 'pending-deletion' });

    expect(await profiles()).toEqual(before);
    expect(await rows('SELECT * FROM favorites')).toEqual([]);
  });

  it('favorite server action returns the pending-deletion error', async () => {
    state.userId = PENDING;
    const before = await profiles();

    expect(await addFavoriteAction(RECIPE)).toEqual({
      success: false,
      error: core.PENDING_DELETION_FAVORITE_ERROR,
    });

    expect(await profiles()).toEqual(before);
  });

  it('POST /api/v1/favorites/:recipeId answers 403', async () => {
    state.userId = PENDING;
    const before = await profiles();

    const res = await favoritePOST(
      new NextRequest(`http://localhost/api/v1/favorites/${RECIPE}`, { method: 'POST' }),
      { params: Promise.resolve({ recipeId: RECIPE }) } as RouteContext
    );

    expect(res.status).toBe(403);
    expect(await profiles()).toEqual(before);
  });

  it('createCollection returns its no-profile error and writes nothing', async () => {
    state.userId = PENDING;
    const before = await profiles();

    expect(await createCollection({ name: 'Soups' })).toEqual({
      success: false,
      error: 'Failed to create user profile',
    });

    expect(await profiles()).toEqual(before);
    expect(await rows('SELECT * FROM collections')).toEqual([]);
  });

  it('trackRecipeView does not throw and creates no profile', async () => {
    state.userId = PENDING;
    const before = await profiles();

    await expect(trackRecipeView(RECIPE)).resolves.toBeUndefined();

    expect(await profiles()).toEqual(before);
  });

  it('createOrUpdateProfile returns the pending-deletion error', async () => {
    state.userId = PENDING;
    const before = await profiles();

    expect(
      await createOrUpdateProfile({ username: 'pending', display_name: 'P', is_public: true })
    ).toEqual({ success: false, error: PENDING_DELETION_PROFILE_ERROR });

    expect(await profiles()).toEqual(before);
  });
});

describe('#210 a pending account with a hidden profile stays hidden', () => {
  it('ensureUserProfileStatus returns the profile unchanged', async () => {
    const before = await profiles();

    const result = await ensureUserProfileStatus(HIDDEN);

    expect(result).toMatchObject({
      status: 'ready',
      profile: { user_id: HIDDEN, is_public: false },
    });
    expect(await profiles()).toEqual(before);
  });

  it.each([
    [
      'createOrUpdateProfile',
      () => createOrUpdateProfile({ username: 'hidden', display_name: 'H', is_public: true }),
    ],
    ['updateProfileSettings', () => updateProfileSettings({ isPublic: true })],
  ])('%s refuses to publish it', async (_n, call) => {
    state.userId = HIDDEN;
    const before = await profiles();

    expect(await call()).toEqual({ success: false, error: PENDING_DELETION_PROFILE_ERROR });

    expect(await profiles()).toEqual(before);
  });
});

describe('#210 the guard is in the insert statement', () => {
  it('ensureUserProfileStatus refuses when the deletion lands after every earlier read', async () => {
    // A guard in a separate query before the insert passes here and the row lands.
    requestDeletionAtProfileInsert(NORMAL);
    const before = await profiles();

    expect(await ensureUserProfileStatus(NORMAL)).toEqual({ status: 'pending-deletion' });

    expect(await profiles()).toEqual(before);
  });

  it('createOrUpdateProfile refuses when the deletion lands after every earlier read', async () => {
    state.userId = NORMAL;
    requestDeletionAtProfileInsert(NORMAL);
    const before = await profiles();

    expect(await createOrUpdateProfile({ username: 'normal', display_name: 'N' })).toEqual({
      success: false,
      error: PENDING_DELETION_PROFILE_ERROR,
    });

    expect(await profiles()).toEqual(before);
  });

  // A normal user, so the insert runs whatever any pre-check would answer.
  it.each([
    ['ensureUserProfileStatus', () => ensureUserProfileStatus(NORMAL)],
    [
      'createOrUpdateProfile',
      () => {
        state.userId = NORMAL;
        return createOrUpdateProfile({ username: 'normal', display_name: 'N' });
      },
    ],
  ])('%s: one profile INSERT statement, carrying the guard', async (_n, call) => {
    const execute = vi.spyOn(state.db as ExecDb, 'execute');

    await call();

    const inserts = execute.mock.calls.map(([q]) => q).filter(isProfileInsert);
    expect(inserts).toHaveLength(1);
    expect(sqlText(inserts[0]).replace(/\s+/g, ' ')).toMatch(
      /^ WITH allowed AS \( SELECT 1 AS ok WHERE NOT EXISTS \(SELECT 1 FROM "users" WHERE "users"\."id" = \$\d+ AND "users"\."deletion_requested_at" IS NOT NULL\) \), inserted AS \( INSERT INTO "user_profiles" \([^)]*\) SELECT .* FROM allowed /
    );
  });
});

describe('#210 other accounts are unchanged', () => {
  it('a normal user gets a public profile named from the users row (#181)', async () => {
    const result = await ensureUserProfileStatus(NORMAL);

    expect(result).toMatchObject({
      status: 'ready',
      profile: { user_id: NORMAL, username: 'normal-person', is_public: true },
    });
    expect(await ensureUserProfileFor(NORMAL)).toMatchObject({ username: 'normal-person' });
    expect(
      await rows('SELECT count(*)::int AS n FROM user_profiles WHERE user_id = $1', [NORMAL])
    ).toEqual([{ n: 1 }]);
  });

  it('a legacy id with no users row gets user-<id8>', async () => {
    expect(await ensureUserProfileFor(LEGACY)).toMatchObject({
      user_id: LEGACY,
      username: `user-${LEGACY.slice(0, 8)}`,
      is_public: true,
    });
  });

  it('a normal user creates, edits and publishes a profile', async () => {
    state.userId = NORMAL;

    const created = await createOrUpdateProfile({
      username: 'chef',
      display_name: 'Chef',
      specialties: ['Baking'],
      is_public: false,
    });
    expect(created).toMatchObject({
      success: true,
      profile: { username: 'chef', specialties: ['Baking'], is_public: false },
    });
    expect(
      await createOrUpdateProfile({ username: 'chef', display_name: 'Chef Two', is_public: false })
    ).toMatchObject({ success: true, profile: { display_name: 'Chef Two' } });
    // Its camelCase `isPublic` key is not a column, so only updated_at changes (as before #210).
    expect(await updateProfileSettings({ isPublic: true })).toMatchObject({ success: true });
  });

  it('updateProfileSettings with no profile still answers "Profile not found"', async () => {
    state.userId = NORMAL;
    expect(await updateProfileSettings({ isPublic: true })).toEqual({
      success: false,
      error: 'Profile not found',
    });
  });
});

describe('#210 restoring the account re-enables profile writes', () => {
  it('a restored account with no profile gets one again', async () => {
    await restoreAccount(PENDING, REQUESTED_AT);

    expect(await ensureUserProfileFor(PENDING)).toMatchObject({
      user_id: PENDING,
      is_public: true,
    });
  });

  it('refused edits during the grace period leave the hidden profile restorable', async () => {
    state.userId = HIDDEN;
    await createOrUpdateProfile({ username: 'hidden', display_name: 'Edited', is_public: false });
    await updateProfileSettings({ isPublic: false });

    await restoreAccount(HIDDEN, REQUESTED_AT);

    expect(
      await rows('SELECT display_name, is_public FROM user_profiles WHERE user_id = $1', [HIDDEN])
    ).toEqual([{ display_name: 'Hidden', is_public: true }]);
  });

  it('a restored public profile is public again and editable', async () => {
    state.userId = NORMAL;
    expect((await createOrUpdateProfile({ username: 'normal', display_name: 'N' })).success).toBe(
      true
    );
    const requestedAt = new Date('2026-10-20T00:00:00.000Z');
    await markAccountDeleted(NORMAL, false, requestedAt);
    expect(await updateProfileSettings({ isPublic: true })).toEqual({
      success: false,
      error: PENDING_DELETION_PROFILE_ERROR,
    });

    await restoreAccount(NORMAL, requestedAt);

    expect(await rows('SELECT is_public FROM user_profiles WHERE user_id = $1', [NORMAL])).toEqual([
      { is_public: true },
    ]);
    expect(
      await createOrUpdateProfile({ username: 'normal', display_name: 'Back', is_public: true })
    ).toMatchObject({ success: true, profile: { display_name: 'Back', is_public: true } });
  });
});
