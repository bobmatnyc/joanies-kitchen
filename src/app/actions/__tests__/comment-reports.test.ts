// @vitest-environment node
/**
 * #105 (D7c S6): comment reports and auto-hide at three distinct reporters.
 *
 * Runs `reportComment` and the moderation queue against PGlite with the real
 * partial unique index (comment_id, user_id) from migration 0004.
 */

import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const ADMIN = 'user_admin';
const AUTHOR = 'user_author';
const R1 = 'recipe-1';
const C1 = 'aaaaaaaa-0000-4000-8000-00000000000a';

const state = vi.hoisted(() => ({
  db: undefined as unknown,
  userId: null as string | null,
  rateAllowed: true,
}));

vi.mock('@/lib/session-user', () => ({
  getSessionUserId: async () => state.userId,
  getSessionUser: async () => (state.userId ? { id: state.userId } : null),
}));
vi.mock('@/lib/auth-users', () => ({
  getUserAdminFlag: async (userId: string) => userId === ADMIN,
}));
vi.mock('@/lib/db', () => ({
  get db() {
    return state.db;
  },
}));
vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: async () =>
    state.rateAllowed
      ? { allowed: true, count: 1, limit: 20 }
      : { allowed: false, reason: 'limited', retryAfterSec: 60, limit: 20 },
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

import { actOnRecipeFlag, flagRecipe, getAllFlags } from '@/app/actions/flag-recipe';
import { reportComment } from '@/app/actions/report-comment';
import { getRecipeComments, setCommentHidden } from '@/app/actions/social';
import { users } from '@/lib/db/auth-schema';
import * as schema from '@/lib/db/schema';
import { userProfiles } from '@/lib/db/user-discovery-schema';
import { createVisibilityDb } from './recipe-visibility-db';

type TestDb = Awaited<ReturnType<typeof createVisibilityDb>>['db'];

let client: PGlite;
let testDb: TestDb;

async function rows(sql: string) {
  return (await client.query(sql)).rows as Record<string, unknown>[];
}

async function isHidden() {
  return (await rows(`SELECT is_flagged FROM recipe_comments WHERE id = '${C1}'`))[0]?.is_flagged;
}

async function reportAs(userId: string) {
  state.userId = userId;
  return reportComment(C1, 'harassment');
}

beforeAll(async () => {
  const made = await createVisibilityDb(
    [schema.recipes, schema.recipeFlags, schema.recipeComments, userProfiles, users],
    { ...schema, userProfiles, users }
  );
  client = made.client;
  // Production defaults and the 0004 partial unique index; the helper builds bare columns.
  await client.exec(`ALTER TABLE "recipe_flags" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();`);
  await client.exec(
    `CREATE UNIQUE INDEX "recipe_flags_comment_user_unique" ON "recipe_flags" ("comment_id","user_id") WHERE "comment_id" IS NOT NULL;`
  );
  const db = made.db;
  // neon-http's db.batch is one HTTP transaction; mirror that on PGlite.
  Object.assign(db, {
    batch: async (queries: Promise<unknown>[]) => {
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
    },
  });
  testDb = db;
  state.db = db;
});

beforeEach(async () => {
  for (const t of ['recipes', 'recipe_flags', 'recipe_comments']) {
    await client.exec(`DELETE FROM "${t}";`);
  }
  await testDb.insert(schema.recipes).values({
    id: R1,
    user_id: 'owner',
    name: R1,
    ingredients: '[]',
    instructions: '[]',
    is_public: true,
    moderation_status: 'approved',
  });
  await testDb.insert(schema.recipeComments).values({
    id: C1,
    recipe_id: R1,
    user_id: AUTHOR,
    content: 'mean words',
    is_flagged: false,
  });
  state.rateAllowed = true;
  vi.restoreAllMocks();
});

