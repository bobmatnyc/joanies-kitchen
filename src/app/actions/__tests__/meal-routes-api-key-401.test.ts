// @vitest-environment node
/**
 * #253: a v1 meal route reached with only an API key (no session) answers 401,
 * never 500. The meal server actions read the session user and refuse without
 * one; the route maps that refusal to 401. Session callers are unchanged.
 *
 * `GET /api/v1/meals/:id` and `GET /api/v1/meals/:id/shopping-list` call no
 * action that needs a session (getMealById serves anonymous reads), so they
 * are checked only for never answering 500.
 * Real server actions and route handlers against PGlite.
 */

import type { PGlite } from '@electric-sql/pglite';
import { NextRequest } from 'next/server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const OWNER = 'user_owner';
const PUBLIC_MEAL = '33333333-0000-4000-8000-000000000001';
const PRIVATE_MEAL = '33333333-0000-4000-8000-000000000002';
const RECIPE = 'dddddddd-0000-4000-8000-00000000000d';
const MEAL_RECIPE = 'eeeeeeee-0000-4000-8000-00000000000e';

const state = vi.hoisted(() => ({
  db: undefined as unknown,
  sessionUserId: null as string | null,
  authType: 'session' as 'session' | 'api_key',
}));

vi.mock('@/lib/session-user', () => ({
  getSessionUserId: async () => state.sessionUserId,
  getSessionUser: async () => (state.sessionUserId ? { id: state.sessionUserId } : null),
}));
vi.mock('@/lib/db', () => ({
  get db() {
    return state.db;
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock('@/lib/auth-users', () => ({ getUserAdminFlag: async () => false }));
// The real actions; updateMeal is wrapped so one test can force a plain failure.
vi.mock('@/app/actions/meals', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/actions/meals')>();
  return { ...actual, updateMeal: vi.fn(actual.updateMeal) };
});
// The route authenticates OWNER either by session or by API key (no session).
vi.mock('@/lib/api-auth/middleware', () => ({
  authenticateRequest: async () => ({
    authenticated: true,
    userId: OWNER,
    authType: state.authType,
    scopes: ['*'],
    metadata: { isAdmin: false },
  }),
  authHasAllScopes: () => true,
  authHasAnyScope: () => true,
}));

import { updateMeal } from '@/app/actions/meals';
import {
  DELETE as mealRecipesDELETE,
  POST as mealRecipesPOST,
} from '@/app/api/v1/meals/[id]/recipes/route';
import {
  DELETE as mealDELETE,
  GET as mealGET,
  PATCH as mealPATCH,
} from '@/app/api/v1/meals/[id]/route';
import {
  GET as shoppingListGET,
  POST as shoppingListPOST,
} from '@/app/api/v1/meals/[id]/shopping-list/route';
import { GET as collectionGET, POST as collectionPOST } from '@/app/api/v1/meals/route';
import type { RouteContext } from '@/lib/api-auth/types';
import { users } from '@/lib/db/auth-schema';
import * as schema from '@/lib/db/schema';
import { createVisibilityDb } from './recipe-visibility-db';

type Handler = (req: NextRequest, ctx: RouteContext) => Promise<Response>;

let client: PGlite;

async function rows(query: string, params: unknown[] = []) {
  return (await client.query(query, params)).rows as Record<string, unknown>[];
}

/** Every row these routes could write, in a stable order. */
async function snapshot() {
  return {
    meals: await rows('SELECT * FROM meals ORDER BY id'),
    mealRecipes: await rows('SELECT * FROM meal_recipes ORDER BY id'),
    shoppingLists: await rows('SELECT * FROM shopping_lists ORDER BY id'),
  };
}

async function send(handler: Handler, method: string, path: string, id: string, body?: unknown) {
  const req = new NextRequest(`http://localhost${path}`, {
    method,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return handler(req, { params: Promise.resolve({ id }) } as RouteContext);
}

async function call(handler: Handler, method: string, path: string, id: string, body?: unknown) {
  const res = await send(handler, method, path, id, body);
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
  await rows(`INSERT INTO users (id, name, email) VALUES ($1, 'O', 'o@x.test')`, [OWNER]);
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
  }
  await rows(
    `INSERT INTO meal_recipes (id, meal_id, recipe_id, course_category, display_order)
     VALUES ($1, $2, $3, 'main', 0)`,
    [MEAL_RECIPE, PUBLIC_MEAL, RECIPE]
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  state.sessionUserId = null;
  state.authType = 'session';
});

function asApiKeyOnly() {
  state.authType = 'api_key';
  state.sessionUserId = null;
}

function asSession() {
  state.authType = 'session';
  state.sessionUserId = OWNER;
}

const SESSION_REQUIRED = {
  status: 401,
  body: {
    success: false,
    error: 'Authentication required',
    reason: 'missing_auth',
    note: 'This meal endpoint requires a signed-in session',
  },
};

// Each route reaches a session-reading action: the meal is OWNER's public one,
// which getMealById serves without a session, so the ownership check passes.
const ACTION_ROUTES: [string, () => Promise<{ status: number; body: unknown }>][] = [
  ['GET /api/v1/meals', () => call(collectionGET, 'GET', '/api/v1/meals', '')],
  [
    'POST /api/v1/meals',
    () => call(collectionPOST, 'POST', '/api/v1/meals', '', { name: 'New', description: 'Meal' }),
  ],
  [
    'PATCH /api/v1/meals/:id',
    () =>
      call(mealPATCH, 'PATCH', `/api/v1/meals/${PUBLIC_MEAL}`, PUBLIC_MEAL, { name: 'Renamed' }),
  ],
  [
    'DELETE /api/v1/meals/:id',
    () => call(mealDELETE, 'DELETE', `/api/v1/meals/${PUBLIC_MEAL}`, PUBLIC_MEAL),
  ],
  [
    'POST /api/v1/meals/:id/recipes',
    () =>
      call(mealRecipesPOST, 'POST', `/api/v1/meals/${PUBLIC_MEAL}/recipes`, PUBLIC_MEAL, {
        recipeId: RECIPE,
      }),
  ],
  [
    'DELETE /api/v1/meals/:id/recipes',
    () =>
      call(
        mealRecipesDELETE,
        'DELETE',
        `/api/v1/meals/${PUBLIC_MEAL}/recipes?mealRecipeId=${MEAL_RECIPE}`,
        PUBLIC_MEAL
      ),
  ],
  [
    'POST /api/v1/meals/:id/shopping-list',
    () => call(shoppingListPOST, 'POST', `/api/v1/meals/${PUBLIC_MEAL}/shopping-list`, PUBLIC_MEAL),
  ],
];

describe('#253 an API-key-only caller gets 401 from a meal action route', () => {
  it.each(ACTION_ROUTES)('%s: 401, nothing written', async (_, run) => {
    const before = await snapshot();
    asApiKeyOnly();

    const res = await run();

    expect(res).toEqual(SESSION_REQUIRED);
    expect(await snapshot()).toEqual(before);
  });

  it('the 401 carries a WWW-Authenticate header', async () => {
    asApiKeyOnly();

    const res = await send(collectionGET, 'GET', '/api/v1/meals', '');

    expect(res.status).toBe(401);
    expect(res.headers.get('WWW-Authenticate')).toBe('Session realm="Meals"');
  });

  it('a plain Unauthorized failure without the errorCode stays 500', async () => {
    // Guards against matching on the error string or on authType.
    asApiKeyOnly();
    vi.mocked(updateMeal).mockResolvedValueOnce({ success: false, error: 'Unauthorized' });

    const res = await call(mealPATCH, 'PATCH', `/api/v1/meals/${PUBLIC_MEAL}`, PUBLIC_MEAL, {
      name: 'Renamed',
    });

    expect(res).toEqual({ status: 500, body: { success: false, error: 'Failed to update meal' } });
  });
});

describe('#253 the read routes with no session-reading action never answer 500', () => {
  it.each([
    ['GET /api/v1/meals/:id', mealGET, '', 200],
    ['GET /api/v1/meals/:id/shopping-list', shoppingListGET, '/shopping-list', 200],
  ] as const)('%s: public meal is served, private meal is 404', async (_, handler, suffix, ok) => {
    asApiKeyOnly();

    const pub = await call(handler, 'GET', `/api/v1/meals/${PUBLIC_MEAL}${suffix}`, PUBLIC_MEAL);
    const priv = await call(handler, 'GET', `/api/v1/meals/${PRIVATE_MEAL}${suffix}`, PRIVATE_MEAL);

    expect(pub.status).toBe(ok);
    expect(priv).toEqual({ status: 404, body: { success: false, error: 'Meal not found' } });
  });
});

describe('#253 session callers are unchanged', () => {
  it('GET /api/v1/meals lists the caller meals', async () => {
    asSession();

    const res = await call(collectionGET, 'GET', '/api/v1/meals', '');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, data: { pagination: { total: 2 } } });
  });

  it('PATCH /api/v1/meals/:id renames the meal', async () => {
    asSession();

    const res = await call(mealPATCH, 'PATCH', `/api/v1/meals/${PRIVATE_MEAL}`, PRIVATE_MEAL, {
      name: 'Renamed',
    });

    expect(res).toMatchObject({ status: 200, body: { success: true, data: { name: 'Renamed' } } });
  });

  it('DELETE /api/v1/meals/:id/recipes removes the meal recipe', async () => {
    asSession();

    const res = await call(
      mealRecipesDELETE,
      'DELETE',
      `/api/v1/meals/${PUBLIC_MEAL}/recipes?mealRecipeId=${MEAL_RECIPE}`,
      PUBLIC_MEAL
    );

    expect(res).toEqual({ status: 200, body: { success: true } });
    expect(await rows('SELECT id FROM meal_recipes')).toEqual([]);
  });

  it('POST /api/v1/meals/:id/shopping-list writes a list to the caller', async () => {
    asSession();

    const res = await call(
      shoppingListPOST,
      'POST',
      `/api/v1/meals/${PUBLIC_MEAL}/shopping-list`,
      PUBLIC_MEAL
    );

    expect(res).toMatchObject({
      status: 201,
      body: { success: true, data: { user_id: OWNER, meal_id: PUBLIC_MEAL } },
    });
  });
});
