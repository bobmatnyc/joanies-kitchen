#!/usr/bin/env tsx
/**
 * Final Verification - Public Recipe Visibility
 *
 * Comprehensive verification that all system/curated recipes are properly
 * configured as public and accessible without sign-in.
 *
 * Checks:
 * 1. All chef recipes are public
 * 2. All system recipes are public
 * 3. The specific problematic recipe from the issue
 * 4. Overall database statistics
 *
 * Run: npx tsx scripts/final-verification-public-recipes.ts
 */

import { db } from '../src/lib/db/index';
import { recipes } from '../src/lib/db/schema';
import { chefs } from '../src/lib/db/chef-schema';
import { eq, isNotNull, and, sql } from 'drizzle-orm';

async function finalVerification() {
  console.log('🔍 FINAL VERIFICATION - Public Recipe Accessibility\n');
  console.log('='.repeat(60));

  try {
    // 1. Overall Database Statistics
    const overallStats = await db.select({
      total: sql<number>`count(*)`,
      systemRecipes: sql<number>`count(*) filter (where is_system_recipe = true)`,
      publicRecipes: sql<number>`count(*) filter (where is_public = true)`,
      privateRecipes: sql<number>`count(*) filter (where is_public = false)`,
      chefRecipes: sql<number>`count(*) filter (where chef_id is not null)`
    })
    .from(recipes);

    console.log('\n📊 OVERALL DATABASE STATISTICS:');
    console.log(`   Total recipes: ${overallStats[0].total}`);
    console.log(`   System/curated recipes: ${overallStats[0].systemRecipes}`);
    console.log(`   Public recipes: ${overallStats[0].publicRecipes} (${((overallStats[0].publicRecipes/overallStats[0].total)*100).toFixed(1)}%)`);
    console.log(`   Private recipes: ${overallStats[0].privateRecipes} (${((overallStats[0].privateRecipes/overallStats[0].total)*100).toFixed(1)}%)`);
    console.log(`   Chef-attributed recipes: ${overallStats[0].chefRecipes}`);

    // 2. Chef Recipe Verification
    console.log('\n' + '='.repeat(60));
    console.log('👨‍🍳 CHEF RECIPE VERIFICATION:');

    const chefStats = await db.select({
      total: sql<number>`count(*)`,
      public: sql<number>`count(*) filter (where is_public = true)`,
      private: sql<number>`count(*) filter (where is_public = false)`,
      system: sql<number>`count(*) filter (where is_system_recipe = true)`
    })
    .from(recipes)
    .where(isNotNull(recipes.chef_id));

    const chefStatus = Number(chefStats[0].private) === 0 ? '✅' : '❌';
    console.log(`   ${chefStatus} Chef recipes: ${chefStats[0].total} total, ${chefStats[0].public} public, ${chefStats[0].private} private`);

    if (chefStats[0].private > 0) {
      console.log(`   ⚠️  CRITICAL: ${chefStats[0].private} chef recipes are still private!`);
    }

    // 3. System Recipe Verification (all system recipes, not just chef)
    console.log('\n' + '='.repeat(60));
    console.log('🗂️  SYSTEM RECIPE VERIFICATION:');

    const systemStats = await db.select({
      total: sql<number>`count(*)`,
      public: sql<number>`count(*) filter (where is_public = true)`,
      private: sql<number>`count(*) filter (where is_public = false)`
    })
    .from(recipes)
    .where(eq(recipes.is_system_recipe, true));

    const systemStatus = Number(systemStats[0].private) === 0 ? '✅' : '❌';
    console.log(`   ${systemStatus} System recipes: ${systemStats[0].total} total, ${systemStats[0].public} public, ${systemStats[0].private} private`);

    if (systemStats[0].private > 0) {
      console.log(`   ⚠️  CRITICAL: ${systemStats[0].private} system recipes are still private!`);
    }

    // 4. Specific Recipe from Issue
    console.log('\n' + '='.repeat(60));
    console.log('🎯 SPECIFIC RECIPE TEST (from GitHub issue):');

    const specificRecipe = await db
      .select({
        id: recipes.id,
        name: recipes.name,
        isPublic: recipes.is_public,
        isSystemRecipe: recipes.is_system_recipe,
        chefId: recipes.chef_id
      })
      .from(recipes)
      .where(eq(recipes.id, 'b81ac1f7-8a60-4e1f-9c9e-91b1794b4230'))
      .limit(1);

    if (specificRecipe.length > 0) {
      const recipe = specificRecipe[0];
      const publicStatus = recipe.isPublic ? '✅' : '❌';
      const systemStatus = recipe.isSystemRecipe ? '✅' : '❌';

      console.log(`   Recipe: ${recipe.name}`);
      console.log(`   URL: https://joanies.kitchen/recipes/${recipe.id}`);
      console.log(`   ${publicStatus} isPublic: ${recipe.isPublic}`);
      console.log(`   ${systemStatus} isSystemRecipe: ${recipe.isSystemRecipe}`);
      console.log(`   Has chef attribution: ${recipe.chefId ? 'Yes ✅' : 'No'}`);

      if (!recipe.isPublic) {
        console.log(`\n   ❌ CRITICAL: This recipe is still private! Users cannot access it.`);
      }
    } else {
      console.log(`   ⚠️  Recipe not found in database.`);
    }

    // 5. Chef Breakdown
    console.log('\n' + '='.repeat(60));
    console.log('👥 CHEF BREAKDOWN:');

    const chefBreakdown = await db
      .select({
        chefName: chefs.name,
        chefSlug: chefs.slug,
        recipeCount: sql<number>`count(${recipes.id})`,
        publicCount: sql<number>`count(*) filter (where ${recipes.is_public} = true)`,
        privateCount: sql<number>`count(*) filter (where ${recipes.is_public} = false)`
      })
      .from(recipes)
      .leftJoin(chefs, eq(recipes.chef_id, chefs.id))
      .where(isNotNull(recipes.chef_id))
      .groupBy(chefs.name, chefs.slug)
      .orderBy(chefs.name);

    chefBreakdown.forEach(chef => {
      const privateCount = Number(chef.privateCount);
      const status = privateCount === 0 ? '✅' : '❌';
      console.log(`   ${status} ${chef.chefName}: ${chef.recipeCount} recipes (${chef.publicCount} public, ${privateCount} private)`);
    });

    // 6. Final Verdict
    console.log('\n' + '='.repeat(60));
    console.log('🏁 FINAL VERDICT:');

    const allChefRecipesPublic = Number(chefStats[0].private) === 0;
    const allSystemRecipesPublic = Number(systemStats[0].private) === 0;
    const specificRecipePublic = specificRecipe.length > 0 && specificRecipe[0].isPublic;

    if (allChefRecipesPublic && allSystemRecipesPublic && specificRecipePublic) {
      console.log('\n🎉 ✅ SUCCESS! All checks passed:');
      console.log('   ✅ All chef recipes are public');
      console.log('   ✅ All system recipes are public');
      console.log('   ✅ Specific problematic recipe is now public');
      console.log('\n   Production site should now display all recipes correctly!');
      console.log('   Users can access recipes without signing in.');
    } else {
      console.log('\n❌ FAILURE! Some issues remain:');
      if (!allChefRecipesPublic) {
        console.log(`   ❌ ${chefStats[0].private} chef recipes are still private`);
      }
      if (!allSystemRecipesPublic) {
        console.log(`   ❌ ${systemStats[0].private} system recipes are still private`);
      }
      if (!specificRecipePublic) {
        console.log('   ❌ Specific recipe from issue is still private');
      }
      console.log('\n   Manual investigation required!');
    }

    console.log('\n' + '='.repeat(60));

  } catch (error) {
    console.error('❌ Error during verification:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Run final verification
finalVerification();
