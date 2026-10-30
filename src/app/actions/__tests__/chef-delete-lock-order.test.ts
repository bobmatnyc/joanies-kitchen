// @vitest-environment node
/**
 * #189: deleting a chef must lock its recipes before the chef, the order every
 * recipe delete uses (#174). Real `deleteChef` and `ChefService.delete` against
 * PGlite tables carrying the production chef foreign keys.
 */

import type { PGlite } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock('@/lib/db', () => ({
  get db() {
    return state.db;
  },
}));
vi.mock('@/lib/admin', () => ({
  requireAdmin: vi.fn(async () => undefined),
  checkAdminAccess: vi.fn(async () => false),
}));
vi.mock('@/lib/auth', () => ({ auth: vi.fn(async () => ({ userId: 'user-1' })) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { revalidatePath } from 'next/cache';
import { createVisibilityDb } from '@/app/actions/__tests__/recipe-visibility-db';
import { deleteChef } from '@/app/actions/chefs';
import { chefRecipes, chefs } from '@/lib/db/chef-schema';
import { recipes } from '@/lib/db/schema';
import { chefService } from '@/lib/services/chef-service';

const CHEF = '00000000-0000-4000-8000-000000000001';
const OTHER = '00000000-0000-4000-8000-000000000002';
const UNKNOWN = '00000000-0000-4000-8000-000000000009';

let client: PGlite;
const rows = async <T>(sql: string) => (await client.query<T>(sql)).rows;

beforeAll(async () => {
  const tables = { recipes, chefs, chefRecipes };
  const built = await createVisibilityDb(Object.values(tables), tables, { constraints: true });
  client = built.client;
  state.db = built.db;
  // The test tables carry no foreign keys; these are the production chef FKs.
  await client.exec(`ALTER TABLE "chef_recipes" ADD CONSTRAINT chef_recipes_chef_fk
    FOREIGN KEY ("chef_id") REFERENCES "chefs" ("id") ON DELETE CASCADE;
    ALTER TABLE "chef_recipes" ADD CONSTRAINT chef_recipes_recipe_fk
    FOREIGN KEY ("recipe_id") REFERENCES "recipes" ("id") ON DELETE CASCADE;
    ALTER TABLE "recipes" ADD CONSTRAINT recipes_chef_fk
    FOREIGN KEY ("chef_id") REFERENCES "chefs" ("id") ON DELETE SET NULL;`);
});

afterAll(async () => {
  await client?.close();
});

beforeEach(async () => {
  await client.exec('DELETE FROM "chef_recipes"; DELETE FROM "recipes"; DELETE FROM "chefs";');
  await client.exec(`INSERT INTO "chefs" (id, slug, name, recipe_count)
    VALUES ('${CHEF}', 'chef-a', 'Chef A', 2), ('${OTHER}', 'chef-b', 'Chef B', 1)`);
  // r1: named and linked; r2: linked only; r3: named only; r4: the other chef's.
  await client.exec(`INSERT INTO "recipes" (id, user_id, name, ingredients, instructions, chef_id)
    VALUES ('r1', 'user-1', 'One', '[]', '[]', '${CHEF}'),
      ('r2', 'user-1', 'Two', '[]', '[]', NULL),
      ('r3', 'user-1', 'Three', '[]', '[]', '${CHEF}'),
      ('r4', 'user-1', 'Four', '[]', '[]', '${OTHER}')`);
  await client.exec(`INSERT INTO "chef_recipes" (chef_id, recipe_id)
    VALUES ('${CHEF}', 'r1'), ('${CHEF}', 'r2'), ('${OTHER}', 'r4')`);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(revalidatePath).mockReset();
});

const paths = [
  ['deleteChef', (id: string) => deleteChef(id)],
  ['ChefService.delete', (id: string) => chefService.delete(id)],
] as const;

describe('chef delete locks recipes before the chef (#189)', () => {
  // PGlite is one session, so it cannot interleave a concurrent recipe delete.
  // This pins the issued order instead: recipes lock, chef lock, chef delete.
  it.each(paths)(
    '%s sends the recipes lock, the chef lock and the delete, in that order',
    async (_name, run) => {
      const batch = vi.spyOn(state.db as { batch: (q: unknown[]) => Promise<unknown> }, 'batch');

      await run(CHEF);

      expect(batch).toHaveBeenCalledTimes(1);
      const sqls = (batch.mock.calls[0][0] as { toSQL: () => { sql: string } }[]).map(
        (q) => q.toSQL().sql
      );
      expect(sqls).toHaveLength(3);
      expect(sqls[0]).toMatch(
        /^select "id" from "recipes" where \("recipes"\."chef_id" = \$1 or "recipes"\."id" in \(select "recipe_id" from "chef_recipes" where "chef_recipes"\."chef_id" = \$2\)\) order by "recipes"\."id" asc for no key update$/
      );
      expect(sqls[1]).toMatch(/^select "id" from "chefs" where "chefs"\."id" = \$1 for update$/);
      expect(sqls[2]).toMatch(/^delete from "chefs" where "chefs"\."id" = \$1 returning /);
    }
  );
});

describe('chef delete keeps the recipes (#189)', () => {
  const recipeChefs = async () =>
    rows<{ id: string; chef_id: string | null }>('SELECT id, chef_id FROM "recipes" ORDER BY id');
  const links = async () =>
    rows<{ chef_id: string; recipe_id: string }>(
      'SELECT chef_id, recipe_id FROM "chef_recipes" ORDER BY recipe_id'
    );

  it('deleteChef nulls chef_id, drops the links, keeps the recipes and revalidates', async () => {
    expect(await deleteChef(CHEF)).toEqual({ success: true });

    expect(await recipeChefs()).toEqual([
      { id: 'r1', chef_id: null },
      { id: 'r2', chef_id: null },
      { id: 'r3', chef_id: null },
      { id: 'r4', chef_id: OTHER },
    ]);
    expect(await links()).toEqual([{ chef_id: OTHER, recipe_id: 'r4' }]);
    expect(await rows('SELECT id FROM "chefs"')).toEqual([{ id: OTHER }]);
    expect(vi.mocked(revalidatePath).mock.calls.map((c) => c[0])).toEqual([
      '/discover/chefs',
      '/chef/chef-a',
      '/admin/chefs',
    ]);
  });

  it('ChefService.delete nulls chef_id, drops the links and keeps the recipes', async () => {
    expect(await chefService.delete(CHEF)).toBe(true);

    expect((await recipeChefs()).map((r) => r.chef_id)).toEqual([null, null, null, OTHER]);
    expect(await links()).toEqual([{ chef_id: OTHER, recipe_id: 'r4' }]);
  });

  it('an unknown chef returns the not-found result and changes nothing', async () => {
    expect(await deleteChef(UNKNOWN)).toEqual({ success: false, error: 'Chef not found' });
    expect(await chefService.delete(UNKNOWN)).toBe(false);

    expect(revalidatePath).not.toHaveBeenCalled();
    expect(await rows('SELECT id FROM "chefs" ORDER BY id')).toEqual([{ id: CHEF }, { id: OTHER }]);
    expect(await links()).toHaveLength(3);
  });
});
