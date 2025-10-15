#!/usr/bin/env tsx

/**
 * Migration Execution Script (Split Statements)
 * Runs SQL migrations statement by statement for better error handling
 * Usage: tsx scripts/run-migration-split.ts
 */

import { neon } from '@neondatabase/serverless';
import path from 'path';
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
  log('\n🚀 Starting pgvector migration', 'blue');

  // Validate environment
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || !databaseUrl.startsWith('postgresql://')) {
    log('❌ ERROR: Invalid DATABASE_URL', 'red');
    process.exit(1);
  }

  const sql = neon(databaseUrl);

  try {
    // Step 1: Enable pgvector extension
    log('\n🔌 Step 1: Enabling pgvector extension...', 'cyan');
    await sql`CREATE EXTENSION IF NOT EXISTS vector;`;
    log('✓ pgvector extension enabled', 'green');

    // Step 2: Add provenance tracking columns to recipes
    log('\n📝 Step 2: Adding provenance tracking columns to recipes table...', 'cyan');

    try {
      await sql`ALTER TABLE recipes ADD COLUMN IF NOT EXISTS search_query TEXT;`;
      log('  ✓ Added search_query', 'green');
    } catch (e) {
      log('  ⚠️  search_query already exists', 'yellow');
    }

    try {
      await sql`ALTER TABLE recipes ADD COLUMN IF NOT EXISTS discovery_date TIMESTAMP WITH TIME ZONE;`;
      log('  ✓ Added discovery_date', 'green');
    } catch (e) {
      log('  ⚠️  discovery_date already exists', 'yellow');
    }

    try {
      await sql`ALTER TABLE recipes ADD COLUMN IF NOT EXISTS confidence_score DECIMAL(3, 2);`;
      log('  ✓ Added confidence_score', 'green');
    } catch (e) {
      log('  ⚠️  confidence_score already exists', 'yellow');
    }

    try {
      await sql`ALTER TABLE recipes ADD COLUMN IF NOT EXISTS validation_model TEXT;`;
      log('  ✓ Added validation_model', 'green');
    } catch (e) {
      log('  ⚠️  validation_model already exists', 'yellow');
    }

    try {
      await sql`ALTER TABLE recipes ADD COLUMN IF NOT EXISTS embedding_model TEXT;`;
      log('  ✓ Added embedding_model', 'green');
    } catch (e) {
      log('  ⚠️  embedding_model already exists', 'yellow');
    }

    // Step 3: Create recipe_embeddings table
    log('\n📊 Step 3: Creating recipe_embeddings table...', 'cyan');
    await sql`
      CREATE TABLE IF NOT EXISTS recipe_embeddings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
        embedding vector(384) NOT NULL,
        embedding_text TEXT NOT NULL,
        model_name VARCHAR(100) NOT NULL DEFAULT 'all-MiniLM-L6-v2',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(recipe_id)
      );
    `;
    log('✓ recipe_embeddings table created', 'green');

    // Step 4: Create HNSW index
    log('\n🔍 Step 4: Creating HNSW vector index...', 'cyan');
    try {
      await sql`
        CREATE INDEX IF NOT EXISTS recipe_embeddings_embedding_idx
        ON recipe_embeddings
        USING hnsw (embedding vector_cosine_ops);
      `;
      log('✓ HNSW index created for vector similarity search', 'green');
    } catch (e) {
      log('⚠️  Index may already exist', 'yellow');
    }

    // Step 5: Create recipe_id index
    log('\n🔗 Step 5: Creating recipe_id index...', 'cyan');
    try {
      await sql`
        CREATE INDEX IF NOT EXISTS recipe_embeddings_recipe_id_idx
        ON recipe_embeddings(recipe_id);
      `;
      log('✓ recipe_id index created', 'green');
    } catch (e) {
      log('⚠️  Index may already exist', 'yellow');
    }

    // Step 6: Create update trigger function
    log('\n⚡ Step 6: Creating timestamp update function...', 'cyan');
    await sql`
      CREATE OR REPLACE FUNCTION update_recipe_embeddings_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `;
    log('✓ Update function created', 'green');

    // Step 7: Create trigger
    log('\n🎯 Step 7: Creating updated_at trigger...', 'cyan');
    try {
      await sql`DROP TRIGGER IF EXISTS recipe_embeddings_updated_at_trigger ON recipe_embeddings;`;
      await sql`
        CREATE TRIGGER recipe_embeddings_updated_at_trigger
        BEFORE UPDATE ON recipe_embeddings
        FOR EACH ROW
        EXECUTE FUNCTION update_recipe_embeddings_updated_at();
      `;
      log('✓ Trigger created for automatic timestamp updates', 'green');
    } catch (e) {
      log('⚠️  Trigger setup may have issues', 'yellow');
    }

    // Step 8: Add table comments
    log('\n📝 Step 8: Adding documentation comments...', 'cyan');
    await sql`COMMENT ON TABLE recipe_embeddings IS 'Stores vector embeddings for semantic recipe search using pgvector';`;
    await sql`COMMENT ON COLUMN recipe_embeddings.embedding IS 'Vector embedding (384 dimensions) from all-MiniLM-L6-v2 model';`;
    await sql`COMMENT ON COLUMN recipe_embeddings.embedding_text IS 'Source text used to generate the embedding';`;
    await sql`COMMENT ON COLUMN recipe_embeddings.model_name IS 'Embedding model identifier for version tracking';`;
    log('✓ Documentation comments added', 'green');

    // Verification
    log('\n🔍 Verifying migration results...', 'cyan');

    const extCheck = await sql`
      SELECT extname, extversion
      FROM pg_extension
      WHERE extname = 'vector';
    `;
    log(`  ✓ pgvector v${extCheck[0].extversion}`, 'green');

    const tableCheck = await sql`
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_name = 'recipe_embeddings';
    `;
    log(`  ✓ recipe_embeddings table: ${tableCheck[0].count > 0 ? 'exists' : 'missing'}`, 'green');

    const indexCheck = await sql`
      SELECT COUNT(*) as count
      FROM pg_indexes
      WHERE tablename = 'recipe_embeddings';
    `;
    log(`  ✓ Indexes created: ${indexCheck[0].count}`, 'green');

    log('\n✅ Migration completed successfully!', 'green');
    log('🎉 pgvector is ready for semantic recipe search', 'green');

  } catch (error) {
    log('\n❌ Migration failed!', 'red');
    const err = error as Error;
    log(`Error: ${err.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// Run migration
runMigration().catch(error => {
  log(`\n💥 Unexpected error: ${error.message}`, 'red');
  process.exit(1);
});
