// @vitest-environment node
/**
 * #225: the v1 meal write routes are owner-only, and adding a recipe to a meal
 * refuses an account with a pending deletion.
 *
 * (a) `PATCH` / `DELETE /api/v1/meals/:id` and (b) `POST /api/v1/meals/:id/recipes`
 * answer a non-owner, admins included, with 404 and change nothing; `deleteMeal`
 * no longer reports success for a delete that matched no row.
 * (d) `addRecipeToMeal` carries the pending-deletion guard in its insert
 * statement (as #217), and the v1 POST answers that refusal with 403.
 * Real server actions and route handlers against PGlite with the production FKs.
 */

import type { PGlite } from '@electric-sql/pglite';
import { NextRequest } from 'next/server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const OWNER = 'user_owner';
const OTHER = 'user_other';
const ADMIN = 'user_admin';
const PENDING = 'user_pending';
const LEGACY = 'user_legacy_no_users_row';
const MEAL_IDS: Record<string, string> = {
  [OWNER]: '11111111-0000-4000-8000-000000000001',
  [PENDING]: '11111111-0000-4000-8000-000000000002',
  [LEGACY]: '11111111-0000-4000-8000-000000000003',
};
const RECIPE = 'aaaaaaaa-0000-4000-8000-00000000000a';

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

import { addRecipeToMeal, deleteMeal } from '@/app/actions/meals';
import { POST as mealRecipesPOST } from '@/app/api/v1/meals/[id]/recipes/route';
import { DELETE as mealDELETE, PATCH as mealPATCH } from '@/app/api/v1/meals/[id]/route';
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

/** Every row these paths could touch, in a stable order. */
async function snapshot() {
  return {
    meals: await rows('SELECT * FROM meals ORDER BY id'),
    mealRecipes: await rows('SELECT * FROM meal_recipes ORDER BY meal_id, recipe_id'),
  };
}

