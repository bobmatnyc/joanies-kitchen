// @vitest-environment node
/**
 * #137: the ratings actions answer a recipe the caller may not see exactly as
 * they answer a recipe that does not exist, and write nothing for it.
 *
 * `rateRecipe` upserts a `recipe_ratings` row and rewrites the recipe's
 * `avg_user_rating` / `total_user_ratings`. Its action ID ships in the client
 * bundle, so a direct POST could rate another user's private, rejected or
 * soft-deleted recipe, and success vs "Recipe not found" revealed that the
 * recipe exists. `getRecipeRatings` and `getUserRating` read the same rows with
 * no visibility check. Rule: `canViewRecipe` (#32, `src/lib/recipe-visibility.ts`).
 * Runs against real Postgres (PGlite).
 */

import type { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const OWNER = 'user_owner';
const OTHER = 'user_other';
const RATER = 'user_rater';
const PUBLIC_ID = 'aaaaaaaa-0000-4000-8000-00000000000a';
const PRIVATE_ID = 'bbbbbbbb-0000-4000-8000-00000000000b';
const REJECTED_ID = 'cccccccc-0000-4000-8000-00000000000c';
const DELETED_ID = 'dddddddd-0000-4000-8000-00000000000d';
const MISSING_ID = 'eeeeeeee-0000-4000-8000-00000000000e';
const REVIEW = 'Secret family review';

const state = vi.hoisted(() => ({
  db: undefined as unknown,
  userId: null as string | null,
}));

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

import {
  deleteRating,
  getRecipeRatings,
  getUserRating,
  rateRecipe,
} from '@/app/actions/rate-recipe';
import * as schema from '@/lib/db/schema';
import { userProfiles } from '@/lib/db/user-discovery-schema';
import { createVisibilityDb } from './recipe-visibility-db';

let client: PGlite;
let db: Awaited<ReturnType<typeof createVisibilityDb>>['db'];

const HIDDEN: { kind: string; id: string }[] = [
  { kind: 'private', id: PRIVATE_ID },
  { kind: 'rejected', id: REJECTED_ID },
  { kind: 'soft-deleted', id: DELETED_ID },
];

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
    avg_user_rating: '4.0',
    total_user_ratings: 1,
    ...over,
  };
}

async function snapshot(recipeId: string) {
  const [recipe] = await db
    .select({
      avg: schema.recipes.avg_user_rating,
      total: schema.recipes.total_user_ratings,
    })
    .from(schema.recipes)
    .where(eq(schema.recipes.id, recipeId));
  const ratings = await db
    .select({
      user: schema.recipeRatings.user_id,
      rating: schema.recipeRatings.rating,
      review: schema.recipeRatings.review,
    })
    .from(schema.recipeRatings)
    .where(eq(schema.recipeRatings.recipe_id, recipeId))
    .orderBy(schema.recipeRatings.user_id);
  return { recipe, ratings };
}

beforeAll(async () => {
  const built = await createVisibilityDb(
    [schema.recipes, schema.recipeRatings, userProfiles],
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
  await client.exec('DELETE FROM "recipe_ratings"; DELETE FROM "recipes";');
  await db
    .insert(schema.recipes)
    .values([
      recipeRow(PUBLIC_ID),
      recipeRow(PRIVATE_ID, { is_public: false }),
      recipeRow(REJECTED_ID, { moderation_status: 'rejected' }),
      recipeRow(DELETED_ID, { deleted_at: new Date('2026-02-01T00:00:00Z') }),
    ]);
  // Each recipe already has one 4-star rating; OTHER rated the hidden ones before they were hidden.
  await db
    .insert(schema.recipeRatings)
    .values([
      { recipe_id: PUBLIC_ID, user_id: RATER, rating: 4, review: null },
      ...HIDDEN.map(({ id }) => ({ recipe_id: id, user_id: OTHER, rating: 4, review: REVIEW })),
    ]);
});

afterAll(async () => {
  await client?.close();
});

describe('#137 rateRecipe: a hidden recipe answers as a missing one and writes nothing', () => {
  for (const { kind, id } of HIDDEN) {
    it(`another signed-in user rating a ${kind} recipe`, async () => {
      state.userId = OTHER;
      const before = await snapshot(id);

      const hidden = await rateRecipe(id, 1, 'overwrite');
      const missing = await rateRecipe(MISSING_ID, 1, 'overwrite');

      expect(hidden).toEqual(missing);
      expect(hidden).toEqual({ success: false, error: 'Recipe not found' });
      expect(await snapshot(id)).toEqual(before);
    });
  }

  it('the owner can still rate their own private recipe', async () => {
    state.userId = OWNER;
    expect(await rateRecipe(PRIVATE_ID, 2)).toEqual({
      success: true,
      rating: 2,
      avgUserRating: 3,
      totalRatings: 2,
    });
    expect((await snapshot(PRIVATE_ID)).recipe).toEqual({ avg: '3.0', total: 2 });
  });

  it('any signed-in user can still rate a public recipe', async () => {
    state.userId = OTHER;
    expect(await rateRecipe(PUBLIC_ID, 5)).toEqual({
      success: true,
      rating: 5,
      avgUserRating: 4.5,
      totalRatings: 2,
    });
    expect((await snapshot(PUBLIC_ID)).recipe).toEqual({ avg: '4.5', total: 2 });
  });

  it('anonymous callers keep the sign-in answer and write nothing', async () => {
    state.userId = null;
    const expected = { success: false, error: 'You must be logged in to rate recipes' };
    for (const id of [PUBLIC_ID, PRIVATE_ID, MISSING_ID]) {
      expect(await rateRecipe(id, 3)).toEqual(expected);
    }
    expect((await snapshot(PUBLIC_ID)).ratings).toHaveLength(1);
  });
});

describe('#137 ratings reads: a hidden recipe answers as a missing one', () => {
  for (const viewer of [null, OTHER, RATER]) {
    for (const { kind, id } of HIDDEN) {
      it(`getRecipeRatings on a ${kind} recipe — ${viewer ?? 'anonymous'}`, async () => {
        state.userId = viewer;
        const hidden = await getRecipeRatings(id);
        expect(hidden).toEqual(await getRecipeRatings(MISSING_ID));
        expect(JSON.stringify(hidden)).not.toContain(REVIEW);
      });
    }
  }

  for (const { kind, id } of HIDDEN) {
    it(`getUserRating on a ${kind} recipe the caller rated before it was hidden`, async () => {
      state.userId = OTHER;
      expect(await getUserRating(id)).toEqual(await getUserRating(MISSING_ID));
    });
  }

  it('the owner and public viewers still read ratings', async () => {
    state.userId = OWNER;
    expect(await getRecipeRatings(PRIVATE_ID)).toMatchObject([{ userId: OTHER, review: REVIEW }]);
    state.userId = null;
    expect(await getRecipeRatings(PUBLIC_ID)).toMatchObject([{ userId: RATER, rating: 4 }]);
    state.userId = RATER;
    expect(await getUserRating(PUBLIC_ID)).toMatchObject({ rating: 4 });
  });
});

describe('#137 deleteRating', () => {
  it("removes the caller's own rating and recomputes the aggregates", async () => {
    state.userId = OTHER;
    await rateRecipe(PUBLIC_ID, 2);
    expect(await deleteRating(PUBLIC_ID)).toEqual({ success: true });
    expect(await snapshot(PUBLIC_ID)).toEqual({
      recipe: { avg: '4.0', total: 1 },
      ratings: [{ user: RATER, rating: 4, review: null }],
    });
  });
});
