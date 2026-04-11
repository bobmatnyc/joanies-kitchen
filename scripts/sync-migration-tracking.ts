/**
 * Sync Drizzle migration tracking table with applied migrations.
 *
 * The production Neon DB has all schema objects applied manually, but the
 * drizzle.__drizzle_migrations table may be empty. This script reads the
 * migration journal and inserts the correct hashes so future `pnpm db:migrate`
 * calls see that all migrations have already run.
 *
 * Hashes are computed the same way drizzle-orm does internally:
 *   sha256(sqlFileContent) -> hex string
 *
 * Usage:
 *   pnpm tsx scripts/sync-migration-tracking.ts
 *
 * Safe to run multiple times — skips already-tracked hashes.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import * as dotenv from 'dotenv';
import postgres from 'postgres';

// Load .env.local (same as drizzle.config.ts)
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !databaseUrl.startsWith('postgresql://')) {
  throw new Error(
    `DATABASE_URL must be a valid PostgreSQL connection string. Got: ${databaseUrl ?? 'undefined'}`
  );
}

const MIGRATIONS_FOLDER = path.resolve(process.cwd(), 'drizzle');
const JOURNAL_PATH = path.join(MIGRATIONS_FOLDER, 'meta', '_journal.json');

interface JournalEntry {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
}

interface Journal {
  version: string;
  dialect: string;
  entries: JournalEntry[];
}

async function main() {
  console.log('Drizzle Migration Tracking Sync');
  console.log('================================\n');

  // Read journal
  const journal: Journal = JSON.parse(fs.readFileSync(JOURNAL_PATH, 'utf-8'));
  console.log(`Found ${journal.entries.length} migrations in journal.\n`);

  // Connect to Neon
  const client = postgres(databaseUrl as string, { max: 1 });

  try {
    // Ensure the schema and table exist (idempotent — matches drizzle-orm's own DDL)
    await client`CREATE SCHEMA IF NOT EXISTS drizzle`;
    await client`
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `;

    // Check current state
    const existing = await client`
      SELECT hash FROM drizzle.__drizzle_migrations
    `;
    const existingHashes = new Set(existing.map((r) => r.hash as string));

    if (existingHashes.size === 0) {
      console.log('Current state: table is empty — will insert all migrations.\n');
    } else {
      console.log(`Current state: ${existingHashes.size} migration(s) already tracked.\n`);
    }

    // Insert each migration hash
    let inserted = 0;
    let skipped = 0;

    for (const entry of journal.entries) {
      const sqlPath = path.join(MIGRATIONS_FOLDER, `${entry.tag}.sql`);
      const label = `[${String(entry.idx).padStart(2, '0')}] ${entry.tag}`;

      if (!fs.existsSync(sqlPath)) {
        console.warn(`  WARN  ${label} — SQL file not found, skipping`);
        continue;
      }

      const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
      // Drizzle computes hash as sha256 of the raw SQL file content
      const hash = crypto.createHash('sha256').update(sqlContent).digest('hex');

      if (existingHashes.has(hash)) {
        console.log(`  SKIP  ${label}`);
        skipped++;
        continue;
      }

      await client`
        INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
        VALUES (${hash}, ${entry.when})
      `;

      console.log(`  INSERT ${label}  hash=${hash.substring(0, 16)}...`);
      inserted++;
    }

    console.log(`\nResult: ${inserted} inserted, ${skipped} skipped.\n`);

    // Final verification
    const final = await client`
      SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id
    `;
    console.log(`Final __drizzle_migrations row count: ${final.length}`);

    if (final.length !== journal.entries.length) {
      console.warn(
        `\nWARNING: Row count (${final.length}) does not match journal entry count (${journal.entries.length}).`
      );
      console.warn('There may be extra or missing entries — review manually.');
    } else {
      console.log('\nAll migration hashes are now tracked.');
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
