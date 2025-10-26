#!/usr/bin/env tsx
/**
 * Verify Chef Recipes Public Visibility
 *
 * Comprehensive verification that all chef recipes are properly configured
 * as public and system recipes.
 *
 * Run: npx tsx scripts/verify-chef-recipes-public.ts
 */

import { db } from '../src/lib/db/index';
import { recipes } from '../src/lib/db/schema';
import { chefs } from '../src/lib/db/chef-schema';
import { eq, isNotNull, and, sql } from 'drizzle-orm';

async function verifyChefRecipesPublic() {
  console.log('🔍 Verifying chef recipe public visibility...\n');

  try {
    // Get all chef recipes with chef names
    const chefRecipesData = await db
      .select({
        recipeId: recipes.id,
        recipeName: recipes.name,
        isPublic: recipes.is_public,
        isSystemRecipe: recipes.is_system_recipe,
        chefId: recipes.chef_id,
        chefName: chefs.name,
        chefSlug: chefs.slug,
      })
      .from(recipes)
      .leftJoin(chefs, eq(recipes.chef_id, chefs.id))
      .where(isNotNull(recipes.chef_id));

    console.log(`📊 Total chef-attributed recipes: ${chefRecipesData.length}\n`);

    // Group by chef
    const recipesByChef = chefRecipesData.reduce((acc, recipe) => {
      const chefName = recipe.chefName || 'Unknown Chef';
      if (!acc[chefName]) {
        acc[chefName] = {
          slug: recipe.chefSlug,
          recipes: [],
          totalCount: 0,
          publicCount: 0,
          systemCount: 0,
          privateCount: 0
        };
      }
      acc[chefName].recipes.push(recipe);
      acc[chefName].totalCount++;
      if (recipe.isPublic) acc[chefName].publicCount++;
      if (recipe.isSystemRecipe) acc[chefName].systemCount++;
      if (!recipe.isPublic) acc[chefName].privateCount++;
      return acc;
    }, {} as Record<string, any>);

    console.log('👨‍🍳 Recipes by Chef:\n');
    Object.keys(recipesByChef).sort().forEach((chefName) => {
      const data = recipesByChef[chefName];
      const status = data.privateCount === 0 ? '✅' : '❌';
      console.log(`${status} ${chefName} (${data.slug || 'no-slug'})`);
      console.log(`   Total recipes: ${data.totalCount}`);
      console.log(`   Public: ${data.publicCount}`);
      console.log(`   System: ${data.systemCount}`);
      console.log(`   Private: ${data.privateCount}`);
      console.log('');
    });

    // Overall statistics
    const totalPublic = chefRecipesData.filter(r => r.isPublic).length;
    const totalSystem = chefRecipesData.filter(r => r.isSystemRecipe).length;
    const totalPrivate = chefRecipesData.filter(r => !r.isPublic).length;

    console.log('📈 Overall Statistics:');
    console.log(`   Total chef recipes: ${chefRecipesData.length}`);
    console.log(`   Public: ${totalPublic} (${((totalPublic/chefRecipesData.length)*100).toFixed(1)}%)`);
    console.log(`   System: ${totalSystem} (${((totalSystem/chefRecipesData.length)*100).toFixed(1)}%)`);
    console.log(`   Private: ${totalPrivate} (${((totalPrivate/chefRecipesData.length)*100).toFixed(1)}%)`);

    if (totalPrivate === 0) {
      console.log('\n🎉 SUCCESS! All chef recipes are public and accessible without sign-in.');
      console.log('   Production site should now display all chef recipes correctly.');
    } else {
      console.log(`\n⚠️  WARNING: ${totalPrivate} chef recipes are still private!`);
      console.log('   Recipes that are still private:');
      chefRecipesData
        .filter(r => !r.isPublic)
        .forEach(r => {
          console.log(`   - ${r.recipeName} (${r.recipeId})`);
          console.log(`     Chef: ${r.chefName} (${r.chefSlug})`);
        });
    }

    // Test the specific recipe mentioned in the issue
    const specificRecipe = chefRecipesData.find(
      r => r.recipeId === 'b81ac1f7-8a60-4e1f-9c9e-91b1794b4230'
    );

    if (specificRecipe) {
      console.log('\n🔍 Specific Recipe Test (from issue):');
      console.log(`   Recipe: ${specificRecipe.recipeName}`);
      console.log(`   Chef: ${specificRecipe.chefName} (${specificRecipe.chefSlug})`);
      console.log(`   URL: https://joanies.kitchen/recipes/${specificRecipe.recipeId}?from=chef/${specificRecipe.chefSlug}`);
      console.log(`   isPublic: ${specificRecipe.isPublic} ${specificRecipe.isPublic ? '✅' : '❌'}`);
      console.log(`   isSystemRecipe: ${specificRecipe.isSystemRecipe} ${specificRecipe.isSystemRecipe ? '✅' : '❌'}`);
    }

  } catch (error) {
    console.error('❌ Error verifying chef recipes:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Run verification
verifyChefRecipesPublic();
