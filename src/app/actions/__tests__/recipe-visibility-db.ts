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
import { getTableConfig, type PgTable } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/pglite';

export async function createVisibilityDb(tables: PgTable[], schema: Record<string, unknown>) {
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
    const columns = config.columns.map((c) => `"${c.name}" ${c.getSQLType()}`).join(', ');
    await client.exec(`CREATE TABLE "${config.name}" (${columns});`);
  }
  return { client, db: drizzle(client, { schema }) };
}
