// @vitest-environment node
/**
 * #218: every `meal_recipes` insert locks its recipe rows before it touches
 * the meal. The insert's FK checks take FOR KEY SHARE on the meal, then on the
 * recipe; the account purge locks recipes FOR UPDATE first and deletes the
 * meal later, so the two could deadlock (40P01). Now one `db.batch` per insert:
 * `lockRecipesForMealInsert` (id order, FOR KEY SHARE), then the insert.
 * Real server actions against PGlite tables carrying the production
 * `meal_recipes` FKs and unique key.
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
import { saveMealPlanFromPairing } from '@/app/actions/meal-pairing';
import { addRecipeToMeal } from '@/app/actions/meals';
import type { MealPlan } from '@/lib/ai/meal-pairing-engine';
import { users } from '@/lib/db/auth-schema';
import * as schema from '@/lib/db/schema';

const OWNER = 'user_owner';
const OTHER = 'user_other';
const MEAL = '11111111-0000-4000-8000-000000000001';
const OTHER_MEAL = '11111111-0000-4000-8000-000000000002';
// Ids out of course order, so id order differs from insert order.
const R_A = 'aaaaaaaa-0000-4000-8000-00000000000a';
const R_B = 'bbbbbbbb-0000-4000-8000-00000000000b';
const R_C = 'cccccccc-0000-4000-8000-00000000000c';
const MISSING = 'ffffffff-0000-4000-8000-00000000000f';

let client: PGlite;

async function rows(query: string, params: unknown[] = []) {
  return (await client.query(query, params)).rows as Record<string, unknown>[];
}

const mealRecipeRows = () =>
  rows(
    `SELECT meal_id, recipe_id, course_category, display_order, serving_multiplier
     FROM meal_recipes ORDER BY meal_id, display_order, recipe_id`
  );

const mealTimes = async (id: string) =>
  (await rows('SELECT total_prep_time, total_cook_time FROM meals WHERE id = $1', [id]))[0];

type Query = { sql: string; params: unknown[] };
// #225: addRecipeToMeal's insert is a raw guarded statement (`db.execute`), read via getQuery().
type Item = { toSQL?: () => Query; getQuery?: () => Query };
const queryOf = (q: Item) => (q.toSQL ? q.toSQL() : (q.getQuery as () => Query)());
const sqlOf = (q: Item) => queryOf(q).sql.replace(/\s+/g, ' ').trim();
const LOCK = (n: number) =>
  new RegExp(
    `^select "id" from "recipes" where "recipes"\\."id" in \\(${Array.from(
      { length: n },
      (_, i) => `\\$${i + 1}`
    ).join(', ')}\\) order by "recipes"\\."id" asc for key share$`
  );
const INSERT = /^insert into "meal_recipes" /;
// #225: the pending-deletion guard rides in the insert statement.
const GUARDED_INSERT =
  /^WITH allowed AS \( SELECT 1 AS ok WHERE NOT EXISTS .* INSERT INTO "meal_recipes" /;

function spyBatch() {
  return vi.spyOn(state.db as { batch: (q: unknown[]) => Promise<unknown> }, 'batch');
}

function plan(ids: { appetizer?: string; main?: string; side?: string; dessert?: string }) {
  const course = (name: string, recipe_id?: string) => ({ name, recipe_id });
  return {
    appetizer: course('a', ids.appetizer),
    main: course('m', ids.main),
    side: course('s', ids.side),
    dessert: course('d', ids.dessert),
    meal_analysis: { total_prep_time: 1, color_palette: [], cultural_coherence: 'x' },
  } as unknown as MealPlan;
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
  await rows(
    `INSERT INTO users (id, name, email) VALUES ($1, 'O', 'o@x.test'), ($2, 'T', 't@x.test')`,
    [OWNER, OTHER]
  );
  await client.exec(`INSERT INTO recipes (id, user_id, name, ingredients, instructions,
      is_public, moderation_status, prep_time, cook_time) VALUES
    ('${R_A}', '${OTHER}', 'A', '[]', '[]', true, 'approved', 10, 20),
    ('${R_B}', '${OTHER}', 'B', '[]', '[]', true, 'approved', 5, 7),
    ('${R_C}', '${OTHER}', 'C', '[]', '[]', true, 'approved', 1, 2)`);
  await rows(
    `INSERT INTO meals (id, user_id, name, total_prep_time, total_cook_time)
     VALUES ($1, $2, 'Dinner', 0, 0), ($3, $4, 'Theirs', 0, 0)`,
    [MEAL, OWNER, OTHER_MEAL, OTHER]
  );
  state.userId = OWNER;
});

afterEach(() => {
  vi.restoreAllMocks();
  state.userId = null;
});

describe('#218 addRecipeToMeal statement order', () => {
  it('one batch: the recipe lock first, bound to the recipe id, then the insert', async () => {
    const batch = spyBatch();

    expect(await addRecipeToMeal({ meal_id: MEAL, recipe_id: R_B })).toMatchObject({
      success: true,
    });

    expect(batch).toHaveBeenCalledTimes(1);
    const items = batch.mock.calls[0][0] as Item[];
    expect(items.map(sqlOf)).toHaveLength(2);
    expect(sqlOf(items[0])).toMatch(LOCK(1));
    expect(sqlOf(items[1])).toMatch(GUARDED_INSERT);
    // A lock on any other id matches no row and changes no result, so only the
    // bound parameter shows the batch locks this recipe.
    expect(queryOf(items[0]).params).toEqual([R_B]);
  });
});

describe('#218 addRecipeToMeal behaviour is unchanged', () => {
  it('the owner adds a recipe: row present, data returned, meal totals updated', async () => {
    const result = await addRecipeToMeal({
      meal_id: MEAL,
      recipe_id: R_A,
      course_category: 'side',
      display_order: 3,
      serving_multiplier: '1.50',
    });

    expect(result).toMatchObject({
      success: true,
      data: {
        meal_id: MEAL,
        recipe_id: R_A,
        course_category: 'side',
        display_order: 3,
        serving_multiplier: '1.50',
      },
    });
    expect(await mealRecipeRows()).toEqual([
      {
        meal_id: MEAL,
        recipe_id: R_A,
        course_category: 'side',
        display_order: 3,
        serving_multiplier: '1.50',
      },
    ]);
    expect(await mealTimes(MEAL)).toEqual({ total_prep_time: 10, total_cook_time: 20 });
  });

  // The message is the driver's: neon-http's batch passes the database error
  // through unwrapped, the PGlite shim wraps it, so only the outcome is pinned.
  it('a duplicate fails and adds nothing', async () => {
    await addRecipeToMeal({ meal_id: MEAL, recipe_id: R_A });
    const before = await mealRecipeRows();

    const result = await addRecipeToMeal({ meal_id: MEAL, recipe_id: R_A });

    expect(result.success).toBe(false);
    expect(await mealRecipeRows()).toEqual(before);
  });

  it('a missing recipe answers "Recipe not found" and writes nothing', async () => {
    const batch = spyBatch();

    expect(await addRecipeToMeal({ meal_id: MEAL, recipe_id: MISSING })).toEqual({
      success: false,
      error: 'Recipe not found',
    });

    expect(batch).not.toHaveBeenCalled();
    expect(await mealRecipeRows()).toEqual([]);
  });

  it('another user\'s meal answers "Meal not found" and writes nothing', async () => {
    expect(await addRecipeToMeal({ meal_id: OTHER_MEAL, recipe_id: R_A })).toEqual({
      success: false,
      error: 'Meal not found',
    });

    expect(await mealRecipeRows()).toEqual([]);
  });
});

describe('#218 saveMealPlanFromPairing statement order', () => {
  it('one batch: every recipe locked in id order, bound to the plan ids, then the insert', async () => {
    const batch = spyBatch();

    const result = await saveMealPlanFromPairing(
      plan({ appetizer: R_C, main: R_A, dessert: R_B }),
      'Plan'
    );

    expect(result).toMatchObject({ success: true });
    expect(batch).toHaveBeenCalledTimes(1);
    const items = batch.mock.calls[0][0] as Item[];
    expect(items.map(sqlOf)).toHaveLength(2);
    expect(sqlOf(items[0])).toMatch(LOCK(3));
    expect(sqlOf(items[1])).toMatch(INSERT);
    expect(queryOf(items[0]).params).toEqual([R_C, R_A, R_B]);
  });
});

describe('#218 saveMealPlanFromPairing behaviour is unchanged', () => {
  it('saves the meal and one meal_recipes row per linked course', async () => {
    const result = await saveMealPlanFromPairing(plan({ appetizer: R_C, main: R_A }), 'Plan');

    expect(result).toMatchObject({ success: true, message: 'Meal plan "Plan" saved successfully' });
    const mealId = (result as { data: string }).data;
    expect(await mealRecipeRows()).toEqual([
      {
        meal_id: mealId,
        recipe_id: R_C,
        course_category: 'appetizer',
        display_order: 1,
        serving_multiplier: '1.00',
      },
      {
        meal_id: mealId,
        recipe_id: R_A,
        course_category: 'main',
        display_order: 2,
        serving_multiplier: '1.00',
      },
    ]);
  });

  it('a recipe linked twice fails; the meal stays, with no rows', async () => {
    const result = await saveMealPlanFromPairing(plan({ main: R_A, side: R_A }), 'Plan');

    expect(result.success).toBe(false);
    expect(await rows('SELECT name FROM meals WHERE user_id = $1', [OWNER])).toEqual([
      { name: 'Dinner' },
      { name: 'Plan' },
    ]);
    expect(await mealRecipeRows()).toEqual([]);
  });

  it('a missing recipe answers "Recipe not found" and writes nothing', async () => {
    expect(await saveMealPlanFromPairing(plan({ main: MISSING }), 'Plan')).toEqual({
      success: false,
      error: 'Recipe not found',
    });

    expect(await rows('SELECT name FROM meals WHERE user_id = $1', [OWNER])).toEqual([
      { name: 'Dinner' },
    ]);
    expect(await mealRecipeRows()).toEqual([]);
  });
});
