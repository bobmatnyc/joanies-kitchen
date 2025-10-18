/**
 * Test Script: Classify a Single Recipe from Database
 *
 * Takes a recipe ID from the database and classifies it.
 * Useful for testing on real data.
 *
 * Run with: pnpm tsx scripts/test-single-recipe-from-db.ts <recipe-id>
 */

import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { classifyRecipe } from '@/app/actions/classify-instructions';

const recipeId = process.argv[2];

if (!recipeId) {
  console.error('❌ Error: Recipe ID required');
  console.error('\nUsage: pnpm tsx scripts/test-single-recipe-from-db.ts <recipe-id>');
  console.error('\nTo find a recipe ID, run:');
  console.error('  psql $DATABASE_URL -c "SELECT id, name FROM recipes LIMIT 10;"');
  process.exit(1);
}

async function testSingleRecipe() {
  console.log('🔍 Fetching recipe from database...\n');

  const recipe = await db.query.recipes.findFirst({
    where: eq(recipes.id, recipeId),
  });

  if (!recipe) {
    console.error(`❌ Recipe not found: ${recipeId}`);
    process.exit(1);
  }

  console.log(`Recipe: ${recipe.name}`);
  console.log(`Cuisine: ${recipe.cuisine || 'Unknown'}`);
  console.log(`Difficulty: ${recipe.difficulty || 'Unknown'}`);

  const instructions = JSON.parse(recipe.instructions);
  console.log(`Instructions: ${instructions.length} steps`);
  console.log('');

  if (recipe.instruction_metadata) {
    console.log('⚠️  This recipe is already classified!');
    console.log('   Set instruction_metadata to NULL to re-classify.\n');

    const metadata = JSON.parse(recipe.instruction_metadata);
    const avgConf =
      metadata.reduce((sum: number, m: any) => sum + m.confidence, 0) / metadata.length;

    console.log(`Existing classification:`);
    console.log(`  Steps: ${metadata.length}`);
    console.log(`  Average Confidence: ${(avgConf * 100).toFixed(1)}%`);
    console.log(`  Model: ${recipe.instruction_metadata_model || 'Unknown'}`);
    console.log(
      `  Generated: ${recipe.instruction_metadata_generated_at?.toISOString() || 'Unknown'}`
    );
    console.log('');

    console.log('To view details, run:');
    console.log(
      `  psql $DATABASE_URL -c "SELECT instruction_metadata FROM recipes WHERE id='${recipeId}';" | jq .`
    );
    console.log('');

    process.exit(0);
  }

  console.log('🚀 Classifying recipe...\n');

  const result = await classifyRecipe(recipeId);

  if (!result.success) {
    console.error(`❌ Classification failed: ${result.error}`);
    process.exit(1);
  }

  console.log('✅ Classification successful!\n');

  const avgConf =
    result.metadata!.reduce((sum, m) => sum + m.confidence, 0) / result.metadata!.length;

  console.log(`Results:`);
  console.log(`  Steps Classified: ${result.metadata!.length}`);
  console.log(`  Average Confidence: ${(avgConf * 100).toFixed(1)}%`);
  console.log(`  Model: ${result.metadata![0]?.model_used || 'Unknown'}`);
  console.log('');

  // Show first 3 steps as preview
  console.log('Preview (first 3 steps):\n');
  result.metadata!.slice(0, 3).forEach((step, idx) => {
    console.log(`Step ${idx + 1}: "${step.step_text}"`);
    console.log(`  Work Type: ${step.classification.work_type}`);
    console.log(`  Technique: ${step.classification.technique || 'N/A'}`);
    console.log(`  Tools: ${step.classification.tools.join(', ') || 'None'}`);
    console.log(`  Time (intermediate): ${step.classification.estimated_time_minutes.intermediate} min`);
    console.log(`  Confidence: ${(step.confidence * 100).toFixed(1)}%`);
    console.log('');
  });

  console.log('✅ Test complete!\n');
}

testSingleRecipe()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  });
