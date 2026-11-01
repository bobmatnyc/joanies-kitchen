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
// #59: literal on purpose; an admin reads this text, and it must name a refresh.
const STALE = {
  success: false,
  error: 'This report was already closed. Refresh the page to see its current state.',
};

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

import { actOnRecipeFlag, flagRecipe, getAllFlags, reviewFlag } from '@/app/actions/flag-recipe';
import { reportComment } from '@/app/actions/report-comment';
import { getRecipeComments, setCommentHidden, updateRecipeComment } from '@/app/actions/social';
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

async function reportEach(userIds: string[]) {
  for (const u of userIds) await reportAs(u);
}

async function hideAsAdmin() {
  state.userId = ADMIN;
  expect((await setCommentHidden(C1, true)).success).toBe(true);
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
    // #59: a fourth reporter is refused; the comment is already out of public view.
    expect((await reportAs('u4')).success).toBe(false);

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

  // #59: a hidden comment is answered as nonexistent, however it was hidden and whoever asks.
  const hideRoutes: [string, () => Promise<unknown>][] = [
    ['an admin', () => hideAsAdmin()],
    ['three reporters', () => reportEach(['u1', 'u2', 'u3'])],
  ];

  it.each(hideRoutes)('refuses a report on a comment hidden by %s', async (_how, hide) => {
    await hide();
    const before = await rows('SELECT id, status FROM recipe_flags ORDER BY id');
    const refused = { success: false, error: 'Comment not found' };

    expect(await reportAs('u9')).toEqual(refused);
    expect(await reportAs(AUTHOR)).toEqual(refused);
    expect(await rows('SELECT id, status FROM recipe_flags ORDER BY id')).toEqual(before);
    expect(await isHidden()).toBe(true);
  });

  it('refuses an earlier reporter of a hidden comment instead of answering alreadyReported', async () => {
    await reportEach(['u1', 'u2', 'u3']);
    expect(await reportAs('u1')).toEqual({ success: false, error: 'Comment not found' });
  });

  it('accepts reports again once an admin unhides the comment', async () => {
    await hideAsAdmin();
    state.userId = ADMIN;
    expect((await setCommentHidden(C1, false)).success).toBe(true);
    expect(await reportAs('u9')).toEqual({ success: true, hidden: false });
  });
});

describe('#59: only an admin unhide makes a hidden comment visible', () => {
  it('holds through every non-admin action, then an admin working the whole queue', async () => {
    // Filed while visible, so the non-admin queue calls below have a real report to act on.
    await reportAs('u0');
    await hideAsAdmin();

    // Each non-admin route to the comment or its reports.
    await reportEach(['u1', 'u2', 'u3', AUTHOR]);
    state.userId = 'u1';
    expect((await setCommentHidden(C1, false)).success).toBe(false);
    const queued = await rows('SELECT id FROM recipe_flags');
    expect(queued.length).toBeGreaterThan(0);
    for (const { id } of queued) {
      expect((await actOnRecipeFlag(id as string, 'unhide')).success).toBe(false);
      expect((await actOnRecipeFlag(id as string, 'dismiss')).success).toBe(false);
    }
    state.userId = AUTHOR;
    expect((await updateRecipeComment(C1, 'kind words now')).success).toBe(true);
    expect(await isHidden()).toBe(true);

    // The admin dismisses whatever those calls left in the queue.
    state.userId = ADMIN;
    for (const { id } of await rows(`SELECT id FROM recipe_flags WHERE status = 'pending'`)) {
      expect((await actOnRecipeFlag(id as string, 'dismiss')).success).toBe(true);
    }

    expect(await isHidden()).toBe(true);
    state.userId = 'viewer';
    const list = await getRecipeComments(R1);
    expect(list.success && list.data).toEqual([]);
  });
});

