// @vitest-environment node
/**
 * #137: `rateRecipe` / `deleteRating` write the rating row and recompute the
 * recipe's `avg_user_rating` / `total_user_ratings` in ONE `db.batch`, so a
 * failed recompute leaves no partial write. Runs against real Postgres (PGlite)
 * with `db.batch` emulated as a real BEGIN/COMMIT/ROLLBACK transaction
 * (`recipe-visibility-db.ts`); neon-http has the same all-or-nothing contract.
 */

import type { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const OWNER = 'user_owner';
const A = 'user_a';
const B = 'user_b';
const ADMIN = 'user_admin';
const RECIPE = 'aaaaaaaa-0000-4000-8000-00000000000a';
const PRIVATE_ID = 'bbbbbbbb-0000-4000-8000-00000000000b';
const DELETED_ID = 'dddddddd-0000-4000-8000-00000000000d';
const MISSING_ID = 'eeeeeeee-0000-4000-8000-00000000000e';

const state = vi.hoisted(() => ({
  db: undefined as unknown,
  userId: null as string | null,
  isAdmin: false,
}));

vi.mock('@/lib/session-user', () => ({
  getSessionUserId: async () => state.userId,
  getSessionUser: async () => (state.userId ? { id: state.userId } : null),
}));
vi.mock('@/lib/auth-users', () => ({ getUserAdminFlag: async () => state.isAdmin }));
vi.mock('@/lib/db', () => ({
  get db() {
    return state.db;
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

import { deleteRating, rateRecipe } from '@/app/actions/rate-recipe';
import { users } from '@/lib/db/auth-schema';
import * as schema from '@/lib/db/schema';
import { userProfiles } from '@/lib/db/user-discovery-schema';
import { createVisibilityDb } from './recipe-visibility-db';

let client: PGlite;
let db: Awaited<ReturnType<typeof createVisibilityDb>>['db'];

function recipeRow(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    user_id: OWNER,
    name: `Recipe ${id.slice(0, 4)}`,
    slug: `recipe-${id.slice(0, 4)}`,
    ingredients: '[]',
    instructions: '[]',
    is_public: true,
    is_system_recipe: false,
    moderation_status: 'approved' as const,
    ...over,
  };
}

async function snapshot(recipeId: string) {
  const [recipe] = await db
    .select({ avg: schema.recipes.avg_user_rating, total: schema.recipes.total_user_ratings })
    .from(schema.recipes)
    .where(eq(schema.recipes.id, recipeId));
  const ratings = await db
    .select({ user: schema.recipeRatings.user_id, rating: schema.recipeRatings.rating })
    .from(schema.recipeRatings)
    .where(eq(schema.recipeRatings.recipe_id, recipeId))
    .orderBy(schema.recipeRatings.user_id);
  return { recipe, ratings };
}

beforeAll(async () => {
  const built = await createVisibilityDb(
    // #197: rateRecipe's write reads users.deletion_requested_at.
    [users, schema.recipes, schema.recipeRatings, userProfiles],
    { ...schema, userProfiles },
    { constraints: true }
  );
  client = built.client;
  db = built.db;
  state.db = built.db;
});

beforeEach(async () => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  state.isAdmin = false;
  await client.exec('ALTER TABLE "recipes" DROP CONSTRAINT IF EXISTS "test_fail_recompute";');
  await client.exec('DELETE FROM "recipe_ratings"; DELETE FROM "recipes";');
  await db
    .insert(schema.recipes)
    .values([
      recipeRow(RECIPE),
      recipeRow(PRIVATE_ID, { is_public: false }),
      recipeRow(DELETED_ID, { deleted_at: new Date('2026-02-01T00:00:00Z') }),
    ]);
});

afterAll(async () => {
  await client?.close();
});

describe('#137 aggregates stay consistent with recipe_ratings', () => {
  it('rateRecipe and deleteRating keep avg and total derived from the rows', async () => {
    state.userId = A;
    expect(await rateRecipe(RECIPE, 5)).toMatchObject({
      success: true,
      avgUserRating: 5,
      totalRatings: 1,
    });
    state.userId = B;
    expect(await rateRecipe(RECIPE, 2)).toMatchObject({ avgUserRating: 3.5, totalRatings: 2 });
    expect((await snapshot(RECIPE)).recipe).toEqual({ avg: '3.5', total: 2 });

    // Updating an existing rating does not add a row.
    expect(await rateRecipe(RECIPE, 4)).toMatchObject({ avgUserRating: 4.5, totalRatings: 2 });

    expect(await deleteRating(RECIPE)).toEqual({ success: true });
    expect(await snapshot(RECIPE)).toEqual({
      recipe: { avg: '5.0', total: 1 },
      ratings: [{ user: A, rating: 5 }],
    });

    state.userId = A;
    expect(await deleteRating(RECIPE)).toEqual({ success: true });
    expect((await snapshot(RECIPE)).recipe).toEqual({ avg: null, total: 0 });
  });

  it('an all-0-star average is a real 0.0, before and after a delete', async () => {
    state.userId = A;
    await rateRecipe(RECIPE, 0);
    state.userId = B;
    expect(await rateRecipe(RECIPE, 0)).toMatchObject({ avgUserRating: 0, totalRatings: 2 });
    expect(await deleteRating(RECIPE)).toEqual({ success: true });
    expect((await snapshot(RECIPE)).recipe).toEqual({ avg: '0.0', total: 1 });
  });
});

describe('#137 deleteRating with nothing to delete', () => {
  it('a hidden recipe answers as a missing one, writes nothing, and skips the recompute', async () => {
    state.userId = B;
    const before = await snapshot(PRIVATE_ID);
    const batch = vi.spyOn(db, 'batch');

    const hidden = await deleteRating(PRIVATE_ID);
    const missing = await deleteRating(MISSING_ID);

    expect(hidden).toEqual(missing);
    expect(hidden).toEqual({ success: true });
    expect(await snapshot(PRIVATE_ID)).toEqual(before);
    expect(batch).not.toHaveBeenCalled();
  });
});

describe('#137 admin viewer', () => {
  it('can rate a private recipe but gets "not found" on a soft-deleted one', async () => {
    state.userId = ADMIN;
    state.isAdmin = true;
    expect(await rateRecipe(PRIVATE_ID, 3)).toMatchObject({ success: true, totalRatings: 1 });

    const before = await snapshot(DELETED_ID);
    expect(await rateRecipe(DELETED_ID, 3)).toEqual({ success: false, error: 'Recipe not found' });
    expect(await rateRecipe(DELETED_ID, 3)).toEqual(await rateRecipe(MISSING_ID, 3));
    expect(await snapshot(DELETED_ID)).toEqual(before);
  });
});

// #141: the batch statement order (recipe lock, rating write, recompute) is
// pinned in `rate-recipe-lock-order.test.ts`.

describe('#137 atomicity', () => {
  it('a failing recompute rolls back the rating write', async () => {
    state.userId = A;
    await rateRecipe(RECIPE, 5);
    // The recompute (not the upsert) violates this: a second rating makes total_user_ratings 2.
    await client.exec(
      'ALTER TABLE "recipes" ADD CONSTRAINT "test_fail_recompute" CHECK (total_user_ratings < 2);'
    );
    const before = await snapshot(RECIPE);

    state.userId = B;
    const result = await rateRecipe(RECIPE, 1);

    expect(result.success).toBe(false);
    expect(await snapshot(RECIPE)).toEqual(before);
  });
});
