// @vitest-environment node
/**
 * #135 (A69): the apply gates — exact pin, signed collision set, survivor
 * owner, recipe_ingredients shortfall with acknowledgement, backup tables, and
 * the batch post-check. Each refusal leaves the group (or run) unapplied.
 */
import type { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildPlan } from '../../../../scripts/dedup-135/plan';
import { type ApplyOptions, runApply } from '../dedup-merge-apply';
import type { DecisionsFile } from '../dedup-merge-decisions';
import { PinError } from '../dedup-merge-pin';
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

async function apply(phase: 1 | 2, opts: Partial<ApplyOptions> = {}, decisions?: DecisionsFile) {
  return runApply(
    db,
    {
      signedPlan: signed.plan,
      signedPlanSha256: signed.sha,
      decisionsText: JSON.stringify(decisions ?? signedDecisions(signed)),
      recomputedPlan: await buildPlan(db),
    },
    { batchId: 'b-gate', phase, ...opts }
  );
}

const ledgerRows = async () =>
  (await db.query<{ n: number }>('SELECT count(*)::int AS n FROM dedup_135_ledger')).rows[0]?.n;
const statusOf = (r: Awaited<ReturnType<typeof apply>>, key: string) =>
  r.results.find((x) => x.groupId === signed.ids[key]);

describe('exact pin', () => {
  it('plan.ts records the chef_recipes collision triples and per-member detail', () => {
    const plan = signed.plan as typeof signed.plan & {
      chefCollisions: Array<{ chefId: string; loserId: string; survivorId: string }>;
    };
    expect(plan.chefCollisions.map((c) => [c.chefId.slice(-4), c.loserId, c.survivorId])).toEqual([
      ['c4e1', 'b3', 'b2'],
    ]);
    expect(plan.memberRefs?.a2).toMatchObject({
      'recipe_views.recipe_id': 1,
      'favorites.recipe_id': 1,
      'recipe_of_the_day.recipe_id': 1,
      'recipe_discovery_run_items.recipe_id': 1,
    });
    expect(plan.memberKeys?.b3).toEqual({
      'chef_recipes.recipe_id#unique_chef_recipe': ['["00000000-0000-0000-0000-00000000c4e1"]'],
    });
  });

  it('stops before any write when a non-views loser count differs by one row', async () => {
    await db.exec(
      `INSERT INTO recipe_tools (recipe_id, tool_id) VALUES ('e2', '00000000-0000-0000-0000-0000000000b1')`
    );
    const before = await snapshot(db);
    const err = await apply(1).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PinError);
    expect((err as PinError).report.problems).toEqual([
      'recipe_tools.recipe_id: 2 rows on post-decision losers now, signed 1 (must match exactly)',
    ]);
    expect(await snapshot(db)).toEqual(before);
    expect(await ledgerRows()).toBe(0);
  });

  it('refuses a signed dry run that predates the per-member detail', async () => {
    const { memberRefs: _r, memberKeys: _k, ...old } = signed.plan;
    signed = { ...signed, plan: old };
    await expect(apply(1)).rejects.toThrow(/no per-member detail/);
  });
});

describe('signed collision set', () => {
  it('stops the group on a collision the dry run did not record', async () => {
    // a2's favorite now collides on u4 instead of u1: same row counts, different key.
    await db.exec(`INSERT INTO favorites (user_id, recipe_id) VALUES ('u4', 'a1');
      UPDATE favorites SET user_id = 'u4' WHERE recipe_id = 'a2';`);
    const before = await snapshot(db);
    const r = await apply(1);
    expect(statusOf(r, 'banana bread')?.status).toBe('failed');
    expect(statusOf(r, 'banana bread')?.error).toMatch(
      /collision not in the signed dry run: favorites/
    );
    expect(await snapshot(db)).toEqual(before);
  });

  it('stops the group when a signed collision does not occur', async () => {
    // b1's chef link moves to a new chef, so b3's ch1 link no longer collides.
    await db.exec(`INSERT INTO chefs (id, slug, name) VALUES ('00000000-0000-0000-0000-00000000c4e3', 'ch3', 'Chef Three');
      UPDATE chef_recipes SET chef_id = '00000000-0000-0000-0000-00000000c4e3' WHERE recipe_id = 'b1';`);
    const r = await apply(2);
    expect(statusOf(r, 'cashew milk')?.error).toMatch(/signed collision\(s\) did not occur/);
  });
});