async function api(
  handler: (req: NextRequest, ctx: RouteContext) => Promise<Response>,
  method: string,
  path: string,
  id: string,
  body?: unknown
): Promise<{ status: number; body: unknown }> {
  const req = new NextRequest(`http://localhost${path}`, {
    method,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const res = await handler(req, { params: Promise.resolve({ id }) } as RouteContext);
  return { status: res.status, body: await res.json() };
}

const patchMeal = (id: string) =>
  api(mealPATCH, 'PATCH', `/api/v1/meals/${id}`, id, { name: 'Renamed' });
const deleteMealRoute = (id: string) => api(mealDELETE, 'DELETE', `/api/v1/meals/${id}`, id);
const addRecipeRoute = (id: string) =>
  api(mealRecipesPOST, 'POST', `/api/v1/meals/${id}/recipes`, id, { recipeId: RECIPE });

/** Sets `userId`'s deletion flag inside the meal_recipes insert's own call, after every read. */
function requestDeletionAtMealRecipeInsert(userId: string) {
  const original = client.query.bind(client);
  vi.spyOn(client, 'query').mockImplementation((async (text: string, ...rest: unknown[]) => {
    if (/INSERT INTO "meal_recipes"/i.test(String(text))) {
      await original('UPDATE users SET deletion_requested_at = now() WHERE id = $1', [userId]);
    }
    return (original as (...a: unknown[]) => unknown)(text, ...rest);
  }) as typeof client.query);
}

beforeAll(async () => {
  const built = await createVisibilityDb(
    [users, schema.recipes, schema.meals, schema.mealRecipes],
    schema,
    { constraints: true }
  );
  client = built.client;
  state.db = built.db;
  // The production meal_recipes FKs (meals-schema.ts).
  await client.exec(`
    ALTER TABLE "meal_recipes" ADD CONSTRAINT meal_recipes_meal_fk FOREIGN KEY ("meal_id")
      REFERENCES "meals" ("id") ON DELETE CASCADE;
    ALTER TABLE "meal_recipes" ADD CONSTRAINT meal_recipes_recipe_fk FOREIGN KEY ("recipe_id")
      REFERENCES "recipes" ("id") ON DELETE CASCADE;`);
});

afterAll(async () => {
  await client?.close();
});

beforeEach(async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  await client.exec(
    'DELETE FROM meal_recipes; DELETE FROM meals; DELETE FROM recipes; DELETE FROM users;'
  );
  // LEGACY has no users row (pre-Auth.js id, #197).
  await rows(
    `INSERT INTO users (id, name, email, deletion_requested_at) VALUES
      ($1, 'O', 'o@x.test', NULL), ($2, 'T', 't@x.test', NULL),
      ($3, 'A', 'a@x.test', NULL), ($4, 'P', 'p@x.test', now())`,
    [OWNER, OTHER, ADMIN, PENDING]
  );
  await client.exec(`INSERT INTO recipes (id, user_id, name, ingredients, instructions,
      is_public, moderation_status, prep_time, cook_time) VALUES
    ('${RECIPE}', '${OTHER}', 'Soup', '[]', '[]', true, 'approved', 10, 20)`);
  for (const [owner, id] of Object.entries(MEAL_IDS)) {
    // Public, so every caller gets past getMealById and reaches the ownership check.
    await rows(
      `INSERT INTO meals (id, user_id, name, is_public, total_prep_time, total_cook_time)
       VALUES ($1, $2, 'Dinner', true, 0, 0)`,
      [id, owner]
    );
  }
});

afterEach(() => {
  vi.restoreAllMocks();
  state.userId = null;
});

const NOT_FOUND = { status: 404, body: { success: false, error: 'Meal not found' } };
const NON_OWNERS = [
  ['another user', OTHER],
  ['an admin', ADMIN],
] as const;

describe('#225 (a) PATCH and DELETE /api/v1/meals/:id are owner-only', () => {
  it.each(NON_OWNERS)('PATCH: %s gets 404 and nothing is edited', async (_, user) => {
    const before = await snapshot();
    state.userId = user;

    expect(await patchMeal(MEAL_IDS[OWNER])).toEqual(NOT_FOUND);
    expect(await snapshot()).toEqual(before);
  });

  it.each(NON_OWNERS)('DELETE: %s gets 404 and nothing is deleted', async (_, user) => {
    const before = await snapshot();
    state.userId = user;

    expect(await deleteMealRoute(MEAL_IDS[OWNER])).toEqual(NOT_FOUND);
    expect(await snapshot()).toEqual(before);
  });

  it('the owner edits and deletes their meal', async () => {
    state.userId = OWNER;
    const id = MEAL_IDS[OWNER];

    expect(await patchMeal(id)).toMatchObject({ status: 200, body: { data: { name: 'Renamed' } } });
    expect(await deleteMealRoute(id)).toEqual({ status: 200, body: { success: true } });
    expect(await rows('SELECT id FROM meals WHERE id = $1', [id])).toEqual([]);
  });

  it('deleteMeal reports a delete that matched no row as not found', async () => {
    const before = await snapshot();
    state.userId = OTHER;

    expect(await deleteMeal(MEAL_IDS[OWNER])).toEqual({ success: false, error: 'Meal not found' });
    expect(await snapshot()).toEqual(before);
  });
});

describe('#225 (b) POST /api/v1/meals/:id/recipes is owner-only', () => {
  it.each(NON_OWNERS)('%s gets 404 and nothing is added', async (_, user) => {
    const before = await snapshot();
    state.userId = user;

    expect(await addRecipeRoute(MEAL_IDS[OWNER])).toEqual(NOT_FOUND);
    expect(await snapshot()).toEqual(before);
  });
});

const REFUSAL = pendingDeletionRefusal('add recipes to meals');

describe('#225 (d) adding a recipe to a meal refuses an account pending deletion', () => {
  it('addRecipeToMeal: refuses and writes nothing', async () => {
    state.userId = PENDING;
    const before = await snapshot();

    expect(await addRecipeToMeal({ meal_id: MEAL_IDS[PENDING], recipe_id: RECIPE })).toEqual(
      REFUSAL
    );
    expect(await snapshot()).toEqual(before);
  });

  it('POST /api/v1/meals/:id/recipes: 403 and writes nothing', async () => {
    state.userId = PENDING;
    const before = await snapshot();

    expect(await addRecipeRoute(MEAL_IDS[PENDING])).toEqual({
      status: 403,
      body: { success: false, error: pendingDeletionError('add recipes to meals') },
    });
    expect(await snapshot()).toEqual(before);
  });

  it.each([
    [
      'addRecipeToMeal',
      (id: string): Promise<unknown> => addRecipeToMeal({ meal_id: id, recipe_id: RECIPE }),
      REFUSAL,
    ],
    [
      'POST /api/v1/meals/:id/recipes',
      async (id: string): Promise<unknown> => (await addRecipeRoute(id)).status,
      403,
    ],
  ])(
    '%s: refuses when the deletion is requested after every read before the insert',
    async (_, run, refused) => {
      // A guard in a separate query before the insert passes here and the write lands.
      requestDeletionAtMealRecipeInsert(OWNER);
      state.userId = OWNER;
      const before = await snapshot();

      expect(await run(MEAL_IDS[OWNER])).toEqual(refused);
      expect(await snapshot()).toEqual(before);
    }
  );

  it.each([
    ['a users row with no pending deletion', OWNER],
    ['a legacy id with no users row', LEGACY],
  ])('%s: the action and the route add the recipe', async (_, user) => {
    state.userId = user;

    expect(await addRecipeToMeal({ meal_id: MEAL_IDS[user], recipe_id: RECIPE })).toMatchObject({
      success: true,
      data: { meal_id: MEAL_IDS[user], recipe_id: RECIPE },
    });
    await rows('DELETE FROM meal_recipes');
    expect(await addRecipeRoute(MEAL_IDS[user])).toMatchObject({
      status: 201,
      body: { success: true, data: { meal_id: MEAL_IDS[user], recipe_id: RECIPE } },
    });
    expect(await rows('SELECT meal_id, recipe_id FROM meal_recipes')).toEqual([
      { meal_id: MEAL_IDS[user], recipe_id: RECIPE },
    ]);
  });
});
