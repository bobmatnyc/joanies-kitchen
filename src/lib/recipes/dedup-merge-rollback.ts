/**
 * #135: reverse a merge batch from `dedup_135_ledger`.
 *
 * Why: rollback option A in the step plan only clears `deleted_at`; this
 * restores everything the apply changed, without the snapshot restore (B).
 * What: per group (newest first), one transaction that walks the group's live
 * ledger entries in reverse id order: deletes the redirect rows, restores the
 * keeper's prior slug/name/source/counters, restores each loser's prior
 * `deleted_at`, restores parent counters (chefs, collections), moves rows back
 * (recipe_of_the_day and recipe_discovery_run_items included), re-inserts
 * dropped rows from their stored JSON, skips notes, then marks
 * the entries `rolled_back_at`. Every restore runs in SQL from the stored
 * jsonb, so values never round-trip through JavaScript numbers.
 * Test: `src/lib/recipes/__tests__/dedup-merge-rollback.test.ts`
 */
import { ident, inTransaction, pkMatchSql, type Queryable } from './dedup-merge-db';

export interface RollbackOptions {
  batchId: string;
  groupId?: string;
  /** Run the reversal, then roll it back. */
  dry?: boolean;
}

export interface RollbackGroupResult {
  groupId: string;
  reversed: Record<string, number>;
}

interface Entry {
  id: number;
  kind: string;
  table_name: string | null;
  column_name: string | null;
  row_pk: Record<string, unknown> | null;
  old_recipe_id: string | null;
  new_recipe_id: string | null;
}

/**
 * #135 (code-critic MEDIUM): counters are reversed by difference,
 * `c = c + (before - after)`, never written back as a snapshot. A recount from
 * child rows was rejected: a stored counter that had already drifted from its
 * rows before the apply would come back "corrected", not as it was. The
 * difference restores the exact prior value when nothing else touched the
 * counter, and composes when groups sharing a parent are rolled back in any
 * order. `avg_user_rating` cannot be differenced: it is restored only if it
 * still holds the value the apply wrote, and otherwise left as it is.
 */
const KEEPER_INT_COUNTERS = ['like_count', 'fork_count', 'collection_count', 'total_user_ratings'];

/** `before - after` added to the live value; a NULL `before` restores NULL when unchanged. */
const relative = (col: string, live: string, before: string, after: string) =>
  `CASE WHEN ${before} IS NULL THEN (CASE WHEN ${live} IS NOT DISTINCT FROM ${after} THEN NULL ELSE ${live} END)
     ELSE ${live} + (${before} - ${after}) END`;

/** Fails unless exactly one row changed; a mismatch means the data moved since apply. */
async function one(db: Queryable, sql: string, params: unknown[], what: string): Promise<void> {
  const { rows } = await db.query<{ n: number }>(
    `WITH c AS (${sql} RETURNING 1) SELECT count(*)::int AS n FROM c`,
    params
  );
  if (rows[0]?.n !== 1)
    throw new Error(`rollback: ${what} matched ${rows[0]?.n ?? 0} rows, expected 1`);
}

const ledgerRecord = (table: string) =>
  `(SELECT p FROM dedup_135_ledger l, jsonb_populate_record(NULL::${ident(table)}, l.row_data) p WHERE l.id = $1)`;