describe('group step-1 assertions', () => {
  it('stops when the survivor is not system-owned', async () => {
    await db.exec(`UPDATE recipes SET user_id = 'test-user' WHERE id = 'b2'`);
    const r = await apply(2);
    expect(statusOf(r, 'cashew milk')?.error).toBe(
      `${signed.ids['cashew milk']}: survivor b2 is owned by test-user, not system`
    );
  });

  async function shortfall() {
    await db.exec(`INSERT INTO ingredients (id, name, display_name) VALUES
        ('00000000-0000-0000-0000-00000000001a', 'salt', 'Salt'),
        ('00000000-0000-0000-0000-00000000001b', 'bones', 'Bones');
      INSERT INTO recipe_ingredients (recipe_id, ingredient_id) VALUES
        ('c1', '00000000-0000-0000-0000-00000000001a'),
        ('c2', '00000000-0000-0000-0000-00000000001a'),
        ('c2', '00000000-0000-0000-0000-00000000001b');`);
  }

  it('stops when a loser has more recipe_ingredients rows than the survivor', async () => {
    await shortfall();
    const r = await apply(2);
    expect(statusOf(r, 'chicken stock')?.error).toMatch(
      /loser c2 has 2 recipe_ingredients rows, survivor c1 has 1; not listed in ack_fewer_ingredients/
    );
  });

  const ackChickenStock = () => ({
    ...signedDecisions(signed),
    ack_fewer_ingredients: {
      [signed.ids['chicken stock']]: {
        reason_class: 'strict-duplicate',
        survivor: 'c1',
        loser: 'c2',
        reason: 'normalised rows',
      },
    },
  });

  // code-critic MEDIUM: an ack holds only for the row counts the signed dry run recorded.
  it('stops an acknowledged group whose loser gained a recipe_ingredients row since signing', async () => {
    await shortfall();
    signed = await signDryRun(db); // signed with c1 = 1 row, c2 = 2 rows
    await db.exec(`INSERT INTO ingredients (id, name, display_name)
        VALUES ('00000000-0000-0000-0000-00000000001c', 'pepper', 'Pepper');
      INSERT INTO recipe_ingredients (recipe_id, ingredient_id)
        VALUES ('c2', '00000000-0000-0000-0000-00000000001c');`);
    const r = await apply(2, {}, ackChickenStock());
    expect(statusOf(r, 'chicken stock')?.status).toBe('failed');
    expect(statusOf(r, 'chicken stock')?.error).toBe(
      `${signed.ids['chicken stock']}: acknowledged group: c2 has 3 recipe_ingredients rows, the signed dry run recorded 2`
    );
  });

  it('proceeds when the group is acknowledged, and ledgers both counts', async () => {
    await shortfall();
    signed = await signDryRun(db);
    const decisions = {
      ...signedDecisions(signed),
      // The draft decisions file's shape: group id -> { survivor, loser, reason }.
      ack_fewer_ingredients: {
        [signed.ids['chicken stock']]: {
          reason_class: 'strict-duplicate',
          survivor: 'c1',
          loser: 'c2',
          reason: 'normalised rows',
        },
      },
    };
    const r = await apply(2, {}, decisions);
    expect(statusOf(r, 'chicken stock')?.status).toBe('applied');
    const notes = await db.query(
      `SELECT new_recipe_id, row_data FROM dedup_135_ledger
       WHERE kind = 'note' AND table_name = 'recipe_ingredients'`
    );
    expect(notes.rows).toEqual([
      {
        new_recipe_id: 'c1',
        row_data: {
          ack: {
            reason_class: 'strict-duplicate',
            survivor: 'c1',
            loser: 'c2',
            reason: 'normalised rows',
          },
          survivor_rows: 1,
          loser_rows: { c2: 2 },
        },
      },
    ]);
    // The loser keeps its rows.
    const left = await db.query(
      `SELECT count(*)::int AS n FROM recipe_ingredients WHERE recipe_id = 'c2'`
    );
    expect(left.rows).toEqual([{ n: 2 }]);
  });
});

