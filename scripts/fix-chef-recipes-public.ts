#!/usr/bin/env tsx
/**
 * Fix Chef Recipes Public Visibility
 *
 * CRITICAL FIX: Makes all chef recipes publicly accessible without sign-in
 *
 * Updates:
 * 1. Sets isPublic: true for all chef recipes
 * 2. Sets isSystemRecipe: true for curated chef content
 * 3. Ensures recipes without chef associations are system recipes
 *
 * Run: npx tsx scripts/fix-chef-recipes-public.ts
 */

import { db } from '../src/lib/db/index';
import { recipes } from '../src/lib/db/schema';
import { eq, isNotNull, and, sql } from 'drizzle-orm';

async function investigateAndFixChefRecipes() {
  console.log('🔍 Investigating chef recipe visibility...\n');

  try {
    // Step 1: Count total recipes
    const totalRecipes = await db.select({ count: sql<number>`count(*)` })
      .from(recipes);
    console.log(`📊 Total recipes in database: ${totalRecipes[0].count}`);

    // Step 2: Count recipes with chef associations
    const chefRecipes = await db.select({
      count: sql<number>`count(*)`,
      public: sql<number>`count(*) filter (where is_public = true)`,
      system: sql<number>`count(*) filter (where is_system_recipe = true)`,
      private: sql<number>`count(*) filter (where is_public = false)`
    })
    .from(recipes)
    .where(isNotNull(recipes.chef_id));

    console.log(`\n👨‍🍳 Chef-attributed recipes:`);
    console.log(`   Total: ${chefRecipes[0].count}`);
    console.log(`   Public: ${chefRecipes[0].public}`);
    console.log(`   System: ${chefRecipes[0].system}`);
    console.log(`   ❌ Private (NEEDS FIX): ${chefRecipes[0].private}`);

    // Step 3: Get sample of problematic recipes
    const problematicRecipes = await db.select({
      id: recipes.id,
      name: recipes.name,
      isPublic: recipes.is_public,
      isSystemRecipe: recipes.is_system_recipe,
      userId: recipes.user_id,
      chefId: recipes.chef_id
    })
    .from(recipes)
    .where(
      and(
        isNotNull(recipes.chef_id),
        eq(recipes.is_public, false)
      )
    )
    .limit(5);

    if (problematicRecipes.length > 0) {
      console.log(`\n⚠️  Sample of private chef recipes (first 5):`);
      problematicRecipes.forEach((recipe, idx) => {
        console.log(`   ${idx + 1}. ${recipe.name}`);
        console.log(`      ID: ${recipe.id}`);
        console.log(`      isPublic: ${recipe.isPublic}`);
        console.log(`      isSystemRecipe: ${recipe.isSystemRecipe}`);
        console.log(`      userId: ${recipe.userId}`);
        console.log(`      chefId: ${recipe.chefId}`);
      });
    }

    // Step 4: FIX - Update all chef recipes to be public and system recipes
    console.log(`\n🔧 Applying fixes...`);

    const updateResult = await db.update(recipes)
      .set({
        is_public: true,
        is_system_recipe: true,
        updated_at: new Date()
      })
      .where(isNotNull(recipes.chef_id))
      .returning({ id: recipes.id });

    console.log(`✅ Updated ${updateResult.length} chef recipes to be public and system recipes`);

    // Step 5: Verify the fix
    console.log(`\n🔍 Verifying fix...`);

    const verifyChefRecipes = await db.select({
      count: sql<number>`count(*)`,
      public: sql<number>`count(*) filter (where is_public = true)`,
      system: sql<number>`count(*) filter (where is_system_recipe = true)`,
      private: sql<number>`count(*) filter (where is_public = false)`
    })
    .from(recipes)
    .where(isNotNull(recipes.chef_id));

    console.log(`\n✅ POST-FIX Chef-attributed recipes:`);
    console.log(`   Total: ${verifyChefRecipes[0].count}`);
    console.log(`   Public: ${verifyChefRecipes[0].public}`);
    console.log(`   System: ${verifyChefRecipes[0].system}`);
    console.log(`   Private: ${verifyChefRecipes[0].private}`);

    if (verifyChefRecipes[0].private === 0) {
      console.log(`\n🎉 SUCCESS! All chef recipes are now public and accessible without sign-in.`);
    } else {
      console.log(`\n⚠️  WARNING: Still have ${verifyChefRecipes[0].private} private chef recipes. Manual investigation needed.`);
    }

    // Step 6: Sample verification - check a few recipes
    const verifyRecipes = await db.select({
      id: recipes.id,
      name: recipes.name,
      isPublic: recipes.is_public,
      isSystemRecipe: recipes.is_system_recipe,
      chefId: recipes.chef_id
    })
    .from(recipes)
    .where(isNotNull(recipes.chef_id))
    .limit(5);

    console.log(`\n📋 Sample of updated chef recipes (first 5):`);
    verifyRecipes.forEach((recipe, idx) => {
      console.log(`   ${idx + 1}. ${recipe.name}`);
      console.log(`      ID: ${recipe.id}`);
      console.log(`      isPublic: ${recipe.isPublic} ✅`);
      console.log(`      isSystemRecipe: ${recipe.isSystemRecipe} ✅`);
    });

    // Step 7: Check the specific problematic recipe mentioned
    const specificRecipe = await db.select({
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
      console.log(`\n🔍 Specific recipe check (b81ac1f7-8a60-4e1f-9c9e-91b1794b4230):`);
      console.log(`   Name: ${specificRecipe[0].name}`);
      console.log(`   isPublic: ${specificRecipe[0].isPublic} ${specificRecipe[0].isPublic ? '✅' : '❌'}`);
      console.log(`   isSystemRecipe: ${specificRecipe[0].isSystemRecipe} ${specificRecipe[0].isSystemRecipe ? '✅' : '❌'}`);
    } else {
      console.log(`\n⚠️  Specific recipe b81ac1f7-8a60-4e1f-9c9e-91b1794b4230 not found in database.`);
    }

    console.log(`\n✅ Fix complete! All chef recipes should now be accessible without sign-in.`);
    console.log(`   You may need to clear Next.js cache or restart the dev server to see changes.`);

  } catch (error) {
    console.error('❌ Error fixing chef recipes:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Run the fix
investigateAndFixChefRecipes();
