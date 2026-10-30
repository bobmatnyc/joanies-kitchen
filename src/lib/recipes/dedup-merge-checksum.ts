/**
 * #135 (A69 gap 1): row counts and checksums for the rollback rehearsal.
 *
 * Why: the rehearsal (apply then rollback on a Neon branch of prod) passes
 * only if every table the apply touches is back to its original rows; two
 * JSON outputs must diff clean.
 * What: lists the tables the apply touches (every moved recipe column's table,
 * backup tables, recipes, chefs, collections, recipe_redirects and the
 * ledger, whichever exist) and, per table, the row count plus the md5 of the
 * sorted md5s of each row's jsonb text. Sorting by row hash makes the result
 * independent of physical row order. Reads only.
 * Test: `src/lib/recipes/__tests__/dedup-merge-checksum.test.ts`
 */
import { discoverBackupRefs, discoverRecipeRefs, ident, type Queryable } from './dedup-merge-db';
import { PARENT_COUNTERS } from './dedup-merge-group';

export interface TableChecksum {
  table: string;
  rows: number;
  md5: string;
}

const FIXED = ['recipes', 'recipe_redirects', 'dedup_135_ledger'];

/** Sorted, de-duplicated names of the existing tables the apply touches. */
export async function touchedTables(db: Queryable): Promise<string[]> {
  const names = new Set([
    ...FIXED,
    ...PARENT_COUNTERS.map((p) => p.parent),
    ...(await discoverRecipeRefs(db)).map((r) => r.table),
    ...(await discoverBackupRefs(db)).map((r) => r.table),
  ]);
  const out: string[] = [];
  for (const t of [...names].sort()) {
    const { rows } = await db.query<{ t: string | null }>('SELECT to_regclass($1)::text AS t', [
      `public.${t}`,
    ]);
    if (rows[0]?.t) out.push(t);
  }
  return out;
}

export async function tableChecksums(db: Queryable, tables: string[]): Promise<TableChecksum[]> {
  const out: TableChecksum[] = [];
  for (const table of [...tables].sort()) {
    const { rows } = await db.query<{ rows: number; md5: string }>(
      `SELECT count(*)::int AS rows, md5(coalesce(string_agg(h, '' ORDER BY h), '')) AS md5
       FROM (SELECT md5(to_jsonb(t)::text) AS h FROM ${ident(table)} t) s`
    );
    out.push({ table, rows: rows[0]?.rows ?? 0, md5: rows[0]?.md5 ?? '' });
  }
  return out;
}
