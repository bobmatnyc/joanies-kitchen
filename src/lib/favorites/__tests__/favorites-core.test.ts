// @vitest-environment node
/**
 * #167 (D26): `favorites` is the one like/favorite store.
 *
 * Runs the favorites core, the v1 favorites routes and the deprecated
 * `/recipes/:id/like` alias against real Postgres (PGlite) with real rows.
 * The API caller is an API-key context with no session and, at the start, no
 * `user_profiles` row: the path must create the profile (the `favorites` FK
 * needs it) and must never touch `recipe_likes`.
 */

import type { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const API_USER = 'user_api';
const OTHER = 'user_other';
const RECIPE = 'aaaaaaaa-0000-4000-8000-00000000000a';

const state = vi.hoisted(() => ({ db: undefined as unknown, apiUser: null as string | null }));

// An API-key caller has no session: auth() answers signed out.
vi.mock('@/lib/auth', () => ({ auth: async () => ({ userId: null, user: null }) }));
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
    state.apiUser
      ? { authenticated: true, userId: state.apiUser, authType: 'api_key', scopes: ['*'] }
      : { authenticated: false, error: 'Authentication required' },
  authHasAllScopes: () => true,
  authHasAnyScope: () => true,
}));

import { createVisibilityDb } from '@/app/actions/__tests__/recipe-visibility-db';
import { getFavoriteCount } from '@/app/actions/favorites';
import {
  DELETE as favoriteDELETE,
  GET as favoriteGET,
  POST as favoritePOST,
} from '@/app/api/v1/favorites/[recipeId]/route';
import {
  DELETE as likeDELETE,
  GET as likeGET,
  POST as likePOST,
} from '@/app/api/v1/recipes/[id]/like/route';
import type { RouteContext } from '@/lib/api-auth/types';
import * as schema from '@/lib/db/schema';
import { favorites, userProfiles } from '@/lib/db/user-discovery-schema';
import * as core from '@/lib/favorites';

let client: PGlite;
let db: Awaited<ReturnType<typeof createVisibilityDb>>['db'];

async function likeCount(): Promise<number> {
  const [row] = await db
    .select({ n: schema.recipes.like_count })
    .from(schema.recipes)
    .where(eq(schema.recipes.id, RECIPE));
  return row.n ?? 0;
}

async function count(table: string, where = ''): Promise<number> {
  const result = await client.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM "${table}" ${where}`
  );
  return result.rows[0].n;
}

const ctx = (params: Record<string, string>): RouteContext => ({
  params: Promise.resolve(params),
});
const likeReq = (method: string) =>
  new NextRequest(`http://localhost/api/v1/recipes/${RECIPE}/like`, { method });
const favReq = (method: string) =>
  new NextRequest(`http://localhost/api/v1/favorites/${RECIPE}`, { method });

async function read(response: Response) {
  return {
    status: response.status,
    body: await response.json(),
    deprecation: response.headers.get('Deprecation'),
    link: response.headers.get('Link'),
  };
}

beforeAll(async () => {
  const built = await createVisibilityDb(
    [schema.recipes, userProfiles, favorites, schema.recipeLikes],
    { ...schema, userProfiles, favorites },
    { constraints: true }
  );
  client = built.client;
  db = built.db;
  state.db = built.db;
});

beforeEach(async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  state.apiUser = API_USER;
  await client.exec(
    'DELETE FROM "favorites"; DELETE FROM "recipe_likes"; DELETE FROM "user_profiles"; DELETE FROM "recipes";'
  );
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
    like_count: 0,
  });
});

afterAll(async () => {
  await client?.close();
});

describe('#167 favorites core', () => {
  it('addFavorite twice increments like_count once and creates the missing profile', async () => {
    const first = await core.addFavorite(API_USER, RECIPE);
    const second = await core.addFavorite(API_USER, RECIPE);

    expect(first).toMatchObject({ status: 'added', favorite: { user_id: API_USER } });
    expect(second).toEqual({ status: 'exists' });
    expect(await likeCount()).toBe(1);
    expect(await count('favorites')).toBe(1);
    expect(await count('user_profiles', `WHERE user_id = '${API_USER}'`)).toBe(1);
  });

  it('removeFavorite reports whether a row went and decrements only then', async () => {
    await core.addFavorite(API_USER, RECIPE);

    expect(await core.removeFavorite(API_USER, RECIPE)).toBe(true);
    expect(await core.removeFavorite(API_USER, RECIPE)).toBe(false);
    expect(await likeCount()).toBe(0);
  });

  it('getFavoriteCount (core and action) counts every favorite, not 0 or 1', async () => {
    await db.insert(favorites).values([
      { user_id: API_USER, recipe_id: RECIPE },
      { user_id: OTHER, recipe_id: RECIPE },
    ]);

    expect(await core.getFavoriteCount(RECIPE)).toBe(2);
    expect(await getFavoriteCount(RECIPE)).toBe(2);
  });
});

describe('#167 /api/v1/recipes/:id/like is a deprecated alias over favorites', () => {
  it('POST creates a favorites row, keeps the body and 201, and marks the response deprecated', async () => {
    const res = await read(await likePOST(likeReq('POST'), ctx({ id: RECIPE })));

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      success: true,
      data: { message: 'Recipe liked', recipeId: RECIPE, isLiked: true, likeCount: 1 },
    });
    expect(await count('favorites', `WHERE user_id = '${API_USER}'`)).toBe(1);
    expect(await count('recipe_likes')).toBe(0);
    expect(await count('user_profiles', `WHERE user_id = '${API_USER}'`)).toBe(1);
    expect(await likeCount()).toBe(1);

    // Idempotent: a repeat like neither adds a row nor counts again.
    const again = await read(await likePOST(likeReq('POST'), ctx({ id: RECIPE })));
    expect(again.body.data.likeCount).toBe(1);
    expect(await likeCount()).toBe(1);

    expect(res.deprecation).toBe('true');
    expect(res.link).toBe(`</api/v1/favorites/${RECIPE}>; rel="successor-version"`);
  });

  it('GET answers likeCount from favorites and isLiked for the caller', async () => {
    await db.insert(favorites).values([
      { user_id: API_USER, recipe_id: RECIPE },
      { user_id: OTHER, recipe_id: RECIPE },
    ]);

    const res = await read(await likeGET(likeReq('GET'), ctx({ id: RECIPE })));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: { recipeId: RECIPE, likeCount: 2, isLiked: true },
    });
    expect(res.deprecation).toBe('true');
  });

  it('DELETE removes the favorites row and decrements like_count', async () => {
    await core.addFavorite(API_USER, RECIPE);

    const res = await read(await likeDELETE(likeReq('DELETE'), ctx({ id: RECIPE })));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: { message: 'Recipe unliked', recipeId: RECIPE, isLiked: false, likeCount: 0 },
    });
    expect(await count('favorites')).toBe(0);
    expect(await likeCount()).toBe(0);
    expect(res.deprecation).toBe('true');
  });

  it('an unauthenticated write keeps its 401 and still carries the deprecation header', async () => {
    state.apiUser = null;

    const res = await read(await likePOST(likeReq('POST'), ctx({ id: RECIPE })));

    expect(res.status).toBe(401);
    expect(res.deprecation).toBe('true');
    expect(await count('favorites')).toBe(0);
  });
});

describe('#167 /api/v1/favorites/:recipeId writes favorites', () => {
  it('POST adds a favorite for a caller with no profile, creating the profile', async () => {
    const res = await read(await favoritePOST(favReq('POST'), ctx({ recipeId: RECIPE })));

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      success: true,
      data: { message: 'Recipe added to favorites', recipeId: RECIPE, isFavorite: true },
    });
    expect(res.deprecation).toBeNull();
    expect(await count('favorites', `WHERE user_id = '${API_USER}'`)).toBe(1);
    expect(await count('user_profiles', `WHERE user_id = '${API_USER}'`)).toBe(1);
    expect(await count('recipe_likes')).toBe(0);
    expect(await likeCount()).toBe(1);
  });

  it('GET reads favorites and DELETE removes the row and decrements', async () => {
    await core.addFavorite(API_USER, RECIPE);

    const got = await read(await favoriteGET(favReq('GET'), ctx({ recipeId: RECIPE })));
    expect(got.body).toEqual({ success: true, data: { isFavorite: true, recipeId: RECIPE } });

    const del = await read(await favoriteDELETE(favReq('DELETE'), ctx({ recipeId: RECIPE })));
    expect(del.status).toBe(200);
    expect(del.body.data).toEqual({
      message: 'Recipe removed from favorites',
      recipeId: RECIPE,
      isFavorite: false,
    });
    expect(await count('favorites')).toBe(0);
    expect(await likeCount()).toBe(0);
  });
});