describe('reportComment', () => {
  it('stores a report in recipe_flags with comment_id', async () => {
    const result = await reportAs('u1');
    expect(result).toEqual({ success: true, hidden: false });
    expect(await rows('SELECT recipe_id, comment_id, user_id, status FROM recipe_flags')).toEqual([
      { recipe_id: R1, comment_id: C1, user_id: 'u1', status: 'pending' },
    ]);
  });

  it('refuses a signed-out caller and stores nothing', async () => {
    state.userId = null;
    const result = await reportComment(C1, 'spam');
    expect(result.success).toBe(false);
    expect(await rows('SELECT id FROM recipe_flags')).toEqual([]);
  });

  it('refuses a report on your own comment', async () => {
    const result = await reportAs(AUTHOR);
    expect(result).toEqual({ success: false, error: 'You cannot report your own comment' });
    expect(await rows('SELECT id FROM recipe_flags')).toEqual([]);
  });

  it('refuses when the rate limit is exhausted', async () => {
    state.rateAllowed = false;
    expect((await reportAs('u1')).success).toBe(false);
    expect(await rows('SELECT id FROM recipe_flags')).toEqual([]);
  });

  it('counts a repeat report once and never hides on one user alone', async () => {
    for (let i = 0; i < 3; i++) await reportAs('u1');
    const again = await reportAs('u1');
    expect(again).toEqual({ success: true, alreadyReported: true });
    expect(await rows('SELECT id FROM recipe_flags')).toHaveLength(1);
    expect(await isHidden()).toBe(false);
  });

  it('hides at exactly the third distinct reporter, not the second', async () => {
    expect((await reportAs('u1')).hidden).toBe(false);
    expect((await reportAs('u2')).hidden).toBe(false);
    expect(await isHidden()).toBe(false);
    expect((await reportAs('u3')).hidden).toBe(true);
    expect(await isHidden()).toBe(true);
    // A fourth reporter does not re-apply the hide.
    expect((await reportAs('u4')).hidden).toBe(false);

    state.userId = 'viewer';
    const list = await getRecipeComments(R1);
    expect(list.success && list.data).toEqual([]);
    // Recipes never auto-hide.
    const recipe = await rows(`SELECT moderation_status FROM recipes WHERE id = '${R1}'`);
    expect(recipe[0].moderation_status).toBe('approved');
  });

  it('surfaces a hide failure after the report is stored', async () => {
    await reportAs('u1');
    await reportAs('u2');
    vi.spyOn(testDb, 'update').mockImplementationOnce(() => {
      throw new Error('neon down');
    });
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const result = await reportAs('u3');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/could not be hidden/);
    expect(logged).toHaveBeenCalled();
    expect(await rows('SELECT id FROM recipe_flags')).toHaveLength(3);
    expect(await isHidden()).toBe(false);
  });

  it('does not block a later report on the recipe itself', async () => {
    await reportAs('u1');
    expect((await flagRecipe(R1, 'spam')).success).toBe(true);
  });
});

