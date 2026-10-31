// @vitest-environment node
/**
 * #146: inventory recipe matching runs against real Postgres (PGlite).
 *
 * Before, both matchers interpolated the inventory id array as `= ANY(${ids})`
 * and `!= ALL(${ids})`. Drizzle expands a JS array to a row, so Postgres
 * rejected every query with one or more inventory items.
 * Sites: `matchRecipesToInventory` (`src/app/actions/inventory.ts`) and
 * `InventoryService.matchRecipes` (`src/lib/services/inventory-service.ts`).
 */

import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const ME = 'user_me';
const OTHER = 'user_other';
const I1 = '22222222-0000-4000-8000-000000000001';
const I2 = '22222222-0000-4000-8000-000000000002';
const I3 = '22222222-0000-4000-8000-000000000003';
const I4 = '22222222-0000-4000-8000-000000000004';
// Recipes: TWO = {I1, I2}, ONE_FOUR = {I1, I4}, FOUR = {I4}.
const TWO = 'aaaaaaaa-0000-4000-8000-000000000001';
const ONE_FOUR = 'aaaaaaaa-0000-4000-8000-000000000002';
const FOUR = 'aaaaaaaa-0000-4000-8000-000000000003';
const OTHER_PRIVATE = 'aaaaaaaa-0000-4000-8000-000000000004';
const REJECTED = 'aaaaaaaa-0000-4000-8000-000000000005';
const DELETED = 'aaaaaaaa-0000-4000-8000-000000000006';
const MY_PRIVATE = 'aaaaaaaa-0000-4000-8000-000000000007';

const state = vi.hoisted(() => ({
  db: undefined as unknown,
  userId: null as string | null,
}));

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

import { matchRecipesToInventory } from '@/app/actions/inventory';
import { ingredients } from '@/lib/db/ingredients-schema';
import { inventoryItems } from '@/lib/db/inventory-schema';
import * as schema from '@/lib/db/schema';
import { inventoryService } from '@/lib/services/inventory-service';
import { createVisibilityDb } from './recipe-visibility-db';

let client: PGlite;
let db: Awaited<ReturnType<typeof createVisibilityDb>>['db'];

function recipeRow(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    user_id: OTHER,
    name: `Recipe ${id.slice(-1)}`,
    slug: `recipe-${id.slice(-1)}`,
    ingredients: '[]',
    instructions: '[]',
    is_public: true,
    is_system_recipe: false,
    moderation_status: 'approved' as const,
    ...over,
  };
}

const RECIPE_INGREDIENTS: [string, string[]][] = [
  [TWO, [I1, I2]],
  [ONE_FOUR, [I1, I4]],
  [FOUR, [I4]],
  [OTHER_PRIVATE, [I1]],
  [REJECTED, [I1]],
  [DELETED, [I1]],
  [MY_PRIVATE, [I1]],
];

async function stock(ids: string[], status: 'fresh' | 'used' = 'fresh') {
  if (ids.length === 0) return;
  await db.insert(inventoryItems).values(
    ids.map((ingredient_id) => ({
      user_id: ME,
      ingredient_id,
      storage_location: 'fridge' as const,
      status,
      quantity: '1',
      unit: 'pieces',
    }))
  );
}

type Row = { id: string; match_percentage: unknown; missing_ingredients: unknown };

/** recipe id -> [match %, sorted missing ingredient ids] */
function summarize(rows: Row[]) {
  return Object.fromEntries(
    rows.map((r) => {
      const missing = ((r.missing_ingredients as { ingredient_id: string }[] | null) ?? [])
        .map((m) => m.ingredient_id)
        .sort();
      return [r.id, [Number(r.match_percentage), missing]];
    })
  );
}

const MATCHERS: { site: string; run: () => Promise<Row[]> }[] = [
  {
    site: 'matchRecipesToInventory',
    run: async () => {
      const result = await matchRecipesToInventory();
      if (!result.success) {
        // The action logs the query error and returns a generic one; surface the logged cause.
        const logged = vi.mocked(console.error).mock.calls.at(-1)?.[1] as { cause?: Error };
        throw new Error(`${result.error}: ${logged?.cause?.message ?? String(logged)}`);
      }
      return result.data as Row[];
    },
  },
  {
    site: 'InventoryService.matchRecipes',
    run: async () => (await inventoryService.matchRecipes(ME)) as Row[],
  },
];

beforeAll(async () => {
  const built = await createVisibilityDb(
    [schema.recipes, schema.recipeIngredients, ingredients, inventoryItems],
    { ...schema, ingredients, inventoryItems },
    { constraints: true }
  );
  client = built.client;
  db = built.db;
  state.db = built.db;
  await db
    .insert(ingredients)
    .values(
      [I1, I2, I3, I4].map((id, n) => ({ id, name: `ing ${n + 1}`, display_name: `Ing ${n + 1}` }))
    );
  await db
    .insert(schema.recipes)
    .values([
      recipeRow(TWO),
      recipeRow(ONE_FOUR),
      recipeRow(FOUR),
      recipeRow(OTHER_PRIVATE, { is_public: false }),
      recipeRow(REJECTED, { moderation_status: 'rejected' }),
      recipeRow(DELETED, { deleted_at: new Date('2026-02-01T00:00:00Z') }),
      recipeRow(MY_PRIVATE, { user_id: ME, is_public: false }),
    ]);
  await db
    .insert(schema.recipeIngredients)
    .values(
      RECIPE_INGREDIENTS.flatMap(([recipe_id, ids]) =>
        ids.map((ingredient_id) => ({ recipe_id, ingredient_id, amount: '1', unit: 'cup' }))
      )
    );
});

beforeEach(async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  state.userId = ME;
  await client.exec('DELETE FROM "inventory_items";');
});

afterAll(async () => {
  await client?.close();
});

for (const { site, run } of MATCHERS) {
  describe(`#146 ${site}`, () => {
    it('several inventory items: match % and missing ingredients are computed', async () => {
      await stock([I1, I2, I3]);
      // A used item is not inventory: I4 stays missing.
      await stock([I4], 'used');
      expect(summarize(await run())).toEqual({
        [TWO]: [100, []],
        [ONE_FOUR]: [50, [I4]],
        [MY_PRIVATE]: [100, []],
      });
    });

    it('exactly one inventory item', async () => {
      await stock([I1]);
      expect(summarize(await run())).toEqual({
        [TWO]: [50, [I2]],
        [ONE_FOUR]: [50, [I4]],
        [MY_PRIVATE]: [100, []],
      });
    });

    it('empty inventory returns no matches without querying recipes', async () => {
      await stock([I4], 'used');
      const execute = vi.spyOn(db, 'execute');
      try {
        expect(await run()).toEqual([]);
        expect(execute).not.toHaveBeenCalled();
      } finally {
        execute.mockRestore();
      }
    });
  });
}
