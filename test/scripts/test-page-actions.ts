#!/usr/bin/env tsx
/**
 * Test script to verify the actual server actions work correctly
 * Simulates what the pages do when they load
 */

import { getPublicMeals } from '@/app/actions/meals';
import { getAllChefs } from '@/app/actions/chefs';

async function testPageActions() {
  console.log('🧪 Testing Server Actions\n');
  console.log('='.repeat(80));

  // ========================================================================
  // TEST MEALS ACTION
  // ========================================================================
  console.log('\n📊 Testing getPublicMeals()');
  console.log('-'.repeat(80));

  try {
    const mealsResult = await getPublicMeals();

    console.log(`\nResult success: ${mealsResult.success}`);

    if (mealsResult.success && mealsResult.data) {
      console.log(`✅ Meals returned: ${mealsResult.data.length}`);

      if (mealsResult.data.length > 0) {
        console.log('\n📋 First 3 meals:');
        mealsResult.data.slice(0, 3).forEach((meal, idx) => {
          console.log(`  ${idx + 1}. ${meal.name}`);
          console.log(`     - ID: ${meal.id}`);
          console.log(`     - is_public: ${meal.is_public}`);
          console.log(`     - user_id: ${meal.user_id}`);
        });
      } else {
        console.log('❌ NO MEALS RETURNED - This is the problem!');
      }
    } else {
      console.log(`❌ Error: ${mealsResult.error}`);
    }
  } catch (error) {
    console.error('❌ Exception in getPublicMeals:', error);
  }

  // ========================================================================
  // TEST MEALS ACTION WITH FILTER
  // ========================================================================
  console.log('\n\n📊 Testing getPublicMeals({ mealType: "dinner" })');
  console.log('-'.repeat(80));

  try {
    const filteredMealsResult = await getPublicMeals({ mealType: 'dinner' });

    console.log(`\nResult success: ${filteredMealsResult.success}`);

    if (filteredMealsResult.success && filteredMealsResult.data) {
      console.log(`✅ Dinner meals returned: ${filteredMealsResult.data.length}`);
    } else {
      console.log(`❌ Error: ${filteredMealsResult.error}`);
    }
  } catch (error) {
    console.error('❌ Exception in getPublicMeals with filter:', error);
  }

  // ========================================================================
  // TEST CHEFS ACTION
  // ========================================================================
  console.log('\n\n📊 Testing getAllChefs()');
  console.log('-'.repeat(80));

  try {
    const chefsResult = await getAllChefs();

    console.log(`\nResult success: ${chefsResult.success}`);

    if (chefsResult.success && chefsResult.chefs) {
      console.log(`✅ Chefs returned: ${chefsResult.chefs.length}`);

      if (chefsResult.chefs.length > 0) {
        console.log('\n📋 First 3 chefs:');
        chefsResult.chefs.slice(0, 3).forEach((chef, idx) => {
          console.log(`  ${idx + 1}. ${chef.name}`);
          console.log(`     - ID: ${chef.id}`);
          console.log(`     - Recipe Count: ${chef.recipeCount}`);
          console.log(`     - Location: ${chef.locationCity || 'N/A'}`);
        });
      } else {
        console.log('❌ NO CHEFS RETURNED - This is the problem!');
      }
    } else {
      console.log(`❌ Error: ${chefsResult.error}`);
    }
  } catch (error) {
    console.error('❌ Exception in getAllChefs:', error);
  }

  // ========================================================================
  // SUMMARY
  // ========================================================================
  console.log('\n\n📝 SUMMARY');
  console.log('='.repeat(80));
  console.log('\nIf the server actions return data but the pages show 0 results,');
  console.log('the issue is likely in:');
  console.log('  1. Page component rendering logic');
  console.log('  2. Client-side component state management');
  console.log('  3. Next.js caching/revalidation');
  console.log('  4. Middleware intercepting requests\n');

  process.exit(0);
}

// Run the tests
testPageActions();