describe('moderation queue', () => {
  async function hideByReports() {
    for (const u of ['u1', 'u2', 'u3']) await reportAs(u);
    state.userId = ADMIN;
    const flags = await getAllFlags();
    const flag = flags.find((f) => f.user_id === 'u1');
    if (!flag) throw new Error('u1 report missing');
    return flag;
  }

  it('lists comment reports with the comment and its hidden state', async () => {
    const flag = await hideByReports();
    expect(flag).toMatchObject({
      comment_id: C1,
      commentContent: 'mean words',
      commentHidden: true,
      status: 'pending',
    });
    expect((await getAllFlags()).filter((f) => f.comment_id === C1)).toHaveLength(3);
  });

  it('dismiss un-hides the comment and closes every pending report on it', async () => {
    const flag = await hideByReports();
    expect(await actOnRecipeFlag(flag.id, 'dismiss')).toEqual({ success: true });
    expect(await isHidden()).toBe(false);
    expect(await rows(`SELECT DISTINCT status FROM recipe_flags`)).toEqual([
      { status: 'dismissed' },
    ]);
    // Dismissed reports no longer count toward a new auto-hide.
    expect((await reportAs('u5')).hidden).toBe(false);
  });

  it('unhide restores the comment and remove deletes it', async () => {
    const flag = await hideByReports();
    expect(await actOnRecipeFlag(flag.id, 'unhide')).toEqual({ success: true });
    expect(await isHidden()).toBe(false);
    expect(await actOnRecipeFlag(flag.id, 'hide')).toEqual({ success: true });
    expect(await isHidden()).toBe(true);
    expect(await actOnRecipeFlag(flag.id, 'remove')).toEqual({ success: true });
    expect(await rows(`SELECT id FROM recipe_comments`)).toEqual([]);
    const recipe = await rows(`SELECT deleted_at FROM recipes WHERE id = '${R1}'`);
    expect(recipe[0].deleted_at).toBeNull();
  });

  it('refuses a non-admin', async () => {
    const flag = await hideByReports();
    state.userId = 'u1';
    expect((await actOnRecipeFlag(flag.id, 'dismiss')).success).toBe(false);
    expect(await isHidden()).toBe(true);
  });

  // #194 (ruling Df8): every admin unhide path closes the pending reports with the unhide.
  const unhidePaths: [string, (flagId: string) => Promise<{ success: boolean }>][] = [
    ['the flag queue', (flagId) => actOnRecipeFlag(flagId, 'unhide')],
    ['setCommentHidden', () => setCommentHidden(C1, false)],
  ];

  describe.each(unhidePaths)('unhide via %s', (_name, unhide) => {
    it('dismisses every pending report; only three new reporters re-hide', async () => {
      const flag = await hideByReports();
      expect((await unhide(flag.id)).success).toBe(true);
      expect(await isHidden()).toBe(false);
      expect(await rows(`SELECT DISTINCT status, reviewed_by FROM recipe_flags`)).toEqual([
        { status: 'dismissed', reviewed_by: ADMIN },
      ]);

      // Earlier reporters cannot report again, so they never count twice.
      for (const u of ['u1', 'u2', 'u3']) {
        expect(await reportAs(u)).toEqual({ success: true, alreadyReported: true });
      }
      expect((await reportAs('u4')).hidden).toBe(false);
      expect((await reportAs('u5')).hidden).toBe(false);
      expect(await isHidden()).toBe(false);
      expect((await reportAs('u6')).hidden).toBe(true);
      expect(await isHidden()).toBe(true);
      const recipe = await rows(`SELECT moderation_status FROM recipes WHERE id = '${R1}'`);
      expect(recipe[0].moderation_status).toBe('approved');
    });

    // Either write failing must undo the other, whichever order an implementation runs them in.
    it.each(['recipe_flags', 'recipe_comments'])(
      'leaves no half state when the %s write fails',
      async (table) => {
        const flag = await hideByReports();
        await client.exec(`
          CREATE FUNCTION fail_update() RETURNS trigger LANGUAGE plpgsql
            AS $$ BEGIN RAISE EXCEPTION 'write failed'; END $$;
          CREATE TRIGGER fail_update BEFORE UPDATE ON ${table}
            FOR EACH ROW EXECUTE FUNCTION fail_update();
        `);
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        try {
          expect((await unhide(flag.id)).success).toBe(false);
        } finally {
          await client.exec(`
            DROP TRIGGER fail_update ON ${table};
            DROP FUNCTION fail_update();
          `);
        }
        expect(await isHidden()).toBe(true);
        expect(await rows(`SELECT status, reviewed_by FROM recipe_flags`)).toEqual([
          { status: 'pending', reviewed_by: null },
          { status: 'pending', reviewed_by: null },
          { status: 'pending', reviewed_by: null },
        ]);
      }
    );

    it('refuses a deleted comment and leaves its reports pending', async () => {
      const flag = await hideByReports();
      await client.exec(`DELETE FROM recipe_comments WHERE id = '${C1}'`);
      expect((await unhide(flag.id)).success).toBe(false);
      expect(await rows(`SELECT DISTINCT status FROM recipe_flags`)).toEqual([
        { status: 'pending' },
      ]);
    });
  });
});
