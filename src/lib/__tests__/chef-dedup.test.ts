// @vitest-environment node
/**
 * Chef dedup plan (`src/lib/chef-dedup.ts`) against PGlite tables carrying the
 * production foreign keys to chefs.id.
 */
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createVisibilityDb } from '@/app/actions/__tests__/recipe-visibility-db';
import {
  applyDedupPlan,
  computeDedupPlan,
  type DedupPlan,
  type Querier,
  renderDedupPlan,
} from '@/lib/chef-dedup';
import { chefRecipes, chefs, scrapingJobs } from '@/lib/db/chef-schema';
import { recipes } from '@/lib/db/schema';

const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const A = id(1); // survivor
const B = id(2); // loser
const C = id(3); // reattribute source
const D = id(4); // unlinkAndDelete
const E = id(5); // bystander

let client: PGlite;
let q: Querier;
const rows = async <T>(sql: string) => (await client.query<T>(sql)).rows;
const chefIds = async () =>
  (await rows<{ id: string }>('SELECT id FROM chefs ORDER BY id')).map((r) => r.id);
const linksOf = async (chef: string) =>
  (
    await rows<{ recipe_id: string }>(
      `SELECT recipe_id FROM chef_recipes WHERE chef_id = '${chef}' ORDER BY recipe_id`
    )
  ).map((r) => r.recipe_id);
const countOf = async (chef: string) =>
  (await rows<{ recipe_count: number }>(`SELECT recipe_count FROM chefs WHERE id = '${chef}'`))[0]
    ?.recipe_count;
const plan = (p: Partial<DedupPlan>): DedupPlan => ({
  merges: [],
  reattribute: [],
  unlinkAndDelete: [],
  ...p,
});

beforeAll(async () => {
  const tables = { recipes, chefs, chefRecipes, scrapingJobs };
  const built = await createVisibilityDb(Object.values(tables), tables, { constraints: true });
  client = built.client;
  await client.exec(`
    ALTER TABLE chef_recipes ADD FOREIGN KEY (chef_id) REFERENCES chefs (id) ON DELETE CASCADE;
    ALTER TABLE chef_recipes ADD FOREIGN KEY (recipe_id) REFERENCES recipes (id) ON DELETE CASCADE;
    ALTER TABLE recipes ADD FOREIGN KEY (chef_id) REFERENCES chefs (id) ON DELETE SET NULL;
    ALTER TABLE scraping_jobs ADD FOREIGN KEY (chef_id) REFERENCES chefs (id) ON DELETE SET NULL;`);
  q = {
    query: async (sql, params) => {
      const res = await client.query(sql, params);
      return { rows: res.rows as never[], rowCount: res.affectedRows ?? 0 };
    },
  };
});

afterAll(async () => {
  await client?.close();
});

beforeEach(async () => {
  await client.exec(`
    DROP TRIGGER IF EXISTS skip_one ON recipes;
    DELETE FROM chef_recipes; DELETE FROM scraping_jobs; DELETE FROM recipes; DELETE FROM chefs;
    INSERT INTO chefs (id, slug, name, recipe_count, is_active) VALUES
      ('${A}', 'kenji', 'Kenji', 2, true), ('${B}', 'kenji-lopez-alt', 'J. Kenji Lopez-Alt', 2, true),
      ('${C}', 'kenji-2', 'Kenji 2', 1, true), ('${D}', 'not-a-chef', 'Not A Chef', 1, true),
      ('${E}', 'other', 'Other', 0, true);
    INSERT INTO recipes (id, user_id, name, ingredients, instructions, chef_id) VALUES
      ('r1', 'u', 'One', '[]', '[]', '${A}'), ('r2', 'u', 'Two', '[]', '[]', '${B}'),
      ('r3', 'u', 'Three', '[]', '[]', '${B}'), ('r4', 'u', 'Four', '[]', '[]', '${C}'),
      ('r5', 'u', 'Five', '[]', '[]', '${D}');
    INSERT INTO chef_recipes (chef_id, recipe_id) VALUES
      ('${A}', 'r1'), ('${A}', 'r2'), ('${B}', 'r2'), ('${B}', 'r3'), ('${C}', 'r4'), ('${D}', 'r5');
    INSERT INTO scraping_jobs (chef_id, source_url) VALUES ('${B}', 'https://x'), ('${D}', 'https://y');`);
});

