#!/usr/bin/env tsx

/**
 * Comprehensive Chef Verification Report
 *
 * Complete analysis of the 10 sustainability-focused chefs' recipe assignments
 * after the batch import completion claim.
 */

import { eq, sql } from 'drizzle-orm';
import { chefSchema, db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';

const { chefs, chefRecipes, scrapingJobs } = chefSchema;

interface ChefVerification {
  slug: string;
  name: string;
  expectedRecipes: number;
  actualRecipes: number;
  status: 'missing' | 'complete' | 'partial' | 'over';
}

const EXPECTED_CHEFS: Record<string, number> = {
  'alton-brown': 12,
  'bren-smith': 11,
  'cristina-scarpaleggia': 12,
  'dan-barber': 14,
  'david-zilber': 10,
  'ina-garten': 12,
  'jeremy-fox': 11,
  'kirsten-christopher-shockey': 13,
  'nancy-silverton': 12,
  'tamar-adler': 14,
};

async function generateReport() {
  console.log('\n');
  console.log('═'.repeat(80));
  console.log('   COMPREHENSIVE CHEF RECIPE VERIFICATION REPORT');
  console.log('   10 Sustainability-Focused Chefs - Batch Import Analysis');
  console.log('═'.repeat(80));
  console.log('\n');

  const verifications: ChefVerification[] = [];
  let totalExpected = 0;
  let totalActual = 0;

  // 1. Chef-by-Chef Analysis
  console.log('📋 CHEF-BY-CHEF ANALYSIS\n');
  console.log('-'.repeat(80));

  for (const [slug, expectedCount] of Object.entries(EXPECTED_CHEFS)) {
    totalExpected += expectedCount;

    // Find chef in database
    const chefResult = await db.select().from(chefs).where(eq(chefs.slug, slug)).limit(1);

    if (chefResult.length === 0) {
      console.log(`❌ ${slug.padEnd(40)} NOT FOUND IN DATABASE`);
      verifications.push({
        slug,
        name: slug,
        expectedRecipes: expectedCount,
        actualRecipes: 0,
        status: 'missing',
      });
      continue;
    }

    const chef = chefResult[0];

    // Count recipes via junction table
    const recipeCountResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(chefRecipes)
      .where(eq(chefRecipes.chef_id, chef.id));

    const actualCount = recipeCountResult[0]?.count || 0;
    totalActual += actualCount;

    const status =
      actualCount === 0
        ? 'missing'
        : actualCount === expectedCount
          ? 'complete'
          : actualCount < expectedCount
            ? 'partial'
            : 'over';

    const statusIcon =
      status === 'complete' ? '✅' : status === 'partial' ? '⚠️' : status === 'over' ? '📈' : '❌';

    console.log(
      `${statusIcon} ${chef.name.padEnd(35)} ${actualCount.toString().padStart(3)} / ${expectedCount.toString().padStart(3)} recipes`
    );

    verifications.push({
      slug: chef.slug,
      name: chef.name,
      expectedRecipes: expectedCount,
      actualRecipes: actualCount,
      status,
    });
  }

  // 2. Summary Statistics
  console.log(`\n${'═'.repeat(80)}`);
  console.log('📊 SUMMARY STATISTICS\n');

  const missingChefs = verifications.filter((v) => v.status === 'missing');
  const completeChefs = verifications.filter((v) => v.status === 'complete');
  const partialChefs = verifications.filter((v) => v.status === 'partial');
  const overChefs = verifications.filter((v) => v.status === 'over');

  console.log(`Total Expected Recipes:        ${totalExpected}`);
  console.log(`Total Actual Recipes:          ${totalActual}`);
  console.log(
    `Success Rate:                  ${((totalActual / totalExpected) * 100).toFixed(1)}%`
  );
  console.log(`Expected from Batch Import:    95 (out of 121 URLs attempted)`);
  console.log('');
  console.log(`Chefs with Complete Import:    ${completeChefs.length} / 10`);
  console.log(`Chefs with Partial Import:     ${partialChefs.length} / 10`);
  console.log(`Chefs with Zero Recipes:       ${missingChefs.length} / 10`);
  console.log(`Chefs with Extra Recipes:      ${overChefs.length} / 10`);

  // 3. Detailed Discrepancy Report
  if (missingChefs.length > 0 || partialChefs.length > 0 || overChefs.length > 0) {
    console.log(`\n${'═'.repeat(80)}`);
    console.log('⚠️  DISCREPANCY DETAILS\n');

    if (missingChefs.length > 0) {
      console.log('❌ Chefs with ZERO recipes:');
      missingChefs.forEach((chef) => {
        console.log(`   - ${chef.name} (expected ${chef.expectedRecipes})`);
      });
      console.log('');
    }

    if (partialChefs.length > 0) {
      console.log('⚠️  Chefs with PARTIAL imports:');
      partialChefs.forEach((chef) => {
        const missing = chef.expectedRecipes - chef.actualRecipes;
        console.log(
          `   - ${chef.name}: ${chef.actualRecipes}/${chef.expectedRecipes} (missing ${missing})`
        );
      });
      console.log('');
    }

    if (overChefs.length > 0) {
      console.log('📈 Chefs with MORE than expected:');
      overChefs.forEach((chef) => {
        const extra = chef.actualRecipes - chef.expectedRecipes;
        console.log(
          `   - ${chef.name}: ${chef.actualRecipes}/${chef.expectedRecipes} (+${extra} extra)`
        );
      });
      console.log('');
    }
  }

  // 4. Database Health Check
  console.log('═'.repeat(80));
  console.log('🔍 DATABASE HEALTH CHECK\n');

  const totalRecipesResult = await db.select({ count: sql<number>`count(*)::int` }).from(recipes);
  const totalRecipes = totalRecipesResult[0]?.count || 0;

  const recipesWithChefIdResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(recipes)
    .where(sql`${recipes.chef_id} IS NOT NULL`);
  const recipesWithChefId = recipesWithChefIdResult[0]?.count || 0;

  const recipesInJunctionResult = await db
    .select({ count: sql<number>`count(DISTINCT ${chefRecipes.recipe_id})::int` })
    .from(chefRecipes);
  const recipesInJunction = recipesInJunctionResult[0]?.count || 0;

  const scrapingJobsResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(scrapingJobs);
  const scrapingJobsCount = scrapingJobsResult[0]?.count || 0;

  console.log(`Total Recipes in Database:              ${totalRecipes}`);
  console.log(`Recipes with chef_id set:               ${recipesWithChefId}`);
  console.log(`Recipes in chef_recipes junction:       ${recipesInJunction}`);
  console.log(`Scraping Jobs Recorded:                 ${scrapingJobsCount}`);

  // 5. Batch Import Status Assessment
  console.log(`\n${'═'.repeat(80)}`);
  console.log('🎯 BATCH IMPORT STATUS ASSESSMENT\n');

  if (scrapingJobsCount === 0) {
    console.log('❌ CRITICAL: No scraping jobs found in database');
    console.log('   This indicates the batch import has NOT been executed yet.\n');

    console.log('📝 EXPECTED WORKFLOW:');
    console.log('   1. Batch import script runs (121 recipe URLs)');
    console.log('   2. Scraping jobs created in scraping_jobs table');
    console.log('   3. Recipes imported to recipes table');
    console.log('   4. Chef-recipe relationships created in chef_recipes table');
    console.log('   5. Chef recipe_count fields updated\n');

    console.log('🔴 CURRENT STATE:');
    console.log('   Step 1: ❌ NOT STARTED (no scraping jobs)');
    console.log('   Step 2: ❌ NOT COMPLETED');
    console.log('   Step 3: ❌ NOT COMPLETED');
    console.log('   Step 4: ❌ NOT COMPLETED');
    console.log('   Step 5: ❌ NOT COMPLETED\n');
  } else {
    console.log(`✅ Found ${scrapingJobsCount} scraping job(s) in database`);
    console.log('   Batch import has been attempted.\n');
  }

  // 6. Recommendations
  console.log('═'.repeat(80));
  console.log('💡 RECOMMENDATIONS\n');

  if (totalActual === 0) {
    console.log('⚠️  ACTION REQUIRED: No recipes have been imported for target chefs\n');
    console.log('Next Steps:');
    console.log('   1. Verify batch import script exists: scripts/batch-import-121-recipes.ts');
    console.log('   2. Check for URL list: docs/scraping/recipes-10-24-2025.md');
    console.log('   3. Run the batch import script or use the admin UI');
    console.log('   4. Monitor progress and verify completion');
    console.log('   5. Re-run this verification script\n');
  } else if (totalActual < totalExpected) {
    console.log(
      `⚠️  PARTIAL SUCCESS: ${totalActual}/${totalExpected} recipes imported (${((totalActual / totalExpected) * 100).toFixed(1)}%)\n`
    );
    console.log('Next Steps:');
    console.log('   1. Review failed URLs from batch import logs');
    console.log('   2. Manually retry failed imports');
    console.log('   3. Check for URL availability/changes');
    console.log('   4. Verify chef-recipe linking is working correctly\n');
  } else if (totalActual === totalExpected) {
    console.log('✅ SUCCESS: All expected recipes have been imported!\n');
    console.log('Next Steps:');
    console.log('   1. Verify recipe quality and data completeness');
    console.log('   2. Check ingredient extraction coverage');
    console.log('   3. Generate embeddings for search functionality');
    console.log('   4. Update chef recipe_count fields if needed\n');
  }

  console.log('═'.repeat(80));
  console.log('✅ Verification Complete');
  console.log('═'.repeat(80));
  console.log('\n');

  process.exit(0);
}

generateReport().catch((error) => {
  console.error('Fatal error during verification:', error);
  process.exit(1);
});
