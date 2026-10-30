// @vitest-environment node
/**
 * #143: `markItemAsUsed` answers a `recipe_id` the caller may not view exactly
 * as it answers a nonexistent one, and writes nothing for it.
 *
 * Before, the handler only checked the recipe existed, so success vs "Recipe
 * not found" revealed a private recipe, and the usage log could point at it.
 * Rule: `findViewableRecipe` (#32, `src/lib/recipe-visibility.ts`). Runs against
 * real Postgres (PGlite).
 */

import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const OWNER = 'user_owner';
const OTHER = 'user_other';
const ITEM_ID = '11111111-0000-4000-8000-000000000001';
const INGREDIENT_ID = '22222222-0000-4000-8000-000000000002';
const ITEM_ID_2 = '11111111-0000-4000-8000-000000000003';
const INGREDIENT_ID_2 = '22222222-0000-4000-8000-000000000004';
const PUBLIC_ID = 'aaaaaaaa-0000-4000-8000-00000000000a';
const PRIVATE_ID = 'bbbbbbbb-0000-4000-8000-00000000000b';
const REJECTED_ID = 'cccccccc-0000-4000-8000-00000000000c';
const DELETED_ID = 'dddddddd-0000-4000-8000-00000000000d';
const MISSING_ID = 'eeeeeeee-0000-4000-8000-00000000000e';

const state = vi.hoisted(() => ({
  db: undefined as unknown,
  userId: null as string | null,
}));

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

import { markItemAsUsed, markRecipeIngredientsAsUsed } from '@/app/actions/inventory';
import { inventoryItems, inventoryUsageLog } from '@/lib/db/inventory-schema';
import * as schema from '@/lib/db/schema';
import { userProfiles } from '@/lib/db/user-discovery-schema';
import { createVisibilityDb } from './recipe-visibility-db';

let client: PGlite;
let db: Awaited<ReturnType<typeof createVisibilityDb>>['db'];

const HIDDEN: { kind: string; id: string }[] = [
  { kind: 'private', id: PRIVATE_ID },
  { kind: 'rejected', id: REJECTED_ID },
  { kind: 'soft-deleted', id: DELETED_ID },
];

function recipeRow(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    user_id: OWNER,
    name: `Recipe ${id.slice(0, 4)}`,
    slug: `recipe-${id.slice(0, 4)}`,
    ingredients: '[]',
    instructions: '[]',
    is_public: true,
    is_system_recipe: false,
    moderation_status: 'approved' as const,
    ...over,
  };
}

async function snapshot() {
  const items = await db.select().from(inventoryItems);
  const log = await db.select().from(inventoryUsageLog);
  return { items, log };
}

beforeAll(async () => {
  const built = await createVisibilityDb(
    [schema.recipes, schema.recipeIngredients, inventoryItems, inventoryUsageLog, userProfiles],
    { ...schema, inventoryItems, inventoryUsageLog, userProfiles },
    { constraints: true }
  );
  client = built.client;
  db = built.db;
  state.db = built.db;
});

beforeEach(async () => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  await client.exec(
    'DELETE FROM "inventory_usage_log"; DELETE FROM "inventory_items"; DELETE FROM "recipe_ingredients"; DELETE FROM "recipes";'
  );
  await db
    .insert(schema.recipes)
    .values([
      recipeRow(PUBLIC_ID),
      recipeRow(PRIVATE_ID, { is_public: false }),
      recipeRow(REJECTED_ID, { moderation_status: 'rejected' }),
      recipeRow(DELETED_ID, { deleted_at: new Date('2026-02-01T00:00:00Z') }),
    ]);
  await db.insert(schema.recipeIngredients).values(
    [PUBLIC_ID, PRIVATE_ID, DELETED_ID].map((recipe_id) => ({
      recipe_id,
      ingredient_id: INGREDIENT_ID,
      amount: '2',
      unit: 'cups',
    }))
  );
  // The caller (OTHER) owns this inventory item; the recipes belong to OWNER.
  await db.insert(inventoryItems).values({
    id: ITEM_ID,
    user_id: OTHER,
    ingredient_id: INGREDIENT_ID,
    storage_location: 'fridge',
    quantity: '5',
    unit: 'cups',
  });
});

afterAll(async () => {
  await client?.close();
});

describe('#143 markItemAsUsed: a hidden recipe answers as a missing one and writes nothing', () => {
  for (const { kind, id } of HIDDEN) {
    it(`another user's ${kind} recipe`, async () => {
      state.userId = OTHER;
      const before = await snapshot();

      const hidden = await markItemAsUsed(ITEM_ID, 2, 'cooked', id);
      const missing = await markItemAsUsed(ITEM_ID, 2, 'cooked', MISSING_ID);

      expect(hidden).toEqual(missing);
      expect(hidden).toEqual({ success: false, error: 'Recipe not found' });
      expect(await snapshot()).toEqual(before);
    });
  }

  it("the owner's own private recipe is still accepted", async () => {
    state.userId = OWNER;
    await db.update(inventoryItems).set({ user_id: OWNER });
    expect(await markItemAsUsed(ITEM_ID, 2, 'cooked', PRIVATE_ID)).toEqual({
      success: true,
      data: { remaining_quantity: 3 },
    });
    const { log } = await snapshot();
    expect(log.map((l) => l.recipe_id)).toEqual([PRIVATE_ID]);
  });

  it('a public recipe is still accepted', async () => {
    state.userId = OTHER;
    expect(await markItemAsUsed(ITEM_ID, 2, 'cooked', PUBLIC_ID)).toEqual({
      success: true,
      data: { remaining_quantity: 3 },
    });
    const { log } = await snapshot();
    expect(log.map((l) => l.recipe_id)).toEqual([PUBLIC_ID]);
  });

  it('no recipe_id is still accepted and logs a null recipe', async () => {
    state.userId = OTHER;
    expect(await markItemAsUsed(ITEM_ID, 2, 'eaten_raw')).toEqual({
      success: true,
      data: { remaining_quantity: 3 },
    });
    const { log } = await snapshot();
    expect(log.map((l) => l.recipe_id)).toEqual([null]);
  });
});

