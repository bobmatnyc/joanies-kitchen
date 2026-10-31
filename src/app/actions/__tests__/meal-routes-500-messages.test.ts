// @vitest-environment node
/**
 * #241: a v1 meal route that answers 500 returns a fixed message, never the raw
 * action error (which can carry a database constraint name). The detail is
 * logged on the server. The 403 and 404 mappings from #217/#225 are unchanged.
 * Real route handlers with the server actions mocked to fail.
 */

import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const OWNER = 'user_owner';
const MEAL_ID = '11111111-0000-4000-8000-000000000001';
const MEAL_RECIPE_ID = '22222222-0000-4000-8000-000000000002';
const RECIPE_ID = 'aaaaaaaa-0000-4000-8000-00000000000a';
const DB_DETAIL =
  'insert or update on table "meal_recipes" violates foreign key constraint "meal_recipes_meal_id_fkey"';

const actions = vi.hoisted(() => ({
  getMealById: vi.fn(),
  updateMeal: vi.fn(),
  deleteMeal: vi.fn(),
  addRecipeToMeal: vi.fn(),
  removeRecipeFromMeal: vi.fn(),
  getUserMeals: vi.fn(),
  createMeal: vi.fn(),
  generateShoppingList: vi.fn(),
}));

vi.mock('@/app/actions/meals', () => actions);
vi.mock('@/lib/db', () => ({ db: {} }));
vi.mock('@/lib/api-auth/middleware', () => ({
  authenticateRequest: async () => ({
    authenticated: true,
    userId: OWNER,
    authType: 'session',
    scopes: ['*'],
    metadata: { isAdmin: false },
  }),
  authHasAllScopes: () => true,
  authHasAnyScope: () => true,
}));

import {
  DELETE as mealRecipesDELETE,
  POST as mealRecipesPOST,
} from '@/app/api/v1/meals/[id]/recipes/route';
import {
  DELETE as mealDELETE,
  GET as mealGET,
  PATCH as mealPATCH,
} from '@/app/api/v1/meals/[id]/route';
import { POST as shoppingListPOST } from '@/app/api/v1/meals/[id]/shopping-list/route';
import { GET as collectionGET, POST as collectionPOST } from '@/app/api/v1/meals/route';
import { pendingDeletionRefusal } from '@/lib/account-deletion/guarded-insert';
import type { RouteContext } from '@/lib/api-auth/types';

type Handler = (req: NextRequest, ctx: RouteContext) => Promise<Response>;

