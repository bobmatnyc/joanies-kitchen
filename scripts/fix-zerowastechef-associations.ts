#!/usr/bin/env tsx

import { db } from '../src/lib/db';
import { recipes } from '../src/lib/db/schema';
import { chefs, chefRecipes } from '../src/lib/db/chef-schema';
import { eq, like } from 'drizzle-orm';

async function fixZeroWasteChefAssociations() {
  console.log('🔧 Fixing Zero Waste Chef recipe associations...\n');

  // Step 1: Get Anne-Marie Bonneau's chef ID
  const anneMarie = await db
    .select()
    .from(chefs)
    .where(like(chefs.website, '%zerowastechef.com%'))
    .limit(1);

  if (anneMarie.length === 0) {
    console.error('❌ Error: Could not find Anne-Marie Bonneau in chefs table');
    process.exit(1);
  }

  const chefId = anneMarie[0].id;
  console.log(`✓ Found chef: ${anneMarie[0].name} (ID: ${chefId})`);
  console.log(`  Website: ${anneMarie[0].website}\n`);

  // Step 2: Find all Zero Waste Chef recipes without chef association
  const zwcRecipes = await db
    .select()
    .from(recipes)
    .where(like(recipes.source, '%zerowastechef.com%'));

  console.log(`Found ${zwcRecipes.length} Zero Waste Chef recipes in database\n`);

  const recipesNeedingFix = zwcRecipes.filter(r => !r.chefId);
  console.log(`Recipes needing chef association: ${recipesNeedingFix.length}\n`);

  if (recipesNeedingFix.length === 0) {
    console.log('✓ All Zero Waste Chef recipes already have chef associations!');
    process.exit(0);
  }

  // Step 3: Update recipes table
  console.log('Updating recipes table...');
  let updateCount = 0;
  
  for (const recipe of recipesNeedingFix) {
    await db
      .update(recipes)
      .set({
        chefId: chefId,
        isPublic: true, // Mark as public since they're scraped
      })
      .where(eq(recipes.id, recipe.id));
    
    updateCount++;
    if (updateCount % 10 === 0) {
      console.log(`  Updated ${updateCount}/${recipesNeedingFix.length} recipes...`);
    }
  }

  console.log(`✓ Updated ${updateCount} recipes with chef_id and is_public = true\n`);

  // Step 4: Create chef_recipes junction entries
  console.log('Creating chef_recipes junction table entries...');
  let junctionCount = 0;

  for (const recipe of recipesNeedingFix) {
    // Check if junction already exists
    const existing = await db
      .select()
      .from(chefRecipes)
      .where(eq(chefRecipes.recipeId, recipe.id))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(chefRecipes).values({
        id: crypto.randomUUID(),
        chefId: chefId,
        recipeId: recipe.id,
        createdAt: new Date(),
      });
      junctionCount++;
      
      if (junctionCount % 10 === 0) {
        console.log(`  Created ${junctionCount}/${recipesNeedingFix.length} junction entries...`);
      }
    }
  }

  console.log(`✓ Created ${junctionCount} chef_recipes junction entries\n`);

  // Step 5: Summary
  console.log('======================================================================');
  console.log('FIX COMPLETE');
  console.log('======================================================================');
  console.log(`Chef: ${anneMarie[0].name}`);
  console.log(`Total Zero Waste Chef recipes: ${zwcRecipes.length}`);
  console.log(`Recipes fixed: ${updateCount}`);
  console.log(`Junction entries created: ${junctionCount}`);
  console.log(`\n✓ All Zero Waste Chef recipes now properly associated!\n`);
  
  process.exit(0);
}

fixZeroWasteChefAssociations();