describe('#143 markRecipeIngredientsAsUsed: a hidden recipe is refused as a missing one', () => {
  it("the owner's own soft-deleted recipe answers as a missing id and writes nothing", async () => {
    state.userId = OWNER;
    await db.update(inventoryItems).set({ user_id: OWNER });
    const before = await snapshot();

    const deleted = await markRecipeIngredientsAsUsed(DELETED_ID);
    const missing = await markRecipeIngredientsAsUsed(MISSING_ID);

    expect(deleted).toEqual(missing);
    expect(deleted).toEqual({ success: false, error: 'Recipe not found or access denied' });
    expect(await snapshot()).toEqual(before);
  });

  it("the owner's live private recipe still marks its ingredients", async () => {
    state.userId = OWNER;
    await db.update(inventoryItems).set({ user_id: OWNER });
    const result = await markRecipeIngredientsAsUsed(PRIVATE_ID);
    expect(result).toMatchObject({
      success: true,
      data: { marked_count: 1, missing_count: 0, failed_count: 0 },
    });
    const { items, log } = await snapshot();
    expect(log.map((l) => l.recipe_id)).toEqual([PRIVATE_ID]);
    expect(items.map((i) => Number(i.quantity))).toEqual([3]);
  });

  it('a public recipe still marks the caller inventory', async () => {
    state.userId = OTHER;
    const result = await markRecipeIngredientsAsUsed(PUBLIC_ID);
    expect(result).toMatchObject({ success: true, data: { marked_count: 1, failed_count: 0 } });
    const { log } = await snapshot();
    expect(log.map((l) => l.recipe_id)).toEqual([PUBLIC_ID]);
  });

  it('an item-level failure is reported as failed, never as marked', async () => {
    state.userId = OTHER;
    // A negative amount fails markItemAsUsed validation, an item-level failure.
    await db.update(schema.recipeIngredients).set({ amount: '-3' });
    const result = await markRecipeIngredientsAsUsed(PUBLIC_ID);
    expect(result).toEqual({ success: false, error: 'Failed to mark recipe ingredients as used' });
    const { items, log } = await snapshot();
    expect(log).toEqual([]);
    expect(items.map((i) => Number(i.quantity))).toEqual([5]);
  });

  it('a recipe hidden mid-loop is refused as a missing one and later items are not written', async () => {
    state.userId = OTHER;
    // Second ingredient and a second inventory item, so the loop makes two inner calls.
    await db.insert(schema.recipeIngredients).values({
      recipe_id: PUBLIC_ID,
      ingredient_id: INGREDIENT_ID_2,
      amount: '2',
      unit: 'cups',
    });
    await db.insert(inventoryItems).values({
      id: ITEM_ID_2,
      user_id: OTHER,
      ingredient_id: INGREDIENT_ID_2,
      storage_location: 'fridge',
      quantity: '5',
      unit: 'cups',
    });
    // The module calls `markItemAsUsed` through its own scope, so it cannot be spied on.
    // A Postgres trigger soft-deletes the recipe right after the first usage-log insert,
    // so the second inner call's visibility lookup sees a hidden recipe.
    await client.exec(`
      CREATE FUNCTION hide_recipe_after_first_log() RETURNS trigger AS $$
      BEGIN
        UPDATE "recipes" SET "deleted_at" = now() WHERE "id" = NEW."recipe_id";
        RETURN NEW;
      END; $$ LANGUAGE plpgsql;
      CREATE TRIGGER hide_recipe_after_first_log AFTER INSERT ON "inventory_usage_log"
        FOR EACH ROW EXECUTE FUNCTION hide_recipe_after_first_log();
    `);
    try {
      const hidden = await markRecipeIngredientsAsUsed(PUBLIC_ID);
      // The trigger is gone from the reference call: the missing id never reaches a write.
      const missing = await markRecipeIngredientsAsUsed(MISSING_ID);

      expect(hidden).toEqual(missing);
      expect(hidden).toEqual({ success: false, error: 'Recipe not found or access denied' });

      // Exactly one write stands (the first item, written before the recipe was hidden).
      // The second item has no usage-log row and its quantity is unchanged.
      const { items, log } = await snapshot();
      expect(log).toHaveLength(1);
      expect(log[0].recipe_id).toBe(PUBLIC_ID);
      const written = log[0].inventory_item_id;
      const other = written === ITEM_ID ? ITEM_ID_2 : ITEM_ID;
      expect(Number(items.find((i) => i.id === written)?.quantity)).toBe(3);
      expect(Number(items.find((i) => i.id === other)?.quantity)).toBe(5);
      expect(log.some((l) => l.inventory_item_id === other)).toBe(false);
    } finally {
      await client.exec(
        'DROP TRIGGER hide_recipe_after_first_log ON "inventory_usage_log"; DROP FUNCTION hide_recipe_after_first_log();'
      );
    }
  });
});
