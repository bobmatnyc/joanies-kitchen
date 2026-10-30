// @vitest-environment node
/**
 * #135 (A69): rehearsal checksums are deterministic, independent of row
 * order, change with any row, and match again after apply + rollback.
 */

import type { PGlite } from '@electric-sql/pglite';
import { afterEach, describe, expect, it } from 'vitest';
import { buildPlan } from '../../../../scripts/dedup-135/plan';
import { runApply } from '../dedup-merge-apply';
import { tableChecksums, touchedTables } from '../dedup-merge-checksum';
import { runRollback } from '../dedup-merge-rollback';
import { createMigratedDb } from './dedup-135-db';
import { SEED_SQL, signDryRun, signedDecisions } from './dedup-135-fixture';

const open: PGlite[] = [];
afterEach(async () => {
  for (const d of open.splice(0)) await d.close();
});

async function seeded(): Promise<PGlite> {
  const db = await createMigratedDb();
  open.push(db);
  await db.exec(SEED_SQL);
  return db;
}

describe('rehearsal checksums', () => {
  it('lists the touched tables in name order', async () => {
    const tables = await touchedTables(await seeded());
    expect(tables).toEqual([...tables].sort());
    for (const t of [
      'recipes',
      'recipe_redirects',
      'dedup_135_ledger',
      'chefs',
      'collections',
      'recipe_views',
      'recipe_of_the_day',
      'recipe_discovery_run_items',
      'recipe_embeddings_bak_d57',
    ]) {
      expect(tables).toContain(t);
    }
    expect(tables).not.toContain('recipe_ingredients');
  }, 60_000);

  it('is deterministic and independent of physical row order', async () => {
    const db = await seeded();
    const tables = await touchedTables(db);
    const first = await tableChecksums(db, tables);
    expect(await tableChecksums(db, [...tables].reverse())).toEqual(first);
    // Same rows, rewritten in reverse physical order.
    await db.exec(`CREATE TEMP TABLE v AS SELECT * FROM recipe_views;
      DELETE FROM recipe_views; INSERT INTO recipe_views SELECT * FROM v ORDER BY viewed_at DESC;`);
    expect(await tableChecksums(db, tables)).toEqual(first);
    await db.exec(
      `UPDATE recipe_views SET viewed_at = viewed_at + interval '1 second' WHERE recipe_id = 'd1'`
    );
    const changed = (await tableChecksums(db, tables)).filter(
      (c, i) => c.md5 !== first[i]?.md5 || c.rows !== first[i]?.rows
    );
    expect(changed.map((c) => c.table)).toEqual(['recipe_views']);
  }, 60_000);

  it('matches after apply + rollback on every table but the ledger', async () => {
    const db = await seeded();
    const signed = await signDryRun(db);
    const tables = await touchedTables(db);
    const before = await tableChecksums(db, tables);
    for (const phase of [1, 2] as const) {
      await runApply(
        db,
        {
          signedPlan: signed.plan,
          signedPlanSha256: signed.sha,
          decisionsText: JSON.stringify(signedDecisions(signed)),
          recomputedPlan: await buildPlan(db),
        },
        { batchId: 'b-ck', phase }
      );
    }
    const applied = await tableChecksums(db, tables);
    expect(applied.filter((c, i) => c.md5 !== before[i]?.md5).length).toBeGreaterThan(5);
    await runRollback(db, { batchId: 'b-ck' });
    const after = await tableChecksums(db, tables);
    const differ = after.filter((c, i) => c.md5 !== before[i]?.md5).map((c) => c.table);
    expect(differ).toEqual(['dedup_135_ledger']);
  }, 60_000);
});
