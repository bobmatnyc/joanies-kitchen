// @vitest-environment node
/**
 * #167: `removeFavorite` decrements `recipes.like_count` only when its DELETE
 * removed a favorites row. Runs against real Postgres (PGlite). `addFavorite`
 * needs no matching guard: `favorites_unique` makes a duplicate insert throw
 * before the increment runs, which the last test pins.
 */

import type { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const USER = 'user_a';
const RECIPE = 'aaaaaaaa-0000-4000-8000-00000000000a';

const state = vi.hoisted(() => ({ db: undefined as unknown, userId: null as string | null }));

vi.mock('@/lib/auth', () => ({
  auth: async () => ({ userId: state.userId, sessionClaims: null }),
}));
vi.mock('@/lib/auth-users', () => ({ getUserAdminFlag: async () => false }));
vi.mock('@/lib/db', () => ({
  get db() {
    return state.db;
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock('@/app/actions/user-profiles', () => ({
  ensureUserProfile: async () => ({ user_id: state.userId }),
}));

import { addFavorite, removeFavorite } from '@/app/actions/favorites';
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
    [schema.recipes, userProfiles, favorites],
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

describe('#167 addFavorite like_count', () => {
  it('a duplicate add fails on favorites_unique and does not increment', async () => {
    await seed(0, false);

    expect(await addFavorite(RECIPE)).toMatchObject({ success: true });
    expect(await likeCount()).toBe(1);

    expect(await addFavorite(RECIPE)).toEqual({
      success: false,
      error: 'Recipe already in favorites',
    });
    expect(await likeCount()).toBe(1);
  });
});
