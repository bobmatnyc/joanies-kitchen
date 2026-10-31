// @vitest-environment node
/**
 * #222: only the meal's owner may remove or edit its recipes.
 *
 * `removeRecipeFromMeal` and `updateMealRecipe` take a `meal_recipes` id, and
 * every viewer of a public meal receives those ids. Runs against real Postgres
 * (PGlite) with the production FKs between meals, meal_recipes and recipes.
 * A non-owner gets exactly the answer a missing id gets, and nothing changes.
 */

import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const OWNER = 'user_owner';
const OTHER = 'user_other';
const MEAL = '22222222-0000-4000-8000-000000000002';
const R1 = 'aaaaaaaa-0000-4000-8000-00000000000a';
const R2 = 'bbbbbbbb-0000-4000-8000-00000000000b';
const MR1 = 'cccccccc-0000-4000-8000-00000000000c';
const MR2 = 'dddddddd-0000-4000-8000-00000000000d';
const MISSING = 'eeeeeeee-0000-4000-8000-00000000000e';

const state = vi.hoisted(() => ({
  db: undefined as unknown,
  userId: null as string | null,
}));

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

import { revalidatePath } from 'next/cache';
import { removeRecipeFromMeal, updateMealRecipe } from '@/app/actions/meals';
import * as schema from '@/lib/db/schema';
import { createVisibilityDb } from './recipe-visibility-db';

let client: PGlite;
const T0 = new Date('2026-01-01T00:00:00Z');

function recipeRow(id: string, prep: number, cook: number) {
  return {
    id,
    user_id: OWNER,
    name: `Recipe ${id.slice(0, 4)}`,
    ingredients: '["1 cup water"]',
    instructions: '[]',
    prep_time: prep,
    cook_time: cook,
    is_public: true,
    created_at: T0,
    updated_at: T0,
  };
}

async function seed() {
  const db = state.db as any;
  await client.exec('DELETE FROM "meal_recipes"; DELETE FROM "meals"; DELETE FROM "recipes";');
  await db.insert(schema.recipes).values([recipeRow(R1, 10, 20), recipeRow(R2, 5, 7)]);
  // A public meal: every viewer receives MR1 / MR2 in getMealById results.
  await db.insert(schema.meals).values({
    id: MEAL,
    user_id: OWNER,
    name: 'Owner meal',
    slug: 'owner-meal',
    meal_type: 'dinner',
    is_public: true,
    total_prep_time: 15,
    total_cook_time: 27,
    created_at: T0,
    updated_at: T0,
  });
  await db.insert(schema.mealRecipes).values([
    { id: MR1, meal_id: MEAL, recipe_id: R1, display_order: 0, serving_multiplier: '1.00' },
    { id: MR2, meal_id: MEAL, recipe_id: R2, display_order: 1, serving_multiplier: '1.00' },
  ]);
}

/** Every row the two actions could touch, in a stable order. */
async function snapshot() {
  const mealRecipes = await client.query('SELECT * FROM "meal_recipes" ORDER BY id;');
  const meals = await client.query('SELECT * FROM "meals" ORDER BY id;');
  return { mealRecipes: mealRecipes.rows, meals: meals.rows };
}

beforeAll(async () => {
  const built = await createVisibilityDb(
    [schema.recipes, schema.meals, schema.mealRecipes],
    schema,
    { constraints: true }
  );
  client = built.client;
  state.db = built.db;
  // Production FKs (meals-schema.ts): meal_recipes -> meals / recipes, cascading.
  await client.exec(`
    ALTER TABLE "meal_recipes" ADD CONSTRAINT "meal_recipes_meal_id_fk"
      FOREIGN KEY ("meal_id") REFERENCES "meals"("id") ON DELETE CASCADE;
    ALTER TABLE "meal_recipes" ADD CONSTRAINT "meal_recipes_recipe_id_fk"
      FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE;
  `);
});

afterAll(async () => {
  await client?.close();
});

beforeEach(async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.mocked(revalidatePath).mockClear();
  state.userId = null;
  await seed();
});