async function call(handler: Handler, method: string, path: string, body?: unknown) {
  const req = new NextRequest(`http://localhost${path}`, {
    method,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const res = await handler(req, { params: Promise.resolve({ id: MEAL_ID }) } as RouteContext);
  return { status: res.status, body: await res.json() };
}

const failure = (error: string) => ({ success: false, error });

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  actions.getMealById.mockResolvedValue({
    success: true,
    data: { id: MEAL_ID, user_id: OWNER, is_public: true },
  });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

const MEAL_BODY = { name: 'Dinner', description: 'Weeknight dinner' };
const ROUTES: [string, () => Promise<{ status: number; body: unknown }>, string, () => void][] = [
  [
    'GET /api/v1/meals',
    () => call(collectionGET as Handler, 'GET', '/api/v1/meals'),
    'Failed to fetch meals',
    () => actions.getUserMeals.mockResolvedValue(failure(DB_DETAIL)),
  ],
  [
    'POST /api/v1/meals',
    () => call(collectionPOST as Handler, 'POST', '/api/v1/meals', MEAL_BODY),
    'Failed to create meal',
    () => actions.createMeal.mockResolvedValue(failure(DB_DETAIL)),
  ],
  [
    'GET /api/v1/meals/:id',
    () => call(mealGET as Handler, 'GET', `/api/v1/meals/${MEAL_ID}`),
    'Failed to fetch meal',
    () => actions.getMealById.mockResolvedValue(failure(DB_DETAIL)),
  ],
  [
    'PATCH /api/v1/meals/:id',
    () => call(mealPATCH as Handler, 'PATCH', `/api/v1/meals/${MEAL_ID}`, { name: 'Renamed' }),
    'Failed to update meal',
    () => actions.updateMeal.mockResolvedValue(failure(DB_DETAIL)),
  ],
  [
    'DELETE /api/v1/meals/:id',
    () => call(mealDELETE as Handler, 'DELETE', `/api/v1/meals/${MEAL_ID}`),
    'Failed to delete meal',
    () => actions.deleteMeal.mockResolvedValue(failure(DB_DETAIL)),
  ],
  [
    'POST /api/v1/meals/:id/recipes',
    () =>
      call(mealRecipesPOST as Handler, 'POST', `/api/v1/meals/${MEAL_ID}/recipes`, {
        recipeId: RECIPE_ID,
      }),
    'Failed to add recipe to meal',
    () => actions.addRecipeToMeal.mockResolvedValue(failure(DB_DETAIL)),
  ],
  [
    'DELETE /api/v1/meals/:id/recipes',
    () =>
      call(
        mealRecipesDELETE as Handler,
        'DELETE',
        `/api/v1/meals/${MEAL_ID}/recipes?mealRecipeId=${MEAL_RECIPE_ID}`
      ),
    'Failed to remove recipe from meal',
    () => actions.removeRecipeFromMeal.mockResolvedValue(failure(DB_DETAIL)),
  ],
  [
    'POST /api/v1/meals/:id/shopping-list',
    () => call(shoppingListPOST as Handler, 'POST', `/api/v1/meals/${MEAL_ID}/shopping-list`),
    'Failed to generate shopping list',
    () => actions.generateShoppingList.mockResolvedValue(failure(DB_DETAIL)),
  ],
];

describe('#241 v1 meal 500 responses carry a fixed message', () => {
  it.each(ROUTES)(
    '%s: 500 body is generic and the detail is logged',
    async (_, run, generic, arm) => {
      arm();

      const res = await run();

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ success: false, error: generic });
      expect(JSON.stringify(res.body)).not.toContain('meal_recipes_meal_id_fkey');
      expect(JSON.stringify(consoleError.mock.calls)).toContain('meal_recipes_meal_id_fkey');
    }
  );
});

describe('#241 the 403 and 404 mappings are unchanged', () => {
  it('PATCH: a pending-deletion refusal stays 403 with its own message', async () => {
    const refusal = pendingDeletionRefusal('edit meals');
    actions.updateMeal.mockResolvedValue(refusal);

    expect(await call(mealPATCH as Handler, 'PATCH', '/x', { name: 'Renamed' })).toEqual({
      status: 403,
      body: { success: false, error: refusal.error },
    });
  });

  it('PATCH: Meal not found stays 404', async () => {
    actions.updateMeal.mockResolvedValue(failure('Meal not found'));

    expect(await call(mealPATCH as Handler, 'PATCH', '/x', { name: 'Renamed' })).toEqual({
      status: 404,
      body: { success: false, error: 'Meal not found' },
    });
  });

  it('DELETE: Meal not found stays 404', async () => {
    actions.deleteMeal.mockResolvedValue(failure('Meal not found'));

    expect(await call(mealDELETE as Handler, 'DELETE', '/x')).toEqual({
      status: 404,
      body: { success: false, error: 'Meal not found' },
    });
  });

  it('recipes POST: a pending-deletion refusal stays 403 and a missing recipe stays 404', async () => {
    const refusal = pendingDeletionRefusal('add recipes to meals');
    actions.addRecipeToMeal.mockResolvedValueOnce(refusal);
    const body = { recipeId: RECIPE_ID };

    expect(await call(mealRecipesPOST as Handler, 'POST', '/x', body)).toEqual({
      status: 403,
      body: { success: false, error: refusal.error },
    });

    actions.addRecipeToMeal.mockResolvedValueOnce(failure('Recipe not found'));
    expect(await call(mealRecipesPOST as Handler, 'POST', '/x', body)).toEqual({
      status: 404,
      body: { success: false, error: 'Recipe not found' },
    });
  });
});
