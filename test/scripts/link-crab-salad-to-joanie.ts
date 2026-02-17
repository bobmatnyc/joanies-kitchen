#!/usr/bin/env tsx

/**
 * Link Joanie's Crab Salad Recipe to Her Chef Profile
 *
 * This script:
 * 1. Updates the recipe to set chef_id = Joanie's ID
 * 2. Creates a chef_recipes entry to properly link them
 * 3. Increments Joanie's recipe_count
 */

import { eq } from 'drizzle-orm';
import { chefRecipes, chefs } from '@/lib/db/chef-schema';
import { db } from '@/lib/db/index';
import { recipes } from '@/lib/db/schema';

async function linkCrabSaladToJoanie() {
  console.log("🔗 Linking Crab Salad Recipe to Joanie's Chef Profile...\n");

  const JOANIE_CHEF_ID = 'f1272147-9a8f-47e3-8f21-09339e278002';
  const RECIPE_SLUG = 'joanies-monday-night-crab-salad-cheesy-tomato-melts';

  // Step 1: Get the recipe
  const recipe = await db.select().from(recipes).where(eq(recipes.slug, RECIPE_SLUG)).limit(1);

  if (recipe.length === 0) {
    console.error('❌ Recipe not found!');
    process.exit(1);
  }

  const recipeId = recipe[0].id;
  console.log(`✅ Found recipe: ${recipe[0].name}`);
  console.log(`   Recipe ID: ${recipeId}`);

  // Step 2: Update recipe to set chef_id
  await db.update(recipes).set({ chef_id: JOANIE_CHEF_ID }).where(eq(recipes.id, recipeId));

  console.log(`✅ Updated recipe chef_id to Joanie's ID`);

  // Step 3: Create chef_recipes link
  try {
    await db.insert(chefRecipes).values({
      chef_id: JOANIE_CHEF_ID,
      recipe_id: recipeId,
      created_at: new Date(),
    });
    console.log(`✅ Created chef_recipes link`);
  } catch (error: any) {
    if (error.code === '23505') {
      console.log(`ℹ️  Chef-recipe link already exists`);
    } else {
      throw error;
    }
  }

  // Step 4: Increment Joanie's recipe count
  const joanie = await db.select().from(chefs).where(eq(chefs.id, JOANIE_CHEF_ID)).limit(1);

  const currentCount = joanie[0].recipe_count || 0;

  await db
    .update(chefs)
    .set({
      recipe_count: currentCount + 1,
      updated_at: new Date(),
    })
    .where(eq(chefs.id, JOANIE_CHEF_ID));

  console.log(`✅ Updated Joanie's recipe count: ${currentCount} → ${currentCount + 1}`);

  console.log("\n🎉 Recipe successfully linked to Joanie's chef profile!");
  console.log(`\n📍 You can now view this recipe on Joanie's chef page:`);
  console.log(`   http://localhost:3002/chefs/joanie`);
}

linkCrabSaladToJoanie()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
