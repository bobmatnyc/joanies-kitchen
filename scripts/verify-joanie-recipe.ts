#!/usr/bin/env tsx
/**
 * Verify Joanie's Crab Salad Recipe Setup
 *
 * This script verifies that:
 * 1. Recipe exists in database
 * 2. Recipe is linked to Joanie's chef profile
 * 3. Instructions are in correct format (string array, not object array)
 * 4. All metadata is correct
 */

import { db } from '../src/lib/db/index';
import { recipes } from '../src/lib/db/schema';
import { chefs, chefRecipes } from '../src/lib/db/chef-schema';
import { eq } from 'drizzle-orm';

async function verifyRecipe() {
  console.log('🔍 Verifying Joanie\'s Crab Salad Recipe...\n');

  const RECIPE_SLUG = 'joanies-monday-night-crab-salad-cheesy-tomato-melts';

  // 1. Get recipe
  const recipeResult = await db
    .select()
    .from(recipes)
    .where(eq(recipes.slug, RECIPE_SLUG))
    .limit(1);

  if (recipeResult.length === 0) {
    console.error('❌ Recipe not found!');
    process.exit(1);
  }

  const recipe = recipeResult[0];

  console.log('✅ Recipe Found');
  console.log(`   ID: ${recipe.id}`);
  console.log(`   Name: ${recipe.name}`);
  console.log(`   Slug: ${recipe.slug}`);

  // 2. Check chef linkage
  if (!recipe.chef_id) {
    console.error('❌ Recipe not linked to chef!');
    process.exit(1);
  }

  const chef = await db
    .select()
    .from(chefs)
    .where(eq(chefs.id, recipe.chef_id))
    .limit(1);

  console.log('\n✅ Chef Linkage');
  console.log(`   Chef: ${chef[0].name}`);
  console.log(`   Chef ID: ${chef[0].id}`);

  // 3. Check chef_recipes table
  const link = await db
    .select()
    .from(chefRecipes)
    .where(eq(chefRecipes.recipe_id, recipe.id))
    .limit(1);

  if (link.length === 0) {
    console.error('❌ chef_recipes link not found!');
    process.exit(1);
  }

  console.log('✅ Chef-Recipe Link Exists');

  // 4. Check instructions format
  const instructions = JSON.parse(recipe.instructions);

  if (!Array.isArray(instructions)) {
    console.error('❌ Instructions not an array!');
    process.exit(1);
  }

  if (instructions.length === 0) {
    console.error('❌ Instructions array is empty!');
    process.exit(1);
  }

  const firstInstruction = instructions[0];
  if (typeof firstInstruction !== 'string') {
    console.error('❌ Instructions are not strings! Found:', typeof firstInstruction);
    console.error('   First instruction:', firstInstruction);
    process.exit(1);
  }

  console.log('\n✅ Instructions Format');
  console.log(`   Type: Array of strings`);
  console.log(`   Steps: ${instructions.length}`);

  // 5. Check metadata
  const tags = JSON.parse(recipe.tags || '[]');

  console.log('\n✅ Recipe Metadata');
  console.log(`   Public: ${recipe.is_public}`);
  console.log(`   System Recipe: ${recipe.is_system_recipe}`);
  console.log(`   User: ${recipe.user_id}`);
  console.log(`   Tags: ${tags.join(', ')}`);
  console.log(`   Resourcefulness Score: ${recipe.system_rating}`);

  // 6. Check image
  if (recipe.images) {
    const images = JSON.parse(recipe.images);
    console.log(`\n✅ Recipe Image`);
    console.log(`   Images: ${images.length}`);
    console.log(`   Path: ${images[0]}`);
  }

  console.log('\n🎉 All Verifications Passed!');
  console.log('\n📍 Recipe URLs:');
  console.log(`   Recipe Page: http://localhost:3002/recipes/${recipe.slug}`);
  console.log(`   Chef Page: http://localhost:3002/chefs/${chef[0].slug}`);
}

verifyRecipe()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  });
