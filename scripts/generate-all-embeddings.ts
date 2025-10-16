#!/usr/bin/env tsx
/**
 * Generate embeddings for ALL recipes in the database
 *
 * This script processes recipes in batches to avoid overwhelming the API
 * Includes progress tracking, error handling, and resumption capability
 *
 * Usage:
 *   npx tsx scripts/generate-all-embeddings.ts [--batch-size=50] [--delay=2000]
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';
import { generateRecipeEmbedding } from '../src/lib/ai/embeddings';
import { saveRecipeEmbedding, countRecipeEmbeddings } from '../src/lib/db/embeddings';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Configuration
const BATCH_SIZE = parseInt(process.argv.find(arg => arg.startsWith('--batch-size='))?.split('=')[1] || '50', 10);
const DELAY_MS = parseInt(process.argv.find(arg => arg.startsWith('--delay='))?.split('=')[1] || '2000', 10);
const DRY_RUN = process.argv.includes('--dry-run');

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

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

async function main() {
  log('\n' + '='.repeat(80), colors.bright);
  log('BULK EMBEDDING GENERATION FOR ALL RECIPES', colors.bright);
  log('='.repeat(80) + '\n', colors.bright);

  if (DRY_RUN) {
    log('⚠️  DRY RUN MODE - No embeddings will be generated', colors.yellow);
  }

  // Check API key
  if (!process.env.HUGGINGFACE_API_KEY && !DRY_RUN) {
    log('❌ HUGGINGFACE_API_KEY not configured', colors.red);
    log('   Add it to .env.local to continue', colors.yellow);
    process.exit(1);
  }

  // Get total counts
  log('Checking database...', colors.cyan);
  const totalRecipes = await db.execute(sql`SELECT COUNT(*) as count FROM recipes`);
  const recipeCount = Number(totalRecipes.rows[0]?.count || 0);
  const embeddingCount = await countRecipeEmbeddings();
  const missing = recipeCount - embeddingCount;

  log(`\nDatabase Status:`, colors.cyan);
  log(`  Total recipes: ${recipeCount}`, colors.blue);
  log(`  With embeddings: ${embeddingCount} (${((embeddingCount / recipeCount) * 100).toFixed(1)}%)`, colors.blue);
  log(`  Missing embeddings: ${missing}`, missing > 0 ? colors.yellow : colors.green);

  if (missing === 0) {
    log('\n✅ All recipes already have embeddings!', colors.green);
    process.exit(0);
  }

  // Estimate time
  const estimatedSeconds = Math.ceil((missing * (DELAY_MS + 3000)) / 1000); // 3s per embedding + delay
  const estimatedTime = formatTime(estimatedSeconds);

  log(`\nConfiguration:`, colors.cyan);
  log(`  Batch size: ${BATCH_SIZE} recipes`, colors.blue);
  log(`  Delay between requests: ${DELAY_MS}ms`, colors.blue);
  log(`  Estimated time: ${estimatedTime}`, colors.blue);

  // Confirm
  if (!DRY_RUN) {
    log(`\n⚠️  This will generate ${missing} embeddings`, colors.yellow);
    log(`   Press Ctrl+C to cancel, or wait 5 seconds to continue...`, colors.yellow);
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  // Process in batches
  let processed = 0;
  let success = 0;
  let failed = 0;
  const startTime = Date.now();

  log(`\n${'='.repeat(80)}`, colors.cyan);
  log('Starting batch processing...', colors.cyan);
  log('='.repeat(80), colors.cyan);

  while (processed < missing) {
    // Get next batch
    const batch = await db.execute(sql`
      SELECT r.*
      FROM recipes r
      LEFT JOIN recipe_embeddings e ON r.id = e.recipe_id
      WHERE e.id IS NULL
      LIMIT ${BATCH_SIZE}
    `);

    const recipes = batch.rows as any[];

    if (recipes.length === 0) {
      break; // No more recipes to process
    }

    log(`\n[Batch ${Math.floor(processed / BATCH_SIZE) + 1}] Processing ${recipes.length} recipes...`, colors.cyan);

    for (let i = 0; i < recipes.length; i++) {
      const recipe = recipes[i];
      const overall = processed + i + 1;

      try {
        log(`  [${overall}/${missing}] ${recipe.name}...`, colors.blue);

        if (!DRY_RUN) {
          const result = await generateRecipeEmbedding(recipe);
          await saveRecipeEmbedding(
            recipe.id,
            result.embedding,
            result.embeddingText,
            result.modelName
          );

          // Delay to avoid rate limits
          if (i < recipes.length - 1 || processed + recipes.length < missing) {
            await new Promise(resolve => setTimeout(resolve, DELAY_MS));
          }
        }

        log(`    ✓ Success`, colors.green);
        success++;
      } catch (error: any) {
        log(`    ✗ Failed: ${error.message}`, colors.red);
        failed++;
      }
    }

    processed += recipes.length;

    // Progress report
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const remaining = missing - processed;
    const rate = processed / elapsed; // recipes per second
    const eta = remaining > 0 ? Math.ceil(remaining / rate) : 0;

    log(`\nProgress: ${processed}/${missing} (${((processed / missing) * 100).toFixed(1)}%)`, colors.cyan);
    log(`  Success: ${success} | Failed: ${failed}`, success > failed ? colors.green : colors.yellow);
    log(`  Elapsed: ${formatTime(elapsed)} | ETA: ${formatTime(eta)}`, colors.blue);
  }

  // Final summary
  const totalTime = Math.floor((Date.now() - startTime) / 1000);

  log(`\n${'='.repeat(80)}`, colors.bright);
  log('GENERATION COMPLETE', colors.bright);
  log('='.repeat(80), colors.bright);

  log(`\nResults:`, colors.cyan);
  log(`  Total processed: ${processed}`, colors.blue);
  log(`  Successful: ${success}`, colors.green);
  log(`  Failed: ${failed}`, failed > 0 ? colors.red : colors.green);
  log(`  Total time: ${formatTime(totalTime)}`, colors.blue);

  if (failed > 0) {
    log(`\n⚠️  ${failed} recipes failed to generate embeddings`, colors.yellow);
    log(`   You can re-run this script to retry failed recipes`, colors.yellow);
  } else if (success > 0) {
    log(`\n✅ All embeddings generated successfully!`, colors.green);
  }

  // Final count
  const finalCount = await countRecipeEmbeddings();
  const coverage = ((finalCount / recipeCount) * 100).toFixed(1);
  log(`\nFinal Coverage: ${finalCount}/${recipeCount} (${coverage}%)`, colors.bright);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  log(`\n❌ Fatal error: ${error.message}`, colors.red);
  console.error(error);
  process.exit(1);
});
