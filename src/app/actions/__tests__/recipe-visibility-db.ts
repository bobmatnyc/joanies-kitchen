/**
 * #32: in-memory Postgres (PGlite) for private-recipe visibility tests.
 *
 * Why: the #32 fixes filter private recipes in SQL. A capturing proxy that
 * returns canned rows cannot show what a WHERE clause admits, so these tests
 * run the real queries against real Postgres semantics.
 * What: builds the named drizzle tables (columns only, no constraints) in a
 * fresh PGlite instance and exposes a drizzle client over it.
 * Test: `src/app/actions/__tests__/private-recipe-visibility.test.ts`
 */

import { PGlite } from '@electric-sql/pglite';
import { is, SQL } from 'drizzle-orm';
import { getTableConfig, type PgColumn, PgDialect, type PgTable } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/pglite';

/** #43: DEFAULT clause for a static or SQL-expression column default; '' when none. */
function defaultClause(column: PgColumn): string {
  const value = column.default as unknown;
  if (!column.hasDefault || value === undefined || value === null) return '';
  if (is(value, SQL)) return ` DEFAULT ${new PgDialect().sqlToQuery(value).sql}`;
  if (typeof value === 'string') return ` DEFAULT '${value.replace(/'/g, "''")}'`;
  if (typeof value === 'number' || typeof value === 'boolean') return ` DEFAULT ${value}`;
  return '';
}

/**
 * `constraints: true` (#43) also emits NOT NULL, PRIMARY KEY, DEFAULT and UNIQUE
 * constraints. Off by default so existing tests keep their constraint-free tables.
 */
export async function createVisibilityDb(
  tables: PgTable[],
  schema: Record<string, unknown>,
  options: { constraints?: boolean } = {}
) {
  const client = new PGlite();
  const enums = new Set<string>();
  for (const table of tables) {
    const config = getTableConfig(table);
    for (const column of config.columns) {
      // pgEnum columns need their type created first.
      const pgEnum = (column as { enum?: { enumName: string; enumValues: string[] } }).enum;
      if (pgEnum && !enums.has(pgEnum.enumName)) {
        enums.add(pgEnum.enumName);
        const values = pgEnum.enumValues.map((v) => `'${v}'`).join(', ');
        await client.exec(`CREATE TYPE "${pgEnum.enumName}" AS ENUM (${values});`);
      }
    }
    const defs = config.columns.map((c) => {
      const base = `"${c.name}" ${c.getSQLType()}`;
      if (!options.constraints) return base;
      // #44: column-level .unique() (e.g. user_profiles.username) is not in config.uniqueConstraints.
      const unique = c.isUnique && !c.primary ? ' UNIQUE' : '';
      return `${base}${c.primary ? ' PRIMARY KEY' : c.notNull ? ' NOT NULL' : ''}${unique}${defaultClause(c)}`;
    });
    if (options.constraints) {
      for (const u of config.uniqueConstraints) {
        const cols = u.columns.map((c) => `"${c.name}"`).join(', ');
        defs.push(`CONSTRAINT "${u.name}" UNIQUE (${cols})`);
      }
    }
    const columns = defs.join(', ');
    await client.exec(`CREATE TABLE "${config.name}" (${columns});`);
  }
  const pgliteDb = drizzle(client, { schema });
  return { client, db: Object.assign(pgliteDb, { batch: pgBatch(client) }) };
}

/**
 * #137: the drizzle pglite driver has no `db.batch`, which neon-http (production)
 * has. This stands in with a real Postgres transaction: BEGIN, run each query
 * builder in order, COMMIT; ROLLBACK and rethrow on the first failure.
 * Callers must not run other queries concurrently on this client.
 */
function pgBatch(client: PGlite) {
  return async (queries: PromiseLike<unknown>[]): Promise<unknown[]> => {
    await client.exec('BEGIN');
    try {
      const results: unknown[] = [];
      for (const query of queries) results.push(await query);
      await client.exec('COMMIT');
      return results;
    } catch (error) {
      await client.exec('ROLLBACK');
      throw error;
    }
  };
}
