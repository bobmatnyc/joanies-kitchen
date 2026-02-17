#!/usr/bin/env node

/**
 * Migration Execution Script
 * Runs SQL migrations against the Neon PostgreSQL database
 * Usage: node scripts/run-migration.js [migration-file]
 */

const { Client } = require('pg');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function runMigration() {
  const migrationFile = process.argv[2] || 'src/lib/db/migrations/0005_enable_pgvector.sql';
  const migrationPath = path.join(__dirname, '..', migrationFile);

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

  // Connect to database
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    log('\n🔌 Connecting to Neon PostgreSQL...', 'cyan');
    await client.connect();
    log('✓ Connected successfully', 'green');

    // Check current pgvector status
    log('\n🔍 Checking pgvector extension status...', 'cyan');
    const extCheck = await client.query(`
      SELECT extname, extversion
      FROM pg_extension
      WHERE extname = 'vector';
    `);

    if (extCheck.rows.length > 0) {
      log(
        `⚠️  pgvector extension already exists (version ${extCheck.rows[0].extversion})`,
        'yellow'
      );
      log('   Migration will skip extension creation', 'yellow');
    } else {
      log('✓ pgvector extension not yet installed', 'green');
    }

    // Execute migration
    log('\n⚡ Executing migration...', 'cyan');
    await client.query(migrationSql);
    log('✓ Migration executed successfully!', 'green');

    // Verify results
    log('\n🔍 Verifying migration results...', 'cyan');

    // Check pgvector extension
    const extResult = await client.query(`
      SELECT extname, extversion
      FROM pg_extension
      WHERE extname = 'vector';
    `);
    if (extResult.rows.length > 0) {
      log(`✓ pgvector extension: v${extResult.rows[0].extversion}`, 'green');
    } else {
      log('❌ pgvector extension not found!', 'red');
    }

    // Check recipe_embeddings table
    const tableResult = await client.query(`
      SELECT table_name, table_type
      FROM information_schema.tables
      WHERE table_name = 'recipe_embeddings';
    `);
    if (tableResult.rows.length > 0) {
      log('✓ recipe_embeddings table created', 'green');
    } else {
      log('❌ recipe_embeddings table not found!', 'red');
    }

    // Check indexes
    const indexResult = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'recipe_embeddings';
    `);
    log(`✓ Created ${indexResult.rows.length} index(es) on recipe_embeddings:`, 'green');
    indexResult.rows.forEach((row) => {
      log(`  - ${row.indexname}`, 'cyan');
    });

    // Check new columns on recipes table
    const columnResult = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'recipes'
        AND column_name IN ('search_query', 'discovery_date', 'confidence_score', 'validation_model', 'embedding_model');
    `);
    log(`✓ Added ${columnResult.rows.length} new column(s) to recipes table:`, 'green');
    columnResult.rows.forEach((row) => {
      log(`  - ${row.column_name} (${row.data_type})`, 'cyan');
    });

    log('\n✅ Migration completed successfully!', 'green');
    log('🎉 pgvector is now enabled for semantic recipe search', 'green');
  } catch (error) {
    log('\n❌ Migration failed!', 'red');
    log(`Error: ${error.message}`, 'red');
    if (error.detail) {
      log(`Detail: ${error.detail}`, 'red');
    }
    if (error.hint) {
      log(`Hint: ${error.hint}`, 'yellow');
    }
    process.exit(1);
  } finally {
    await client.end();
    log('\n🔌 Database connection closed', 'cyan');
  }
}

// Run migration
runMigration().catch((error) => {
  log(`\n💥 Unexpected error: ${error.message}`, 'red');
  process.exit(1);
});
