#!/usr/bin/env tsx
/**
 * Debug script to investigate why meals and chefs pages show 0 results
 *
 * This script checks:
 * 1. Total meal count
 * 2. Public meal count (is_public = true)
 * 3. Total chef count
 * 4. Active chef count (is_active = true)
 * 5. Sample records to verify field values
 */

import { db } from '../src/lib/db';
import { meals } from '../src/lib/db/meals-schema';
import { chefs } from '../src/lib/db/chef-schema';
import { eq, sql } from 'drizzle-orm';

async function debugMealsAndChefs() {
  console.log('🔍 Debugging Meals and Chefs Queries\n');
  console.log('=' .repeat(80));

  try {
    // ========================================================================
    // MEALS INVESTIGATION
    // ========================================================================
    console.log('\n📊 MEALS ANALYSIS');
    console.log('-'.repeat(80));

    // Total meal count
    const totalMealsResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(meals);
    const totalMeals = totalMealsResult[0]?.count || 0;
    console.log(`\n✅ Total meals in database: ${totalMeals}`);

    // Public meal count
    const publicMealsResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(meals)
      .where(eq(meals.is_public, true));
    const publicMeals = publicMealsResult[0]?.count || 0;
    console.log(`✅ Public meals (is_public = true): ${publicMeals}`);

    // Private meal count
    const privateMealsResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(meals)
      .where(eq(meals.is_public, false));
    const privateMeals = privateMealsResult[0]?.count || 0;
    console.log(`✅ Private meals (is_public = false): ${privateMeals}`);

    // NULL is_public count
    const nullPublicResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(meals)
      .where(sql`${meals.is_public} IS NULL`);
    const nullPublic = nullPublicResult[0]?.count || 0;
    console.log(`⚠️  Meals with NULL is_public: ${nullPublic}`);

    // Sample meals
    console.log('\n📋 Sample meals (first 5):');
    const sampleMeals = await db
      .select({
        id: meals.id,
        name: meals.name,
        is_public: meals.is_public,
        user_id: meals.user_id,
        slug: meals.slug,
        created_at: meals.created_at,
      })
      .from(meals)
      .limit(5);

    sampleMeals.forEach((meal, idx) => {
      console.log(`  ${idx + 1}. ${meal.name}`);
      console.log(`     - is_public: ${meal.is_public}`);
      console.log(`     - slug: ${meal.slug || 'NULL'}`);
      console.log(`     - user_id: ${meal.user_id}`);
    });

    // ========================================================================
    // CHEFS INVESTIGATION
    // ========================================================================
    console.log('\n\n📊 CHEFS ANALYSIS');
    console.log('-'.repeat(80));

    // Total chef count
    const totalChefsResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(chefs);
    const totalChefs = totalChefsResult[0]?.count || 0;
    console.log(`\n✅ Total chefs in database: ${totalChefs}`);

    // Active chef count
    const activeChefsResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(chefs)
      .where(eq(chefs.is_active, true));
    const activeChefs = activeChefsResult[0]?.count || 0;
    console.log(`✅ Active chefs (is_active = true): ${activeChefs}`);

    // Inactive chef count
    const inactiveChefsResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(chefs)
      .where(eq(chefs.is_active, false));
    const inactiveChefs = inactiveChefsResult[0]?.count || 0;
    console.log(`✅ Inactive chefs (is_active = false): ${inactiveChefs}`);

    // NULL is_active count
    const nullActiveResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(chefs)
      .where(sql`${chefs.is_active} IS NULL`);
    const nullActive = nullActiveResult[0]?.count || 0;
    console.log(`⚠️  Chefs with NULL is_active: ${nullActive}`);

    // Sample chefs
    console.log('\n📋 Sample chefs (first 5):');
    const sampleChefs = await db
      .select({
        id: chefs.id,
        name: chefs.name,
        is_active: chefs.is_active,
        recipe_count: chefs.recipe_count,
        slug: chefs.slug,
      })
      .from(chefs)
      .limit(5);

    sampleChefs.forEach((chef, idx) => {
      console.log(`  ${idx + 1}. ${chef.name}`);
      console.log(`     - is_active: ${chef.is_active}`);
      console.log(`     - recipe_count: ${chef.recipe_count}`);
      console.log(`     - slug: ${chef.slug}`);
    });

    // ========================================================================
    // SUMMARY
    // ========================================================================
    console.log('\n\n📝 SUMMARY');
    console.log('='.repeat(80));
    console.log(`\n🍽️  MEALS:`);
    console.log(`   Total: ${totalMeals}`);
    console.log(`   Public (shown on /meals): ${publicMeals}`);
    console.log(`   Private: ${privateMeals}`);
    console.log(`   NULL is_public: ${nullPublic}`);

    console.log(`\n👨‍🍳 CHEFS:`);
    console.log(`   Total: ${totalChefs}`);
    console.log(`   Active (shown on /discover/chefs): ${activeChefs}`);
    console.log(`   Inactive: ${inactiveChefs}`);
    console.log(`   NULL is_active: ${nullActive}`);

    console.log('\n\n🔎 DIAGNOSIS:');
    if (publicMeals === 0 && totalMeals > 0) {
      console.log('   ⚠️  MEALS ISSUE: All meals have is_public = false or NULL');
      console.log('   ➡️  FIX: Update meals to set is_public = true for public meals');
    } else if (publicMeals > 0) {
      console.log('   ✅ MEALS: Should be displaying correctly');
    }

    if (activeChefs === 0 && totalChefs > 0) {
      console.log('   ⚠️  CHEFS ISSUE: All chefs have is_active = false or NULL');
      console.log('   ➡️  FIX: Update chefs to set is_active = true for active chefs');
    } else if (activeChefs > 0) {
      console.log('   ✅ CHEFS: Should be displaying correctly');
    }

    console.log('\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error during investigation:', error);
    process.exit(1);
  }
}

// Run the investigation
debugMealsAndChefs();
