#!/usr/bin/env tsx
/**
 * Check Recipe-Chef Linkage Methods
 *
 * Investigates how recipes are linked to chefs:
 * 1. Via recipes.chef_id field (direct foreign key)
 * 2. Via chef_recipes join table (many-to-many relationship)
 */

import { db } from '@/lib/db/index.js';
import { recipes } from '@/lib/db/schema.js';
import { chefs, chefRecipes } from '@/lib/db/chef-schema.js';
import { sql, eq } from 'drizzle-orm';

async function checkRecipeLinks() {
  console.log('\n🔍 Checking Recipe-Chef Linkage Methods\n');
  console.log('='.repeat(80));

  // Method 1: Count recipes linked via recipes.chef_id
  const viaChefIdField = await db
    .select({
      chefId: recipes.chef_id,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(recipes)
    .where(sql`${recipes.chef_id} IS NOT NULL`)
    .groupBy(recipes.chef_id);

  console.log('\n📊 Method 1: Recipes linked via recipes.chef_id field');
  console.log(`   Total chefs with recipes: ${viaChefIdField.length}`);
  const totalViaField = viaChefIdField.reduce((sum, r) => sum + Number(r.count), 0);
  console.log(`   Total recipes: ${totalViaField}\n`);

  if (viaChefIdField.length > 0) {
    console.log('   Top 10 chefs by recipe count:');
    const sorted = viaChefIdField.sort((a, b) => Number(b.count) - Number(a.count)).slice(0, 10);
    for (const row of sorted) {
      const chef = await db.query.chefs.findFirst({
        where: eq(chefs.id, row.chefId!),
      });
      console.log(`     ${chef?.name || 'Unknown'}: ${row.count} recipes`);
    }
  }

  console.log('\n' + '-'.repeat(80));

  // Method 2: Count entries in chef_recipes join table
  const viaJoinTable = await db
    .select({
      chefId: chefRecipes.chef_id,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(chefRecipes)
    .groupBy(chefRecipes.chef_id);

  console.log('\n📊 Method 2: Recipes linked via chef_recipes join table');
  console.log(`   Total chefs with recipes: ${viaJoinTable.length}`);
  const totalViaJoin = viaJoinTable.reduce((sum, r) => sum + Number(r.count), 0);
  console.log(`   Total recipes: ${totalViaJoin}\n`);

  if (viaJoinTable.length > 0) {
    console.log('   Top 10 chefs by recipe count:');
    const sorted = viaJoinTable.sort((a, b) => Number(b.count) - Number(a.count)).slice(0, 10);
    for (const row of sorted) {
      const chef = await db.query.chefs.findFirst({
        where: eq(chefs.id, row.chefId),
      });
      console.log(`     ${chef?.name || 'Unknown'}: ${row.count} recipes`);
    }
  } else {
    console.log('   ⚠️  No entries found in chef_recipes table!');
  }

  console.log('\n' + '='.repeat(80));

  // Analysis
  console.log('\n🔬 ANALYSIS:\n');

  if (totalViaField > 0 && totalViaJoin === 0) {
    console.log('❌ PROBLEM IDENTIFIED:');
    console.log('   - Recipes are linked via recipes.chef_id field');
    console.log('   - But NOT in the chef_recipes join table');
    console.log('   - The chef_recipes table is EMPTY');
    console.log('\n💡 SOLUTION:');
    console.log('   - The stored recipe_count appears to be from recipes.chef_id');
    console.log('   - But the verification script checks chef_recipes table');
    console.log('   - Need to either:');
    console.log('     a) Populate chef_recipes table from recipes.chef_id');
    console.log('     b) Update verification to check recipes.chef_id instead');
    console.log('\n🎯 RECOMMENDED ACTION:');
    console.log('   Run: npx tsx scripts/sync-chef-recipes-join-table.ts');
  } else if (totalViaField > 0 && totalViaJoin > 0) {
    console.log('⚠️  DUAL LINKAGE DETECTED:');
    console.log('   - Recipes linked via BOTH methods');
    console.log('   - This could indicate data inconsistency');
    console.log('   - Verify which is the source of truth');
  } else if (totalViaField === 0 && totalViaJoin > 0) {
    console.log('✅ USING JOIN TABLE:');
    console.log('   - Recipes linked via chef_recipes join table');
    console.log('   - This is the recommended approach');
  } else {
    console.log('⚠️  NO LINKAGE FOUND:');
    console.log('   - No recipes linked to chefs');
    console.log('   - This may be expected for a new database');
  }

  console.log('\n' + '='.repeat(80) + '\n');
}

checkRecipeLinks().catch((error) => {
  console.error('Error checking recipe links:', error);
  process.exit(1);
});
