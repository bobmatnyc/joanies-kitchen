// @vitest-environment node
/**
 * #41: a private recipe stays private when it sits in a container.
 *
 * One private recipe P (owned by OWNER) is linked into another user's public
 * collection, public meal, chef page, and every user's favorites (likes are
 * favorites since #167) and view history. Runs against real Postgres (PGlite). Per path and caller:
 * - read paths: anonymous / other user never see P, and get exactly the
 *   answer they get once P is deleted; owner / admin see P;
 * - attach paths: anonymous / other user are refused, with exactly the answer
 *   a nonexistent recipe gets; owner / admin pass the visibility gate.
 * The v1 API resolves its caller as a non-admin viewer (same as #32), so the
 * admin role there is expected to be denied.
 */

import type { PGlite } from '@electric-sql/pglite';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const OWNER = 'user_owner';
const OTHER = 'user_other';
const ADMIN = 'user_admin';
const P = 'aaaaaaaa-0000-4000-8000-00000000000a';
const Q = 'bbbbbbbb-0000-4000-8000-00000000000b';
const MISSING = 'eeeeeeee-0000-4000-8000-00000000000e';
const PUBLIC_COLLECTION = '11111111-0000-4000-8000-000000000001';
const PUBLIC_MEAL = '22222222-0000-4000-8000-000000000002';
const CHEF = '33333333-0000-4000-8000-000000000003';
const SECRET = 'Secret Stew';

const state = vi.hoisted(() => ({
  db: undefined as unknown,
  auth: undefined as unknown as ReturnType<typeof vi.fn>,
  apiUser: null as string | null,
}));

