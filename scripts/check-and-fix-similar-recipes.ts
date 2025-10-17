#!/usr/bin/env tsx

/**
 * Check and Fix Similar Recipes Feature
 *
 * This script:
 * 1. Checks if pgvector extension is enabled
 * 2. Checks if recipe_embeddings table exists
 * 3. Counts how many recipes have embeddings
 * 4. Offers to generate missing embeddings
 */

import * as path from 'node:path';
import * as dotenv from 'dotenv';
import { count, sql } from 'drizzle-orm';
import { generateRecipeEmbedding } from '../src/lib/ai/embeddings';
import { db } from '../src/lib/db';
import { saveRecipeEmbedding } from '../src/lib/db/embeddings';
import { recipeEmbeddings, recipes } from '../src/lib/db/schema';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

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

async function checkPgVector() {
  log('\n=== Checking pgvector Extension ===', colors.cyan);
  try {
    const result = await db.execute(sql`SELECT * FROM pg_extension WHERE extname = 'vector'`);
    if (result.rows.length > 0) {
      log('✓ pgvector extension is installed', colors.green);
      return true;
    } else {
      log('✗ pgvector extension is NOT installed', colors.red);
      log('  Run: CREATE EXTENSION vector;', colors.yellow);
      return false;
    }
  } catch (error: any) {
    log(`✗ Error checking pgvector: ${error.message}`, colors.red);
    return false;
  }
}

