// @vitest-environment node
/**
 * #103 (D7c S4): account soft delete with a 30-day grace period and undo.
 *
 * Runs the real server actions, the real Auth.js callbacks and the real
 * `auth-users` queries against PGlite. `db.batch` is shimmed as one
 * BEGIN/COMMIT transaction, which is what neon-http sends, so a failing
 * statement rolls the whole batch back here too.
 */

import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const USER = 'user_deleter';
const ADMIN = 'user_admin';
const OTHER = 'user_other';
const EMAIL = 'deleter@example.test';
const C1 = 'aaaaaaaa-0000-4000-8000-00000000000a';
const C2 = 'bbbbbbbb-0000-4000-8000-00000000000b';
const P1 = 'cccccccc-0000-4000-8000-00000000000c';
const ADMIN_DELETED_AT = new Date('2026-01-01T00:00:00.000Z');
const PROFILE_UPDATED_AT = new Date('2026-02-02T00:00:00.000Z');

const state = vi.hoisted(() => ({
  db: undefined as unknown,
  userId: null as string | null,
}));

vi.mock('@/lib/session-user', () => ({
  getSessionUserId: async () => state.userId,
  getSessionUser: async () => (state.userId ? { id: state.userId } : null),
}));
vi.mock('@/lib/db', () => ({
  get db() {
    return state.db;
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

import { createVisibilityDb } from '@/app/actions/__tests__/recipe-visibility-db';
import { requestAccountDeletion, undoAccountDeletion } from '@/app/actions/account-deletion';
import { getRecipeCommentCount, getRecipeComments } from '@/app/actions/social';
import { getProfileByUsername } from '@/app/actions/user-profiles';
import { DELETION_GRACE_PERIOD_MS } from '@/lib/account-deletion';
import { issueUndoToken, verifyUndoToken } from '@/lib/account-deletion/undo-token';
import { ADMIN_CLAIM_TTL_MS, authorizeSignIn, refreshAdminClaim } from '@/lib/auth-callbacks';
import { users } from '@/lib/db/auth-schema';
import * as schema from '@/lib/db/schema';
import { userProfiles } from '@/lib/db/user-discovery-schema';
import { ANONYMOUS_VIEWER, findViewableRecipe } from '@/lib/recipe-visibility';

let client: PGlite;

type TestDb = Awaited<ReturnType<typeof createVisibilityDb>>['db'] & {
  batch?: (queries: PromiseLike<unknown>[]) => Promise<unknown[]>;
};

function recipeRow(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    user_id: USER,
    name: id,
    ingredients: '[]',
    instructions: '[]',
    is_public: true,
    moderation_status: 'approved' as const,
    ...extra,
  };
}

async function rows(query: string) {
  return (await client.query(query)).rows as Record<string, unknown>[];
}

async function seed(profilePublic = true) {
  const db = state.db as TestDb;
  for (const t of ['users', 'recipes', 'recipe_comments', 'user_profiles']) {
    await client.exec(`DELETE FROM "${t}";`);
  }
  await db.insert(users).values([
    { id: USER, email: EMAIL, is_admin: false },
    { id: ADMIN, email: 'admin@example.test', is_admin: true },
    { id: OTHER, email: 'other@example.test', is_admin: false },
  ]);
  await db.insert(schema.recipes).values([
    recipeRow('mine-public'),
    recipeRow('mine-private', { is_public: false }),
    // Deleted by an admin before the request: must stay deleted after undo.
    recipeRow('mine-admin-deleted', { deleted_at: ADMIN_DELETED_AT, deleted_by: ADMIN }),
    recipeRow('theirs', { user_id: OTHER }),
  ]);
  await db.insert(schema.recipeComments).values([
    { id: C1, recipe_id: 'theirs', user_id: USER, content: 'mine', is_flagged: false },
    { id: C2, recipe_id: 'theirs', user_id: OTHER, content: 'theirs', is_flagged: false },
  ]);
  await db.insert(userProfiles).values({
    id: P1,
    user_id: USER,
    username: 'deleter',
    display_name: 'Deleter',
    is_public: profilePublic,
    created_at: PROFILE_UPDATED_AT,
    updated_at: PROFILE_UPDATED_AT,
  });
}

async function visibility() {
  return rows(
    `SELECT id, deleted_at::text AS deleted_at, deleted_by FROM recipes WHERE user_id = '${USER}' ORDER BY id`
  );
}

async function request(confirmEmail = EMAIL, keepRecipes = false) {
  state.userId = USER;
  return requestAccountDeletion({ confirmEmail, keepRecipes });
}

function googleSignIn(email = EMAIL) {
  return authorizeSignIn({
    user: { id: 'g-1', email },
    account: { provider: 'google', type: 'oidc', providerAccountId: 'g-1' },
    profile: { email, email_verified: true },
  });
}

/** The token a blocked sign-in hands to the undo page. */
async function undoTokenFromSignIn(): Promise<string> {
  const redirect = await googleSignIn();
  expect(typeof redirect).toBe('string');
  return new URL(redirect as string, 'https://joanies.kitchen').searchParams.get('token') ?? '';
}

beforeAll(async () => {
  const made = await createVisibilityDb(
    [users, schema.recipes, schema.recipeComments, userProfiles],
    { ...schema, users, userProfiles }
  );
  client = made.client;
  // neon-http's db.batch is one HTTP transaction; mirror that on PGlite.
  const db: TestDb = made.db;
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

beforeEach(async () => {
  vi.unstubAllEnvs();
  vi.stubEnv('AUTH_ADMIN_EMAILS', '');
  vi.stubEnv('AUTH_SECRET', 'test-secret-for-undo-tokens');
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  state.userId = null;
  await seed();
});

describe('requestAccountDeletion', () => {
  it('hides recipes, profile and comments from anonymous readers in one batch', async () => {
    expect(await request()).toEqual({ success: true });

    const [user] = await rows(
      `SELECT deletion_requested_at::text AS deletion_requested_at, deletion_keep_recipes FROM users WHERE id = '${USER}'`
    );
    expect(user.deletion_requested_at).not.toBeNull();
    expect(user.deletion_keep_recipes).toBe(false);

    const marker = `account-deletion:${USER}`;
    expect(await visibility()).toEqual([
      { id: 'mine-admin-deleted', deleted_at: '2026-01-01 00:00:00', deleted_by: ADMIN },
      { id: 'mine-private', deleted_at: user.deletion_requested_at, deleted_by: marker },
      { id: 'mine-public', deleted_at: user.deletion_requested_at, deleted_by: marker },
    ]);

    state.userId = null;
    expect(await findViewableRecipe('mine-public', ANONYMOUS_VIEWER)).toBeNull();
    expect(await getProfileByUsername('deleter')).toBeNull();
    const comments = await getRecipeComments('theirs');
    expect(comments.success && comments.data.map((c) => c.id)).toEqual([C2]);
    const count = await getRecipeCommentCount('theirs');
    expect(count.success && count.data).toBe(1);
    // #103: moderation's is_flagged is not used for this.
    const [comment] = await rows(`SELECT is_flagged FROM recipe_comments WHERE id = '${C1}'`);
    expect(comment.is_flagged).toBe(false);
    // Other users' content is untouched.
    expect(await findViewableRecipe('theirs', ANONYMOUS_VIEWER)).not.toBeNull();
  });

  it('records the keep-recipes choice', async () => {
    expect(await request(EMAIL, true)).toEqual({ success: true });
    const [user] = await rows(`SELECT deletion_keep_recipes FROM users WHERE id = '${USER}'`);
    expect(user.deletion_keep_recipes).toBe(true);
  });

  it('accepts the email case-insensitively', async () => {
    expect(await request('  Deleter@Example.TEST ')).toEqual({ success: true });
  });

  it.each([
    ['a wrong email', 'someone@example.test'],
    ['a blank email', '   '],
  ])('refuses %s and changes nothing', async (_label, email) => {
    const result = await request(email);
    expect(result).toEqual({
      success: false,
      error: 'The email you typed does not match your account email.',
    });
    const [user] = await rows(`SELECT deletion_requested_at FROM users WHERE id = '${USER}'`);
    expect(user.deletion_requested_at).toBeNull();
    expect((await visibility()).filter((r) => r.deleted_by !== ADMIN)).toEqual([
      { id: 'mine-private', deleted_at: null, deleted_by: null },
      { id: 'mine-public', deleted_at: null, deleted_by: null },
    ]);
  });

  it('refuses an admin self-delete', async () => {
    state.userId = ADMIN;
    const result = await requestAccountDeletion({
      confirmEmail: 'admin@example.test',
      keepRecipes: false,
    });
    expect(result).toEqual({
      success: false,
      error: 'Admin accounts cannot be deleted from settings.',
    });
    const [admin] = await rows(`SELECT deletion_requested_at FROM users WHERE id = '${ADMIN}'`);
    expect(admin.deletion_requested_at).toBeNull();
  });

  it('refuses an AUTH_ADMIN_EMAILS admin whose row is not yet flagged', async () => {
    vi.stubEnv('AUTH_ADMIN_EMAILS', EMAIL);
    expect((await request()).success).toBe(false);
  });

  it('refuses a signed-out caller and a repeat request', async () => {
    expect(await requestAccountDeletion({ confirmEmail: EMAIL, keepRecipes: false })).toEqual({
      success: false,
      error: 'You must be signed in.',
    });
    expect((await request()).success).toBe(true);
    const [first] = await rows(`SELECT deletion_requested_at FROM users WHERE id = '${USER}'`);
    expect(await request()).toEqual({
      success: false,
      error: 'Deletion has already been requested for this account.',
    });
    const [again] = await rows(`SELECT deletion_requested_at FROM users WHERE id = '${USER}'`);
    expect(again.deletion_requested_at).toEqual(first.deletion_requested_at);
  });

  it('returns failure and leaves no partial state when the batch fails', async () => {
    // The third statement (user_profiles) fails; the first two must roll back.
    await client.exec('ALTER TABLE user_profiles RENAME TO user_profiles_gone;');
    try {
      const result = await request();
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Nothing was changed/);
    } finally {
      await client.exec('ALTER TABLE user_profiles_gone RENAME TO user_profiles;');
    }
    const [user] = await rows(`SELECT deletion_requested_at FROM users WHERE id = '${USER}'`);
    expect(user.deletion_requested_at).toBeNull();
    expect((await visibility()).filter((r) => r.deleted_by !== ADMIN)).toEqual([
      { id: 'mine-private', deleted_at: null, deleted_by: null },
      { id: 'mine-public', deleted_at: null, deleted_by: null },
    ]);
  });
});

describe('session cut-off', () => {
  const NOW = Date.now();

  it('invalidates a pending-deletion JWT once the TTL has passed', async () => {
    const before = await refreshAdminClaim({
      token: { sub: USER, adminCheckedAt: NOW - ADMIN_CLAIM_TTL_MS },
      now: NOW,
    });
    expect(before).toMatchObject({ sub: USER, isAdmin: false, adminCheckedAt: NOW });

    expect((await request()).success).toBe(true);

    // Inside the TTL the token is not re-read; at the TTL it is ended.
    const fresh = { sub: USER, isAdmin: false, adminCheckedAt: NOW };
    await expect(
      refreshAdminClaim({ token: { ...fresh }, now: NOW + ADMIN_CLAIM_TTL_MS - 1 })
    ).resolves.not.toBeNull();
    await expect(
      refreshAdminClaim({ token: { ...fresh }, now: NOW + ADMIN_CLAIM_TTL_MS })
    ).resolves.toBeNull();
  });

  it('refuses sign-in for a pending-deletion user and redirects to the undo page', async () => {
    expect(await googleSignIn()).toBe(true);
    expect((await request()).success).toBe(true);

    const redirect = await googleSignIn();
    expect(redirect).toMatch(/^\/account\/undo-deletion\?token=/);
    const token = await undoTokenFromSignIn();
    expect(verifyUndoToken(token)?.userId).toBe(USER);
  });

  it('refuses sign-in after the grace period, with no undo link', async () => {
    expect((await request()).success).toBe(true);
    const past = new Date(Date.now() - DELETION_GRACE_PERIOD_MS - 1000).toISOString();
    await client.exec(`UPDATE users SET deletion_requested_at = '${past}' WHERE id = '${USER}';`);
    expect(await googleSignIn()).toBe(false);
  });

  it('refuses sign-in when the deletion-state lookup fails', async () => {
    await client.exec('ALTER TABLE users RENAME TO users_gone;');
    try {
      expect(await googleSignIn()).toBe(false);
    } finally {
      await client.exec('ALTER TABLE users_gone RENAME TO users;');
    }
  });
});

describe('undoAccountDeletion', () => {
  it('restores exactly the visibility from before the request', async () => {
    const recipesBefore = await visibility();
    const profileBefore = await rows(`SELECT is_public FROM user_profiles WHERE id = '${P1}'`);
    expect((await request()).success).toBe(true);

    const token = await undoTokenFromSignIn();
    expect(await undoAccountDeletion(token)).toEqual({ success: true });

    expect(await visibility()).toEqual(recipesBefore);
    expect(await rows(`SELECT is_public FROM user_profiles WHERE id = '${P1}'`)).toEqual(
      profileBefore
    );
    const [user] = await rows(
      `SELECT deletion_requested_at, deletion_keep_recipes FROM users WHERE id = '${USER}'`
    );
    expect(user).toEqual({ deletion_requested_at: null, deletion_keep_recipes: null });
    const comments = await getRecipeComments('theirs');
    expect(comments.success && comments.data.map((c) => c.id).sort()).toEqual([C1, C2]);
    expect(await googleSignIn()).toBe(true);
    // The used token is void: the request it was bound to is gone.
    expect((await undoAccountDeletion(token)).success).toBe(false);
  });

  it('keeps a profile that was private before the request private', async () => {
    await seed(false);
    expect((await request()).success).toBe(true);
    expect(await undoAccountDeletion(await undoTokenFromSignIn())).toEqual({ success: true });
    const [profile] = await rows(`SELECT is_public FROM user_profiles WHERE id = '${P1}'`);
    expect(profile.is_public).toBe(false);
  });

  it.each([
    ['a tampered token', (t: string) => `${t.slice(0, -2)}xx`],
    ['a garbage token', () => 'not-a-token'],
    ['an empty token', () => ''],
  ])('refuses %s and changes nothing', async (_label, mangle) => {
    expect((await request()).success).toBe(true);
    const token = mangle(await undoTokenFromSignIn());
    expect((await undoAccountDeletion(token)).success).toBe(false);
    const [user] = await rows(`SELECT deletion_requested_at FROM users WHERE id = '${USER}'`);
    expect(user.deletion_requested_at).not.toBeNull();
  });

  it('refuses an expired token', async () => {
    expect((await request()).success).toBe(true);
    const [user] = await rows(`SELECT deletion_requested_at FROM users WHERE id = '${USER}'`);
    const old = issueUndoToken(
      { userId: USER, requestedAtMs: (user.deletion_requested_at as Date).getTime() },
      Date.now() - 60 * 60 * 1000
    );
    expect((await undoAccountDeletion(old)).success).toBe(false);
  });

  it('returns failure and leaves no partial state when the batch fails', async () => {
    expect((await request()).success).toBe(true);
    const hidden = await visibility();
    const token = await undoTokenFromSignIn();
    // The first statement (user_profiles) fails; nothing may be restored.
    await client.exec('ALTER TABLE user_profiles RENAME TO user_profiles_gone;');
    try {
      const result = await undoAccountDeletion(token);
      expect(result.success).toBe(false);
    } finally {
      await client.exec('ALTER TABLE user_profiles_gone RENAME TO user_profiles;');
    }
    expect(await visibility()).toEqual(hidden);
    const [user] = await rows(`SELECT deletion_requested_at FROM users WHERE id = '${USER}'`);
    expect(user.deletion_requested_at).not.toBeNull();
  });
});
