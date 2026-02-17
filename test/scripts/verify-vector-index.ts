#!/usr/bin/env tsx

/**
 * HNSW Vector Index Verification Script
 *
 * Verifies the pgvector extension, recipe_embeddings table, and HNSW index
 * in the Neon PostgreSQL production database.
 *
 * Checks:
 * 1. Database connection
 * 2. pgvector extension installation and version
 * 3. recipe_embeddings table structure
 * 4. HNSW index existence and configuration
 * 5. Embedding coverage statistics
 * 6. Index performance test
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import 'dotenv/config';

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log(`\n${'='.repeat(80)}`);
  log(title, 'bright');
  console.log('='.repeat(80));
}

function logSuccess(message: string) {
  log(`✓ ${message}`, 'green');
}

function logError(message: string) {
  log(`✗ ${message}`, 'red');
}

function logWarning(message: string) {
  log(`⚠ ${message}`, 'yellow');
}

function logInfo(message: string) {
  log(`ℹ ${message}`, 'cyan');
}

async function verifyVectorIndex() {
  if (!process.env.DATABASE_URL) {
    logError('DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  logSection('1. Database Connection');

  const client = postgres(process.env.DATABASE_URL);
  const _db = drizzle(client);

  try {
    // Test connection
    await client`SELECT 1`;
    logSuccess('Connected to Neon PostgreSQL database');

    // Get database info
    const dbInfo = await client`
      SELECT
        current_database() as database,
        current_user as user,
        version() as version
    `;
    logInfo(`Database: ${dbInfo[0].database}`);
    logInfo(`User: ${dbInfo[0].user}`);
    logInfo(`Version: ${dbInfo[0].version.split('\n')[0]}`);

    // Check pgvector extension
    logSection('2. pgvector Extension Verification');

    const extensions = await client`
      SELECT
        extname,
        extversion,
        extrelocatable
      FROM pg_extension
      WHERE extname = 'vector'
    `;

    if (extensions.length === 0) {
      logError('pgvector extension is NOT installed');
      logInfo('To install pgvector, run:');
      console.log('  CREATE EXTENSION IF NOT EXISTS vector;');
      return;
    }

    const vectorExt = extensions[0];
    logSuccess(`pgvector extension is installed`);
    logInfo(`Version: ${vectorExt.extversion}`);

    // Check version compatibility
    const version = parseFloat(vectorExt.extversion);
    if (version >= 0.8) {
      logSuccess(`Version ${vectorExt.extversion} supports HNSW indexes`);
    } else {
      logWarning(`Version ${vectorExt.extversion} may not support HNSW (requires 0.8.0+)`);
    }

    // Check recipe_embeddings table
    logSection('3. recipe_embeddings Table Verification');

    const tables = await client`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'recipe_embeddings'
    `;

    if (tables.length === 0) {
      logError('recipe_embeddings table does NOT exist');
      logInfo('Run database migrations to create the table:');
      console.log('  pnpm db:push');
      return;
    }

    logSuccess('recipe_embeddings table exists');

    // Check table structure
    const columns = await client`
      SELECT
        column_name,
        data_type,
        udt_name,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'recipe_embeddings'
      ORDER BY ordinal_position
    `;

    console.log('\nTable Structure:');
    for (const col of columns) {
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';

      if (col.column_name === 'embedding') {
        if (col.udt_name === 'vector') {
          logSuccess(`  ${col.column_name}: ${col.udt_name} ${nullable}${defaultVal}`);
        } else {
          logError(
            `  ${col.column_name}: ${col.udt_name} ${nullable}${defaultVal} (expected: vector)`
          );
        }
      } else {
        logInfo(`  ${col.column_name}: ${col.data_type} ${nullable}${defaultVal}`);
      }
    }

    // Check for embedding column specifically
    const embeddingCol = columns.find((c) => c.column_name === 'embedding');
    if (!embeddingCol) {
      logError('embedding column is missing');
      return;
    }

    if (embeddingCol.udt_name !== 'vector') {
      logError(`embedding column has wrong type: ${embeddingCol.udt_name} (expected: vector)`);
      return;
    }

    // Check HNSW index
    logSection('4. HNSW Index Verification');

    const indexes = await client`
      SELECT
        indexname,
        indexdef,
        tablename
      FROM pg_indexes
      WHERE tablename = 'recipe_embeddings'
      AND indexname LIKE '%embedding%'
    `;

    console.log(`\nFound ${indexes.length} embedding index(es):\n`);

    let hnswIndexFound = false;
    for (const idx of indexes) {
      console.log(`Index: ${idx.indexname}`);
      console.log(`Definition: ${idx.indexdef}\n`);

      if (idx.indexdef.includes('hnsw') || idx.indexdef.includes('HNSW')) {
        logSuccess('HNSW access method detected');
        hnswIndexFound = true;
      }

      if (idx.indexdef.includes('vector_cosine_ops')) {
        logSuccess('Cosine similarity operator class detected');
      } else if (idx.indexdef.includes('vector_l2_ops')) {
        logInfo('L2 distance operator class detected');
      } else if (idx.indexdef.includes('vector_ip_ops')) {
        logInfo('Inner product operator class detected');
      }
    }

    if (indexes.length === 0) {
      logError('No embedding indexes found');
      logInfo('\nTo create an HNSW index for cosine similarity, run:');
      console.log(`
CREATE INDEX IF NOT EXISTS recipe_embeddings_embedding_idx
ON recipe_embeddings
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
      `);
      logInfo('Index parameters explained:');
      logInfo('  m = 16: Number of bi-directional links per node (trade-off: accuracy vs speed)');
      logInfo('  ef_construction = 64: Quality of index build (higher = better but slower)');
    } else if (!hnswIndexFound) {
      logWarning('Index exists but may not be using HNSW access method');
      logInfo('For optimal vector search performance, use HNSW index');
    }

    // Check embedding coverage
    logSection('5. Embedding Coverage Statistics');

    const embeddingStats = await client`
      SELECT COUNT(*) as total_embeddings FROM recipe_embeddings
    `;

    const recipeStats = await client`
      SELECT COUNT(*) as total_recipes FROM recipes
    `;

    const totalEmbeddings = parseInt(embeddingStats[0].total_embeddings, 10);
    const totalRecipes = parseInt(recipeStats[0].total_recipes, 10);

    logInfo(`Total recipes: ${totalRecipes}`);
    logInfo(`Total embeddings: ${totalEmbeddings}`);

    if (totalRecipes > 0) {
      const coverage = ((totalEmbeddings / totalRecipes) * 100).toFixed(2);

      if (totalEmbeddings === totalRecipes) {
        logSuccess(`Embedding coverage: ${coverage}% (complete)`);
      } else if (totalEmbeddings > 0) {
        logWarning(
          `Embedding coverage: ${coverage}% (${totalRecipes - totalEmbeddings} recipes need embeddings)`
        );
      } else {
        logError(`Embedding coverage: 0% (no embeddings generated)`);
      }
    }

    // Check embedding models used
    const modelStats = await client`
      SELECT
        model_name,
        COUNT(*) as count
      FROM recipe_embeddings
      GROUP BY model_name
      ORDER BY count DESC
    `;

    if (modelStats.length > 0) {
      console.log('\nEmbedding models used:');
      for (const stat of modelStats) {
        logInfo(`  ${stat.model_name}: ${stat.count} embeddings`);
      }
    }

    // Performance test (only if embeddings exist)
    if (totalEmbeddings > 0 && hnswIndexFound) {
      logSection('6. Index Performance Test');

      // Get a sample embedding to test with
      const sampleEmbedding = await client`
        SELECT embedding
        FROM recipe_embeddings
        LIMIT 1
      `;

      if (sampleEmbedding.length > 0) {
        const testVector = sampleEmbedding[0].embedding;

        logInfo('Running EXPLAIN ANALYZE on similarity search...\n');

        const explainResult = await client`
          EXPLAIN ANALYZE
          SELECT
            recipe_id,
            1 - (embedding <=> ${testVector}::vector) as similarity
          FROM recipe_embeddings
          ORDER BY embedding <=> ${testVector}::vector
          LIMIT 10
        `;

        let indexScanFound = false;
        console.log('Query Execution Plan:');
        for (const row of explainResult) {
          console.log(row['QUERY PLAN']);

          if (row['QUERY PLAN'].includes('Index Scan using')) {
            indexScanFound = true;
          }
        }

        console.log();
        if (indexScanFound) {
          logSuccess('HNSW index is being used for similarity search');
        } else {
          logWarning('HNSW index may not be used (check query plan above)');
        }
      }
    } else if (totalEmbeddings > 0 && !hnswIndexFound) {
      logSection('6. Index Performance Test');
      logWarning('Skipping performance test - HNSW index not found');
    } else {
      logSection('6. Index Performance Test');
      logWarning('Skipping performance test - no embeddings exist');
    }

    // Summary and recommendations
    logSection('Summary and Recommendations');

    const issues = [];
    const recommendations = [];

    if (extensions.length === 0) {
      issues.push('pgvector extension not installed');
      recommendations.push('Install pgvector extension: CREATE EXTENSION IF NOT EXISTS vector;');
    }

    if (tables.length === 0) {
      issues.push('recipe_embeddings table not created');
      recommendations.push('Run database migrations: pnpm db:push');
    }

    if (indexes.length === 0) {
      issues.push('No HNSW index on embedding column');
      recommendations.push('Create HNSW index (see CREATE INDEX command above)');
    } else if (!hnswIndexFound) {
      issues.push('Index exists but may not be using HNSW');
      recommendations.push('Verify index definition and consider recreating with HNSW');
    }

    if (totalRecipes > 0 && totalEmbeddings === 0) {
      issues.push('No embeddings generated for recipes');
      recommendations.push('Run embedding generation script: pnpm db:seed:embeddings');
    } else if (totalEmbeddings < totalRecipes) {
      issues.push(`${totalRecipes - totalEmbeddings} recipes missing embeddings`);
      recommendations.push('Generate missing embeddings: pnpm db:seed:embeddings');
    }

    if (issues.length === 0) {
      logSuccess('\n✓ All checks passed! Vector search infrastructure is properly configured.');
    } else {
      logWarning(`\n${issues.length} issue(s) found:\n`);
      issues.forEach((issue, i) => {
        console.log(`  ${i + 1}. ${issue}`);
      });

      if (recommendations.length > 0) {
        console.log('\nRecommended actions:\n');
        recommendations.forEach((rec, i) => {
          console.log(`  ${i + 1}. ${rec}`);
        });
      }
    }

    console.log(`\n${'='.repeat(80)}\n`);
  } catch (error) {
    logError('Verification failed');
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run verification
verifyVectorIndex().catch(console.error);
