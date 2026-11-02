/**
 * #142: applies the real migration `drizzle/0008_*.sql` to a PGlite test
 * database, so tests exercise the shipped index and its duplicate precheck.
 * The tables come from `createVisibilityDb`, which builds no indexes, so the
 * 0007 index that 0008 drops is created first.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { PGlite } from '@electric-sql/pglite';

const MIGRATION = path.resolve(
  process.cwd(),
  'drizzle/0008_recipes_canonical_source_url_live_unique.sql'
);

/** The 0008 statements in order, split the way the drizzle migrator splits them. */
export function migration0008Statements(): string[] {
  return readFileSync(MIGRATION, 'utf8')
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Creates the 0007 index, then runs 0008 in one transaction, as `drizzle-kit migrate` does. */
export async function applyMigration0008(client: PGlite): Promise<void> {
  await client.exec(
    'CREATE INDEX IF NOT EXISTS "idx_recipes_canonical_source_url" ON "recipes" ("canonical_source_url")'
  );
  await client.exec('BEGIN');
  try {
    for (const statement of migration0008Statements()) await client.exec(statement);
    await client.exec('COMMIT');
  } catch (error) {
    await client.exec('ROLLBACK');
    throw error;
  }
}
