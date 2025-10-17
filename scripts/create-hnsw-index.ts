#!/usr/bin/env tsx

/**
 * Create HNSW Index for Vector Similarity Search
 *
 * Creates an HNSW (Hierarchical Navigable Small World) index on the
 * recipe_embeddings table for efficient vector similarity search.
 *
 * HNSW Index Parameters:
 * - m = 16: Number of bi-directional links per node
 *   Higher values increase accuracy but use more memory
 *   Recommended range: 4-64, default: 16
 *
 * - ef_construction = 64: Quality of index construction
 *   Higher values produce better indexes but take longer to build
 *   Recommended range: 16-512, default: 64
 *
 * Vector Operator Class:
 * - vector_cosine_ops: Cosine similarity (1 - cosine distance)
 *   Best for normalized embeddings, measures angle between vectors
 *
 * Alternative operators (comment/uncomment as needed):
 * - vector_l2_ops: Euclidean distance (L2)
 * - vector_ip_ops: Inner product (dot product)
 */

import postgres from 'postgres';
import 'dotenv/config';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message: string) {
  log(`✓ ${message}`, 'green');
}

function logError(message: string) {
  log(`✗ ${message}`, 'red');
}

function logInfo(message: string) {
  log(`ℹ ${message}`, 'cyan');
}

function logWarning(message: string) {
  log(`⚠ ${message}`, 'yellow');
}

async function createHnswIndex() {
  if (!process.env.DATABASE_URL) {
    logError('DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const client = postgres(process.env.DATABASE_URL);

  try {
    log(`\n${'='.repeat(80)}`, 'bright');
    log('Creating HNSW Index for Vector Similarity Search', 'bright');
    log(`${'='.repeat(80)}\n`, 'bright');

    // Check if index already exists
    logInfo('Checking for existing HNSW index...');

    const existingIndexes = await client`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'recipe_embeddings'
      AND indexdef LIKE '%hnsw%'
    `;

    if (existingIndexes.length > 0) {
      logWarning('HNSW index already exists:');
      for (const idx of existingIndexes) {
        console.log(`  ${idx.indexname}`);
        console.log(`  ${idx.indexdef}\n`);
      }

      console.log('To recreate the index, first drop it:');
      console.log(`  DROP INDEX ${existingIndexes[0].indexname};\n`);

      process.exit(0);
    }

    // Check pgvector version
    const extensions = await client`
      SELECT extversion
      FROM pg_extension
      WHERE extname = 'vector'
    `;

    if (extensions.length === 0) {
      logError('pgvector extension is not installed');
      logInfo('Install it first: CREATE EXTENSION IF NOT EXISTS vector;');
      process.exit(1);
    }

    const version = parseFloat(extensions[0].extversion);
    if (version < 0.8) {
      logError(`pgvector version ${extensions[0].extversion} does not support HNSW`);
      logInfo('HNSW indexes require pgvector 0.8.0 or higher');
      process.exit(1);
    }

    logSuccess(`pgvector version ${extensions[0].extversion} supports HNSW`);

    // Check embedding count
    const embeddingCount = await client`
      SELECT COUNT(*) as count FROM recipe_embeddings
    `;

    const count = parseInt(embeddingCount[0].count, 10);
    logInfo(`Found ${count} embeddings`);

    if (count === 0) {
      logWarning(
        'No embeddings found - index will be created but not used until embeddings are generated'
      );
    }

    // Create HNSW index
    logInfo('\nCreating HNSW index with parameters:');
    logInfo('  Access Method: HNSW');
    logInfo('  Operator Class: vector_cosine_ops (cosine similarity)');
    logInfo('  m: 16 (links per node)');
    logInfo('  ef_construction: 64 (build quality)');

    console.log('\nExecuting:');
    console.log(`
CREATE INDEX recipe_embeddings_embedding_idx
ON recipe_embeddings
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
    `);

    const startTime = Date.now();

    await client`
      CREATE INDEX recipe_embeddings_embedding_idx
      ON recipe_embeddings
      USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64)
    `;

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    logSuccess(`\nHNSW index created successfully in ${duration}s`);

    // Verify index creation
    const newIndex = await client`
      SELECT
        indexname,
        indexdef,
        pg_size_pretty(pg_relation_size(indexname::regclass)) as size
      FROM pg_indexes
      WHERE tablename = 'recipe_embeddings'
      AND indexname = 'recipe_embeddings_embedding_idx'
    `;

    if (newIndex.length > 0) {
      console.log('\nIndex Details:');
      logInfo(`  Name: ${newIndex[0].indexname}`);
      logInfo(`  Size: ${newIndex[0].size}`);
      logSuccess('\n✓ Index is ready for vector similarity search');
    }

    // Performance tips
    console.log(`\n${'='.repeat(80)}`);
    log('Performance Tips:', 'bright');
    console.log('='.repeat(80));

    console.log(`
1. Query Format:
   SELECT recipe_id, 1 - (embedding <=> $1::vector) as similarity
   FROM recipe_embeddings
   ORDER BY embedding <=> $1::vector
   LIMIT 10;

2. Adjust Search Accuracy:
   SET hnsw.ef_search = 100;  -- Higher = more accurate but slower
                               -- Default: 40
                               -- Range: 1-1000

3. Index Tuning:
   - For more accuracy: increase m (16 -> 32 or 64)
   - For faster builds: decrease ef_construction (64 -> 32)
   - Recreate index if you change parameters

4. Monitoring:
   - Check index usage: pg_stat_user_indexes
   - Check index size: pg_relation_size('recipe_embeddings_embedding_idx')
   - Analyze queries: EXPLAIN ANALYZE

5. Generate Missing Embeddings:
   pnpm db:seed:embeddings
    `);

    console.log(`${'='.repeat(80)}\n`);
  } catch (error) {
    logError('\nIndex creation failed');
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

createHnswIndex().catch(console.error);
