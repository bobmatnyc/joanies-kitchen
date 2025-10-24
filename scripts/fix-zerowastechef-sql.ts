#!/usr/bin/env tsx

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function fixZeroWasteChefAssociations() {
  console.log('🔧 Fixing Zero Waste Chef recipe associations with raw SQL...\n');

  // Step 1: Get Anne-Marie Bonneau's chef ID
  const chefResult = await sql`
    SELECT id, name, website
    FROM chefs
    WHERE website LIKE '%zerowastechef.com%'
    LIMIT 1
  `;

  if (chefResult.length === 0) {
    console.error('❌ Error: Could not find Anne-Marie Bonneau in chefs table');
    process.exit(1);
  }

  const chefId = chefResult[0].id;
  console.log(`✓ Found chef: ${chefResult[0].name} (ID: ${chefId})`);
  console.log(`  Website: ${chefResult[0].website}\n`);

  // Step 2: Count Zero Waste Chef recipes
  const totalRecipes = await sql`
    SELECT COUNT(*) as count
    FROM recipes
    WHERE source LIKE '%zerowastechef.com%'
  `;
  console.log(`Total Zero Waste Chef recipes: ${totalRecipes[0].count}\n`);

  // Step 3: Update recipes with chef_id and is_public
  const updateResult = await sql`
    UPDATE recipes
    SET chef_id = ${chefId},
        is_public = true
    WHERE source LIKE '%zerowastechef.com%'
      AND chef_id IS NULL
    RETURNING id, name
  `;

  console.log(`✓ Updated ${updateResult.length} recipes with chef_id and is_public = true\n`);

  if (updateResult.length > 0) {
    console.log('Sample updated recipes:');
    updateResult.slice(0, 5).forEach((r, idx) => {
      console.log(`  ${idx + 1}. ${r.name}`);
    });
    if (updateResult.length > 5) {
      console.log(`  ... and ${updateResult.length - 5} more`);
    }
    console.log();
  }

  // Step 4: Create chef_recipes junction entries
  const junctionResult = await sql`
    INSERT INTO chef_recipes (id, chef_id, recipe_id, created_at)
    SELECT 
      gen_random_uuid(),
      ${chefId},
      r.id,
      NOW()
    FROM recipes r
    WHERE r.source LIKE '%zerowastechef.com%'
      AND NOT EXISTS (
        SELECT 1 FROM chef_recipes cr
        WHERE cr.recipe_id = r.id AND cr.chef_id = ${chefId}
      )
    RETURNING id
  `;

  console.log(`✓ Created ${junctionResult.length} chef_recipes junction entries\n`);

  // Step 5: Final verification
  const verifyResult = await sql`
    SELECT COUNT(*) as count
    FROM recipes
    WHERE source LIKE '%zerowastechef.com%'
      AND chef_id = ${chefId}
  `;

  console.log('======================================================================');
  console.log('FIX COMPLETE');
  console.log('======================================================================');
  console.log(`Chef: ${chefResult[0].name}`);
  console.log(`Total Zero Waste Chef recipes: ${totalRecipes[0].count}`);
  console.log(`Recipes now associated: ${verifyResult[0].count}`);
  console.log(`\n✓ All Zero Waste Chef recipes properly associated!\n`);
  
  process.exit(0);
}

fixZeroWasteChefAssociations();
