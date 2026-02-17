/**
 * Batch Classification Script: Classify All Recipe Instructions
 *
 * Processes recipes in batches with rate limiting to respect API limits.
 * Gemini 2.0 Flash free tier: 15 requests/minute
 *
 * Run with: pnpm tsx scripts/classify-all-recipes.ts
 * Dry run: DRY_RUN=true pnpm tsx scripts/classify-all-recipes.ts
 */

import { eq, isNull } from 'drizzle-orm';
import {
  classifyRecipeInstructions,
  estimateClassificationCost,
} from '@/lib/ai/instruction-classifier';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';

const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '100', 10);
const REQUESTS_PER_MINUTE = 15; // Gemini free tier limit
const DELAY_BETWEEN_REQUESTS = (60 / REQUESTS_PER_MINUTE) * 1000; // milliseconds
const DRY_RUN = process.env.DRY_RUN === 'true';

async function classifyAllRecipes() {
  console.log('🚀 Batch Recipe Instruction Classification\n');
  console.log('═══════════════════════════════════════════\n');

  if (DRY_RUN) {
    console.log('⚠️  DRY RUN MODE - No database writes will be performed\n');
  }

  console.log(`Configuration:`);
  console.log(`  Batch Size:        ${BATCH_SIZE} recipes`);
  console.log(`  Rate Limit:        ${REQUESTS_PER_MINUTE} requests/minute`);
  console.log(`  Delay:             ${DELAY_BETWEEN_REQUESTS}ms between requests`);
  console.log('');

  // Get unclassified recipes
  console.log('📊 Fetching unclassified recipes...');
  const unclassified = await db
    .select()
    .from(recipes)
    .where(isNull(recipes.instruction_metadata))
    .limit(BATCH_SIZE);

  console.log(`\nFound ${unclassified.length} unclassified recipes\n`);

  if (unclassified.length === 0) {
    console.log('✅ All recipes are already classified!');
    return;
  }

  // Calculate estimates
  const totalInstructions = unclassified.reduce((sum, recipe) => {
    try {
      const instructions = JSON.parse(recipe.instructions);
      return sum + (Array.isArray(instructions) ? instructions.length : 0);
    } catch {
      return sum;
    }
  }, 0);

  const estimatedCost = estimateClassificationCost(totalInstructions);
  const estimatedTime = (unclassified.length * DELAY_BETWEEN_REQUESTS) / 1000 / 60; // minutes

  console.log(`Estimates:`);
  console.log(`  Total Instructions: ${totalInstructions}`);
  console.log(`  Estimated Cost:     $${estimatedCost.toFixed(4)}`);
  console.log(`  Estimated Time:     ${estimatedTime.toFixed(1)} minutes`);
  console.log('');

  if (DRY_RUN) {
    console.log('✅ Dry run complete - no actual processing performed\n');
    return;
  }

  // Process recipes with rate limiting
  console.log('═══════════════════════════════════════════');
  console.log('PROCESSING RECIPES\n');
  console.log('═══════════════════════════════════════════\n');

  let successCount = 0;
  let errorCount = 0;
  let totalCost = 0;
  const startTime = Date.now();

  for (let i = 0; i < unclassified.length; i++) {
    const recipe = unclassified[i];

    try {
      const instructions = JSON.parse(recipe.instructions) as string[];

      if (instructions.length === 0) {
        console.log(
          `⚠️  [${i + 1}/${unclassified.length}] Skipping "${recipe.name}" - no instructions`
        );
        continue;
      }

      console.log(`\n🔄 [${i + 1}/${unclassified.length}] Processing: "${recipe.name}"`);
      console.log(`   Steps: ${instructions.length}`);

      // Classify
      const metadata = await classifyRecipeInstructions(instructions, {
        recipeName: recipe.name,
        cuisine: recipe.cuisine || undefined,
        difficulty: recipe.difficulty || undefined,
      });

      if (metadata.length === 0) {
        console.error(`   ❌ Failed to classify`);
        errorCount++;
        continue;
      }

      // Save to database
      await db
        .update(recipes)
        .set({
          instruction_metadata: JSON.stringify(metadata),
          instruction_metadata_version: '1.0.0',
          instruction_metadata_generated_at: new Date(),
          instruction_metadata_model: 'google/gemini-2.0-flash-exp:free',
        })
        .where(eq(recipes.id, recipe.id));

      const avgConfidence =
        metadata.reduce((sum, step) => sum + step.confidence, 0) / metadata.length;

      successCount++;
      console.log(`   ✅ Success (confidence: ${(avgConfidence * 100).toFixed(1)}%)`);

      // Estimate cost
      const cost = estimateClassificationCost(instructions.length);
      totalCost += cost;

      // Rate limiting - delay before next request
      if (i < unclassified.length - 1) {
        console.log(`   ⏱️  Waiting ${DELAY_BETWEEN_REQUESTS}ms...`);
        await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
      }
    } catch (error) {
      console.error(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      errorCount++;
    }
  }

  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  console.log('\n═══════════════════════════════════════════');
  console.log('BATCH CLASSIFICATION COMPLETE\n');
  console.log('═══════════════════════════════════════════\n');

  console.log(`Results:`);
  console.log(`  ✅ Success:        ${successCount} recipes`);
  console.log(`  ❌ Errors:         ${errorCount} recipes`);
  console.log(`  💰 Total Cost:     $${totalCost.toFixed(4)}`);
  console.log(`  ⏱️  Duration:       ${duration} minutes`);
  console.log('');

  const successRate = (successCount / (successCount + errorCount)) * 100;
  console.log(`Success Rate: ${successRate.toFixed(1)}%`);

  if (successRate < 95) {
    console.log('\n⚠️  Warning: Success rate below 95%');
  } else {
    console.log('\n✅ Batch processing completed successfully!');
  }

  console.log('\n═══════════════════════════════════════════\n');
}

classifyAllRecipes()
  .then(() => {
    console.log('Script completed\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  });
