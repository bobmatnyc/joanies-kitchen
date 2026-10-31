// @vitest-environment node
/**
 * #167: `removeFavorite` decrements `recipes.like_count` only when its DELETE
 * removed a favorites row. Runs against real Postgres (PGlite). `addFavorite`
 * increments only when its insert added a row (D26: `ON CONFLICT DO NOTHING`
 * in the same statement), and `toggleFavorite`'s remove path decrements too.
 */

import type { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const USER = 'user_a';
const RECIPE = 'aaaaaaaa-0000-4000-8000-00000000000a';

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

import { addFavorite, removeFavorite, toggleFavorite } from '@/app/actions/favorites';
import { users } from '@/lib/db/auth-schema';
import * as schema from '@/lib/db/schema';
import { favorites, userProfiles } from '@/lib/db/user-discovery-schema';
import { createVisibilityDb } from './recipe-visibility-db';

let client: PGlite;
let db: Awaited<ReturnType<typeof createVisibilityDb>>['db'];

async function likeCount(): Promise<number> {
  const [row] = await db
    .select({ n: schema.recipes.like_count })
    .from(schema.recipes)
    .where(eq(schema.recipes.id, RECIPE));
  return row.n ?? 0;
}

async function seed(likeCountValue: number, favorited: boolean) {
  await db.insert(schema.recipes).values({
    id: RECIPE,
    user_id: 'user_owner',
    name: 'Recipe',
    slug: 'recipe-aaaa',
    ingredients: '[]',
    instructions: '[]',
    is_public: true,
    is_system_recipe: false,
    moderation_status: 'approved' as const,
    like_count: likeCountValue,
  });
  if (favorited) await db.insert(favorites).values({ user_id: USER, recipe_id: RECIPE });
}

beforeAll(async () => {
  const built = await createVisibilityDb(
    // #208: addFavorite's pending-deletion guard reads users.
    [schema.recipes, userProfiles, favorites, users],
    { ...schema, userProfiles, favorites },
    { constraints: true }
  );
  client = built.client;
  db = built.db;
  state.db = built.db;
});

beforeEach(async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  state.userId = USER;
  await client.exec('DELETE FROM "favorites"; DELETE FROM "recipes";');
});

afterAll(async () => {
  await client?.close();
});

describe('#167 removeFavorite like_count', () => {
  it('decrements once for a real favorite; a repeat call changes nothing', async () => {
    await seed(1, true);

    expect(await removeFavorite(RECIPE)).toEqual({ success: true });
    expect(await likeCount()).toBe(0);

    expect(await removeFavorite(RECIPE)).toEqual({ success: true });
    expect(await likeCount()).toBe(0);
  });

  // GREATEST(…, 0) hides a repeat at count 1, so this case stays above the floor.
  it('a repeat call does not take another liker’s count when the total is above 0', async () => {
    await seed(2, true);
    await db.insert(favorites).values({ user_id: 'user_b', recipe_id: RECIPE });

    await removeFavorite(RECIPE);
    expect(await likeCount()).toBe(1);

    await removeFavorite(RECIPE);
    expect(await likeCount()).toBe(1);
  });

  it('leaves like_count alone when this user never favorited the recipe', async () => {
    await seed(5, false);

    expect(await removeFavorite(RECIPE)).toEqual({ success: true });
    expect(await likeCount()).toBe(5);
  });

  it("does not decrement for another user's favorite", async () => {
    await seed(5, false);
    await db.insert(favorites).values({ user_id: 'user_b', recipe_id: RECIPE });

    await removeFavorite(RECIPE);

    expect(await likeCount()).toBe(5);
  });
});

describe('#167 (D26) toggleFavorite like_count', () => {
  it('add then remove nets 0; a repeat remove changes nothing', async () => {
    await seed(3, false);

    expect(await toggleFavorite(RECIPE)).toEqual({ success: true, isFavorited: true });
    expect(await likeCount()).toBe(4);

    expect(await toggleFavorite(RECIPE)).toEqual({ success: true, isFavorited: false });
    expect(await likeCount()).toBe(3);

    expect(await removeFavorite(RECIPE)).toEqual({ success: true });
    expect(await likeCount()).toBe(3);
  });
});

describe('#167 addFavorite like_count', () => {
  it('a duplicate add answers "already in favorites" and does not increment', async () => {
    await seed(0, false);

    expect(await addFavorite(RECIPE)).toMatchObject({ success: true });
    expect(await likeCount()).toBe(1);

    expect(await addFavorite(RECIPE)).toEqual({
      success: false,
      error: 'Recipe already in favorites',
    });
    expect(await likeCount()).toBe(1);
  });

  it('a signed-out caller gets the sign-in error and nothing is counted', async () => {
    await seed(0, false);
    state.userId = null;

    expect(await addFavorite(RECIPE)).toEqual({
      success: false,
      error: 'Please sign in to favorite recipes',
    });
    expect(await likeCount()).toBe(0);
  });
});
