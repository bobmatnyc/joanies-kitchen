// @vitest-environment node
/**
 * #59 (D7c S3): recipe report polish and admin moderation.
 *
 * Runs the real actions against PGlite: the harassment reason, one report per
 * user per recipe, admin-only comment hiding that drops a comment from the
 * list and the count, and the dismiss / hide / remove queue actions changing
 * exactly the intended rows.
 */

import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const ADMIN = 'user_admin';
const USER = 'user_reporter';
const R1 = 'recipe-1';
const R2 = 'recipe-2';
const C1 = 'aaaaaaaa-0000-4000-8000-00000000000a';
const C2 = 'bbbbbbbb-0000-4000-8000-00000000000b';
const F1 = 'cccccccc-0000-4000-8000-00000000000c';
const F2 = 'dddddddd-0000-4000-8000-00000000000d';

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

import { actOnRecipeFlag, flagRecipe } from '@/app/actions/flag-recipe';
import { getRecipesPaginated, searchRecipes } from '@/app/actions/recipes';
import { getRecipeCommentCount, getRecipeComments, setCommentHidden } from '@/app/actions/social';
import { users } from '@/lib/db/auth-schema';
import * as schema from '@/lib/db/schema';
import { userProfiles } from '@/lib/db/user-discovery-schema';
import { findViewableRecipe, getRecipeViewer } from '@/lib/recipe-visibility';
import { createVisibilityDb } from './recipe-visibility-db';

let client: PGlite;

function recipeRow(id: string) {
  return {
    id,
    user_id: 'owner',
    name: id,
    ingredients: '[]',
    instructions: '[]',
    is_public: true,
    moderation_status: 'approved' as const,
  };
}

async function seed() {
  const db = state.db as any;
  for (const t of ['recipes', 'recipe_flags', 'recipe_comments']) {
    await client.exec(`DELETE FROM "${t}";`);
  }
  await db.insert(schema.recipes).values([recipeRow(R1), recipeRow(R2)]);
  await db.insert(schema.recipeComments).values([
    { id: C1, recipe_id: R1, user_id: 'a', content: 'one', is_flagged: false },
    { id: C2, recipe_id: R1, user_id: 'b', content: 'two', is_flagged: false },
  ]);
  await db.insert(schema.recipeFlags).values([
    { id: F1, recipe_id: R1, user_id: 'x', reason: 'spam', status: 'pending' },
    { id: F2, recipe_id: R2, user_id: 'y', reason: 'spam', status: 'pending' },
  ]);
}

async function rows(sql: string) {
  return (await client.query(sql)).rows as Record<string, unknown>[];
}

