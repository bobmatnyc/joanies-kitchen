#!/usr/bin/env tsx

import { db } from '../src/lib/db';
import { recipes } from '../src/lib/db/schema';
import { chefs } from '../src/lib/db/chef-schema';
import { eq, like, or, isNull } from 'drizzle-orm';

/**
 * LINK LIDIA BASTIANICH RECIPES TO CHEF PROFILE
 *
 * Updates all Lidia Bastianich recipes to reference her chef profile
 * by setting the chef_id field.
 */

async function main() {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('🔗 LINKING LIDIA BASTIANICH RECIPES TO CHEF PROFILE');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  // Step 1: Find Lidia's chef profile
  console.log('🔍 Step 1: Finding Lidia Bastianich chef profile...\n');

  const [chef] = await db
    .select()
    .from(chefs)
    .where(eq(chefs.slug, 'lidia-bastianich'))
    .limit(1);

  if (!chef) {
    console.error('❌ Error: Lidia Bastianich not found in chefs table');
    console.error('   Run: npx tsx scripts/import-chefs.ts');
    process.exit(1);
  }

  console.log('✅ Found chef profile:');
  console.log(`   Name: ${chef.name}`);
  console.log(`   ID: ${chef.id}`);
  console.log(`   Slug: ${chef.slug}\n`);

  // Step 2: Find all Lidia's recipes (by tags/source)
  console.log('🔍 Step 2: Finding Lidia Bastianich recipes...\n');

  const lidiaRecipes = await db
    .select()
    .from(recipes)
    .where(
      or(
        like(recipes.tags, '%Lidia%'),
        like(recipes.source, '%lidia%')
      )
    );

  console.log(`📚 Found ${lidiaRecipes.length} recipes\n`);

  if (lidiaRecipes.length === 0) {
    console.log('✅ No recipes found to link');
    return;
  }

  // Check how many already linked
  const alreadyLinked = lidiaRecipes.filter(r => r.chef_id === chef.id);
  const needsLinking = lidiaRecipes.filter(r => r.chef_id !== chef.id);

  console.log(`✅ Already linked: ${alreadyLinked.length}`);
  console.log(`🔗 Need linking: ${needsLinking.length}\n`);

  if (needsLinking.length === 0) {
    console.log('✅ All recipes are already linked to Lidia\'s profile!');
    return;
  }

  // Step 3: Link recipes
  console.log('🔗 Step 3: Linking recipes to chef profile...\n');

  let successCount = 0;
  let errorCount = 0;

  for (const recipe of needsLinking) {
    try {
      await db
        .update(recipes)
        .set({
          chef_id: chef.id,
          updated_at: new Date(),
        })
        .where(eq(recipes.id, recipe.id));

      successCount++;
      console.log(`✅ Linked: ${recipe.name}`);
    } catch (error) {
      errorCount++;
      console.error(`❌ Failed to link: ${recipe.name}`);
      console.error(`   Error: ${error}`);
    }
  }

  // Step 4: Summary
  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('📊 SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  console.log(`✅ Successfully linked: ${successCount}`);
  console.log(`❌ Failed: ${errorCount}`);
  console.log(`📚 Total Lidia recipes: ${lidiaRecipes.length}\n`);

  // Verify linking
  console.log('🔍 Verifying...\n');

  const verifyLinked = await db
    .select()
    .from(recipes)
    .where(eq(recipes.chef_id, chef.id));

  console.log(`✅ Verification: ${verifyLinked.length} recipes now linked to Lidia Bastianich\n`);

  console.log('✅ Linking completed!\n');
}

main().catch(console.error);