describe('#59: dismiss closes one report and leaves the comment alone', () => {
  async function flagOf(userId: string) {
    state.userId = ADMIN;
    const flag = (await getAllFlags()).find((f) => f.user_id === userId);
    if (!flag) throw new Error(`${userId} report missing`);
    return flag;
  }

  async function statusByUser() {
    return rows('SELECT user_id, status, reviewed_by FROM recipe_flags ORDER BY user_id');
  }

  it('stays hidden when the reports left pending are still at the threshold', async () => {
    await reportEach(['u1', 'u2', 'u3']);
    // A report whose insert committed just before the hide: the check in reportComment missed it.
    await testDb.insert(schema.recipeFlags).values({
      recipe_id: R1,
      comment_id: C1,
      user_id: 'u4',
      reason: 'spam',
      status: 'pending',
    });

    expect(await actOnRecipeFlag((await flagOf('u1')).id, 'dismiss')).toEqual({ success: true });

    expect(await isHidden()).toBe(true);
    expect(await statusByUser()).toEqual([
      { user_id: 'u1', status: 'dismissed', reviewed_by: ADMIN },
      { user_id: 'u2', status: 'pending', reviewed_by: null },
      { user_id: 'u3', status: 'pending', reviewed_by: null },
      { user_id: 'u4', status: 'pending', reviewed_by: null },
    ]);
  });

  it('keeps a comment an admin hid with setCommentHidden hidden', async () => {
    await reportAs('u1');
    await hideAsAdmin();
    expect(await actOnRecipeFlag((await flagOf('u1')).id, 'dismiss')).toEqual({ success: true });
    expect(await isHidden()).toBe(true);
  });

  it('keeps a comment an admin hid from the queue hidden when a stale page dismisses', async () => {
    await reportAs('u1');
    const flag = await flagOf('u1');
    expect((await actOnRecipeFlag(flag.id, 'hide')).success).toBe(true);
    expect(await actOnRecipeFlag(flag.id, 'dismiss')).toEqual(STALE);
    expect(await isHidden()).toBe(true);
  });

  // The data model records no hide source, so an auto-hide below the threshold also stays hidden.
  it('keeps an auto-hidden comment hidden until an explicit unhide, even with no reports left', async () => {
    await reportEach(['u1', 'u2', 'u3']);
    for (const u of ['u1', 'u2', 'u3']) {
      expect(await actOnRecipeFlag((await flagOf(u)).id, 'dismiss')).toEqual({ success: true });
      expect(await isHidden()).toBe(true);
    }

    expect(await actOnRecipeFlag((await flagOf('u1')).id, 'unhide')).toEqual({ success: true });
    expect(await isHidden()).toBe(false);
  });

  it('on a visible comment, removes only the dismissed reporter from the count', async () => {
    await reportEach(['u1', 'u2']);
    expect(await actOnRecipeFlag((await flagOf('u1')).id, 'dismiss')).toEqual({ success: true });
    expect(await isHidden()).toBe(false);

    expect((await reportAs('u3')).hidden).toBe(false);
    expect((await reportAs('u4')).hidden).toBe(true);
  });
});

describe('#59: a stale page cannot change a closed comment report', () => {
  const closedRow = `SELECT status, review_notes, reviewed_at IS NOT NULL AS timed FROM recipe_flags WHERE user_id = 'u1'`;

  async function closedFlagId(closing: 'dismiss' | 'hide', notes: string) {
    await reportAs('u1');
    state.userId = ADMIN;
    const flag = (await getAllFlags()).find((f) => f.user_id === 'u1');
    if (!flag) throw new Error('u1 report missing');
    expect(await actOnRecipeFlag(flag.id, closing, notes)).toEqual({ success: true });
    return flag.id;
  }

  const closings = [
    ['dismiss', 'dismissed', false],
    ['hide', 'resolved', true],
  ] as const;

  describe.each(closings)('after %s', (closing, status, hidden) => {
    it.each(['dismiss', 'hide', 'remove'] as const)(
      'a stale %s writes nothing and reports a stale page',
      async (stale) => {
        const flagId = await closedFlagId(closing, 'first decision');

        expect(await actOnRecipeFlag(flagId, stale, 'stale decision')).toEqual(STALE);

        expect(await rows(closedRow)).toEqual([
          { status, review_notes: 'first decision', timed: true },
        ]);
        expect(await isHidden()).toBe(hidden);
      }
    );
  });

  it('a stale hide leaves another pending report on the comment open', async () => {
    const flagId = await closedFlagId('dismiss', 'first decision');
    await reportAs('u2');
    state.userId = ADMIN;
    expect(await actOnRecipeFlag(flagId, 'hide')).toEqual(STALE);
    expect(await rows(`SELECT status FROM recipe_flags WHERE user_id = 'u2'`)).toEqual([
      { status: 'pending' },
    ]);
  });

  it('unhide from a closed report restores the comment and leaves that report as it is', async () => {
    const flagId = await closedFlagId('hide', 'first decision');
    expect(await actOnRecipeFlag(flagId, 'unhide', 'stale decision')).toEqual({ success: true });
    expect(await isHidden()).toBe(false);
    expect(await rows(closedRow)).toEqual([
      { status: 'resolved', review_notes: 'first decision', timed: true },
    ]);
  });

  it('reviewFlag does not overwrite a closed report', async () => {
    const flagId = await closedFlagId('dismiss', 'first decision');
    expect(await reviewFlag(flagId, 'resolved', 'stale decision')).toEqual(STALE);
    expect(await rows(closedRow)).toEqual([
      { status: 'dismissed', review_notes: 'first decision', timed: true },
    ]);
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

  it('unhide restores the comment and a pending report can hide it again', async () => {
    const flag = await hideByReports();
    expect(await actOnRecipeFlag(flag.id, 'unhide')).toEqual({ success: true });
    expect(await isHidden()).toBe(false);

    await reportAs('u4');
    state.userId = ADMIN;
    const fresh = (await getAllFlags()).find((f) => f.user_id === 'u4');
    if (!fresh) throw new Error('u4 report missing');
    expect(await actOnRecipeFlag(fresh.id, 'hide')).toEqual({ success: true });
    expect(await isHidden()).toBe(true);
  });

  it('remove deletes the comment, resolves every pending report and keeps the recipe', async () => {
    const flag = await hideByReports();
    expect(await actOnRecipeFlag(flag.id, 'remove')).toEqual({ success: true });
    expect(await rows(`SELECT id FROM recipe_comments`)).toEqual([]);
    expect(await rows(`SELECT DISTINCT status FROM recipe_flags`)).toEqual([
      { status: 'resolved' },
    ]);
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
