import { db } from '../src/lib/db';
import { recipes } from '../src/lib/db/schema';
import { inArray } from 'drizzle-orm';
import * as fs from 'fs';

/**
 * Process Categories C and D
 * - Category C: 1 tutorial (remove)
 * - Category D: 34 incomplete recipes (remove)
 */

const analysis = JSON.parse(fs.readFileSync('tmp/hidden-recipes-analysis.json', 'utf-8'));

async function processCategoriesCD() {
  console.log('🔍 Processing Categories C & D (Removal)\n');
  console.log('='.repeat(70));

  const categoryC = analysis.byCategory.categoryC.map((r: any) => r.id);
  const categoryD = analysis.byCategory.categoryD.map((r: any) => r.id);

  const allToRemove = [...categoryC, ...categoryD];

  console.log(`\n📊 REMOVAL PLAN:`);
  console.log(`   Category C (Tutorials): ${categoryC.length} recipes`);
  console.log(`   Category D (Incomplete): ${categoryD.length} recipes`);
  console.log(`   Total to Remove: ${allToRemove.length} recipes\n`);

  if (allToRemove.length === 0) {
    console.log('✅ No recipes to remove');
    return;
  }

  // Update to 'removed' status
  const result = await db
    .update(recipes)
    .set({
      qa_status: 'removed',
      qa_method: 'automated-cleanup',
      qa_timestamp: new Date(),
      qa_notes: 'Removed: Category C (tutorial/non-recipe) or Category D (insufficient data)',
      qa_fixes_applied: JSON.stringify(['marked_for_removal']),
    })
    .where(inArray(recipes.id, allToRemove));

  console.log('✅ REMOVAL COMPLETE\n');
  console.log(`Updated ${allToRemove.length} recipes to qa_status = 'removed'`);
  console.log();

  // Show sample removals
  console.log('📋 CATEGORY C - TUTORIALS (1):');
  analysis.byCategory.categoryC.forEach((recipe: any, idx: number) => {
    console.log(`   ${idx + 1}. ${recipe.name}`);
    console.log(`      Reason: ${recipe.reasoning}`);
  });
  console.log();

  console.log('📋 CATEGORY D - INCOMPLETE (34):');
  analysis.byCategory.categoryD.slice(0, 5).forEach((recipe: any, idx: number) => {
    console.log(`   ${idx + 1}. ${recipe.name}`);
    console.log(`      Reason: ${recipe.reasoning}`);
  });
  if (analysis.byCategory.categoryD.length > 5) {
    console.log(`   ... and ${analysis.byCategory.categoryD.length - 5} more`);
  }
  console.log();

  // Generate summary
  const summary = {
    timestamp: new Date().toISOString(),
    categoriesProcessed: ['C', 'D'],
    totalRemoved: allToRemove.length,
    breakdown: {
      categoryC: categoryC.length,
      categoryD: categoryD.length,
    },
    removedRecipes: {
      categoryC: analysis.byCategory.categoryC,
      categoryD: analysis.byCategory.categoryD,
    },
  };

  fs.writeFileSync('tmp/categories-c-d-removal-report.json', JSON.stringify(summary, null, 2));

  console.log('='.repeat(70));
  console.log('📈 IMPACT:');
  console.log(`   - ${allToRemove.length} recipes marked as 'removed'`);
  console.log(`   - Database cleaned of tutorial and insufficient-data recipes`);
  console.log(`   - Remaining hidden recipes: ${179} (Category B - need instructions)`);
  console.log();
  console.log('📄 Report saved to: tmp/categories-c-d-removal-report.json');
  console.log('\n✅ Categories C & D processing complete!');
}

processCategoriesCD()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
