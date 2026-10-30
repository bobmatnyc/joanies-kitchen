// @vitest-environment node
/**
 * #135: rollback restores the pre-apply state exactly (every touched table,
 * row for row), per batch or per group, and `--dry` keeps nothing.
 */
import type { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildPlan } from '../../../../scripts/dedup-135/plan';
import { runApply } from '../dedup-merge-apply';
import { runRollback } from '../dedup-merge-rollback';
import { createMigratedDb } from './dedup-135-db';
import { SEED_SQL, type Signed, signDryRun, signedDecisions, snapshot } from './dedup-135-fixture';

let db: PGlite;
let signed: Signed;

beforeEach(async () => {
  db = await createMigratedDb();
  await db.exec(SEED_SQL);
  signed = await signDryRun(db);
}, 60_000);

afterEach(async () => {
  await db.close();
});

async function applyBoth() {
  for (const phase of [1, 2] as const) {
    await runApply(
      db,
      {
        signedPlan: signed.plan,
        signedPlanSha256: signed.sha,
        decisionsText: JSON.stringify(signedDecisions(signed)),
        recomputedPlan: await buildPlan(db),
      },
      { batchId: 'b-rb', phase }
    );
  }
}

const liveLedger = async () =>
  (
    await db.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM dedup_135_ledger WHERE rolled_back_at IS NULL'
    )
  ).rows[0]?.n;

