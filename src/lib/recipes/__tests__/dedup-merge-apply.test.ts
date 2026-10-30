// @vitest-environment node
/**
 * #135: merge apply on PGlite built from the real migrations (0005 included).
 * Covers the signed-file refusal, the exact post-state of every touched table,
 * idempotent re-run, no_merge and partial groups, phase separation, drift
 * refusal and a mid-group failure that leaves no trace.
 */
import type { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildPlan } from '../../../../scripts/dedup-135/plan';
import { type ApplyOptions, runApply } from '../dedup-merge-apply';
import { DecisionsError } from '../dedup-merge-decisions';
import { PinError } from '../dedup-merge-pin';
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

async function apply(phase: 1 | 2, decisionsText?: string, opts: Partial<ApplyOptions> = {}) {
  return runApply(
    db,
    {
      signedPlan: signed.plan,
      signedPlanSha256: signed.sha,
      decisionsText: decisionsText ?? JSON.stringify(signedDecisions(signed)),
      recomputedPlan: await buildPlan(db),
    },
    { batchId: 'b-test', phase, ...opts }
  );
}

const col = async (sql: string) => (await db.query<Record<string, unknown>>(sql)).rows;
const ledgerCount = async () =>
  Number((await col('SELECT count(*)::int AS n FROM dedup_135_ledger'))[0]?.n);

describe('runApply refusals', () => {
  it.each([
    ['missing', undefined],
    ['empty', '   '],
    ['unsigned', JSON.stringify({ ...signedDecisionsPlaceholder(), signed_by: '' })],
  ])('refuses a %s decisions file and writes nothing', async (_label, text) => {
    const before = await snapshot(db);
    const input = text === undefined ? '' : text.replace('__SHA__', signed.sha);
    await expect(apply(1, input)).rejects.toBeInstanceOf(DecisionsError);
    expect(await snapshot(db)).toEqual(before);
    expect(await ledgerCount()).toBe(0);
  });

  it('refuses on drift beyond tolerance (a new member joins a signed group)', async () => {
    await db.exec(`INSERT INTO recipes (id, user_id, name, ingredients, instructions, source, is_public)
      VALUES ('a3', 'system', 'Banana Bread', 'same ingredients', 'same steps', 'example.com', true)`);
    const before = await snapshot(db);
    await expect(apply(1)).rejects.toBeInstanceOf(PinError);
    expect(await snapshot(db)).toEqual(before);
  });
});

function signedDecisionsPlaceholder() {
  return {
    signed_by: 'Bob',
    signed_at: '2026-10-31T12:00:00Z',
    dry_run_sha256: '__SHA__',
    decisions: {},
  };
}