describe('chef dedup plan', () => {
  it('merges a loser into the survivor, skipping the link the survivor already has', async () => {
    const p = plan({
      merges: [{ survivor: A, losers: [B], rename: { name: 'J. Kenji', slug: 'kenji-lopez-alt' } }],
    });
    const dry = await computeDedupPlan(q, p);
    expect(dry.moves[0]).toMatchObject({
      linksMoved: 1,
      linksSkipped: 1,
      recipesRepointed: 2,
      jobsRepointed: 1,
    });
    expect(renderDedupPlan(dry).join('\n')).toContain('move 1 links, skip 1 conflicts');
    expect(await chefIds()).toContain(B); // dry run writes nothing

    await applyDedupPlan(q, p);
    expect(await chefIds()).not.toContain(B);
    expect(await linksOf(A)).toEqual(['r1', 'r2', 'r3']);
    expect(await countOf(A)).toBe(3);
    expect(await rows(`SELECT id FROM recipes WHERE chef_id = '${A}' ORDER BY id`)).toEqual([
      { id: 'r1' },
      { id: 'r2' },
      { id: 'r3' },
    ]);
    expect(
      await rows(`SELECT count(*)::int AS n FROM scraping_jobs WHERE chef_id = '${A}'`)
    ).toEqual([{ n: 1 }]);
    expect(await rows(`SELECT name, slug FROM chefs WHERE id = '${A}'`)).toEqual([
      { name: 'J. Kenji', slug: 'kenji-lopez-alt' },
    ]);
  });

  it('reattributes a chef to a target without a rename', async () => {
    await applyDedupPlan(q, plan({ reattribute: [{ chef: C, to: E }] }));
    expect(await chefIds()).not.toContain(C);
    expect(await linksOf(E)).toEqual(['r4']);
    expect(await countOf(E)).toBe(1);
    expect(await rows(`SELECT chef_id FROM recipes WHERE id = 'r4'`)).toEqual([{ chef_id: E }]);
  });

  it('unlinkAndDelete nulls recipes, drops links and deletes the chef', async () => {
    await applyDedupPlan(q, plan({ unlinkAndDelete: [D] }));
    expect(await chefIds()).not.toContain(D);
    expect(await rows(`SELECT chef_id FROM recipes WHERE id = 'r5'`)).toEqual([{ chef_id: null }]);
    expect(await linksOf(D)).toEqual([]);
    expect(await rows(`SELECT chef_id FROM scraping_jobs WHERE source_url = 'https://y'`)).toEqual([
      { chef_id: null },
    ]);
  });

  it.each([
    ['a missing id', plan({ unlinkAndDelete: [id(9)] }), /does not exist/],
    [
      'a duplicate id',
      plan({ merges: [{ survivor: A, losers: [B] }], unlinkAndDelete: [B] }),
      /removed more than once/,
    ],
    [
      'a survivor that is also a loser',
      plan({
        merges: [
          { survivor: A, losers: [B] },
          { survivor: B, losers: [C] },
        ],
      }),
      /both a survivor\/target and removed/,
    ],
    [
      'a rename slug held by a surviving chef',
      plan({ merges: [{ survivor: A, losers: [B], rename: { name: 'X', slug: 'other' } }] }),
      /held by surviving chef/,
    ],
  ])('aborts on %s and writes nothing', async (_label, p, message) => {
    await expect(applyDedupPlan(q, p)).rejects.toThrow(message);
    expect(await chefIds()).toEqual([A, B, C, D, E]);
  });

  it('aborts on an inactive chef', async () => {
    await client.exec(`UPDATE chefs SET is_active = false WHERE id = '${C}'`);
    await expect(computeDedupPlan(q, plan({ reattribute: [{ chef: C, to: E }] }))).rejects.toThrow(
      /not active/
    );
  });

  it('rolls back the whole run when a later statement touches an unexpected row count', async () => {
    // The B -> A merge writes first; a trigger then silently skips nulling r5 for D,
    // so the unlinkAndDelete guard counts 0, not 1, after real writes exist.
    await client.exec(`
      CREATE OR REPLACE FUNCTION skip_r5() RETURNS trigger AS $$
      BEGIN IF OLD.id = 'r5' AND NEW.chef_id IS NULL THEN RETURN NULL; END IF; RETURN NEW; END $$ LANGUAGE plpgsql;
      CREATE TRIGGER skip_one BEFORE UPDATE ON recipes FOR EACH ROW EXECUTE FUNCTION skip_r5();`);
    const p = plan({ merges: [{ survivor: A, losers: [B] }], unlinkAndDelete: [D] });
    await expect(applyDedupPlan(q, p)).rejects.toThrow(
      /unlinkAndDelete .* unlink recipes: expected 1 rows, got 0; rolled back/
    );
    // The merge is fully undone.
    expect(await chefIds()).toEqual([A, B, C, D, E]);
    expect(await linksOf(A)).toEqual(['r1', 'r2']);
    expect(await linksOf(B)).toEqual(['r2', 'r3']);
    expect(await rows('SELECT id, chef_id FROM recipes ORDER BY id')).toEqual([
      { id: 'r1', chef_id: A },
      { id: 'r2', chef_id: B },
      { id: 'r3', chef_id: B },
      { id: 'r4', chef_id: C },
      { id: 'r5', chef_id: D },
    ]);
    expect(await rows('SELECT source_url, chef_id FROM scraping_jobs ORDER BY source_url')).toEqual(
      [
        { source_url: 'https://x', chef_id: B },
        { source_url: 'https://y', chef_id: D },
      ]
    );
    expect(await countOf(A)).toBe(2);
    // D is intact.
    expect(await linksOf(D)).toEqual(['r5']);
  });
});