vi.mock('@/lib/auth', () => {
  state.auth = vi.fn();
  return { auth: (...args: unknown[]) => state.auth(...args) };
});
// #22: admin is read from users.is_admin; here only ADMIN carries the flag.
vi.mock('@/lib/auth-users', () => ({
  getUserAdminFlag: async (userId: string) => userId === ADMIN,
}));
vi.mock('@/lib/db', () => ({
  get db() {
    return state.db;
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock('@/lib/ai/meal-pairing-engine', () => ({ generateMeal: vi.fn() }));
vi.mock('@/app/actions/user-profiles', () => ({ ensureUserProfile: vi.fn(async () => ({})) }));
// v1 API: a session-authenticated caller with every scope.
vi.mock('@/lib/api-auth/middleware', () => ({
  authenticateRequest: async () =>
    state.apiUser
      ? { authenticated: true, userId: state.apiUser, authType: 'session', scopes: ['*'] }
      : { authenticated: false, error: 'Authentication required' },
  authHasAllScopes: () => true,
  authHasAnyScope: () => true,
}));

import {
  addRecipeToCollection,
  getCollectionById,
  getCollectionBySlug,
  getPublicCollections,
  getUserCollections,
} from '@/app/actions/collections';
import { addFavorite, getUserFavorites, toggleFavorite } from '@/app/actions/favorites';
import { flagRecipe } from '@/app/actions/flag-recipe';
import { getChefBySlug } from '@/app/actions/chefs';
import { saveMealPlanFromPairing } from '@/app/actions/meal-pairing';
import { addRecipeToMeal, getMealById, getMealBySlug } from '@/app/actions/meals';
import {
  getRecentlyViewedRecipes,
  getUserViewHistory,
  trackRecipeView,
} from '@/app/actions/recipe-views';
import { GET as chefRecipesGET } from '@/app/api/v1/chefs/[slug]/recipes/route';
import {
  GET as collectionRecipesGET,
  POST as collectionRecipesPOST,
} from '@/app/api/v1/collections/[id]/recipes/route';
import { POST as favoritePOST } from '@/app/api/v1/favorites/[recipeId]/route';
import { GET as favoritesGET } from '@/app/api/v1/favorites/route';
import { POST as likePOST } from '@/app/api/v1/recipes/[id]/like/route';
import * as chefSchema from '@/lib/db/chef-schema';
import * as schema from '@/lib/db/schema';
import * as discovery from '@/lib/db/user-discovery-schema';
import { createVisibilityDb } from './recipe-visibility-db';

type Role = 'anonymous' | 'otherUser' | 'owner' | 'admin';
const ROLES: Role[] = ['anonymous', 'otherUser', 'owner', 'admin'];
const USER_OF: Record<Role, string | null> = {
  anonymous: null,
  otherUser: OTHER,
  owner: OWNER,
  admin: ADMIN,
};
const ALLOWED: Record<Role, boolean> = {
  anonymous: false,
  otherUser: false,
  owner: true,
  admin: true,
};
// v1 resolves its caller as { userId, isAdmin: false } (#32 convention).
const API_ALLOWED: Record<Role, boolean> = { ...ALLOWED, admin: false };

function signInAs(role: Role) {
  const userId = USER_OF[role];
  state.apiUser = userId;
  state.auth.mockResolvedValue(
    userId ? { userId, sessionClaims: { metadata: {} } } : { userId: null, sessionClaims: null }
  );
}

let client: PGlite;
const T0 = new Date('2026-01-01T00:00:00Z');
const TABLES = [
  'recipes',
  'user_profiles',
  'collections',
  'collection_recipes',
  'favorites',
  'recipe_views',
  'recipe_flags',
  'meals',
  'meal_recipes',
  'chefs',
  'chef_recipes',
];

function recipeRow(id: string, userId: string, isPublic: boolean, name: string) {
  return {
    id,
    user_id: userId,
    name,
    description: `${name} description`,
    ingredients: '["1 cup water"]',
    instructions: '[]',
    is_public: isPublic,
    is_system_recipe: false,
    created_at: T0,
    updated_at: T0,
  };
}

const collectionId = (role: Role) => `44444444-0000-4000-8000-00000000000${ROLES.indexOf(role)}`;
const mealId = (role: Role) => `55555555-0000-4000-8000-00000000000${ROLES.indexOf(role)}`;

async function seed() {
  const db = state.db as any;
  for (const table of TABLES) await client.exec(`DELETE FROM "${table}";`);
  await db
    .insert(schema.recipes)
    .values([recipeRow(P, OWNER, false, SECRET), recipeRow(Q, OTHER, true, 'Open Soup')]);
  await db
    .insert(discovery.userProfiles)
    .values([OWNER, OTHER, ADMIN].map((u) => ({ user_id: u, username: u, display_name: u })));
  // OTHER's public collection holds P (attached before #41) and Q.
  await db.insert(discovery.collections).values([
    {
      id: PUBLIC_COLLECTION,
      user_id: OTHER,
      name: 'Shared',
      slug: 'shared',
      is_public: true,
      recipe_count: 2,
      created_at: T0,
    },
    // One empty collection per signed-in role, as an attach target.
    ...ROLES.filter((r) => USER_OF[r]).map((r) => ({
      id: collectionId(r),
      user_id: USER_OF[r]!,
      name: `Mine ${r}`,
      slug: `mine-${r}`,
      is_public: false,
      recipe_count: 0,
      created_at: new Date('2025-01-01T00:00:00Z'),
    })),
  ]);
  await db.insert(discovery.collectionRecipes).values([
    { collection_id: PUBLIC_COLLECTION, recipe_id: P, position: 0, added_at: T0 },
    { collection_id: PUBLIC_COLLECTION, recipe_id: Q, position: 1, added_at: T0 },
  ]);
  await db.insert(schema.meals).values([
    {
      id: PUBLIC_MEAL,
      user_id: OTHER,
      name: 'Shared meal',
      slug: 'shared-meal',
      meal_type: 'dinner',
      is_public: true,
      created_at: T0,
      updated_at: T0,
    },
    ...ROLES.filter((r) => USER_OF[r]).map((r) => ({
      id: mealId(r),
      user_id: USER_OF[r]!,
      name: `Meal ${r}`,
      meal_type: 'dinner',
      is_public: false,
      created_at: T0,
      updated_at: T0,
    })),
  ]);
  await db.insert(schema.mealRecipes).values([
    { meal_id: PUBLIC_MEAL, recipe_id: P, display_order: 0 },
    { meal_id: PUBLIC_MEAL, recipe_id: Q, display_order: 1 },
  ]);
  await db.insert(chefSchema.chefs).values({
    id: CHEF,
    slug: 'chef',
    name: 'Chef',
    is_active: true,
    recipe_count: 2,
  });
  await db.insert(chefSchema.chefRecipes).values([
    { chef_id: CHEF, recipe_id: P },
    { chef_id: CHEF, recipe_id: Q },
  ]);
  // Every user favorited (#167 D26: likes are favorites) and viewed P (attached before #41).
  for (const u of [OWNER, OTHER, ADMIN]) {
    await db.insert(discovery.favorites).values({ user_id: u, recipe_id: P, created_at: T0 });
    await db.insert(discovery.recipeViews).values({ user_id: u, recipe_id: P, viewed_at: T0 });
  }
}

/** Removes P the way a cascade delete would: the "nonexistent recipe" state. */
async function deletePrivateRecipe() {
  await client.exec(`DELETE FROM "recipes" WHERE id = '${P}';`);
  for (const table of TABLES.filter((t) => t !== 'recipes' && t !== 'user_profiles')) {
    if (['collections', 'meals', 'chefs'].includes(table)) continue;
    await client.exec(`DELETE FROM "${table}" WHERE recipe_id = '${P}';`);
  }
}

const hasP = (list: Array<{ id?: string; name?: string | null }> | undefined) =>
  (list ?? []).some((r) => r.id === P || r.name === SECRET);

const ctx = (params: Record<string, string>) => ({ params: Promise.resolve(params) });
async function api(response: Response) {
  return { status: response.status, body: await response.json() };
}

interface ReadPath {
  name: string;
  api?: boolean;
  run: (role: Role) => Promise<any>;
  sees: (result: any) => boolean;
  normalize?: (result: any) => unknown;
}

const READS: ReadPath[] = [
  {
    name: 'getCollectionById (public collection of another user)',
    run: () => getCollectionById(PUBLIC_COLLECTION),
    sees: (r) => hasP(r?.recipes),
  },
  {
    name: 'getCollectionBySlug',
    run: () => getCollectionBySlug(OTHER, 'shared'),
    sees: (r) => hasP(r?.recipes),
  },
  {
    name: 'getPublicCollections previews',
    run: () => getPublicCollections(),
    sees: (r) => r.some((c: any) => hasP(c.recipes)),
  },
  {
    name: 'getUserCollections previews',
    run: () => getUserCollections(OTHER),
    sees: (r) => r.some((c: any) => hasP(c.recipes)),
  },
  {
    name: 'getMealById (public meal of another user)',
    run: () => getMealById(PUBLIC_MEAL),
    sees: (r) => hasP(r.data?.recipes?.map((m: any) => m.recipe)),
  },
  {
    name: 'getMealBySlug',
    run: () => getMealBySlug('shared-meal'),
    sees: (r) => hasP(r.data?.recipes?.map((m: any) => m.recipe)),
  },
  {
    name: 'getChefBySlug (chef page)',
    run: () => getChefBySlug('chef'),
    sees: (r) => hasP(r.chef?.recipes),
  },
  {
    name: 'getUserFavorites',
    run: () => getUserFavorites(),
    sees: (r) => hasP(r),
  },
  {
    name: 'getRecentlyViewedRecipes',
    run: () => getRecentlyViewedRecipes(),
    sees: (r) => hasP(r),
  },
  {
    name: 'getUserViewHistory',
    run: () => getUserViewHistory(),
    sees: (r) => hasP(r.recipes),
    // total is a link count, outside #41 (see report).
    normalize: (r) => ({ ...r, total: undefined }),
  },
  {
    name: 'GET /api/v1/collections/:id/recipes',
    api: true,
    run: async () =>
      api(
        await collectionRecipesGET(
          new NextRequest(`http://localhost/api/v1/collections/${PUBLIC_COLLECTION}/recipes`),
          ctx({ id: PUBLIC_COLLECTION }) as any
        )
      ),
    sees: (r) => hasP(r.body.data?.items),
  },
  {
    name: 'GET /api/v1/chefs/:slug/recipes',
    api: true,
    run: async () =>
      api(
        await chefRecipesGET(
          new NextRequest('http://localhost/api/v1/chefs/chef/recipes'),
          ctx({ slug: 'chef' }) as any
        )
      ),
    sees: (r) => hasP(r.body.data?.items),
    // pagination.total comes from chefs.recipe_count, outside #41 (see report).
    normalize: (r) => ({ ...r, body: { ...r.body, pagination: undefined } }),
  },
  {
    name: 'GET /api/v1/favorites',
    api: true,
    run: async () =>
      api(await favoritesGET(new NextRequest('http://localhost/api/v1/favorites'), ctx({}) as any)),
    sees: (r) => hasP(r.body.data?.items),
  },
];

interface AttachPath {
  name: string;
  api?: boolean;
  run: (role: Role, recipeId: string) => Promise<any>;
  /** True when the call got past the visibility gate. */
  passed: (result: any) => boolean;
}

const failedAsMissing = (r: any) => r?.success === false && r?.error === 'Recipe not found';

const ATTACHES: AttachPath[] = [
  {
    name: 'addRecipeToCollection',
    run: (role, id) => addRecipeToCollection(collectionId(role), id),
    // The action's insert-schema parse fails for every recipe (pre-existing,
    // see report), so "passed" means it got past the recipe check.
    passed: (r) => !failedAsMissing(r) && r.error !== 'Unauthorized',
  },
  { name: 'addFavorite', run: (_r, id) => addFavorite(id), passed: (r) => r.success === true },
  {
    name: 'toggleFavorite',
    run: async (_r, id) => {
      // Clear the seeded favorite so the call takes the "add" branch.
      await client.exec(`DELETE FROM "favorites" WHERE recipe_id = '${id}';`);
      return toggleFavorite(id);
    },
    passed: (r) => r.success === true,
  },
  {
    name: 'addRecipeToMeal',
    run: (role, id) => addRecipeToMeal({ meal_id: mealId(role), recipe_id: id }),
    passed: (r) => r.success === true,
  },
  {
    name: 'saveMealPlanFromPairing',
    run: (_r, id) =>
      saveMealPlanFromPairing(
        {
          appetizer: { name: 'a' },
          main: { name: 'm', recipe_id: id },
          side: { name: 's' },
          dessert: { name: 'd' },
          meal_analysis: { total_prep_time: 1, color_palette: [], cultural_coherence: 'x' },
        } as any,
        'Plan'
      ),
    passed: (r) => r.success === true,
  },
  {
    name: 'flagRecipe',
    run: (_r, id) => flagRecipe(id, 'spam'),
    passed: (r) => r.success === true,
  },
  {
    name: 'trackRecipeView',
    run: async (role, id) => {
      await client.exec(`DELETE FROM "recipe_views";`);
      await trackRecipeView(id);
      const rows = await client.query(`SELECT 1 FROM "recipe_views" WHERE recipe_id = '${id}';`);
      return { recorded: rows.rows.length, role };
    },
    passed: (r) => r.recorded === 1,
  },
  {
    name: 'POST /api/v1/collections/:id/recipes',
    api: true,
    run: async (role, id) =>
      api(
        await collectionRecipesPOST(
          new NextRequest(`http://localhost/api/v1/collections/${collectionId(role)}/recipes`, {
            method: 'POST',
            body: JSON.stringify({ recipeId: id }),
          }),
          ctx({ id: collectionId(role) }) as any
        )
      ),
    passed: (r) => r.status === 201,
  },
  {
    name: 'POST /api/v1/favorites/:recipeId',
    api: true,
    run: async (_r, id) =>
      api(
        await favoritePOST(
          new NextRequest(`http://localhost/api/v1/favorites/${id}`, { method: 'POST' }),
          ctx({ recipeId: id }) as any
        )
      ),
    passed: (r) => r.status === 201,
  },
  {
    name: 'POST /api/v1/recipes/:id/like',
    api: true,
    run: async (_r, id) =>
      api(
        await likePOST(
          new NextRequest(`http://localhost/api/v1/recipes/${id}/like`, { method: 'POST' }),
          ctx({ id }) as any
        )
      ),
    passed: (r) => r.status === 200 || r.status === 201,
  },
];

beforeAll(async () => {
  const tables = [
    schema.recipes,
    discovery.userProfiles,
    discovery.collections,
    discovery.collectionRecipes,
    discovery.favorites,
    discovery.recipeViews,
    schema.recipeFlags,
    schema.meals,
    schema.mealRecipes,
    chefSchema.chefs,
    chefSchema.chefRecipes,
  ];
  const built = await createVisibilityDb(tables, { ...schema, ...discovery, ...chefSchema });
  client = built.client;
  state.db = built.db;
  // GROUP BY recipes.id (view history) needs the key; saveMealPlanFromPairing
  // relies on the database default for meals.id.
  await client.exec(`
    ALTER TABLE "recipes" ADD PRIMARY KEY ("id");
    ALTER TABLE "meals" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
  `);
});

afterAll(async () => {
  await client?.close();
});

beforeEach(async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  await seed();
});

describe.each(READS)('#41 read $name', (path) => {
  it.each(ROLES)('%s', async (role) => {
    signInAs(role);
    const result = await path.run(role);
    const allowed = (path.api ? API_ALLOWED : ALLOWED)[role];

    if (allowed) {
      expect(path.sees(result), JSON.stringify(result)).toBe(true);
      return;
    }

    expect(path.sees(result), JSON.stringify(result)).toBe(false);
    await deletePrivateRecipe();
    const nonexistent = await path.run(role);
    const normalize = path.normalize ?? ((r: unknown) => r);
    expect(normalize(result)).toEqual(normalize(nonexistent));
  });
});

describe.each(ATTACHES)('#41 attach $name', (path) => {
  it.each(ROLES)('%s', async (role) => {
    signInAs(role);
    const allowed = (path.api ? API_ALLOWED : ALLOWED)[role];

    if (allowed) {
      const result = await path.run(role, P);
      expect(path.passed(result), JSON.stringify(result)).toBe(true);
      return;
    }

    const result = await path.run(role, P);
    expect(path.passed(result), JSON.stringify(result)).toBe(false);
    const nonexistent = await path.run(role, MISSING);
    expect(result).toEqual(nonexistent);
  });
});
