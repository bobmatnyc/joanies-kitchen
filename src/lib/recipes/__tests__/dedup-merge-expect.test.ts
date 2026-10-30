// @vitest-environment node
/**
 * #135 (A69): the expectations computed from the signed dry run + decisions
 * equal what the apply then does, figure by figure, and the comparison with
 * an expected-counts file reports matches, mismatches and gaps.
 */
import type { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { comparisons } from '../../../../scripts/dedup-135/expect';
import { buildPlan } from '../../../../scripts/dedup-135/plan';
import { runApply } from '../dedup-merge-apply';
import { resolveGroups, validateDecisions } from '../dedup-merge-decisions';
import { type ExpectPlan, expectFromSigned } from '../dedup-merge-expect';
import { createMigratedDb } from './dedup-135-db';
import { SEED_SQL, type Signed, signDryRun, signedDecisions } from './dedup-135-fixture';

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

const expectations = () => {
  const plan = signed.plan as ExpectPlan;
  const file = validateDecisions(signedDecisions(signed), plan.groups, signed.sha);
  return expectFromSigned(plan, resolveGroups(plan.groups, file));
};
const one = async (sql: string) => Number(Object.values((await db.query(sql)).rows[0] ?? {})[0]);

describe('expectFromSigned', () => {
  it('reproduces what the apply does', async () => {
    const e = expectations();
    for (const phase of [1, 2] as const) {
      await runApply(
        db,
        {
          signedPlan: signed.plan,
          signedPlanSha256: signed.sha,
          decisionsText: JSON.stringify(signedDecisions(signed)),
          recomputedPlan: await buildPlan(db),
        },
        { batchId: 'b-x', phase }
      );
    }
    expect([e.losers, e.losersPhase1, e.losersPhase2, e.groupsWithLosers]).toEqual([5, 2, 3, 4]);
    expect(e.notDerivable).toEqual([]);
    expect(e.softDeleted).toBe(
      await one('SELECT count(*) FROM recipes WHERE deleted_at IS NOT NULL')
    );
    expect(e.liveAfter).toBe(await one('SELECT count(*) FROM recipes WHERE deleted_at IS NULL'));
    expect(e.redirectsById).toBe(await one('SELECT count(*) FROM recipe_redirects'));
    expect(e.redirectsBySlug).toBe(await one('SELECT count(from_slug) FROM recipe_redirects'));
    expect(e.keepersNullSlug).toBe(
      await one(
        `SELECT count(*) FROM dedup_135_ledger WHERE kind = 'keeper' AND row_data->>'slug' IS NULL`
      )
    );
    // Per table: rows moved + rows dropped (moved tables), or rows noted (backups).
    const { rows } = await db.query<{ ref: string; n: number }>(
      `SELECT table_name || '.' || column_name AS ref, count(*)::int AS n FROM dedup_135_ledger
       WHERE kind IN ('move', 'drop') OR (kind = 'note' AND row_pk IS NOT NULL) GROUP BY 1`
    );
    const done = Object.fromEntries(rows.map((r) => [r.ref, r.n]));
    const expected = Object.fromEntries(
      Object.entries(e.tables ?? {}).filter(
        ([ref]) => !/^recipe_(embeddings|ingredients)\./.test(ref)
      )
    );
    expect(done).toEqual(expected);
    expect(e.views).toBe(done['recipe_views.recipe_id']);
    expect(e.recipeOfTheDay).toBe(done['recipe_of_the_day.recipe_id']);
    expect(e.discoveryRunItems).toBe(done['recipe_discovery_run_items.recipe_id']);
    const drops = await db.query<{ ref: string; n: number }>(
      `SELECT table_name AS ref, count(*)::int AS n FROM dedup_135_ledger WHERE kind = 'drop' GROUP BY 1 ORDER BY 1`
    );
    expect(drops.rows).toEqual([
      { ref: 'chef_recipes', n: e.collisions?.['chef_recipes.recipe_id#unique_chef_recipe'] },
      {
        ref: 'collection_recipes',
        n: e.collisions?.['collection_recipes.recipe_id#collection_recipes_unique'],
      },
      { ref: 'favorites', n: e.collisions?.['favorites.recipe_id#favorites_unique'] },
    ]);
  });

  it('a dry run without per-member detail reports the gap instead of guessing', () => {
    const { memberRefs: _r, memberKeys: _k, ...old } = signed.plan;
    signed = { ...signed, plan: old };
    const e = expectations();
    expect(e.tables).toBeNull();
    expect(e.notDerivable).toEqual([
      // c2 had the most user refs, so it was the rules keeper; the decision retires it.
      'recipeOfTheDay/discoveryRunItems omit rows on 1 loser(s) that were rules keepers: c2',
      'per-table counts and collisions: the dry run has no per-member detail (memberRefs/memberKeys)',
    ]);
    const rows = comparisons(e, { tables: { 'favorites.recipe_id': { loser_rows: 1 } } });
    expect(rows.find(([l]) => l === 'favorites.recipe_id loser rows')).toEqual([
      'favorites.recipe_id loser rows',
      null,
      1,
    ]);
  });

  it('comparisons line up each figure with the expected-counts file', () => {
    const e = expectations();
    const rows = comparisons(e, {
      basis: { losers: 5, losers_phase1: 2, losers_phase2: 3, groups_with_losers: 4 },
      redirects: { by_id: 5, by_slug: 2, keepers_with_null_slug: 99 },
      chef_recipes: { collisions: 1 },
    });
    const get = (label: string) => rows.find(([l]) => l === label);
    expect(get('losers')).toEqual(['losers', 5, 5]);
    expect(get('redirects by slug')).toEqual(['redirects by slug', 2, 2]);
    expect(get('survivors with NULL slug')).toEqual(['survivors with NULL slug', 2, 99]);
    expect(get('chef_recipes collisions')).toEqual(['chef_recipes collisions', 1, 1]);
  });
});
