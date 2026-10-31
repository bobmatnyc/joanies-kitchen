// @vitest-environment node
/**
 * #225 (c), owner ruling Dee: anyone signed in may generate a shopping list
 * from a public meal.
 *
 * `POST /api/v1/meals/:id/shopping-list` serves the owner (public or private
 * meal) and any signed-in caller on a public meal. Another user's private meal
 * is 404 for everyone, admins included. The list is written to the caller,
 * never the meal owner, and an account pending deletion is refused with 403.
 * Real server action and route handler against PGlite.
 */

import type { PGlite } from '@electric-sql/pglite';
import { NextRequest } from 'next/server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const OWNER = 'user_owner';
const OTHER = 'user_other';
const ADMIN = 'user_admin';
const PENDING = 'user_pending';
const PUBLIC_MEAL = '22222222-0000-4000-8000-000000000001';
const PRIVATE_MEAL = '22222222-0000-4000-8000-000000000002';
const RECIPE = 'bbbbbbbb-0000-4000-8000-00000000000b';
const OWNER_LIST = 'cccccccc-0000-4000-8000-00000000000c';

const state = vi.hoisted(() => ({ db: undefined as unknown, userId: null as string | null }));

vi.mock('@/lib/session-user', () => ({
  getSessionUserId: async () => state.userId,
  getSessionUser: async () => (state.userId ? { id: state.userId } : null),
}));
vi.mock('@/lib/db', () => ({
  get db() {
    return state.db;
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock('@/lib/auth-users', () => ({
  getUserAdminFlag: async (userId: string) => userId === ADMIN,
}));
// A session caller with every scope; ADMIN carries the admin flag the old bypass read.
vi.mock('@/lib/api-auth/middleware', () => ({
  authenticateRequest: async () =>
    state.userId
      ? {
          authenticated: true,
          userId: state.userId,
          authType: 'session',
          scopes: ['*'],
          metadata: { isAdmin: state.userId === ADMIN },
        }
      : { authenticated: false, error: 'Authentication required' },
  authHasAllScopes: () => true,
  authHasAnyScope: () => true,
}));

import { generateShoppingList } from '@/app/actions/meals';
import { POST as shoppingListPOST } from '@/app/api/v1/meals/[id]/shopping-list/route';
import {
  pendingDeletionError,
  pendingDeletionRefusal,
} from '@/lib/account-deletion/guarded-insert';
import type { RouteContext } from '@/lib/api-auth/types';
import { users } from '@/lib/db/auth-schema';
import * as schema from '@/lib/db/schema';
import { createVisibilityDb } from './recipe-visibility-db';

let client: PGlite;

async function rows(query: string, params: unknown[] = []) {
  return (await client.query(query, params)).rows as Record<string, unknown>[];
}

const allLists = () => rows('SELECT * FROM shopping_lists ORDER BY id');
const listsOf = (userId: string) =>
  rows('SELECT * FROM shopping_lists WHERE user_id = $1 ORDER BY id', [userId]);

async function generateRoute(id: string): Promise<{ status: number; body: unknown }> {
  const req = new NextRequest(`http://localhost/api/v1/meals/${id}/shopping-list`, {
    method: 'POST',
  });
  const res = await shoppingListPOST(req, { params: Promise.resolve({ id }) } as RouteContext);
  return { status: res.status, body: await res.json() };
}

beforeAll(async () => {
  const built = await createVisibilityDb(
    [
      users,
      schema.recipes,
      schema.meals,
      schema.mealRecipes,
      schema.shoppingLists,
      schema.ingredients,
    ],
    schema,
    { constraints: true }
  );
  client = built.client;
  state.db = built.db;
});

afterAll(async () => {
  await client?.close();
});

beforeEach(async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  await client.exec(`DELETE FROM shopping_lists; DELETE FROM meal_recipes; DELETE FROM meals;
    DELETE FROM recipes; DELETE FROM ingredients; DELETE FROM users;`);
  await rows(
    `INSERT INTO users (id, name, email, deletion_requested_at) VALUES
      ($1, 'O', 'o@x.test', NULL), ($2, 'T', 't@x.test', NULL),
      ($3, 'A', 'a@x.test', NULL), ($4, 'P', 'p@x.test', now())`,
    [OWNER, OTHER, ADMIN, PENDING]
  );
  await client.exec(`INSERT INTO recipes (id, user_id, name, ingredients, instructions,
      is_public, moderation_status, prep_time, cook_time) VALUES
    ('${RECIPE}', '${OWNER}', 'Soup', '["2 cups flour"]', '[]', true, 'approved', 10, 20)`);
  for (const [id, isPublic] of [
    [PUBLIC_MEAL, true],
    [PRIVATE_MEAL, false],
  ] as const) {
    await rows(
      `INSERT INTO meals (id, user_id, name, is_public, total_prep_time, total_cook_time)
       VALUES ($1, $2, 'Dinner', $3, 0, 0)`,
      [id, OWNER, isPublic]
    );
    await rows(
      `INSERT INTO meal_recipes (meal_id, recipe_id, course_category, display_order)
       VALUES ($1, $2, 'main', 0)`,
      [id, RECIPE]
    );
  }
  // The owner's own list for the public meal; no other caller may touch it.
  await rows(
    `INSERT INTO shopping_lists (id, user_id, meal_id, name, items, status)
     VALUES ($1, $2, $3, 'Mine', '[]', 'active')`,
    [OWNER_LIST, OWNER, PUBLIC_MEAL]
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  state.userId = null;
});

const NOT_FOUND = { status: 404, body: { success: false, error: 'Meal not found' } };

describe('#225 (c) POST /api/v1/meals/:id/shopping-list', () => {
  it.each([
    ['another user', OTHER],
    ['an admin', ADMIN],
  ])(
    '%s on a public meal gets a list of their own; the owner list is unchanged',
    async (_, user) => {
      const ownerBefore = await listsOf(OWNER);
      state.userId = user;

      const res = await generateRoute(PUBLIC_MEAL);

      expect(res).toMatchObject({
        status: 201,
        body: { success: true, data: { user_id: user, meal_id: PUBLIC_MEAL, status: 'draft' } },
      });
      const mine = await listsOf(user);
      expect(mine).toHaveLength(1);
      expect(mine[0]).toMatchObject({ user_id: user, meal_id: PUBLIC_MEAL });
      expect(JSON.parse(String(mine[0].items))).toMatchObject([{ name: 'flour' }]);
      expect(await listsOf(OWNER)).toEqual(ownerBefore);
    }
  );

  it.each([
    ['another user', OTHER],
    ['an admin', ADMIN],
  ])('%s on a private meal gets 404 and nothing is written', async (_, user) => {
    const before = await allLists();
    state.userId = user;

    expect(await generateRoute(PRIVATE_MEAL)).toEqual(NOT_FOUND);
    expect(await allLists()).toEqual(before);
  });

  it('the owner generates a list from their private meal', async () => {
    state.userId = OWNER;

    expect(await generateRoute(PRIVATE_MEAL)).toMatchObject({
      status: 201,
      body: { success: true, data: { user_id: OWNER, meal_id: PRIVATE_MEAL } },
    });
    expect(
      await rows('SELECT user_id FROM shopping_lists WHERE meal_id = $1', [PRIVATE_MEAL])
    ).toEqual([{ user_id: OWNER }]);
  });

  it('an unauthenticated caller gets 401 and nothing is written', async () => {
    const before = await allLists();

    expect((await generateRoute(PUBLIC_MEAL)).status).toBe(401);
    expect(await allLists()).toEqual(before);
  });

  it('a caller pending deletion gets 403 and nothing is written', async () => {
    const before = await allLists();
    state.userId = PENDING;

    expect(await generateRoute(PUBLIC_MEAL)).toEqual({
      status: 403,
      body: { success: false, error: pendingDeletionError('generate shopping lists') },
    });
    expect(await allLists()).toEqual(before);
  });

  it('generateShoppingList refuses a caller pending deletion and writes nothing', async () => {
    const before = await allLists();
    state.userId = PENDING;

    expect(await generateShoppingList({ mealId: PUBLIC_MEAL })).toEqual(
      pendingDeletionRefusal('generate shopping lists')
    );
    expect(await allLists()).toEqual(before);
  });
});
