/**
 * #135: PGlite database built from the repo's real drizzle migrations.
 *
 * Why: the merge discovers dependent tables from `pg_constraint` and relies on
 * real unique keys and FKs, so a constraint-free fixture would prove nothing.
 * What: applies every migration in `drizzle/meta/_journal.json` (0005 creates
 * `recipe_redirects` and `dedup_135_ledger`) to a fresh PGlite with pg_trgm.
 * PGlite ships no pgvector, so three substitutions apply: the
 * `CREATE EXTENSION vector` line is dropped, `vector(384)` becomes `real[]`,
 * and a `USING hnsw` index statement (#131, 0006) is skipped.
 * Test: `dedup-merge-apply.test.ts`, `dedup-merge-rollback.test.ts`
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';

const DRIZZLE_DIR = path.resolve(__dirname, '../../../../drizzle');

export async function createMigratedDb(): Promise<PGlite> {
  const db = new PGlite({ extensions: { pg_trgm } });
  const journal = JSON.parse(
    readFileSync(path.join(DRIZZLE_DIR, 'meta/_journal.json'), 'utf8')
  ) as {
    entries: Array<{ tag: string }>;
  };
  for (const { tag } of journal.entries) {
    const raw = readFileSync(path.join(DRIZZLE_DIR, `${tag}.sql`), 'utf8');
    const text = raw
      .replace(/^CREATE EXTENSION IF NOT EXISTS vector;/m, '')
      .replace(/vector\(384\)/g, 'real[]');
    for (const stmt of text.split('--> statement-breakpoint')) {
      // #131: PGlite has no hnsw access method; the index changes no data.
      if (stmt.trim() && !/USING hnsw/.test(stmt)) await db.exec(stmt);
    }
  }
  return db;
}
