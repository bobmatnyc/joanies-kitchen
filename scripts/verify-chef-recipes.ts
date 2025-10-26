#!/usr/bin/env tsx
/**
 * Verify Chef Recipe Assignments
 *
 * Checks the database to confirm all 10 sustainability-focused chefs have
 * their recipes properly imported and linked.
 *
 * Expected counts:
 * - Alton Brown: 12 recipes
 * - Bren Smith: 11 recipes
 * - Cristina Scarpaleggia: 12 recipes
 * - Dan Barber: 11 recipes
 * - David Zilber: 6 recipes
 * - Ina Garten: 12 recipes
 * - Jeremy Fox: 7 recipes
 * - Kirsten & Christopher Shockey: 13 recipes
 * - Nancy Silverton: 11 recipes
 * - Tamar Adler: 7 recipes
 * Total: 102 recipes expected (95 successful imports)
 */

import { db } from '../src/lib/db';
import { chefSchema } from '../src/lib/db';
import { eq, and, sql } from 'drizzle-orm';

const { chefs, chefRecipes } = chefSchema;
import { recipes } from '../src/lib/db/schema';

interface ChefRecipeCount {
  chefName: string;
  chefSlug: string;
  recipeCount: number;
  expectedCount: number;
}

// Expected counts per chef
const EXPECTED_COUNTS: Record<string, number> = {
  'alton-brown': 12,
  'bren-smith': 11,
  'cristina-scarpaleggia': 12,
  'dan-barber': 11,
  'david-zilber': 6,
  'ina-garten': 12,
  'jeremy-fox': 7,
  'kirsten-christopher-shockey': 13,
  'nancy-silverton': 11,
  'tamar-adler': 7,
};

async function verifyChefRecipes() {
  console.log('🔍 Verifying Chef Recipe Assignments\n');
  console.log('=' .repeat(80));

  const results: ChefRecipeCount[] = [];
  let totalRecipes = 0;
  let totalExpected = 0;
  const missingChefs: string[] = [];
  const discrepancies: { chef: string; expected: number; actual: number }[] = [];

  // Query each chef and their recipe count
  for (const [chefSlug, expectedCount] of Object.entries(EXPECTED_COUNTS)) {
    try {
      // Find the chef
      const chef = await db
        .select()
        .from(chefs)
        .where(eq(chefs.slug, chefSlug))
        .limit(1);

      if (chef.length === 0) {
        console.log(`❌ Chef not found: ${chefSlug}`);
        missingChefs.push(chefSlug);
        results.push({
          chefName: chefSlug,
          chefSlug,
          recipeCount: 0,
          expectedCount,
        });
        continue;
      }

      const chefData = chef[0];

      // Count recipes for this chef via chef_recipes junction table
      const recipeCountResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(chefRecipes)
        .where(eq(chefRecipes.chef_id, chefData.id));

      const actualCount = recipeCountResult[0]?.count || 0;
      totalRecipes += actualCount;
      totalExpected += expectedCount;

      results.push({
        chefName: chefData.name,
        chefSlug: chefData.slug,
        recipeCount: actualCount,
        expectedCount,
      });

      // Track discrepancies
      if (actualCount !== expectedCount) {
        discrepancies.push({
          chef: chefData.name,
          expected: expectedCount,
          actual: actualCount,
        });
      }

      // Status indicator
      const status = actualCount === expectedCount ? '✅' : actualCount > 0 ? '⚠️' : '❌';
      console.log(
        `${status} ${chefData.name.padEnd(35)} ${actualCount.toString().padStart(3)} / ${expectedCount} recipes`
      );
    } catch (error) {
      console.error(`Error processing chef ${chefSlug}:`, error);
    }
  }

  // Summary Report
  console.log('\n' + '='.repeat(80));
  console.log('📊 SUMMARY REPORT\n');

  console.log(`Total Recipes Imported:     ${totalRecipes}`);
  console.log(`Total Expected:             ${totalExpected}`);
  console.log(`Expected from Batch Import: 95 (out of 121 URLs attempted)`);
  console.log(`Success Rate:               ${((totalRecipes / totalExpected) * 100).toFixed(1)}%`);

  if (missingChefs.length > 0) {
    console.log('\n❌ Missing Chefs (not found in database):');
    missingChefs.forEach(chef => console.log(`   - ${chef}`));
  }

  if (discrepancies.length > 0) {
    console.log('\n⚠️  Recipe Count Discrepancies:');
    discrepancies.forEach(({ chef, expected, actual }) => {
      const diff = actual - expected;
      const diffStr = diff > 0 ? `+${diff}` : diff.toString();
      console.log(`   - ${chef.padEnd(35)} Expected: ${expected}, Actual: ${actual} (${diffStr})`);
    });
  }

  if (missingChefs.length === 0 && discrepancies.length === 0) {
    console.log('\n✅ All chefs have exactly the expected number of recipes!');
  }

  // Additional verification: Check for orphaned recipes
  console.log('\n' + '='.repeat(80));
  console.log('🔍 Additional Verification\n');

  // Get sample recipe names for each chef to verify data quality
  console.log('Sample Recipe Names (first 3 per chef):\n');

  for (const result of results.slice(0, 3)) { // Show samples for first 3 chefs
    if (result.recipeCount === 0) continue;

    const chef = await db
      .select()
      .from(chefs)
      .where(eq(chefs.slug, result.chefSlug))
      .limit(1);

    if (chef.length === 0) continue;

    const sampleRecipes = await db
      .select({
        name: recipes.name,
        source: recipes.source,
      })
      .from(chefRecipes)
      .innerJoin(recipes, eq(chefRecipes.recipe_id, recipes.id))
      .where(eq(chefRecipes.chef_id, chef[0].id))
      .limit(3);

    console.log(`${result.chefName}:`);
    sampleRecipes.forEach((recipe, idx) => {
      console.log(`   ${idx + 1}. ${recipe.name}`);
    });
    console.log('');
  }

  console.log('='.repeat(80));
  console.log('✅ Verification Complete\n');

  process.exit(0);
}

// Run verification
verifyChefRecipes().catch((error) => {
  console.error('Fatal error during verification:', error);
  process.exit(1);
});