// #135 (rehearsal): (recipe_id, tool_id) is a logical key for recipe_tools, which has none.
describe('recipe_tools logical key', () => {
  async function tools() {
    // Survivor e1 already has the pot that loser e2 holds; e2 also has a pan e1 lacks.
    await db.exec(`INSERT INTO tools (id, name, display_name, category, slug)
        VALUES ('00000000-0000-0000-0000-0000000000b2', 'pan', 'Pan', 'cookware', 'pan');
      INSERT INTO recipe_tools (recipe_id, tool_id) VALUES
        ('e1', '00000000-0000-0000-0000-0000000000b1'),
        ('e2', '00000000-0000-0000-0000-0000000000b2');`);
    signed = await signDryRun(db);
  }
  const rows = async () =>
    (
      await db.query(
        `SELECT recipe_id, right(tool_id::text, 2) AS tool FROM recipe_tools ORDER BY 1, 2`
      )
    ).rows;

  it('plan.ts records the tool collision triple', async () => {
    await tools();
    const plan = signed.plan as typeof signed.plan & {
      toolCollisions: Array<{ toolId: string; loserId: string; survivorId: string }>;
    };
    expect(plan.toolCollisions.map((c) => [c.toolId.slice(-2), c.loserId, c.survivorId])).toEqual([
      ['b1', 'e2', 'e1'],
    ]);
  });

  it('drops and ledgers a duplicate tool, moves the other, and rollback restores both', async () => {
    await tools();
    const before = await snapshot(db);
    const r = await apply(1);
    expect(statusOf(r, 'kale stew')?.status).toBe('applied');
    expect(await rows()).toEqual([
      { recipe_id: 'e1', tool: 'b1' },
      { recipe_id: 'e1', tool: 'b2' },
    ]);
    const drops = await db.query(
      `SELECT old_recipe_id, new_recipe_id, row_data->>'recipe_id' AS r,
         right(row_data->>'tool_id', 2) AS tool
       FROM dedup_135_ledger WHERE kind = 'drop' AND table_name = 'recipe_tools'`
    );
    expect(drops.rows).toEqual([{ old_recipe_id: 'e2', new_recipe_id: 'e1', r: 'e2', tool: 'b1' }]);
    await runRollback(db, { batchId: 'b-gate' });
    expect(await snapshot(db)).toEqual(before);
  });

  it('stops the group when a signed tool drop does not happen', async () => {
    await tools();
    await db.exec(`DELETE FROM recipe_tools WHERE recipe_id = 'e1'`);
    const r = await apply(1);
    expect(statusOf(r, 'kale stew')?.error).toMatch(
      /signed collision\(s\) did not occur: recipe_tools/
    );
  });

  // code-critic BLOCK: a loser listing one tool twice stops the group, whether or not the
  // survivor has that tool; nothing is written and no ledger row is left.
  it.each([
    ['the survivor already has the tool', `('e1', '00000000-0000-0000-0000-0000000000b1'),`],
    ['the survivor lacks the tool', ''],
  ])('stops a loser that lists one tool twice when %s', async (_label, survivorRow) => {
    await db.exec(`INSERT INTO recipe_tools (recipe_id, tool_id) VALUES
      ${survivorRow} ('e2', '00000000-0000-0000-0000-0000000000b1')`);
    signed = await signDryRun(db);
    const kale = async () => ({
      tools: await rows(),
      deleted: (await db.query(`SELECT id FROM recipes WHERE id = 'e2' AND deleted_at IS NOT NULL`))
        .rows,
      ledger: (
        await db.query('SELECT count(*)::int AS n FROM dedup_135_ledger WHERE group_id = $1', [
          signed.ids['kale stew'],
        ])
      ).rows,
    });
    const before = await kale();
    const r = await apply(1);
    expect(statusOf(r, 'kale stew')?.status).toBe('failed');
    expect(statusOf(r, 'kale stew')?.error).toBe(
      `${signed.ids['kale stew']}: loser e2 holds 2 recipe_tools rows with the same (recipe_id, tool_id) key ["00000000-0000-0000-0000-0000000000b1"]; refusing the group`
    );
    expect(await kale()).toEqual(before);
    expect(before.ledger).toEqual([{ n: 0 }]);
  });

  it('stops the group on a tool drop the dry run did not record', async () => {
    await tools();
    // After signing, the survivor gains the pan too: e2's pan would now be dropped.
    await db.exec(`INSERT INTO recipe_tools (recipe_id, tool_id)
      VALUES ('e1', '00000000-0000-0000-0000-0000000000b2')`);
    const r = await apply(1);
    expect(statusOf(r, 'kale stew')?.error).toMatch(
      /collision not in the signed dry run: recipe_tools\.recipe_id#recipe_tools_recipe_id_tool_id_logical/
    );
  });
});

describe('backup tables and post-checks', () => {
  it('runs when the backup table has been dropped', async () => {
    await db.exec('DROP TABLE recipe_embeddings_bak_d57');
    const r = await apply(1);
    expect(r.results.map((x) => x.status)).toEqual(['applied', 'applied']);
  });

  it('a failed post-check stops the run after the batch', async () => {
    const r = await apply(1, {
      batchSize: 1,
      afterMoves: async () => {
        await db.query(`UPDATE recipes SET deleted_at = now() WHERE id = 'z1'`);
      },
    });
    expect(r.results.map((x) => x.status)).toEqual(['applied']);
    expect(r.stopped).toBe('post-check failed: soft-deleted recipes: 2, expected 1');
  });

  it('runs a post-check every batch and at the end', async () => {
    const r = await apply(1, { batchSize: 1 });
    expect(r.stopped).toBeUndefined();
    expect(r.totals['post-checks run']).toBe(2);
  });
});
