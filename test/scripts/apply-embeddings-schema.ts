#!/usr/bin/env tsx

/**
 * Apply Meals and Chefs Embeddings Schema Migration
 *
 * Creates tables and indexes for meals_embeddings and chefs_embeddings
 * with HNSW vector indexes for efficient similarity search.
 *
 * This script:
 * 1. Creates meals_embeddings table with pgvector support
 * 2. Creates chefs_embeddings table with pgvector support
 * 3. Creates HNSW indexes for vector similarity search
 * 4. Creates supporting indexes for foreign keys and timestamps
 *
 * Usage:
 *   npx tsx scripts/apply-embeddings-schema.ts                # Dry run (default)
 *   npx tsx scripts/apply-embeddings-schema.ts --execute      # Apply changes
 */

import * as path from 'node:path';
import * as dotenv from 'dotenv';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const DRY_RUN = !process.argv.includes('--execute');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function checkTableExists(tableName: string): Promise<boolean> {
  try {
    const result = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = ${tableName}
      );
    `);
    return result.rows[0]?.exists === true;
  } catch (_error) {
    return false;
  }
}

async function checkIndexExists(indexName: string): Promise<boolean> {
  try {
    const result = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM pg_indexes
        WHERE schemaname = 'public'
        AND indexname = ${indexName}
      );
    `);
    return result.rows[0]?.exists === true;
  } catch (_error) {
    return false;
  }
}

