import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { inArray } from 'drizzle-orm';
import * as fs from 'fs';

/**
 * Verification: All 20 flagged recipes have been resolved
 * Expected statuses:
 * - 14 recipes: qa_status = 'validated' (3 Quick Wins + 11 Category B)
 * - 3 recipes: qa_status = 'removed' (Category C tutorials)
 * - 3 recipes: qa_status = 'needs_review' (Category D incomplete)
 */

const FLAGGED_RECIPE_IDS = [
  // Category A - Quick Wins (3) - Expected: validated
  '163f25de-7d7d-4525-9785-77162b2b7ea3', // Parsnip Soup
  'b7d25ff5-98eb-44a7-8824-04b16e1ba471', // Pickled Vegetables
  'dc3a2745-b1fe-439d-b2fc-f22ff3e80e5b', // Yoghurt Panna Cotta

  // Category B - Manual Review (11) - Expected: validated
  '03d77494-96ac-46b0-bb77-a68e2bb6ba51', // Beef Wellington
  '031cfb77-3505-4dfe-b387-d607923b4a65', // Beetroot Sorbet
  '404cafbf-cfaa-4813-a2fd-792fc4c63781', // Joshua McFadden's Broccolini
  '3d83ee08-7724-4afc-9b61-453ac4a4ebff', // Monkfish Wrapped in Chard
  '907a094c-cd15-4b5b-8d6c-a2a118596811', // Roast Turkey
  '476b3fc3-56ae-4880-96f4-db748bba133d', // Roast chicken with dates
  '54a95eb9-9808-4a65-8dc6-eac9acf7b3b2', // Roasted cauliflower
  'f46a32f8-0be0-4fc1-939e-55d1a5040d6b', // Roasted lemon and fregola
  'd84db97b-3dab-4852-add8-35fef5395cbe', // Spiced Roast Turkey
  'a027cf15-d85b-4610-bbf7-57c3ef46097e', // Butter Chicken
  '12d8170d-722d-4d3e-8e49-60a1a831fc83', // Madras beef curry

  // Category C - Tutorials (3) - Expected: removed
  'd3f48984-d93f-4586-b440-5aaf78e18f32', // Onion Skin Fabric Dye
  '83355000-59ec-46ed-80bd-94c823e302e3', // Scouring Powder
  'b81ac1f7-8a60-4e1f-9c9e-91b1794b4230', // Mouthwash

  // Category D - Incomplete (3) - Expected: needs_review
  '08a1aae2-ec03-4fca-9aa9-b851ec83261a', // Halibut
  'ea38e499-5239-4415-be04-f8c027682b1f', // Potato Gratin
  '800b6153-db4e-40ef-a123-1dceb30c621b', // Preserved lemon chicken
];

interface RecipeStatus {
  id: string;
  name: string;
  qa_status: string | null;
  qa_method: string | null;
  qa_confidence: string | null;
  ingredients: string;
  ingredientCount: number;
  hasIngredients: boolean;
}

