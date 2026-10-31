// @vitest-environment node
/**
 * #223: /meals/[slug] shows only the signed-in viewer's own shopping list for
 * the meal. Any signed-in viewer of a public meal can generate a list for it,
 * so one meal carries lists from several users; the newest by meal_id alone
 * was someone else's. Renders the real page component against PGlite.
 */

import type { PGlite } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

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

import { createVisibilityDb } from '@/app/actions/__tests__/recipe-visibility-db';
import MealDetailPage from '@/app/meals/[slug]/page';
import { users } from '@/lib/db/auth-schema';
import * as schema from '@/lib/db/schema';
import { getViewerShoppingListForMeal } from '@/lib/meals/viewer-shopping-list';

const OWNER = 'user_owner';
const A = 'user_a';
const B = 'user_b';
const NO_LIST = 'user_no_list';
const MEAL = '11111111-0000-4000-8000-000000000001';
const SLUG = 'shared-feast';
// Oldest to newest: B's list is the newest row for the meal.
const LISTS: Array<[string, string, string]> = [
  [OWNER, '33333333-0000-4000-8000-000000000001', '2026-10-01T00:00:00Z'],
  [A, '33333333-0000-4000-8000-000000000002', '2026-10-02T00:00:00Z'],
  [B, '33333333-0000-4000-8000-000000000003', '2026-10-03T00:00:00Z'],
];
const listIdOf = (user: string) => LISTS.find(([u]) => u === user)?.[1];

let client: PGlite;

/** The `initialShoppingList` prop the page hands to MealDetailContent. */
async function pageListFor(viewer: string | null) {
  state.userId = viewer;
  const page = await MealDetailPage({ params: Promise.resolve({ slug: SLUG }) });
  const children = [page.props.children].flat();
  const content = children.find((c: any) => c?.props && 'initialShoppingList' in c.props);
  expect(content, 'page renders MealDetailContent').toBeDefined();
  return content.props.initialShoppingList as { id: string; user_id: string } | null;
}

beforeAll(async () => {
  const built = await createVisibilityDb(
    [users, schema.recipes, schema.meals, schema.mealRecipes, schema.shoppingLists],
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
  await client.exec(`DELETE FROM shopping_lists; DELETE FROM meal_recipes; DELETE FROM meals;
    DELETE FROM recipes; DELETE FROM users;`);
  for (const u of [OWNER, A, B, NO_LIST]) {
    await client.query('INSERT INTO users (id, name, email) VALUES ($1, $1, $2)', [
      u,
      `${u}@example.test`,
    ]);
  }
  await client.query(
    `INSERT INTO meals (id, user_id, name, description, is_public, slug)
      VALUES ($1, $2, 'Shared feast', 'Public', true, $3)`,
    [MEAL, OWNER, SLUG]
  );
  for (const [user, id, createdAt] of LISTS) {
    await client.query(
      `INSERT INTO shopping_lists (id, user_id, meal_id, name, notes, items, status, created_at)
        VALUES ($1, $2, $3, $4, 'private note', '[]', 'draft', $5)`,
      [id, user, MEAL, `${user} list`, createdAt]
    );
  }
});

afterEach(() => {
  state.userId = null;
});

describe('#223 /meals/[slug] shopping list', () => {
  it.each([
    ['viewer A', A],
    ['viewer B', B],
    ['the meal owner', OWNER],
  ])('%s sees only their own list', async (_label, viewer) => {
    const list = await pageListFor(viewer);
    expect(list?.user_id).toBe(viewer);
    expect(list?.id).toBe(listIdOf(viewer));
  });

  it('a viewer with no list sees none, though the newest list is B’s', async () => {
    expect(await pageListFor(NO_LIST)).toBeNull();
  });

  it('a signed-out visitor sees none', async () => {
    expect(await pageListFor(null)).toBeNull();
  });
});

describe('#223 getViewerShoppingListForMeal', () => {
  it('returns the viewer’s newest list for the meal', async () => {
    await client.query(
      `INSERT INTO shopping_lists (id, user_id, meal_id, name, items, status, created_at)
        VALUES ('33333333-0000-4000-8000-000000000009', $1, $2, 'A again', '[]', 'draft',
        '2026-10-04T00:00:00Z')`,
      [A, MEAL]
    );
    expect((await getViewerShoppingListForMeal(MEAL, A))?.id).toBe(
      '33333333-0000-4000-8000-000000000009'
    );
  });

  it('returns null for no viewer without querying', async () => {
    const query = vi.spyOn(client, 'query');
    expect(await getViewerShoppingListForMeal(MEAL, null)).toBeNull();
    expect(query).not.toHaveBeenCalled();
    query.mockRestore();
  });
});
