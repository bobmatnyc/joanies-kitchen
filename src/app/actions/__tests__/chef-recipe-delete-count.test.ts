// @vitest-environment node
/**
 * #165: deleting a recipe cascades its `chef_recipes` rows away, so every delete
 * path must recount the affected chefs. Real actions against PGlite tables, with
 * the production `ON DELETE CASCADE` foreign key added to `chef_recipes`.
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
vi.mock('@/lib/session-user', () => ({
  getSessionUserId: async () => 'user-1',
  getSessionUser: async () => ({ id: 'user-1' }),
}));
vi.mock('@/lib/cache', () => ({ invalidateRecipeById: vi.fn(), invalidateRecipeCaches: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { revalidatePath } from 'next/cache';
import { createVisibilityDb } from '@/app/actions/__tests__/recipe-visibility-db';
import { adminBulkDeleteRecipes, adminDeleteRecipe } from '@/app/actions/admin';
import { deleteRecipe } from '@/app/actions/recipes';
import { deleteRecipesWithChefRecount, recountChefRecipes } from '@/lib/chef-recipe-count';
import { linkInsertedRecipe } from '@/lib/chef-scraping-links';
import { chefRecipes, chefs, scrapingJobs } from '@/lib/db/chef-schema';
import { recipes } from '@/lib/db/schema';

const CHEF = '00000000-0000-4000-8000-000000000001';

let client: PGlite;
const rows = async <T>(sql: string) => (await client.query<T>(sql)).rows;
const storedCount = async () =>
  (await rows<{ recipe_count: number }>(`SELECT recipe_count FROM "chefs" WHERE id = '${CHEF}'`))[0]
    .recipe_count;
const liveLinks = async () =>
  (await rows<{ n: number }>('SELECT count(*)::int AS n FROM "chef_recipes"'))[0].n;

beforeAll(async () => {
  const tables = { recipes, chefs, chefRecipes, scrapingJobs };
  const built = await createVisibilityDb(Object.values(tables), tables, { constraints: true });
  client = built.client;
  state.db = built.db;
  // The test tables carry no foreign keys; production cascades chef_recipes on recipe delete.
  await client.exec(`ALTER TABLE "chef_recipes" ADD CONSTRAINT chef_recipes_recipe_fk
    FOREIGN KEY ("recipe_id") REFERENCES "recipes" ("id") ON DELETE CASCADE`);
});

afterAll(async () => {
  await client?.close();
});

beforeEach(async () => {
  await client.exec('DELETE FROM "chef_recipes"; DELETE FROM "recipes"; DELETE FROM "chefs";');
  await client.exec(
    `INSERT INTO "chefs" (id, slug, name, recipe_count) VALUES ('${CHEF}', 'chef-a', 'Chef A', 2)`
  );
  await client.exec(`INSERT INTO "recipes" (id, user_id, name, ingredients, instructions, is_public)
    VALUES ('r1', 'user-1', 'One', '[]', '[]', false), ('r2', 'user-1', 'Two', '[]', '[]', false)`);
  await client.exec(`INSERT INTO "chef_recipes" (chef_id, recipe_id)
    VALUES ('${CHEF}', 'r1'), ('${CHEF}', 'r2')`);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(revalidatePath).mockReset();
});

describe('chef recipe_count after a recipe delete (#165)', () => {
  it('adminDeleteRecipe recounts the chef', async () => {
    expect(await adminDeleteRecipe('r1')).toMatchObject({ success: true });
    expect(await storedCount()).toBe(1);
  });

  it('adminBulkDeleteRecipes recounts the chef once for both recipes', async () => {
    expect(await adminBulkDeleteRecipes(['r1', 'r2'])).toMatchObject({ success: true });
    expect(await storedCount()).toBe(0);
  });

  it('deleteRecipe (user path) recounts the chef', async () => {
    expect(await deleteRecipe('r1')).toMatchObject({ success: true });
    expect(await storedCount()).toBe(1);
    expect(await deleteRecipe('r2')).toMatchObject({ success: true });
    expect(await storedCount()).toBe(0);
  });

  it('linkInsertedRecipe cleanup recounts when revalidatePath throws after the link recount', async () => {
    await client.exec(`INSERT INTO "recipes" (id, user_id, name, ingredients, instructions)
      VALUES ('r3', 'system', 'Three', '[]', '[]')`);
    vi.mocked(revalidatePath).mockImplementation(() => {
      throw new Error('revalidate down');
    });
    await expect(linkInsertedRecipe(CHEF, 'r3', 'https://chef.com/three')).rejects.toThrow(
      /revalidate down/
    );
    expect(await liveLinks()).toBe(2);
    expect(await storedCount()).toBe(2);
  });

  it('reports a failed recount instead of swallowing it', async () => {
    await client.exec(`UPDATE "chefs" SET recipe_count = 2`);
    const original = state.db as { update: (...args: unknown[]) => unknown };
    vi.spyOn(original, 'update').mockImplementation(() => {
      throw new Error('update down');
    });
    expect(await adminDeleteRecipe('r1')).toEqual({
      success: false,
      error: 'Failed to delete recipe',
    });
  });
});

// #174: the delete and the chef recount run in one db.batch transaction.
describe('delete and chef recount are atomic (#174)', () => {
  const recipeIds = async () =>
    (await rows<{ id: string }>('SELECT id FROM "recipes" ORDER BY id')).map((r) => r.id);

  afterEach(async () => {
    await client.exec('DROP TRIGGER IF EXISTS fail_recount ON "chefs";');
  });

  it.each([
    ['adminDeleteRecipe', () => adminDeleteRecipe('r1'), 'Failed to delete recipe'],
    ['adminBulkDeleteRecipes', () => adminBulkDeleteRecipes(['r1']), 'Failed to delete recipes'],
    ['deleteRecipe', () => deleteRecipe('r1'), 'Failed to delete recipe'],
  ])('%s deletes nothing when the recount statement fails', async (_name, run, error) => {
    await client.exec(`CREATE OR REPLACE FUNCTION fail_recount() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'recount down'; END $$ LANGUAGE plpgsql;
      CREATE TRIGGER fail_recount BEFORE UPDATE ON "chefs" FOR EACH ROW EXECUTE FUNCTION fail_recount();`);

    expect(await run()).toEqual({ success: false, error });

    expect(await recipeIds()).toEqual(['r1', 'r2']);
    expect(await liveLinks()).toBe(2);
    expect(await storedCount()).toBe(2);
  });

  it('a chef with two of the bulk-deleted recipes keeps the count of its surviving links', async () => {
    const other = '00000000-0000-4000-8000-000000000002';
    await client.exec(`INSERT INTO "recipes" (id, user_id, name, ingredients, instructions)
      VALUES ('r3', 'user-1', 'Three', '[]', '[]')`);
    await client.exec(
      `INSERT INTO "chefs" (id, slug, name, recipe_count) VALUES ('${other}', 'chef-b', 'Chef B', 9)`
    );
    await client.exec(`INSERT INTO "chef_recipes" (chef_id, recipe_id)
      VALUES ('${CHEF}', 'r3'), ('${other}', 'r2'), ('${other}', 'r3')`);

    expect(await adminBulkDeleteRecipes(['r1', 'r2'])).toMatchObject({
      success: true,
      data: { deleted: 2 },
    });

    expect(await recipeIds()).toEqual(['r3']);
    expect(await storedCount()).toBe(1);
    const [b] = await rows<{ recipe_count: number }>(
      `SELECT recipe_count FROM "chefs" WHERE id = '${other}'`
    );
    expect(b.recipe_count).toBe(1);
  });

  // PGlite is one session, so it cannot interleave a concurrent link insert.
  // This pins the issued order instead: recipes lock, chefs lock, recount, delete.
  it('sends the recipes lock, the chefs lock, the recount and the delete, in that order', async () => {
    const batch = vi.spyOn(state.db as { batch: (q: unknown[]) => Promise<unknown> }, 'batch');

    await deleteRecipesWithChefRecount(['r1']);

    const sqls = (batch.mock.calls[0][0] as { toSQL: () => { sql: string } }[]).map(
      (q) => q.toSQL().sql
    );
    expect(sqls).toHaveLength(4);
    expect(sqls[0]).toMatch(
      /^select .+ from "recipes" where .+ order by "recipes"\."id" asc for update$/
    );
    expect(sqls[1]).toMatch(
      /^select .+ from "chefs" where .+ order by "chefs"\."id" asc for no key update$/
    );
    expect(sqls[2]).toMatch(/^update "chefs" set "recipe_count" = \(SELECT count/);
    expect(sqls[3]).toMatch(/^delete from "recipes" /);
  });
});

describe('recountChefRecipes (#174)', () => {
  it('recounts in one UPDATE, with no separate SELECT', async () => {
    await client.exec(`UPDATE "chefs" SET recipe_count = 7`);
    const spied = state.db as { select: () => unknown; update: () => unknown };
    const select = vi.spyOn(spied, 'select');
    const update = vi.spyOn(spied, 'update');

    expect(await recountChefRecipes(CHEF)).toEqual({ success: true, recipeCount: 2 });

    expect(select).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(1);
    expect(await storedCount()).toBe(2);
  });
});
