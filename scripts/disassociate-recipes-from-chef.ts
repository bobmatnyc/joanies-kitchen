/**
 * Disassociate Recipes from Chef
 *
 * Updates specific recipes that belong to a different Joanie (not Joanie from Joanie's Kitchen)
 * by setting their chef_id to null while keeping them as public shared recipes.
 *
 * Recipe IDs to update:
 * - d8e9184c-144a-4bff-a518-a4d63e3146ab
 * - fc3bb79b-a596-4c9c-bbe8-10a08a3e621f
 */

import { eq, inArray } from 'drizzle-orm';
import { db } from '../src/lib/db/index';
import { recipes } from '../src/lib/db/schema';
import { chefRecipes } from '../src/lib/db/chef-schema';

const RECIPE_IDS_TO_UPDATE = [
  'd8e9184c-144a-4bff-a518-a4d63e3146ab',
  'fc3bb79b-a596-4c9c-bbe8-10a08a3e621f',
];

async function disassociateRecipesFromChef() {
  console.log('🔧 Disassociating recipes from chef...\n');

  try {
    // First, fetch the current state of these recipes
    console.log('📋 Current recipe state:');
    const currentRecipes = await db
      .select({
        id: recipes.id,
        name: recipes.name,
        chef_id: recipes.chef_id,
        is_public: recipes.is_public,
      })
      .from(recipes)
      .where(inArray(recipes.id, RECIPE_IDS_TO_UPDATE));

    if (currentRecipes.length === 0) {
      console.log('❌ No recipes found with the specified IDs');
      return;
    }

    console.log('\nRecipes to update:');
    currentRecipes.forEach((recipe) => {
      console.log(`  - ${recipe.name}`);
      console.log(`    ID: ${recipe.id}`);
      console.log(`    Current chef_id: ${recipe.chef_id}`);
      console.log(`    Is public: ${recipe.is_public}`);
      console.log('');
    });

    // Step 1: Remove entries from chefRecipes junction table
    console.log('⚡ Removing chef-recipe associations from junction table...');
    const deletedJunctions = await db
      .delete(chefRecipes)
      .where(inArray(chefRecipes.recipe_id, RECIPE_IDS_TO_UPDATE))
      .returning({
        recipe_id: chefRecipes.recipe_id,
        chef_id: chefRecipes.chef_id,
      });

    console.log(`✅ Removed ${deletedJunctions.length} chef-recipe junction(s)\n`);

    // Step 2: Update the recipes table: set chef_id to null, ensure is_public is true
    console.log('⚡ Updating recipes table...');
    const result = await db
      .update(recipes)
      .set({
        chef_id: null,
        is_public: true,
        updated_at: new Date(),
      })
      .where(inArray(recipes.id, RECIPE_IDS_TO_UPDATE))
      .returning({
        id: recipes.id,
        name: recipes.name,
        chef_id: recipes.chef_id,
        is_public: recipes.is_public,
      });

    console.log(`\n✅ Successfully updated ${result.length} recipe(s):\n`);
    result.forEach((recipe) => {
      console.log(`  - ${recipe.name}`);
      console.log(`    ID: ${recipe.id}`);
      console.log(`    New chef_id: ${recipe.chef_id} (null)`);
      console.log(`    Is public: ${recipe.is_public}`);
      console.log('');
    });

    console.log('✨ Done! These recipes are now:');
    console.log('  - Completely disassociated from the Joanie chef');
    console.log('  - Removed from chef_recipes junction table');
    console.log('  - chef_id set to null in recipes table');
    console.log('  - Still public and accessible to all users');
    console.log('  - Will NOT appear on /chef/joanie page');
  } catch (error) {
    console.error('❌ Error updating recipes:', error);
    throw error;
  }
}

// Run the script
disassociateRecipesFromChef()
  .then(() => {
    console.log('\n🎉 Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });
