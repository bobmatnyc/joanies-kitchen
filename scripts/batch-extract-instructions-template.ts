import { db } from '../src/lib/db';
import { recipes } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';
import * as fs from 'fs';

/**
 * POST-LAUNCH BATCH INSTRUCTION EXTRACTION TEMPLATE
 *
 * This script template can be used to extract instructions from food.com
 * for the 179 pending recipes after launch.
 *
 * USAGE:
 * 1. Review the Category B prioritization in tmp/category-b-prioritized.json
 * 2. Start with Tier 1 (50 high-priority recipes)
 * 3. For each recipe, visit the source URL and copy instructions
 * 4. Uncomment and populate the INSTRUCTIONS object below
 * 5. Run: npx tsx scripts/batch-extract-instructions-template.ts
 *
 * IMPORTANT: This is a TEMPLATE - you must populate the instructions manually
 * or integrate with a web scraping solution.
 */

// Example structure - populate this with actual instructions
const INSTRUCTIONS: Record<string, {
  recipeId: string;
  name: string;
  instructions: string[];
  confidence: number;
  notes: string;
}> = {
  // EXAMPLE (remove this and add real data):
  // 'recipe-id-here': {
  //   recipeId: 'recipe-id-here',
  //   name: 'Recipe Name',
  //   instructions: [
  //     'Step 1: Preheat oven to 350°F',
  //     'Step 2: Mix ingredients',
  //     'Step 3: Bake for 30 minutes',
  //   ],
  //   confidence: 1.0,
  //   notes: 'Instructions extracted from food.com source URL',
  // },
};

async function batchExtractInstructions() {
  console.log('🔍 POST-LAUNCH BATCH INSTRUCTION EXTRACTION\n');
  console.log('='.repeat(70));

  const recipesToUpdate = Object.keys(INSTRUCTIONS);

  if (recipesToUpdate.length === 0) {
    console.log('⚠️  No instructions provided in INSTRUCTIONS object');
    console.log('\nThis is a TEMPLATE script. To use:');
    console.log('1. Load tmp/category-b-prioritized.json to see pending recipes');
    console.log('2. Visit source URLs and copy instructions');
    console.log('3. Populate the INSTRUCTIONS object in this file');
    console.log('4. Re-run this script');
    console.log('\n📄 See tmp/category-b-post-launch-plan.json for extraction plan');
    return;
  }

  console.log(`\n📊 BATCH UPDATE PLAN:`);
  console.log(`   Recipes to Update: ${recipesToUpdate.length}`);
  console.log();

  const results = {
    updated: [] as string[],
    failed: [] as string[],
  };

  for (const [recipeId, data] of Object.entries(INSTRUCTIONS)) {
    try {
      console.log(`📝 Processing: ${data.name}`);
      console.log(`   Instructions: ${data.instructions.length} steps`);
      console.log(`   Confidence: ${data.confidence}`);

      await db
        .update(recipes)
        .set({
          instructions: JSON.stringify(data.instructions),
          qa_status: 'validated',
          qa_method: 'post-launch-extraction',
          qa_timestamp: new Date(),
          qa_confidence: data.confidence.toString(),
          qa_notes: data.notes,
          qa_fixes_applied: JSON.stringify(['added_instructions', 'post_launch_processing']),
        })
        .where(eq(recipes.id, recipeId));

      console.log(`   ✅ Updated successfully\n`);
      results.updated.push(data.name);
    } catch (error) {
      console.error(`   ❌ Failed: ${error}`);
      results.failed.push(data.name);
    }
  }

  // Generate summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 BATCH UPDATE SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total Processed: ${recipesToUpdate.length}`);
  console.log(`✅ Successfully Updated: ${results.updated.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);

  if (results.updated.length > 0) {
    console.log('\n✅ Updated Recipes:');
    results.updated.forEach((name, idx) => {
      console.log(`   ${idx + 1}. ${name}`);
    });
  }

  if (results.failed.length > 0) {
    console.log('\n❌ Failed Recipes:');
    results.failed.forEach((name, idx) => {
      console.log(`   ${idx + 1}. ${name}`);
    });
  }

  console.log('\n📈 Impact:');
  console.log(`   - ${results.updated.length} recipes now have complete instructions`);
  console.log(`   - ${results.updated.length} recipes moved from 'pending_instructions' to 'validated'`);
  console.log(`   - These recipes are now unhidden and searchable`);

  console.log('\n✅ Batch extraction complete!');
}

// Helper function to load pending recipes (for reference)
export async function loadPendingRecipes() {
  const pending = await db
    .select()
    .from(recipes)
    .where(eq(recipes.qa_status, 'pending_instructions'));

  console.log(`\n📋 PENDING RECIPES (${pending.length} total):\n`);

  pending.slice(0, 10).forEach((recipe, idx) => {
    console.log(`${idx + 1}. ${recipe.name}`);
    console.log(`   ID: ${recipe.id}`);
    console.log(`   Source: ${recipe.source || 'no-source'}`);
    console.log(`   Ingredients: ${recipe.ingredients ? JSON.parse(recipe.ingredients).length : 0}`);
    console.log();
  });

  if (pending.length > 10) {
    console.log(`... and ${pending.length - 10} more\n`);
  }

  console.log('💡 TIP: Use this information to populate the INSTRUCTIONS object above\n');

  return pending;
}

// Run extraction or show pending recipes
if (Object.keys(INSTRUCTIONS).length === 0) {
  console.log('📋 LOADING PENDING RECIPES FOR REFERENCE...\n');
  loadPendingRecipes()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
} else {
  batchExtractInstructions()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
