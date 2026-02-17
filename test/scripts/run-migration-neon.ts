#!/usr/bin/env tsx

/**
 * Migration Execution Script (Neon Serverless)
 * Runs SQL migrations against the Neon PostgreSQL database using @neondatabase/serverless
 * Usage: tsx scripts/run-migration-neon.ts [migration-file]
 */

import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
} as const;

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function runMigration() {
  const migrationFile = process.argv[2] || 'src/lib/db/migrations/0005_enable_pgvector.sql';
  const migrationPath = path.join(process.cwd(), migrationFile);

  log('\n🚀 Starting migration execution', 'blue');
  log(`📄 Migration file: ${migrationFile}`, 'cyan');

  // Validate environment
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || !databaseUrl.startsWith('postgresql://')) {
    log('❌ ERROR: Invalid DATABASE_URL in .env.local', 'red');
    log(`Current value: ${databaseUrl || 'undefined'}`, 'red');
    process.exit(1);
  }

  // Read migration file
  if (!fs.existsSync(migrationPath)) {
    log(`❌ ERROR: Migration file not found: ${migrationPath}`, 'red');
    process.exit(1);
  }

  const migrationSql = fs.readFileSync(migrationPath, 'utf8');
  log(`✓ Migration file loaded (${migrationSql.length} bytes)`, 'green');

  // Create SQL client
  const sql = neon(databaseUrl);

  try {
    log('\n🔌 Connecting to Neon PostgreSQL...', 'cyan');

    // Check current pgvector status
    log('\n🔍 Checking pgvector extension status...', 'cyan');
    const extCheck = await sql`
      SELECT extname, extversion
      FROM pg_extension
      WHERE extname = 'vector';
    `;

    if (extCheck.length > 0) {
      log(`⚠️  pgvector extension already exists (version ${extCheck[0].extversion})`, 'yellow');
      log('   Migration will skip extension creation', 'yellow');
    } else {
      log('✓ pgvector extension not yet installed', 'green');
    }

    // Execute migration
    log('\n⚡ Executing migration...', 'cyan');
    await sql.unsafe(migrationSql);
    log('✓ Migration executed successfully!', 'green');

    // Verify results
    log('\n🔍 Verifying migration results...', 'cyan');

    // Check pgvector extension
    const extResult = await sql`
      SELECT extname, extversion
      FROM pg_extension
      WHERE extname = 'vector';
    `;
    if (extResult.length > 0) {
      log(`✓ pgvector extension: v${extResult[0].extversion}`, 'green');
    } else {
      log('❌ pgvector extension not found!', 'red');
    }

    // Check recipe_embeddings table
    const tableResult = await sql`
      SELECT table_name, table_type
      FROM information_schema.tables
      WHERE table_name = 'recipe_embeddings';
    `;
    if (tableResult.length > 0) {
      log('✓ recipe_embeddings table created', 'green');
    } else {
      log('❌ recipe_embeddings table not found!', 'red');
    }

    // Check indexes
    const indexResult = await sql`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'recipe_embeddings';
    `;
    log(`✓ Created ${indexResult.length} index(es) on recipe_embeddings:`, 'green');
    indexResult.forEach((row) => {
      log(`  - ${row.indexname}`, 'cyan');
    });

    // Check new columns on recipes table
    const columnResult = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'recipes'
        AND column_name IN ('search_query', 'discovery_date', 'confidence_score', 'validation_model', 'embedding_model');
    `;
    log(`✓ Added ${columnResult.length} new column(s) to recipes table:`, 'green');
    columnResult.forEach((row) => {
      log(`  - ${row.column_name} (${row.data_type})`, 'cyan');
    });

    log('\n✅ Migration completed successfully!', 'green');
    log('🎉 pgvector is now enabled for semantic recipe search', 'green');
  } catch (error: unknown) {
    log('\n❌ Migration failed!', 'red');
    const err = error as Error;
    log(`Error: ${err.message}`, 'red');
    if (error && typeof error === 'object' && 'detail' in error) {
      log(`Detail: ${(error as any).detail}`, 'red');
    }
    if (error && typeof error === 'object' && 'hint' in error) {
      log(`Hint: ${(error as any).hint}`, 'yellow');
    }
    console.error(error);
    process.exit(1);
  }
}

// Run migration
runMigration().catch((error) => {
  log(`\n💥 Unexpected error: ${error.message}`, 'red');
  process.exit(1);
});