async function main() {
  log(`\n${'='.repeat(80)}`, colors.bright);
  log('MEALS AND CHEFS EMBEDDINGS SCHEMA MIGRATION', colors.bright);
  log(`${'='.repeat(80)}\n`, colors.bright);

  if (DRY_RUN) {
    log('⚠️  DRY RUN MODE - No changes will be applied', colors.yellow);
    log('   Use --execute flag to apply changes', colors.yellow);
  } else {
    log('🚀 EXECUTE MODE - Changes will be applied', colors.green);
  }

  // Check for pgvector extension
  log('\n🔍 Checking database prerequisites...', colors.cyan);
  try {
    const vectorCheck = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM pg_extension WHERE extname = 'vector'
      );
    `);
    const hasVector = vectorCheck.rows[0]?.exists === true;

    if (!hasVector) {
      log('❌ pgvector extension not installed', colors.red);
      log('   Run: CREATE EXTENSION vector; in your database', colors.yellow);
      process.exit(1);
    }
    log('✅ pgvector extension found', colors.green);
  } catch (error) {
    log(`❌ Failed to check pgvector extension: ${error}`, colors.red);
    process.exit(1);
  }

  // Check if tables already exist
  const mealsEmbeddingsExists = await checkTableExists('meals_embeddings');
  const chefsEmbeddingsExists = await checkTableExists('chefs_embeddings');

  log('\n📊 Current State:', colors.cyan);
  log(
    `  meals_embeddings table: ${mealsEmbeddingsExists ? '✅ EXISTS' : '❌ MISSING'}`,
    mealsEmbeddingsExists ? colors.green : colors.yellow
  );
  log(
    `  chefs_embeddings table: ${chefsEmbeddingsExists ? '✅ EXISTS' : '❌ MISSING'}`,
    chefsEmbeddingsExists ? colors.green : colors.yellow
  );

  if (mealsEmbeddingsExists && chefsEmbeddingsExists) {
    log('\n✅ All tables already exist. No migration needed.', colors.green);

    // Check if HNSW indexes exist
    log('\n🔍 Checking vector indexes...', colors.cyan);
    const mealsHnswExists = await checkIndexExists('meals_embeddings_embedding_idx');
    const chefsHnswExists = await checkIndexExists('chefs_embeddings_embedding_idx');

    log(
      `  meals HNSW index: ${mealsHnswExists ? '✅ EXISTS' : '❌ MISSING'}`,
      mealsHnswExists ? colors.green : colors.yellow
    );
    log(
      `  chefs HNSW index: ${chefsHnswExists ? '✅ EXISTS' : '❌ MISSING'}`,
      chefsHnswExists ? colors.green : colors.yellow
    );

    if (!mealsHnswExists || !chefsHnswExists) {
      log(
        '\n⚠️  HNSW indexes missing. Consider creating them for better performance.',
        colors.yellow
      );
      log('   See: scripts/create-hnsw-index.ts', colors.blue);
    }

    process.exit(0);
  }

  log('\n📝 Migration Steps:', colors.cyan);
  if (!mealsEmbeddingsExists) {
    log('  1. Create meals_embeddings table', colors.blue);
    log('  2. Create meals_embeddings indexes', colors.blue);
    log('  3. Create meals_embeddings HNSW vector index', colors.blue);
  }
  if (!chefsEmbeddingsExists) {
    log('  4. Create chefs_embeddings table', colors.blue);
    log('  5. Create chefs_embeddings indexes', colors.blue);
    log('  6. Create chefs_embeddings HNSW vector index', colors.blue);
  }

  if (DRY_RUN) {
    log('\n💡 This is a dry run. Run with --execute to apply changes.', colors.yellow);
    process.exit(0);
  }

  // Confirm before applying
  log(`\n⚠️  CONFIRMATION REQUIRED`, colors.yellow);
  log(`   This will modify your database schema`, colors.yellow);
  log(`   Press Ctrl+C to cancel, or wait 5 seconds to continue...`, colors.yellow);
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Apply migrations
  log(`\n${'='.repeat(80)}`, colors.cyan);
  log('🚀 Applying migrations...', colors.cyan);
  log('='.repeat(80), colors.cyan);

  try {
    // Create meals_embeddings table
    if (!mealsEmbeddingsExists) {
      log('\n1️⃣  Creating meals_embeddings table...', colors.blue);
      await db.execute(sql`
        CREATE TABLE meals_embeddings (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          meal_id UUID NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
          embedding vector(384) NOT NULL,
          embedding_text TEXT NOT NULL,
          model_name VARCHAR(100) NOT NULL DEFAULT 'BAAI/bge-small-en-v1.5',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);
      log('✅ meals_embeddings table created', colors.green);

      log('   Creating indexes...', colors.blue);
      await db.execute(sql`
        CREATE INDEX meals_embeddings_meal_id_idx ON meals_embeddings(meal_id);
      `);
      await db.execute(sql`
        CREATE INDEX meals_embeddings_created_at_idx ON meals_embeddings(created_at DESC);
      `);
      log('✅ Standard indexes created', colors.green);

      log('   Creating HNSW vector index (this may take a few moments)...', colors.blue);
      await db.execute(sql`
        CREATE INDEX meals_embeddings_embedding_idx
        ON meals_embeddings
        USING hnsw (embedding vector_cosine_ops);
      `);
      log('✅ HNSW vector index created', colors.green);
    }

    // Create chefs_embeddings table
    if (!chefsEmbeddingsExists) {
      log('\n2️⃣  Creating chefs_embeddings table...', colors.blue);
      await db.execute(sql`
        CREATE TABLE chefs_embeddings (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          chef_id UUID NOT NULL REFERENCES chefs(id) ON DELETE CASCADE,
          embedding vector(384) NOT NULL,
          embedding_text TEXT NOT NULL,
          model_name VARCHAR(100) NOT NULL DEFAULT 'BAAI/bge-small-en-v1.5',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);
      log('✅ chefs_embeddings table created', colors.green);

      log('   Creating indexes...', colors.blue);
      await db.execute(sql`
        CREATE INDEX chefs_embeddings_chef_id_idx ON chefs_embeddings(chef_id);
      `);
      await db.execute(sql`
        CREATE INDEX chefs_embeddings_created_at_idx ON chefs_embeddings(created_at DESC);
      `);
      log('✅ Standard indexes created', colors.green);

      log('   Creating HNSW vector index (this may take a few moments)...', colors.blue);
      await db.execute(sql`
        CREATE INDEX chefs_embeddings_embedding_idx
        ON chefs_embeddings
        USING hnsw (embedding vector_cosine_ops);
      `);
      log('✅ HNSW vector index created', colors.green);
    }

    log(`\n${'='.repeat(80)}`, colors.bright);
    log('✅ MIGRATION COMPLETE', colors.bright);
    log('='.repeat(80), colors.bright);

    log('\n📊 Final State:', colors.cyan);
    log('  ✅ meals_embeddings table created', colors.green);
    log('  ✅ chefs_embeddings table created', colors.green);
    log('  ✅ All indexes created (including HNSW)', colors.green);

    log('\n💡 Next Steps:', colors.cyan);
    log('  1. Generate embeddings for meals:', colors.blue);
    log('     npx tsx scripts/generate-meal-embeddings.ts --execute', colors.blue);
    log('  2. Generate embeddings for chefs:', colors.blue);
    log('     npx tsx scripts/generate-chef-embeddings.ts --execute', colors.blue);

    process.exit(0);
  } catch (error: any) {
    log(`\n❌ Migration failed: ${error.message}`, colors.red);
    console.error(error);
    process.exit(1);
  }
}

main().catch((error) => {
  log(`\n❌ Fatal error: ${error.message}`, colors.red);
  console.error(error);
  process.exit(1);
});