describe('runRollback', () => {
  it('restores every touched table exactly', async () => {
    const before = await snapshot(db);
    await applyBoth();
    expect(await snapshot(db)).not.toEqual(before);
    const res = await runRollback(db, { batchId: 'b-rb' });
    expect(res).toHaveLength(4);
    expect(await snapshot(db)).toEqual(before);
    expect(await liveLedger()).toBe(0);
  });

  // A69 gap 5 / item 9: each coverage named, so a removed reversal fails by name.
  describe('restores each covered change', () => {
    const q = async (sql: string) => (await db.query(sql)).rows;
    beforeEach(async () => {
      await applyBoth();
      await runRollback(db, { batchId: 'b-rb' });
    });
    it('recipe_redirects rows are deleted', async () => {
      expect(await q('SELECT from_recipe_id FROM recipe_redirects')).toEqual([]);
    });
    it('recipe_of_the_day re-points are reversed', async () => {
      expect(await q(`SELECT recipe_id FROM recipe_of_the_day ORDER BY date`)).toEqual([
        { recipe_id: 'a2' },
        { recipe_id: 'd1' },
      ]);
    });
    it('recipe_discovery_run_items text re-points are reversed', async () => {
      expect(await q('SELECT recipe_id FROM recipe_discovery_run_items')).toEqual([
        { recipe_id: 'a2' },
      ]);
    });
    it('source_override is reversed', async () => {
      expect(await q(`SELECT source FROM recipes WHERE id = 'b2'`)).toEqual([
        { source: 'example.com' },
      ]);
    });
    it('parent counters are restored', async () => {
      expect(await q('SELECT slug, recipe_count FROM chefs ORDER BY slug')).toEqual([
        { slug: 'ch1', recipe_count: 2 },
        { slug: 'ch2', recipe_count: 1 },
      ]);
      expect(await q('SELECT slug, recipe_count FROM collections ORDER BY slug')).toEqual([
        { slug: 'both', recipe_count: 2 },
        { slug: 'mine', recipe_count: 1 },
      ]);
    });
    it('keeper slugs and counters are restored', async () => {
      expect(
        await q(
          `SELECT id, slug, like_count, collection_count, total_user_ratings, avg_user_rating
           FROM recipes WHERE id IN ('a1', 'e1') ORDER BY id`
        )
      ).toEqual([
        {
          id: 'a1',
          slug: null,
          like_count: 7,
          collection_count: 3,
          total_user_ratings: 0,
          avg_user_rating: null,
        },
        {
          id: 'e1',
          slug: null,
          like_count: 0,
          collection_count: 0,
          total_user_ratings: 0,
          avg_user_rating: null,
        },
      ]);
    });
  });

  // code-critic MEDIUM: counters are reversed by difference, so rolling back an older group
  // alone leaves a parent shared with a later group at the right count.
  // code-critic: the two rollback guards.
  it('refuses a parent ledger row that has no after value, and changes nothing', async () => {
    await applyBoth();
    const { rows } = await db.query<{ id: number }>(
      `UPDATE dedup_135_ledger SET row_data = row_data - 'after'
       WHERE kind = 'parent' AND table_name = 'chefs' RETURNING id::int AS id`
    );
    const applied = await snapshot(db);
    await expect(runRollback(db, { batchId: 'b-rb' })).rejects.toThrow(
      `rollback: ledger entry ${rows[0]?.id} (parent chefs.recipe_count) matched 0 rows, expected 1`
    );
    // Groups after the refused one were reversed; the refused group stays applied.
    const ch1 = await db.query(`SELECT recipe_count FROM chefs WHERE slug = 'ch1'`);
    expect(ch1.rows).toEqual([{ recipe_count: 1 }]);
    expect((await snapshot(db)).chefs).toEqual(applied.chefs);
  });

  it('keeps a change made to a parent counter after apply', async () => {
    await applyBoth(); // ch1: 2 -> 1
    await db.exec(`UPDATE chefs SET recipe_count = recipe_count + 1 WHERE slug = 'ch1'`);
    await runRollback(db, { batchId: 'b-rb' });
    const ch1 = await db.query(`SELECT recipe_count FROM chefs WHERE slug = 'ch1'`);
    expect(ch1.rows).toEqual([{ recipe_count: 3 }]); // original 2, plus the later +1
  });

  it('rolling back the older of two groups on one chef leaves that chef correct', async () => {
    await db.exec(`INSERT INTO chef_recipes (chef_id, recipe_id) VALUES
        ('00000000-0000-0000-0000-00000000c4e1', 'a1'),
        ('00000000-0000-0000-0000-00000000c4e1', 'a2');
      UPDATE chefs SET recipe_count = 4 WHERE slug = 'ch1';`);
    signed = await signDryRun(db);
    await applyBoth(); // banana (phase 1) drops a2's ch1 row: 4 -> 3; cashew (phase 2): 3 -> 2
    const chef = async () =>
      (
        await db.query<{ stored: number; live: number }>(
          `SELECT recipe_count AS stored,
             (SELECT count(*)::int FROM chef_recipes c WHERE c.chef_id = x.id) AS live
           FROM chefs x WHERE slug = 'ch1'`
        )
      ).rows[0];
    expect(await chef()).toEqual({ stored: 2, live: 2 });
    await runRollback(db, { batchId: 'b-rb', groupId: signed.ids['banana bread'] });
    expect(await chef()).toEqual({ stored: 3, live: 3 });
    await runRollback(db, { batchId: 'b-rb' });
    expect(await chef()).toEqual({ stored: 4, live: 4 });
  });

  it('narrowed to one group reverses only that group', async () => {
    await applyBoth();
    const banana = signed.ids['banana bread'];
    await runRollback(db, { batchId: 'b-rb', groupId: banana });
    const deleted = await db.query<{ id: string }>(
      'SELECT id FROM recipes WHERE deleted_at IS NOT NULL ORDER BY id'
    );
    expect(deleted.rows.map((r) => r.id)).toEqual(['b1', 'b3', 'c2', 'e2']);
    const fav = await db.query('SELECT recipe_id FROM favorites ORDER BY recipe_id');
    expect(fav.rows).toEqual([{ recipe_id: 'a1' }, { recipe_id: 'a2' }, { recipe_id: 'd2' }]);
    const slug = await db.query(`SELECT slug FROM recipes WHERE id = 'a1'`);
    expect(slug.rows).toEqual([{ slug: null }]);
  });

  it('--dry reverses and rolls back: nothing changes', async () => {
    await applyBoth();
    const applied = await snapshot(db);
    const res = await runRollback(db, { batchId: 'b-rb', dry: true });
    expect(res).toHaveLength(4);
    expect(await snapshot(db)).toEqual(applied);
    expect(await liveLedger()).toBeGreaterThan(0);
  });

  it('after a rollback the batch can be applied again', async () => {
    await applyBoth();
    const applied = await snapshot(db);
    await runRollback(db, { batchId: 'b-rb' });
    await applyBoth();
    const again = await snapshot(db);
    // created_at of redirect rows differs; compare everything else.
    const strip = (s: Record<string, unknown[]>) => ({
      ...s,
      recipes: (s.recipes as Array<Record<string, unknown>>).map(({ deleted_at, ...r }) => ({
        ...r,
        deleted: deleted_at !== null,
      })),
      recipe_redirects: (s.recipe_redirects as Array<Record<string, unknown>>).map(
        ({ created_at, ...r }) => r
      ),
    });
    expect(strip(again)).toEqual(strip(applied));
  });
});