beforeAll(async () => {
  const made = await createVisibilityDb(
    // #103: comment reads check the author's users row for a pending deletion.
    [schema.recipes, schema.recipeFlags, schema.recipeComments, userProfiles, users],
    { ...schema, userProfiles, users }
  );
  client = made.client;
  // #194: the comment unhide runs in db.batch (one neon-http transaction); mirror that on PGlite.
  Object.assign(made.db, {
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
  state.db = made.db;
});

beforeEach(async () => {
  state.userId = USER;
  await seed();
});

describe('flagRecipe', () => {
  it('accepts the harassment reason', async () => {
    const result = await flagRecipe(R1, 'harassment');
    expect(result.success).toBe(true);
    const saved = await rows(`SELECT reason FROM recipe_flags WHERE user_id = '${USER}'`);
    expect(saved).toEqual([{ reason: 'harassment' }]);
  });

  it('rejects an unknown reason', async () => {
    const result = await flagRecipe(R1, 'nonsense' as never);
    expect(result).toEqual({ success: false, error: 'Invalid flag reason' });
  });

  it('rejects a second report on the same recipe from the same user', async () => {
    expect((await flagRecipe(R1, 'spam')).success).toBe(true);
    const second = await flagRecipe(R1, 'harassment');
    expect(second).toEqual({ success: false, error: 'You have already reported this recipe' });
    const count = await rows(
      `SELECT count(*)::int AS n FROM recipe_flags WHERE user_id = '${USER}'`
    );
    expect(count[0].n).toBe(1);
  });
});

describe('setCommentHidden', () => {
  // #194: the unhide (false) path also writes reports, so both directions are checked.
  it.each([true, false])(
    'refuses a non-admin setting hidden=%s and changes nothing',
    async (hidden) => {
      await client.exec(`UPDATE recipe_comments SET is_flagged = ${!hidden} WHERE id = '${C1}'`);
      await client.exec(
        `INSERT INTO recipe_flags (id, recipe_id, comment_id, user_id, reason, status) VALUES ('eeeeeeee-0000-4000-8000-0000000000f1', '${R1}', '${C1}', 'z', 'spam', 'pending')`
      );
      const result = await setCommentHidden(C1, hidden);
      expect(result.success).toBe(false);
      const saved = await rows(`SELECT is_flagged FROM recipe_comments WHERE id = '${C1}'`);
      expect(saved[0].is_flagged).toBe(!hidden);
      expect(await rows(`SELECT DISTINCT status FROM recipe_flags`)).toEqual([
        { status: 'pending' },
      ]);
    }
  );

  it('hides a comment from the list and the count, and unhides it', async () => {
    state.userId = ADMIN;
    expect((await setCommentHidden(C1, true)).success).toBe(true);

    const list = await getRecipeComments(R1);
    expect(list.success && list.data.map((c) => c.id)).toEqual([C2]);
    const hiddenCount = await getRecipeCommentCount(R1);
    expect(hiddenCount.success && hiddenCount.data).toBe(1);

    expect((await setCommentHidden(C1, false)).success).toBe(true);
    const count = await getRecipeCommentCount(R1);
    expect(count.success && count.data).toBe(2);
  });

  it('errors for an unknown comment', async () => {
    state.userId = ADMIN;
    const result = await setCommentHidden('eeeeeeee-0000-4000-8000-00000000000e', true);
    expect(result).toEqual({ success: false, error: 'Comment not found' });
  });
});

describe('actOnRecipeFlag', () => {
  it('refuses a non-admin', async () => {
    const result = await actOnRecipeFlag(F1, 'remove');
    expect(result.success).toBe(false);
    const saved = await rows(`SELECT deleted_at FROM recipes WHERE id = '${R1}'`);
    expect(saved[0].deleted_at).toBeNull();
  });

  it('dismiss reviews the flag and leaves every recipe alone', async () => {
    state.userId = ADMIN;
    expect((await actOnRecipeFlag(F1, 'dismiss', 'fine')).success).toBe(true);
    const flags = await rows(
      'SELECT id, status, reviewed_by, reviewed_at IS NOT NULL AS timed FROM recipe_flags ORDER BY id'
    );
    expect(flags).toEqual([
      { id: F1, status: 'dismissed', reviewed_by: ADMIN, timed: true },
      { id: F2, status: 'pending', reviewed_by: null, timed: false },
    ]);
    const recipes = await rows('SELECT moderation_status, deleted_at FROM recipes');
    expect(recipes.every((r) => r.moderation_status === 'approved' && r.deleted_at === null)).toBe(
      true
    );
  });

  it('hide rejects only the reported recipe and resolves the flag', async () => {
    state.userId = ADMIN;
    expect((await actOnRecipeFlag(F1, 'hide')).success).toBe(true);
    const recipes = await rows('SELECT id, moderation_status, deleted_at FROM recipes ORDER BY id');
    expect(recipes).toEqual([
      { id: R1, moderation_status: 'rejected', deleted_at: null },
      { id: R2, moderation_status: 'approved', deleted_at: null },
    ]);
    const flags = await rows('SELECT id, status, reviewed_by FROM recipe_flags ORDER BY id');
    expect(flags).toEqual([
      { id: F1, status: 'resolved', reviewed_by: ADMIN },
      { id: F2, status: 'pending', reviewed_by: null },
    ]);
  });

  it('remove soft-deletes only the reported recipe and resolves the flag', async () => {
    state.userId = ADMIN;
    expect((await actOnRecipeFlag(F2, 'remove')).success).toBe(true);
    const recipes = await rows(
      'SELECT id, moderation_status, deleted_at IS NOT NULL AS gone, deleted_by FROM recipes ORDER BY id'
    );
    expect(recipes).toEqual([
      { id: R1, moderation_status: 'approved', gone: false, deleted_by: null },
      { id: R2, moderation_status: 'approved', gone: true, deleted_by: ADMIN },
    ]);
    const flags = await rows('SELECT id, status FROM recipe_flags ORDER BY id');
    expect(flags).toEqual([
      { id: F1, status: 'pending' },
      { id: F2, status: 'resolved' },
    ]);
  });

  it('errors, and leaves the flag pending, when the recipe is gone', async () => {
    state.userId = ADMIN;
    await client.exec(`DELETE FROM recipes WHERE id = '${R1}'`);
    const result = await actOnRecipeFlag(F1, 'hide');
    expect(result).toEqual({ success: false, error: 'Recipe not found' });
    const flags = await rows(`SELECT status FROM recipe_flags WHERE id = '${F1}'`);
    expect(flags[0].status).toBe('pending');
  });
});

describe('a hidden recipe (#102)', () => {
  async function hideR1() {
    state.userId = ADMIN;
    expect((await actOnRecipeFlag(F1, 'hide')).success).toBe(true);
  }
  async function anonymousSees() {
    state.userId = null;
    const viewer = await getRecipeViewer();
    const direct = (await findViewableRecipe(R1, viewer)) !== null;
    const list = await getRecipesPaginated({ limit: 50 });
    const inList = (list.data?.recipes ?? []).some((r) => r.id === R1);
    const found = await searchRecipes('recipe');
    const inSearch = ((found.data as { id: string }[] | undefined) ?? []).some((r) => r.id === R1);
    return { direct, inList, inSearch };
  }

  it('is visible before the hide', async () => {
    expect(await anonymousSees()).toEqual({ direct: true, inList: true, inSearch: true });
  });

  it('is withheld from anonymous viewers by the helper, a list and a search', async () => {
    await hideR1();
    expect(await anonymousSees()).toEqual({ direct: false, inList: false, inSearch: false });
    state.userId = USER;
    expect(await findViewableRecipe(R1, await getRecipeViewer())).toBeNull();
  });

  it('stays visible to its owner and to an admin', async () => {
    await hideR1();
    state.userId = 'owner';
    expect(await findViewableRecipe(R1, await getRecipeViewer())).not.toBeNull();
    state.userId = ADMIN;
    expect(await findViewableRecipe(R1, await getRecipeViewer())).not.toBeNull();
  });

  it('is restored exactly by unhide, and unhide is admin-only', async () => {
    await hideR1();
    state.userId = USER;
    expect((await actOnRecipeFlag(F1, 'unhide')).success).toBe(false);
    expect((await anonymousSees()).direct).toBe(false);

    state.userId = ADMIN;
    expect((await actOnRecipeFlag(F1, 'unhide')).success).toBe(true);
    expect(await anonymousSees()).toEqual({ direct: true, inList: true, inSearch: true });
    const row = await rows(`SELECT is_public FROM recipes WHERE id = '${R1}'`);
    expect(row[0].is_public).toBe(true);
    // Unhiding a recipe that is not hidden is an error, not a silent success.
    expect((await actOnRecipeFlag(F1, 'unhide')).success).toBe(false);
  });
});