async function reverse(db: Queryable, e: Entry, batchId: string): Promise<void> {
  const where = `ledger entry ${e.id} (${e.kind} ${e.table_name ?? ''}.${e.column_name ?? ''})`;
  switch (e.kind) {
    case 'group':
    case 'note':
      return;
    case 'parent': {
      if (!e.table_name || !e.column_name) throw new Error(`rollback: malformed ${where}`);
      const c = ident(e.column_name);
      const before = `(l.row_data->>'${e.column_name}')::int`;
      const after = `(l.row_data->>'after')::int`;
      return one(
        db,
        `UPDATE ${ident(e.table_name)} x SET ${c} = ${relative(c, `x.${c}`, before, after)}
         FROM dedup_135_ledger l
         WHERE l.id = $1 AND l.row_data ? 'after' AND x.id::text = l.row_pk->>'id'`,
        [e.id],
        where
      );
    }
    case 'redirect':
      return one(
        db,
        'DELETE FROM recipe_redirects WHERE from_recipe_id = $1 AND to_recipe_id = $2 AND batch_id = $3',
        [e.old_recipe_id, e.new_recipe_id, batchId],
        where
      );
    case 'keeper': {
      const ints = KEEPER_INT_COUNTERS.map(
        (c) => `${c} = ${relative(c, `x.${c}`, `p.${c}`, `a.${c}`)}`
      ).join(',\n           ');
      return one(
        db,
        `UPDATE recipes x SET slug = p.slug, name = p.name, source = p.source,
           ${ints},
           avg_user_rating = CASE WHEN x.avg_user_rating IS NOT DISTINCT FROM a.avg_user_rating
             THEN p.avg_user_rating ELSE x.avg_user_rating END
         FROM dedup_135_ledger l,
           jsonb_populate_record(NULL::recipes, l.row_data) p,
           jsonb_populate_record(NULL::recipes, l.row_data->'after') a
         WHERE l.id = $1 AND l.row_data ? 'after' AND x.id = $2`,
        [e.id, e.old_recipe_id],
        where
      );
    }
    case 'soft_delete':
      return one(
        db,
        `UPDATE recipes SET deleted_at = (${ledgerRecord('recipes')}).deleted_at WHERE id = $2`,
        [e.id, e.old_recipe_id],
        where
      );
    case 'move': {
      if (!e.table_name || !e.column_name || !e.row_pk)
        throw new Error(`rollback: malformed ${where}`);
      const pk = Object.keys(e.row_pk);
      const match = pkMatchSql(pk, 'x', '(SELECT row_pk FROM dedup_135_ledger WHERE id = $1)');
      const c = ident(e.column_name);
      return one(
        db,
        `UPDATE ${ident(e.table_name)} x SET ${c} = $2 WHERE ${match} AND x.${c}::text = $3`,
        [e.id, e.old_recipe_id, e.new_recipe_id],
        where
      );
    }
    case 'drop': {
      if (!e.table_name) throw new Error(`rollback: malformed ${where}`);
      const t = ident(e.table_name);
      return one(
        db,
        `INSERT INTO ${t} SELECT (jsonb_populate_record(NULL::${t}, l.row_data)).*
         FROM dedup_135_ledger l WHERE l.id = $1`,
        [e.id],
        where
      );
    }
    default:
      throw new Error(`rollback: unknown kind in ${where}`);
  }
}

/**
 * Why: the batch's only exact undo short of the snapshot.
 * What: reverses every live group of `batchId` (or just `groupId`), newest
 * group first, each in its own transaction; throws on the first entry that no
 * longer matches the data, leaving that group untouched.
 * Test: `dedup-merge-rollback.test.ts`
 */
export async function runRollback(
  db: Queryable,
  opts: RollbackOptions
): Promise<RollbackGroupResult[]> {
  const { rows: groups } = await db.query<{ group_id: string }>(
    `SELECT group_id FROM dedup_135_ledger
     WHERE batch_id = $1 AND rolled_back_at IS NULL AND ($2::text IS NULL OR group_id = $2)
     GROUP BY group_id ORDER BY max(id) DESC`,
    [opts.batchId, opts.groupId ?? null]
  );
  const results: RollbackGroupResult[] = [];
  for (const { group_id: groupId } of groups) {
    const reversed = await inTransaction(
      db,
      async () => {
        const { rows: entries } = await db.query<Entry>(
          `SELECT id::int AS id, kind, table_name, column_name, row_pk, old_recipe_id, new_recipe_id
           FROM dedup_135_ledger
           WHERE batch_id = $1 AND group_id = $2 AND rolled_back_at IS NULL
           ORDER BY id DESC FOR UPDATE`,
          [opts.batchId, groupId]
        );
        const counts: Record<string, number> = {};
        for (const e of entries) {
          await reverse(db, e, opts.batchId);
          const key = e.table_name && e.kind !== 'group' ? `${e.kind} ${e.table_name}` : e.kind;
          counts[key] = (counts[key] ?? 0) + 1;
        }
        await db.query(
          `UPDATE dedup_135_ledger SET rolled_back_at = now()
           WHERE batch_id = $1 AND group_id = $2 AND rolled_back_at IS NULL`,
          [opts.batchId, groupId]
        );
        return counts;
      },
      { rollback: opts.dry }
    );
    results.push({ groupId, reversed });
  }
  return results;
}