describe('runApply effect', () => {
  it('phase 1 touches auto groups only; phase 2 the reviewed ones', async () => {
    const p1 = await apply(1);
    expect(p1.results.map((r) => [r.groupId, r.status])).toEqual([
      [signed.ids['banana bread'], 'applied'],
      [signed.ids['kale stew'], 'applied'],
    ]);
    const deleted1 = await col('SELECT id FROM recipes WHERE deleted_at IS NOT NULL ORDER BY id');
    expect(deleted1.map((r) => r.id)).toEqual(['a2', 'e2']);
    const p2 = await apply(2);
    expect(p2.results.map((r) => [r.groupId, r.status])).toEqual([
      [signed.ids['beef tacos'], 'skipped-no-merge'],
      [signed.ids['cashew milk'], 'applied'],
      [signed.ids['chicken stock'], 'applied'],
    ]);
  });

  it('leaves the exact post-state in every touched table', async () => {
    const before = await snapshot(db);
    await apply(1);
    await apply(2);
    const after = await snapshot(db);

    const recipes = await col(
      `SELECT id, slug, name, deleted_at IS NOT NULL AS deleted, like_count, collection_count,
         total_user_ratings, avg_user_rating::text AS avg FROM recipes ORDER BY id`
    );
    expect(recipes).toEqual([
      {
        id: 'a1',
        slug: 'banana-bread-3',
        name: 'Banana Bread',
        deleted: false,
        like_count: 1,
        collection_count: 2,
        total_user_ratings: 2,
        avg: '4.5',
      },
      {
        id: 'a2',
        slug: 'banana-bread',
        name: 'Banana Bread',
        deleted: true,
        like_count: 0,
        collection_count: 0,
        total_user_ratings: 0,
        avg: null,
      },
      {
        id: 'b1',
        slug: null,
        name: 'Cashew Milk',
        deleted: true,
        like_count: 0,
        collection_count: 0,
        total_user_ratings: 0,
        avg: null,
      },
      {
        id: 'b2',
        slug: 'cashew-milk',
        name: 'Cashew Milk',
        deleted: false,
        like_count: 0,
        collection_count: 0,
        total_user_ratings: 0,
        avg: null,
      },
      {
        id: 'b3',
        slug: 'cashew-milk-2',
        name: 'Cashew Milk ',
        deleted: true,
        like_count: 0,
        collection_count: 0,
        total_user_ratings: 0,
        avg: null,
      },
      {
        id: 'c1',
        slug: 'chicken-stock',
        name: 'Chicken Stock',
        deleted: false,
        like_count: 0,
        collection_count: 0,
        total_user_ratings: 0,
        avg: null,
      },
      {
        id: 'c2',
        slug: null,
        name: 'Chicken Stock',
        deleted: true,
        like_count: 0,
        collection_count: 0,
        total_user_ratings: 0,
        avg: null,
      },
      {
        id: 'c3',
        slug: null,
        name: 'Chicken Stock',
        deleted: false,
        like_count: 0,
        collection_count: 0,
        total_user_ratings: 0,
        avg: null,
      },
      {
        id: 'd1',
        slug: 'beef-tacos',
        name: 'Beef Tacos',
        deleted: false,
        like_count: 0,
        collection_count: 0,
        total_user_ratings: 0,
        avg: null,
      },
      {
        id: 'd2',
        slug: 'beef-tacos-2',
        name: 'Beef Tacos',
        deleted: false,
        like_count: 0,
        collection_count: 0,
        total_user_ratings: 0,
        avg: null,
      },
      {
        id: 'e1',
        slug: 'kale-stew',
        name: 'Kale Stew',
        deleted: false,
        like_count: 0,
        collection_count: 0,
        total_user_ratings: 0,
        avg: null,
      },
      {
        id: 'e2',
        slug: null,
        name: 'Kale Stew',
        deleted: true,
        like_count: 0,
        collection_count: 0,
        total_user_ratings: 0,
        avg: null,
      },
      {
        id: 'z1',
        slug: 'banana-bread-2',
        name: 'Unrelated Soup',
        deleted: false,
        like_count: 0,
        collection_count: 0,
        total_user_ratings: 0,
        avg: null,
      },
    ]);
    expect(await col('SELECT user_id, recipe_id FROM favorites ORDER BY recipe_id')).toEqual([
      { user_id: 'u1', recipe_id: 'a1' },
      { user_id: 'u1', recipe_id: 'd2' },
    ]);
    expect(
      await col('SELECT user_id, recipe_id, rating FROM recipe_ratings ORDER BY user_id')
    ).toEqual([
      { user_id: 'u2', recipe_id: 'a1', rating: 4 },
      { user_id: 'u3', recipe_id: 'a1', rating: 5 },
    ]);
    expect(await col('SELECT recipe_id FROM recipe_comments')).toEqual([{ recipe_id: 'a1' }]);
    expect(
      await col(
        'SELECT right(collection_id::text, 2) AS c, recipe_id FROM collection_recipes ORDER BY 1'
      )
    ).toEqual([
      { c: 'c1', recipe_id: 'a1' },
      { c: 'c2', recipe_id: 'a1' },
    ]);
    // Parent counters recounted from live rows (k2 lost a2's colliding row; ch1 lost b3's).
    expect(await col('SELECT slug, recipe_count FROM collections ORDER BY slug')).toEqual([
      { slug: 'both', recipe_count: 1 },
      { slug: 'mine', recipe_count: 1 },
    ]);
    expect(await col('SELECT slug, recipe_count FROM chefs ORDER BY slug')).toEqual([
      { slug: 'ch1', recipe_count: 1 },
      { slug: 'ch2', recipe_count: 1 },
    ]);
    expect(
      await col(`SELECT id, source FROM recipes WHERE id IN ('b2', 'c1') ORDER BY id`)
    ).toEqual([
      { id: 'b2', source: 'https://example.com/cashew-milk' },
      { id: 'c1', source: 'example.com' },
    ]);
    // The backup table is never re-pointed.
    expect(await col('SELECT recipe_id FROM recipe_embeddings_bak_d57')).toEqual([
      { recipe_id: 'a2' },
    ]);
    expect(
      await col(
        `SELECT recipe_id, to_char(viewed_at, 'MM-DD') AS d FROM recipe_views ORDER BY viewed_at`
      )
    ).toEqual([
      { recipe_id: 'a1', d: '06-01' },
      { recipe_id: 'a1', d: '06-02' },
      { recipe_id: 'a1', d: '06-03' },
      { recipe_id: 'b2', d: '06-04' },
      { recipe_id: 'b2', d: '06-05' },
      { recipe_id: 'b2', d: '06-06' },
      { recipe_id: 'c3', d: '06-07' },
      { recipe_id: 'd1', d: '06-08' },
    ]);
    expect(
      await col(`SELECT recipe_id, date::text AS d FROM recipe_of_the_day ORDER BY date`)
    ).toEqual([
      { recipe_id: 'a1', d: '2026-05-23' },
      { recipe_id: 'd1', d: '2026-05-24' },
    ]);
    expect(await col('SELECT recipe_id FROM recipe_discovery_run_items')).toEqual([
      { recipe_id: 'a1' },
    ]);
    expect(
      await col(
        `SELECT right(chef_id::text, 4) AS chef, recipe_id FROM chef_recipes ORDER BY chef_id`
      )
    ).toEqual([
      { chef: 'c4e1', recipe_id: 'b2' },
      { chef: 'c4e2', recipe_id: 'b2' },
    ]);
    expect(await col('SELECT recipe_id FROM meal_recipes')).toEqual([{ recipe_id: 'c1' }]);
    expect(await col('SELECT recipe_id FROM recipe_tools')).toEqual([{ recipe_id: 'e1' }]);
    expect(
      await col(
        'SELECT from_recipe_id, from_slug, to_recipe_id, batch_id FROM recipe_redirects ORDER BY from_recipe_id'
      )
    ).toEqual([
      { from_recipe_id: 'a2', from_slug: 'banana-bread', to_recipe_id: 'a1', batch_id: 'b-test' },
      { from_recipe_id: 'b1', from_slug: null, to_recipe_id: 'b2', batch_id: 'b-test' },
      { from_recipe_id: 'b3', from_slug: 'cashew-milk-2', to_recipe_id: 'b2', batch_id: 'b-test' },
      { from_recipe_id: 'c2', from_slug: null, to_recipe_id: 'c1', batch_id: 'b-test' },
      { from_recipe_id: 'e2', from_slug: null, to_recipe_id: 'e1', batch_id: 'b-test' },
    ]);
    // Tables the fixture does not reference stay identical.
    for (const t of ['recipe_likes', 'recipe_forks']) expect(after[t]).toEqual(before[t]);
  });

  it('records each change in the ledger, with the full row of each dropped collision', async () => {
    await apply(1);
    await apply(2);
    const kinds = await col(
      `SELECT kind, coalesce(table_name, '') || '.' || coalesce(column_name, '') AS ref, count(*)::int AS n
       FROM dedup_135_ledger GROUP BY 1, 2 ORDER BY 1, 2`
    );
    expect(kinds).toEqual([
      { kind: 'drop', ref: 'chef_recipes.recipe_id', n: 1 },
      { kind: 'drop', ref: 'collection_recipes.recipe_id', n: 1 },
      { kind: 'drop', ref: 'favorites.recipe_id', n: 1 },
      { kind: 'group', ref: '.', n: 4 },
      { kind: 'keeper', ref: 'recipes.', n: 4 },
      { kind: 'move', ref: 'chef_recipes.recipe_id', n: 1 },
      { kind: 'move', ref: 'collection_recipes.recipe_id', n: 1 },
      { kind: 'move', ref: 'meal_recipes.recipe_id', n: 1 },
      { kind: 'move', ref: 'recipe_discovery_run_items.recipe_id', n: 1 },
      { kind: 'move', ref: 'recipe_of_the_day.recipe_id', n: 1 },
      { kind: 'move', ref: 'recipe_ratings.recipe_id', n: 1 },
      { kind: 'move', ref: 'recipe_tools.recipe_id', n: 1 },
      { kind: 'move', ref: 'recipe_views.recipe_id', n: 2 },
      { kind: 'note', ref: 'recipe_embeddings_bak_d57.recipe_id', n: 1 },
      { kind: 'parent', ref: 'chefs.recipe_count', n: 1 },
      { kind: 'parent', ref: 'collections.recipe_count', n: 1 },
      { kind: 'redirect', ref: 'recipe_redirects.', n: 5 },
      { kind: 'soft_delete', ref: 'recipes.', n: 5 },
    ]);
    const [drop] = await col(
      `SELECT row_data->>'user_id' AS u, row_data->>'recipe_id' AS r, old_recipe_id, new_recipe_id
       FROM dedup_135_ledger WHERE kind = 'drop' AND table_name = 'favorites'`
    );
    expect(drop).toEqual({ u: 'u1', r: 'a2', old_recipe_id: 'a2', new_recipe_id: 'a1' });
    const [keeper] = await col(
      `SELECT row_data FROM dedup_135_ledger WHERE kind = 'keeper' AND old_recipe_id = 'a1'`
    );
    expect(keeper?.row_data).toMatchObject({ slug: null, like_count: 7, collection_count: 3 });
    const notes = await col(
      `SELECT row_pk->>'id' AS id, old_recipe_id FROM dedup_135_ledger WHERE kind = 'note'`
    );
    expect(notes).toEqual([{ id: '00000000-0000-0000-0000-0000000000ba', old_recipe_id: 'a2' }]);
  });

  it('a re-run is a no-op', async () => {
    await apply(1);
    await apply(2);
    const state = await snapshot(db);
    const ledger = await ledgerCount();
    const again1 = await apply(1);
    const again2 = await apply(2);
    expect(again1.results.map((r) => r.status)).toEqual(['skipped-applied', 'skipped-applied']);
    expect(again2.results.map((r) => r.status)).toEqual([
      'skipped-no-merge',
      'skipped-applied',
      'skipped-applied',
    ]);
    expect(await snapshot(db)).toEqual(state);
    expect(await ledgerCount()).toBe(ledger);
  });

  it('a no_merge group is untouched and a partial group retires only the listed member', async () => {
    const before = await col(
      `SELECT to_jsonb(r) AS r FROM recipes r WHERE id IN ('d1', 'd2', 'c3')`
    );
    await apply(2);
    expect(
      await col(`SELECT to_jsonb(r) AS r FROM recipes r WHERE id IN ('d1', 'd2', 'c3')`)
    ).toEqual(before);
    expect(await col(`SELECT recipe_id FROM favorites WHERE recipe_id LIKE 'd%'`)).toEqual([
      { recipe_id: 'd2' },
    ]);
    expect(
      await col(`SELECT recipe_id FROM recipe_views WHERE recipe_id IN ('c3', 'd1')`)
    ).toHaveLength(2);
    const redirectsTo = await col(
      `SELECT from_recipe_id FROM recipe_redirects WHERE to_recipe_id = 'c1'`
    );
    expect(redirectsTo).toEqual([{ from_recipe_id: 'c2' }]);
  });

  it('--dry runs every group and rolls back: counts printed, nothing kept', async () => {
    const before = await snapshot(db);
    const r = await apply(1, undefined, { dry: true });
    expect(r.totals).toMatchObject({
      'groups applied': 2,
      'soft-deleted': 2,
      'redirects by id': 2,
    });
    expect(await snapshot(db)).toEqual(before);
    expect(await ledgerCount()).toBe(0);
  });

  it('--limit applies only the first N groups', async () => {
    const r = await apply(1, undefined, { limit: 1 });
    expect(r.results.map((x) => x.status)).toEqual(['applied']);
    expect(
      (await col('SELECT id FROM recipes WHERE deleted_at IS NOT NULL')).map((x) => x.id)
    ).toEqual(['a2']);
  });

  it('a failure after the moves leaves that group fully unapplied, with no ledger rows', async () => {
    const before = await snapshot(db);
    const r = await apply(2, undefined, {
      afterMoves: async (groupId) => {
        if (groupId === signed.ids['cashew milk']) throw new Error('forced failure');
      },
    });
    expect(r.results.map((x) => x.status)).toEqual(['skipped-no-merge', 'failed']);
    expect(r.results[1]?.error).toBe('forced failure');
    expect(await snapshot(db)).toEqual(before);
    expect(await ledgerCount()).toBe(0);
  });
});