async function checkEmbeddingsTable() {
  log('\n=== Checking recipe_embeddings Table ===', colors.cyan);
  try {
    const result = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'recipe_embeddings'
      ) as exists
    `);
    const exists = result.rows[0]?.exists;
    if (exists) {
      log('✓ recipe_embeddings table exists', colors.green);
      return true;
    } else {
      log('✗ recipe_embeddings table does NOT exist', colors.red);
      log('  Run: pnpm db:push', colors.yellow);
      return false;
    }
  } catch (error: any) {
    log(`✗ Error checking table: ${error.message}`, colors.red);
    return false;
  }
}

async function countRecipes() {
  log('\n=== Counting Recipes ===', colors.cyan);
  try {
    const totalRecipes = await db.select({ count: count() }).from(recipes);
    const totalEmbeddings = await db.select({ count: count() }).from(recipeEmbeddings);

    const recipeCount = Number(totalRecipes[0]?.count || 0);
    const embeddingCount = Number(totalEmbeddings[0]?.count || 0);

    log(`Total recipes: ${recipeCount}`, colors.blue);
    log(`Recipes with embeddings: ${embeddingCount}`, colors.blue);
    log(
      `Missing embeddings: ${recipeCount - embeddingCount}`,
      recipeCount > embeddingCount ? colors.yellow : colors.green
    );

    return { recipeCount, embeddingCount, missing: recipeCount - embeddingCount };
  } catch (error: any) {
    log(`✗ Error counting: ${error.message}`, colors.red);
    return { recipeCount: 0, embeddingCount: 0, missing: 0 };
  }
}

async function findRecipesNeedingEmbeddings() {
  try {
    const recipesWithoutEmbeddings = await db.execute(sql`
      SELECT r.id, r.name, r.cuisine
      FROM recipes r
      LEFT JOIN recipe_embeddings e ON r.id = e.recipe_id
      WHERE e.id IS NULL
      LIMIT 10
    `);
    return recipesWithoutEmbeddings.rows as Array<{ id: string; name: string; cuisine: string }>;
  } catch (error: any) {
    log(`✗ Error finding recipes: ${error.message}`, colors.red);
    return [];
  }
}

async function generateMissingEmbeddings(limit: number = 10) {
  log(`\n=== Generating Missing Embeddings (limit: ${limit}) ===`, colors.cyan);

  if (!process.env.HUGGINGFACE_API_KEY) {
    log('✗ HUGGINGFACE_API_KEY not configured', colors.red);
    log('  Add it to .env.local to enable embedding generation', colors.yellow);
    return;
  }

  const needsEmbeddings = await db.execute(sql`
    SELECT r.*
    FROM recipes r
    LEFT JOIN recipe_embeddings e ON r.id = e.recipe_id
    WHERE e.id IS NULL
    LIMIT ${limit}
  `);

  const recipesToProcess = needsEmbeddings.rows as any[];

  if (recipesToProcess.length === 0) {
    log('✓ All recipes have embeddings!', colors.green);
    return;
  }

  log(`Found ${recipesToProcess.length} recipes needing embeddings`, colors.blue);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < recipesToProcess.length; i++) {
    const recipe = recipesToProcess[i];
    try {
      log(`\n[${i + 1}/${recipesToProcess.length}] Processing: ${recipe.name}`, colors.yellow);

      const result = await generateRecipeEmbedding(recipe);
      await saveRecipeEmbedding(
        recipe.id,
        result.embedding,
        result.embeddingText,
        result.modelName
      );

      log(`  ✓ Generated embedding`, colors.green);
      success++;

      // Rate limiting: wait 2 seconds between requests
      if (i < recipesToProcess.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (error: any) {
      log(`  ✗ Failed: ${error.message}`, colors.red);
      failed++;
    }
  }

  log(`\n=== Generation Summary ===`, colors.cyan);
  log(`Success: ${success}`, colors.green);
  log(`Failed: ${failed}`, failed > 0 ? colors.red : colors.green);
}

async function testSimilarRecipes() {
  log('\n=== Testing Similar Recipes Feature ===', colors.cyan);

  try {
    // Get a recipe with embedding
    const recipeWithEmbedding = await db.execute(sql`
      SELECT r.id, r.name
      FROM recipes r
      INNER JOIN recipe_embeddings e ON r.id = e.recipe_id
      LIMIT 1
    `);

    if (recipeWithEmbedding.rows.length === 0) {
      log('✗ No recipes with embeddings to test', colors.yellow);
      return;
    }

    const testRecipe = recipeWithEmbedding.rows[0] as { id: string; name: string };
    log(`Testing with recipe: "${testRecipe.name}" (${testRecipe.id})`, colors.blue);

    // Import the server action
    const { findSimilarToRecipe } = await import('../src/app/actions/semantic-search');
    const result = await findSimilarToRecipe(testRecipe.id, 5);

    if (result.success) {
      log(`✓ Found ${result.recipes.length} similar recipes`, colors.green);
      result.recipes.forEach((r, i) => {
        const similarity = (r.similarity * 100).toFixed(1);
        log(`  ${i + 1}. ${r.name} (${similarity}% similar)`, colors.blue);
      });
    } else {
      log(`✗ Failed: ${result.error}`, colors.red);
    }
  } catch (error: any) {
    log(`✗ Error testing: ${error.message}`, colors.red);
    if (error.message.includes('Client Component')) {
      log('  Note: This is expected when running as a script', colors.yellow);
      log('  The feature should work in the actual application', colors.yellow);
    }
  }
}

async function main() {
  log(`\n${'='.repeat(60)}`, colors.bright);
  log('SIMILAR RECIPES FEATURE DIAGNOSTIC', colors.bright);
  log('='.repeat(60), colors.bright);

  // Step 1: Check pgvector
  const hasPgVector = await checkPgVector();
  if (!hasPgVector) {
    log('\n⚠️  Cannot proceed without pgvector extension', colors.yellow);
    process.exit(1);
  }

  // Step 2: Check table
  const hasTable = await checkEmbeddingsTable();
  if (!hasTable) {
    log('\n⚠️  Cannot proceed without recipe_embeddings table', colors.yellow);
    process.exit(1);
  }

  // Step 3: Count recipes and embeddings
  const counts = await countRecipes();

  if (counts.missing > 0) {
    // Step 4: Show sample recipes missing embeddings
    log('\n=== Sample Recipes Missing Embeddings ===', colors.cyan);
    const samples = await findRecipesNeedingEmbeddings();
    samples.forEach((r, i) => {
      log(`  ${i + 1}. ${r.name} [${r.cuisine || 'N/A'}]`, colors.yellow);
    });

    // Step 5: Offer to generate embeddings
    if (process.argv.includes('--generate')) {
      const limit = parseInt(process.argv[process.argv.indexOf('--generate') + 1] || '10', 10);
      await generateMissingEmbeddings(limit);
    } else {
      log('\n💡 To generate embeddings, run:', colors.bright);
      log('   npx tsx scripts/check-and-fix-similar-recipes.ts --generate 10', colors.cyan);
    }
  }

  // Step 6: Test the feature
  if (process.argv.includes('--test')) {
    await testSimilarRecipes();
  }

  log(`\n${'='.repeat(60)}`, colors.bright);
  log('DIAGNOSTIC COMPLETE', colors.bright);
  log(`${'='.repeat(60)}\n`, colors.bright);

  if (counts.missing === 0 && counts.recipeCount > 0) {
    log('✓ All recipes have embeddings!', colors.green);
    log('✓ Similar recipes feature should be working', colors.green);
  } else if (counts.recipeCount === 0) {
    log('⚠️  No recipes in database', colors.yellow);
  } else {
    log(`⚠️  ${counts.missing} recipes need embeddings`, colors.yellow);
    log('   Run with --generate to fix', colors.yellow);
  }

  process.exit(0);
}

main().catch((error) => {
  log(`\nFatal error: ${error.message}`, colors.red);
  console.error(error);
  process.exit(1);
});
