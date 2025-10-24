#!/usr/bin/env tsx
/**
 * Analyze Chef Count Source
 *
 * Determines which method was used to calculate the stored recipe_count:
 * - recipes.chef_id (direct foreign key)
 * - chef_recipes join table (many-to-many)
 */

import { db } from '../src/lib/db/index.js';
import { recipes } from '../src/lib/db/schema.js';
import { chefs, chefRecipes } from '../src/lib/db/chef-schema.js';
import { sql, eq } from 'drizzle-orm';

async function analyzeCountSource() {
  console.log('\n🔍 Analyzing Chef Recipe Count Source\n');
  console.log('='.repeat(90));

  // Get all chefs with their stored counts
  const allChefs = await db.select().from(chefs);

  console.log(`\nTotal chefs: ${allChefs.length}\n`);

  console.log('Chef Name                    Stored   Via chef_id   Via join    Match?');
  console.log('-'.repeat(90));

  let matchesChefId = 0;
  let matchesJoinTable = 0;
  let matchesNeither = 0;
  let matchesBoth = 0;

  for (const chef of allChefs) {
    const storedCount = chef.recipe_count || 0;

    // Count via recipes.chef_id
    const viaChefIdResult = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(recipes)
      .where(eq(recipes.chef_id, chef.id));
    const viaChefId = Number(viaChefIdResult[0]?.count || 0);

    // Count via chef_recipes join table
    const viaJoinResult = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(chefRecipes)
      .where(eq(chefRecipes.chef_id, chef.id));
    const viaJoin = Number(viaJoinResult[0]?.count || 0);

    const matchChefId = storedCount === viaChefId;
    const matchJoin = storedCount === viaJoin;

    let matchStatus = '';
    if (matchChefId && matchJoin) {
      matchStatus = '✅ Both';
      matchesBoth++;
    } else if (matchChefId) {
      matchStatus = '🔵 chef_id';
      matchesChefId++;
    } else if (matchJoin) {
      matchStatus = '🟢 join';
      matchesJoinTable++;
    } else {
      matchStatus = '❌ Neither';
      matchesNeither++;
    }

    const name = chef.name.padEnd(28);
    const stored = String(storedCount).padStart(6);
    const chefIdCount = String(viaChefId).padStart(12);
    const joinCount = String(viaJoin).padStart(10);

    console.log(`${name} ${stored}   ${chefIdCount}   ${joinCount}    ${matchStatus}`);
  }

  console.log('\n' + '='.repeat(90));
  console.log('\n📊 SUMMARY:\n');
  console.log(`   Matches Both: ${matchesBoth}/${allChefs.length}`);
  console.log(`   Matches chef_id only: ${matchesChefId}/${allChefs.length}`);
  console.log(`   Matches join table only: ${matchesJoinTable}/${allChefs.length}`);
  console.log(`   Matches Neither: ${matchesNeither}/${allChefs.length}`);

  console.log('\n' + '='.repeat(90));
  console.log('\n🎯 CONCLUSION:\n');

  if (matchesJoinTable > matchesChefId) {
    console.log('✅ STORED COUNTS ARE FROM: chef_recipes join table');
    console.log('   This is the correct source of truth.');
    console.log('\n💡 ISSUE:');
    console.log('   The verification script was correct to use chef_recipes.');
    console.log('   The discrepancy means some recipes are:');
    console.log('   - In chef_recipes table (counted)');
    console.log('   - But deleted/missing from recipes table (not visible)');
    console.log('\n🔧 SOLUTION:');
    console.log('   1. Find orphaned chef_recipes entries (recipes that don\'t exist)');
    console.log('   2. Clean up orphaned entries');
    console.log('   3. Re-sync recipe counts');
  } else if (matchesChefId > matchesJoinTable) {
    console.log('⚠️  STORED COUNTS ARE FROM: recipes.chef_id field');
    console.log('   But chef_recipes join table exists and is populated.');
    console.log('\n💡 ISSUE:');
    console.log('   System appears to be migrating from one approach to another.');
    console.log('   Need to decide on single source of truth.');
    console.log('\n🔧 SOLUTION:');
    console.log('   1. Sync chef_recipes table with recipes.chef_id');
    console.log('   2. Update all recipe_count from chef_recipes');
    console.log('   3. Use chef_recipes as source of truth going forward');
  } else {
    console.log('🤔 MIXED SOURCES DETECTED:');
    console.log('   No clear pattern. Manual investigation needed.');
  }

  console.log('\n' + '='.repeat(90) + '\n');
}

analyzeCountSource().catch((error) => {
  console.error('Error analyzing count source:', error);
  process.exit(1);
});