describe('#222 removeRecipeFromMeal', () => {
  it('refuses a non-owner with the missing-row answer and changes nothing', async () => {
    const before = await snapshot();
    state.userId = OTHER;

    const result = await removeRecipeFromMeal(MR1);

    expect(result).toEqual({ success: false, error: 'Recipe not found in meal' });
    expect(await snapshot()).toEqual(before);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('answers a non-owner exactly as it answers an unknown id', async () => {
    state.userId = OTHER;
    const foreign = await removeRecipeFromMeal(MR1);
    const unknown = await removeRecipeFromMeal(MISSING);
    expect(foreign).toEqual(unknown);
  });

  it('refuses an unauthenticated caller', async () => {
    const before = await snapshot();
    expect(await removeRecipeFromMeal(MR1)).toEqual({ success: false, error: 'Unauthorized' });
    expect(await snapshot()).toEqual(before);
  });

  it('lets the owner remove a recipe, recomputing meal times and revalidating', async () => {
    state.userId = OWNER;

    const result = await removeRecipeFromMeal(MR1);

    expect(result).toEqual({ success: true });
    const after = await snapshot();
    expect(after.mealRecipes.map((r: any) => r.id)).toEqual([MR2]);
    expect(after.meals[0]).toMatchObject({ total_prep_time: 5, total_cook_time: 7 });
    expect(revalidatePath).toHaveBeenCalledWith('/meals');
    expect(revalidatePath).toHaveBeenCalledWith(`/meals/${MEAL}`);
  });
});

describe('#222 updateMealRecipe', () => {
  it('refuses a non-owner with the missing-row answer and changes nothing', async () => {
    const before = await snapshot();
    state.userId = OTHER;

    const result = await updateMealRecipe(MR1, { serving_multiplier: '3.00' });

    expect(result).toEqual({ success: false, error: 'Meal recipe not found' });
    expect(await snapshot()).toEqual(before);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('answers a non-owner exactly as it answers an unknown id', async () => {
    state.userId = OTHER;
    const foreign = await updateMealRecipe(MR1, { display_order: 9 });
    const unknown = await updateMealRecipe(MISSING, { display_order: 9 });
    expect(foreign).toEqual(unknown);
  });

  it('refuses an unauthenticated caller', async () => {
    const before = await snapshot();
    expect(await updateMealRecipe(MR1, { display_order: 9 })).toEqual({
      success: false,
      error: 'Unauthorized',
    });
    expect(await snapshot()).toEqual(before);
  });

  it('lets the owner update a recipe and returns the updated row', async () => {
    state.userId = OWNER;

    const result = await updateMealRecipe(MR1, { serving_multiplier: '3.00', display_order: 4 });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      id: MR1,
      meal_id: MEAL,
      serving_multiplier: '3.00',
      display_order: 4,
    });
    expect(revalidatePath).toHaveBeenCalledWith('/meals');
    expect(revalidatePath).toHaveBeenCalledWith(`/meals/${MEAL}`);
  });
});

describe('#222 the ownership check is inside the write statement', () => {
  /** Runs `act` and returns every SQL string sent to Postgres, in order. */
  async function capture(act: () => Promise<unknown>) {
    const spy = vi.spyOn(client, 'query');
    try {
      await act();
      return spy.mock.calls.map((call) => String(call[0]));
    } finally {
      spy.mockRestore();
    }
  }

  const OWNERSHIP = /"meal_id" in \(select "id" from "meals" where "meals"\."user_id" = \$\d+\)/i;

  it.each([
    ['removeRecipeFromMeal', /^delete from "meal_recipes"/i, () => removeRecipeFromMeal(MR1)],
    [
      'updateMealRecipe',
      /^update "meal_recipes"/i,
      () => updateMealRecipe(MR1, { display_order: 2 }),
    ],
  ])('%s', async (_name, write, act) => {
    state.userId = OWNER;
    const statements = await capture(act);

    const writes = statements.filter((s) => write.test(s.trim()));
    expect(writes, statements.join('\n')).toHaveLength(1);
    expect(writes[0]).toMatch(OWNERSHIP);
    // No separate read of meal_recipes precedes the write (a non-atomic pre-check).
    const firstWrite = statements.indexOf(writes[0]);
    const reads = statements
      .slice(0, firstWrite)
      .filter((s) => /^select/i.test(s.trim()) && s.includes('"meal_recipes"'));
    expect(reads, statements.join('\n')).toEqual([]);
  });
});