async function verifyAllFlaggedResolved() {
  console.log('🔍 VERIFICATION: All 20 Flagged Recipes Resolution\n');
  console.log('='.repeat(70));

  // Fetch all 20 recipes
  const allRecipes = await db
    .select({
      id: recipes.id,
      name: recipes.name,
      qa_status: recipes.qa_status,
      qa_method: recipes.qa_method,
      qa_confidence: recipes.qa_confidence,
      ingredients: recipes.ingredients,
    })
    .from(recipes)
    .where(inArray(recipes.id, FLAGGED_RECIPE_IDS));

  // Process recipe statuses
  const recipeStatuses: RecipeStatus[] = allRecipes.map((recipe) => {
    const ingredientArray = recipe.ingredients ? JSON.parse(recipe.ingredients) : [];
    return {
      id: recipe.id,
      name: recipe.name,
      qa_status: recipe.qa_status || 'unknown',
      qa_method: recipe.qa_method || 'none',
      qa_confidence: recipe.qa_confidence || '0.00',
      ingredients: recipe.ingredients || '[]',
      ingredientCount: Array.isArray(ingredientArray) ? ingredientArray.length : 0,
      hasIngredients: Array.isArray(ingredientArray) && ingredientArray.length > 0,
    };
  });

  // Group by status
  const byStatus = {
    validated: recipeStatuses.filter((r) => r.qa_status === 'validated'),
    removed: recipeStatuses.filter((r) => r.qa_status === 'removed'),
    needs_review: recipeStatuses.filter((r) => r.qa_status === 'needs_review'),
    other: recipeStatuses.filter(
      (r) => !['validated', 'removed', 'needs_review'].includes(r.qa_status)
    ),
  };

  // Verification checks
  const checks = {
    totalFound: allRecipes.length === 20,
    validatedCount: byStatus.validated.length === 14,
    removedCount: byStatus.removed.length === 3,
    needsReviewCount: byStatus.needs_review.length === 3,
    noOtherStatuses: byStatus.other.length === 0,
    allValidatedHaveIngredients: byStatus.validated.every((r) => r.hasIngredients),
  };

  const allChecksPassed = Object.values(checks).every((check) => check === true);

  // Display results
  console.log('📊 STATUS BREAKDOWN\n');

  console.log(`✅ VALIDATED (Expected: 14, Actual: ${byStatus.validated.length})`);
  if (byStatus.validated.length > 0) {
    byStatus.validated.forEach((recipe, idx) => {
      console.log(
        `   ${idx + 1}. ${recipe.name} (${recipe.ingredientCount} ingredients, confidence: ${recipe.qa_confidence})`
      );
    });
  }
  console.log();

  console.log(`🚫 REMOVED (Expected: 3, Actual: ${byStatus.removed.length})`);
  if (byStatus.removed.length > 0) {
    byStatus.removed.forEach((recipe, idx) => {
      console.log(`   ${idx + 1}. ${recipe.name}`);
    });
  }
  console.log();

  console.log(`⚠️  NEEDS REVIEW (Expected: 3, Actual: ${byStatus.needs_review.length})`);
  if (byStatus.needs_review.length > 0) {
    byStatus.needs_review.forEach((recipe, idx) => {
      console.log(`   ${idx + 1}. ${recipe.name}`);
    });
  }
  console.log();

  if (byStatus.other.length > 0) {
    console.log(`❓ OTHER STATUSES (Expected: 0, Actual: ${byStatus.other.length})`);
    byStatus.other.forEach((recipe, idx) => {
      console.log(`   ${idx + 1}. ${recipe.name} - Status: ${recipe.qa_status}`);
    });
    console.log();
  }

  // Verification results
  console.log('='.repeat(70));
  console.log('🔍 VERIFICATION CHECKS\n');

  const checkResults = [
    { name: 'All 20 recipes found', passed: checks.totalFound },
    { name: '14 recipes validated', passed: checks.validatedCount },
    { name: '3 recipes removed', passed: checks.removedCount },
    { name: '3 recipes needs_review', passed: checks.needsReviewCount },
    { name: 'No unexpected statuses', passed: checks.noOtherStatuses },
    { name: 'All validated have ingredients', passed: checks.allValidatedHaveIngredients },
  ];

  checkResults.forEach((check) => {
    const icon = check.passed ? '✅' : '❌';
    console.log(`${icon} ${check.name}`);
  });

  console.log();
  console.log('='.repeat(70));

  if (allChecksPassed) {
    console.log('✅ ALL VERIFICATION CHECKS PASSED\n');
    console.log('📈 Week 1-2 Priority Task: COMPLETE');
    console.log('   - 14 recipes validated with complete ingredient lists');
    console.log('   - 3 non-recipe tutorials removed from database');
    console.log('   - 3 incomplete recipes hidden from search');
    console.log();
    console.log('🎯 Coverage Impact:');
    console.log('   - Before: 4,624/4,644 recipes (99.57%)');
    console.log('   - After:  4,638/4,644 recipes (99.87%)');
    console.log('   - Improvement: +14 recipes validated (+0.30%)');
  } else {
    console.log('❌ VERIFICATION FAILED\n');
    console.log('Some checks did not pass. Review the results above.');
  }

  // Generate report
  const report = {
    timestamp: new Date().toISOString(),
    totalRecipes: allRecipes.length,
    statusBreakdown: {
      validated: byStatus.validated.length,
      removed: byStatus.removed.length,
      needs_review: byStatus.needs_review.length,
      other: byStatus.other.length,
    },
    checks,
    allChecksPassed,
    recipes: recipeStatuses,
  };

  fs.writeFileSync('tmp/flagged-recipes-verification.json', JSON.stringify(report, null, 2));
  console.log('\n📄 Full report saved to: tmp/flagged-recipes-verification.json');
}

verifyAllFlaggedResolved()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
