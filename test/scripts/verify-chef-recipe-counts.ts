#!/usr/bin/env tsx
/**
 * Verify Chef Recipe Counts
 *
 * Compares stored recipe_count in chefs table with actual count from chef_recipes join table.
 * This is the source of truth for chef-recipe relationships.
 */

import { db } from '@/lib/db/index.js';
import { chefRecipes, chefs } from '@/lib/db/chef-schema.js';
import { eq, sql } from 'drizzle-orm';

async function verifyChefCounts() {
  console.log('\n🔍 Verifying Chef Recipe Counts\n');
  console.log('='.repeat(80));
  console.log('\nSource of Truth: chef_recipes join table');
  console.log('Comparing with: chefs.recipe_count column\n');
  console.log('='.repeat(80));

  // Get all chefs
  const allChefs = await db.select().from(chefs).orderBy(sql`${chefs.recipe_count} DESC NULLS LAST`);

  console.log(`\nTotal chefs: ${allChefs.length}\n`);

  let correct = 0;
  let incorrect = 0;
  let discrepancies: Array<{
    id: string;
    chef: string;
    slug: string;
    stored: number;
    actual: number;
    diff: number;
    isActive: boolean;
  }> = [];

  console.log('Chef Recipe Count Verification:');
  console.log('-'.repeat(90));
  console.log('Chef Name                              Stored    Actual    Status    Active');
  console.log('-'.repeat(90));

  for (const chef of allChefs) {
    const storedCount = chef.recipe_count || 0;

    // Count actual recipes from chef_recipes table
    const countResult = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(chefRecipes)
      .where(eq(chefRecipes.chef_id, chef.id));

    const actualCount = Number(countResult[0]?.count || 0);
    const match = storedCount === actualCount;
    const activeStatus = chef.is_active ? '✓' : '✗';

    if (match) {
      correct++;
      console.log(
        `${chef.name.padEnd(38)} ${String(storedCount).padStart(6)} ${String(actualCount).padStart(9)}    ✅        ${activeStatus}`
      );
    } else {
      incorrect++;
      const diff = actualCount - storedCount;
      discrepancies.push({
        id: chef.id,
        chef: chef.name,
        slug: chef.slug,
        stored: storedCount,
        actual: actualCount,
        diff,
        isActive: chef.is_active || false,
      });
      console.log(
        `${chef.name.padEnd(38)} ${String(storedCount).padStart(6)} ${String(actualCount).padStart(9)}    ❌ (${diff > 0 ? '+' : ''}${diff})   ${activeStatus}`
      );
    }
  }

  console.log('\n' + '='.repeat(90));
  console.log(`\n📊 Summary:`);
  console.log(`   Total chefs: ${allChefs.length}`);
  console.log(`   Correct counts: ${correct}/${allChefs.length}`);
  console.log(`   Incorrect counts: ${incorrect}/${allChefs.length}`);
  console.log(`   Accuracy: ${((correct / allChefs.length) * 100).toFixed(1)}%\n`);

  if (discrepancies.length > 0) {
    console.log('⚠️  DISCREPANCIES FOUND:\n');
    discrepancies.forEach(({ id, chef, slug, stored, actual, diff, isActive }) => {
      console.log(`   ${chef} (@${slug}):`);
      console.log(`     ID: ${id}`);
      console.log(`     Stored: ${stored} | Actual: ${actual} | Difference: ${diff > 0 ? '+' : ''}${diff}`);
      console.log(`     Active: ${isActive ? 'Yes' : 'No'}`);
      console.log('');
    });
    console.log('💡 To fix these discrepancies:');
    console.log('   1. Run: npx tsx scripts/fix-chef-recipe-counts.ts');
    console.log('   2. Or manually update with: updateChefRecipeCount(chefId)\n');
  } else {
    console.log('✅ All chef recipe counts are accurate!\n');
  }

  console.log('='.repeat(90) + '\n');

  process.exit(incorrect > 0 ? 1 : 0);
}

verifyChefCounts().catch((error) => {
  console.error('Error verifying chef counts:', error);
  process.exit(1);
});
