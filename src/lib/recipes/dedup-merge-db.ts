/**
 * #135: database plumbing shared by the merge apply and rollback.
 *
 * Why: apply and rollback run against `pg.Client` in the scripts and PGlite in
 * the tests; both expose `query(sql, params) -> { rows }`.
 * What: the `Queryable` shape, identifier quoting, a per-group transaction
 * helper, and discovery of every column that references a recipe id.
 * Test: `src/lib/recipes/__tests__/dedup-merge-apply.test.ts`
 */

export interface Queryable {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

export const ident = (s: string): string => `"${s.replace(/"/g, '""')}"`;

/** Tables the merge leaves on the loser; the keeper keeps its own rows. */
export const STAY_WITH_LOSER = new Set(['recipe_embeddings', 'recipe_ingredients']);

/**
 * #135 (A69): a backup table (`*_bak_*`, e.g. `recipe_embeddings_bak_d57`) is
 * never re-pointed; a rewritten backup stops being a backup. Apply records its
 * loser rows as ledger notes only.
 */
export const isBackupTable = (table: string): boolean => /_bak_/.test(table);

/**
 * SQL text of a row's unique-key values other than the recipe column, as a
 * jsonb array of text. Plan and apply both use it, so keys compare as strings.
 */
export const otherKeySql = (others: readonly string[], alias: string): string =>
  `jsonb_build_array(${others.map((c) => `${alias}.${ident(c)}::text`).join(', ')})::text`;

/** `table.column#index` names one unique key of one recipe reference. */
export const keyRefName = (table: string, column: string, index: string): string =>
  `${table}.${column}#${index}`;

/** Columns named like a recipe id that are bookkeeping of the merge itself, never data. */
export const MERGE_BOOKKEEPING = new Set([
  'dedup_135_ledger.old_recipe_id',
  'dedup_135_ledger.new_recipe_id',
  'recipe_redirects.from_recipe_id',
]);

export interface UniqueKey {
  name: string;
  columns: string[];
  partial: boolean;
  /** No index enforces it; the merge treats it as unique (`LOGICAL_KEYS`). */
  logical?: boolean;
}

/**
 * #135 (rehearsal): keys the merge treats as unique although no index enforces
 * them. `recipe_tools` has only its primary key, so moving a loser's tool row
 * onto a survivor that already has that `tool_id` would duplicate it. A loser
 * row on such a key is dropped and ledgered, like a unique-key collision.
 */
export const LOGICAL_KEYS: Array<{ table: string; key: UniqueKey }> = [
  {
    table: 'recipe_tools',
    key: {
      name: 'recipe_tools_recipe_id_tool_id_logical',
      columns: ['recipe_id', 'tool_id'],
      partial: false,
      logical: true,
    },
  },
];

/** One column that holds a recipe id and moves from loser to keeper. */
export interface RecipeRef {
  table: string;
  column: string;
  hasFk: boolean;
  pkColumns: string[];
  uniqueKeys: UniqueKey[];
}

/** Runs `fn` inside BEGIN/COMMIT; ROLLBACK and rethrow on failure, or always when `rollback`. */
export async function inTransaction<T>(
  db: Queryable,
  fn: () => Promise<T>,
  opts: { rollback?: boolean } = {}
): Promise<T> {
  await db.query('BEGIN');
  try {
    const out = await fn();
    await db.query(opts.rollback ? 'ROLLBACK' : 'COMMIT');
    return out;
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  }
}

async function primaryKey(db: Queryable, table: string): Promise<string[]> {
  const { rows } = await db.query<{ col: string }>(
    `SELECT a.attname::text AS col
     FROM pg_index i
     JOIN LATERAL unnest(i.indkey::int2[]) WITH ORDINALITY AS k(attnum, ord) ON true
     JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
     WHERE i.indrelid = $1::regclass AND i.indisprimary ORDER BY k.ord`,
    [table]
  );
  return rows.map((r) => r.col);
}

async function uniqueKeys(db: Queryable, table: string, column: string): Promise<UniqueKey[]> {
  const { rows } = await db.query<{ name: string; cols: string[]; partial: boolean }>(
    `SELECT i.indexrelid::regclass::text AS name, i.indpred IS NOT NULL AS partial,
       array_agg(a.attname::text ORDER BY k.ord) AS cols
     FROM pg_index i
     JOIN LATERAL unnest(i.indkey::int2[]) WITH ORDINALITY AS k(attnum, ord) ON true
     JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
     WHERE i.indrelid = $1::regclass AND i.indisunique AND NOT i.indisprimary
       AND NOT (0 = ANY(i.indkey::int2[]))
     GROUP BY 1, 2 ORDER BY 1`,
    [table]
  );
  const real = rows
    .filter((r) => r.cols.includes(column))
    .map((r) => ({ name: r.name, columns: r.cols, partial: r.partial }));
  const { rows: cols } = await db.query<{ col: string }>(
    `SELECT attname::text AS col FROM pg_attribute
     WHERE attrelid = $1::regclass AND attnum > 0 AND NOT attisdropped`,
    [table]
  );
  const have = new Set(cols.map((c) => c.col));
  const logical = LOGICAL_KEYS.filter(
    (l) =>
      l.table === table && l.key.columns.includes(column) && l.key.columns.every((c) => have.has(c))
  ).map((l) => l.key);
  return [...real, ...logical];
}

/**
 * Every FK column to `recipes.id`, plus public columns named `*recipe_id`
 * without an FK (text references such as `recipe_discovery_run_items`), minus
 * `STAY_WITH_LOSER` tables and `MERGE_BOOKKEEPING` columns. Same discovery as
 * the dry run (`scripts/dedup-135/plan.ts`).
 */
export async function discoverRecipeRefs(db: Queryable): Promise<RecipeRef[]> {
  return (await discoverAllRefs(db)).filter(
    (r) => !STAY_WITH_LOSER.has(r.table) && !isBackupTable(r.table)
  );
}

/** Backup-table recipe columns (`isBackupTable`); empty when none exist. */
export async function discoverBackupRefs(db: Queryable): Promise<RecipeRef[]> {
  return (await discoverAllRefs(db)).filter((r) => isBackupTable(r.table));
}

/** Every recipe-id column, including tables that stay with the loser and backups. */
export async function discoverAllRefs(db: Queryable): Promise<RecipeRef[]> {
  const { rows: fks } = await db.query<{ tbl: string; col: string }>(
    `SELECT c.conrelid::regclass::text AS tbl, a.attname::text AS col
     FROM pg_constraint c
     JOIN LATERAL unnest(c.conkey) AS u(attnum) ON true
     JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = u.attnum
     WHERE c.contype = 'f' AND c.confrelid = 'public.recipes'::regclass
     ORDER BY 1, 2`
  );
  const fkSet = new Set(fks.map((f) => `${f.tbl}.${f.col}`));
  const { rows: named } = await db.query<{ tbl: string; col: string }>(
    `SELECT table_name::text AS tbl, column_name::text AS col FROM information_schema.columns
     WHERE table_schema = 'public' AND column_name ~ 'recipe_id$' AND table_name <> 'recipes'
     ORDER BY 1, 2`
  );
  const candidates = [
    ...fks.map((f) => ({ ...f, hasFk: true })),
    ...named.filter((c) => !fkSet.has(`${c.tbl}.${c.col}`)).map((c) => ({ ...c, hasFk: false })),
  ].filter((c) => !MERGE_BOOKKEEPING.has(`${c.tbl}.${c.col}`));
  const refs: RecipeRef[] = [];
  for (const c of candidates) {
    refs.push({
      table: c.tbl,
      column: c.col,
      hasFk: c.hasFk,
      pkColumns: await primaryKey(db, c.tbl),
      uniqueKeys: await uniqueKeys(db, c.tbl, c.col),
    });
  }
  return refs;
}

/** SQL for a jsonb object of the row's primary key, e.g. `jsonb_build_object('id', x."id")`. */
export const pkJsonSql = (pk: readonly string[], alias: string): string =>
  `jsonb_build_object(${pk.map((c) => `'${c}', ${alias}.${ident(c)}`).join(', ')})`;

/** SQL matching `alias`'s primary key against a jsonb pk expression. */
export const pkMatchSql = (pk: readonly string[], alias: string, json: string): string =>
  pk.map((c) => `${alias}.${ident(c)}::text = (${json})->>'${c}'`).join(' AND ');
