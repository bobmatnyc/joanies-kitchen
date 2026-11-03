// @vitest-environment node
/**
 * #59: every hidden comment can be reached, unhidden and removed by an admin,
 * whatever its report rows say. Runs the real actions against PGlite.
 */

import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const ADMIN = 'user_admin';
const R1 = 'recipe-1';
const HIDDEN = 'aaaaaaaa-0000-4000-8000-00000000000a';
const VISIBLE = 'bbbbbbbb-0000-4000-8000-00000000000b';
const SECRET = 'text only an admin may read';

const state = vi.hoisted(() => ({
  db: undefined as unknown,
  userId: null as string | null,
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
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

import { getAllFlags } from '@/app/actions/flag-recipe';
import { actOnHiddenComment, getHiddenComments } from '@/app/actions/hidden-comments';
import { HIDDEN_COMMENTS_PAGE_SIZE } from '@/lib/comment-moderation';
import * as schema from '@/lib/db/schema';
import { createVisibilityDb } from './recipe-visibility-db';

type TestDb = Awaited<ReturnType<typeof createVisibilityDb>>['db'];

let client: PGlite;
let testDb: TestDb;

async function rows(sql: string) {
  return (await client.query(sql)).rows as Record<string, unknown>[];
}

function uuid(prefix: string, n: number) {
  return `${prefix}-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

async function addReport(commentId: string, userId: string, status: 'pending' | 'dismissed') {
  await testDb.insert(schema.recipeFlags).values({
    recipe_id: R1,
    comment_id: commentId,
    user_id: userId,
    reason: 'spam',
    status,
    review_notes: status === 'dismissed' ? 'closed earlier' : null,
    created_at: new Date(),
  });
}

/** 100+ newer dismissed rows on other comments: the rows that pushed a report out of every tab. */
async function addNewerDismissedRows(n: number) {
  const later = Date.now() + 86_400_000;
  await testDb.insert(schema.recipeFlags).values(
    Array.from({ length: n }, (_, i) => ({
      recipe_id: R1,
      comment_id: uuid('dddddddd', i),
      user_id: `other-${i}`,
      reason: 'spam' as const,
      status: 'dismissed' as const,
      created_at: new Date(later + i),
    }))
  );
}

beforeAll(async () => {
  const made = await createVisibilityDb(
    [schema.recipes, schema.recipeFlags, schema.recipeComments, schema.recipeRatings], // #270: getAllFlags joins the reported review
    {
      ...schema,
    }
  );
  client = made.client;
  await client.exec(`ALTER TABLE "recipe_flags" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();`);
  await client.exec(
    `ALTER TABLE "recipe_comments" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();`
  );
  testDb = made.db;
  state.db = made.db;
});

beforeEach(async () => {
  for (const t of ['recipes', 'recipe_flags', 'recipe_comments']) {
    await client.exec(`DELETE FROM "${t}";`);
  }
  await testDb.insert(schema.recipes).values({
    id: R1,
    user_id: 'owner',
    name: 'Soup',
    ingredients: '[]',
    instructions: '[]',
    is_public: true,
    moderation_status: 'approved',
  });
  await testDb.insert(schema.recipeComments).values([
    {
      id: HIDDEN,
      recipe_id: R1,
      user_id: 'author',
      content: SECRET,
      is_flagged: true,
      created_at: new Date(1_000_000),
    },
    {
      id: VISIBLE,
      recipe_id: R1,
      user_id: 'author',
      content: 'visible',
      is_flagged: false,
      created_at: new Date(2_000_000),
    },
  ]);
  state.userId = ADMIN;
});

describe('getHiddenComments', () => {
  it('lists a hidden comment that has no report rows, and only hidden comments', async () => {
    expect(await rows('SELECT id FROM recipe_flags')).toEqual([]);
    const result = await getHiddenComments();
    expect(result).toMatchObject({ total: 1, page: 1, pageCount: 1 });
    expect(result.comments).toEqual([
      expect.objectContaining({
        id: HIDDEN,
        recipeName: 'Soup',
        content: SECRET,
        pendingReports: 0,
      }),
    ]);
  });

  it('lists a hidden comment whose only report is pushed out of every tab', async () => {
    await addReport(HIDDEN, 'u1', 'dismissed');
    await addNewerDismissedRows(120);

    for (const tab of [undefined, 'pending', 'dismissed'] as const) {
      const inTab = (await getAllFlags(tab, 100)).some((f) => f.comment_id === HIDDEN);
      expect(inTab).toBe(false);
    }

    const result = await getHiddenComments();
    expect(result.total).toBe(1);
    expect(result.comments.map((c) => c.id)).toEqual([HIDDEN]);
  });

  it('counts only pending reports on each comment', async () => {
    await addReport(HIDDEN, 'u1', 'pending');
    await addReport(HIDDEN, 'u2', 'pending');
    await addReport(HIDDEN, 'u3', 'dismissed');
    await addReport(VISIBLE, 'u4', 'pending');
    expect((await getHiddenComments()).comments[0].pendingReports).toBe(2);
  });

  it('reaches every hidden comment across pages, with no repeat and no silent cap', async () => {
    const extra = HIDDEN_COMMENTS_PAGE_SIZE * 2 + 4;
    // All one timestamp: paging must still be a stable order.
    await testDb.insert(schema.recipeComments).values(
      Array.from({ length: extra }, (_, i) => ({
        id: uuid('eeeeeeee', i),
        recipe_id: R1,
        user_id: 'author',
        content: `hidden ${i}`,
        is_flagged: true,
        created_at: new Date(3_000_000),
      }))
    );

    const seen: string[] = [];
    const first = await getHiddenComments(1);
    expect(first.total).toBe(extra + 1);
    expect(first.pageCount).toBe(3);
    for (let page = 1; page <= first.pageCount; page++) {
      const result = await getHiddenComments(page);
      expect(result.page).toBe(page);
      seen.push(...result.comments.map((c) => c.id));
    }
    expect(seen).toHaveLength(extra + 1);
    expect(new Set(seen).size).toBe(extra + 1);
    expect(seen).toContain(HIDDEN);
    expect(seen).not.toContain(VISIBLE);
  });

  it.each([
    [999, 1],
    [0, 1],
    [-3, 1],
    [Number.NaN, 1],
  ])('reads page %s as page %s', async (requested, expected) => {
    const result = await getHiddenComments(requested);
    expect(result.page).toBe(expected);
    expect(result.comments.map((c) => c.id)).toEqual([HIDDEN]);
  });

  it.each([
    ['a signed-out caller', null],
    ['a non-admin', 'user_plain'],
  ])('refuses %s with no comment text', async (_who, userId) => {
    state.userId = userId;
    await expect(getHiddenComments()).rejects.toThrow('Admin access required');
  });
});

describe('actOnHiddenComment', () => {
  it('unhides a comment with no report rows', async () => {
    expect(await actOnHiddenComment(HIDDEN, 'unhide')).toEqual({ success: true });
    expect(await rows(`SELECT is_flagged FROM recipe_comments WHERE id = '${HIDDEN}'`)).toEqual([
      { is_flagged: false },
    ]);
    expect((await getHiddenComments()).total).toBe(0);
  });

  it('removes a comment with no report rows', async () => {
    expect(await actOnHiddenComment(HIDDEN, 'remove')).toEqual({ success: true });
    expect(await rows(`SELECT id FROM recipe_comments`)).toEqual([{ id: VISIBLE }]);
  });

  // Df8: an unhide dismisses every pending report; a closed report keeps its status and notes.
  it.each([
    ['unhide', 'dismissed'],
    ['remove', 'resolved'],
  ] as const)('%s closes pending reports as %s and leaves closed ones', async (action, closed) => {
    await addReport(HIDDEN, 'u1', 'pending');
    await addReport(HIDDEN, 'u2', 'dismissed');
    await addReport(VISIBLE, 'u3', 'pending');

    expect(await actOnHiddenComment(HIDDEN, action, 'decided')).toEqual({ success: true });

    expect(
      await rows(
        'SELECT user_id, status, review_notes, reviewed_by FROM recipe_flags ORDER BY user_id'
      )
    ).toEqual([
      { user_id: 'u1', status: closed, review_notes: 'decided', reviewed_by: ADMIN },
      { user_id: 'u2', status: 'dismissed', review_notes: 'closed earlier', reviewed_by: null },
      { user_id: 'u3', status: 'pending', review_notes: null, reviewed_by: null },
    ]);
  });

  it.each(['unhide', 'remove'] as const)(
    'a stale %s on a comment no longer hidden writes nothing',
    async (action) => {
      await addReport(VISIBLE, 'u1', 'pending');
      expect(await actOnHiddenComment(VISIBLE, action)).toEqual({
        success: false,
        error: 'This comment is no longer hidden. Refresh the page to see its current state.',
      });
      expect(await rows(`SELECT id FROM recipe_comments WHERE id = '${VISIBLE}'`)).toHaveLength(1);
      expect(await rows('SELECT status FROM recipe_flags')).toEqual([{ status: 'pending' }]);
    }
  );

  it('answers a missing comment as not found', async () => {
    const result = await actOnHiddenComment(uuid('ffffffff', 1), 'remove');
    expect(result).toEqual({ success: false, error: 'Comment not found' });
  });

  it.each([
    ['a signed-out caller', null, 'unhide'],
    ['a signed-out caller', null, 'remove'],
    ['a non-admin', 'user_plain', 'unhide'],
    ['a non-admin', 'user_plain', 'remove'],
  ] as const)('refuses %s (%s, %s) and changes nothing', async (_who, userId, action) => {
    vi.spyOn(console, 'error').mockImplementationOnce(() => undefined);
    state.userId = userId;
    expect((await actOnHiddenComment(HIDDEN, action)).success).toBe(false);
    expect(await rows(`SELECT is_flagged FROM recipe_comments WHERE id = '${HIDDEN}'`)).toEqual([
      { is_flagged: true },
    ]);
  });
});
