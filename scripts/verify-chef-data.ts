import 'dotenv/config';
import { eq, sql } from 'drizzle-orm';
import { db } from '../src/lib/db';
import { chefRecipes, chefs } from '../src/lib/db/chef-schema';
import { recipes } from '../src/lib/db/schema';

/**
 * Verify Chef Data and Linkages
 *
 * Validates that all chefs and recipes are properly imported
 * and linked in the database.
 */

async function verifyChefData() {
  console.log('=== Chef Data Verification ===\n');

  // Get all chefs
  const allChefs = await db.select().from(chefs);
  console.log(`Total chefs: ${allChefs.length}\n`);

  for (const chef of allChefs) {
    // Get recipe count for this chef
    const recipeLinks = await db.select().from(chefRecipes).where(eq(chefRecipes.chef_id, chef.id));

    console.log(`${chef.name} (${chef.slug})`);
    console.log(`  Profile Image: ${chef.profile_image_url || 'Not set'}`);
    console.log(`  Specialties: ${chef.specialties?.join(', ') || 'None'}`);
    console.log(`  Recipe Count (stored): ${chef.recipe_count || 0}`);
    console.log(`  Recipe Links (actual): ${recipeLinks.length}`);
    console.log(`  Active: ${chef.is_active}`);
    console.log(`  Verified: ${chef.is_verified}`);

    if (chef.recipe_count !== recipeLinks.length) {
      console.log(`  ⚠️  WARNING: Recipe count mismatch!`);
    }
    console.log('');
  }

  // Get total system recipes
  const systemRecipes = await db.select().from(recipes).where(eq(recipes.is_system_recipe, true));

  console.log(`\nTotal system recipes: ${systemRecipes.length}`);

  // Get recipes by chef
  console.log('\n=== Recipes by Chef ===');
  const lidiaRecipes = await db
    .select()
    .from(recipes)
    .innerJoin(chefRecipes, eq(recipes.id, chefRecipes.recipe_id))
    .innerJoin(chefs, eq(chefRecipes.chef_id, chefs.id))
    .where(eq(chefs.slug, 'lidia-bastianich'));

  console.log(`\nLidia Bastianich: ${lidiaRecipes.length} recipes`);
  if (lidiaRecipes.length > 0) {
    console.log(
      `  Sample: ${lidiaRecipes
        .slice(0, 3)
        .map((r) => r.recipes.name)
        .join(', ')}...`
    );
  }

  const nancyRecipes = await db
    .select()
    .from(recipes)
    .innerJoin(chefRecipes, eq(recipes.id, chefRecipes.recipe_id))
    .innerJoin(chefs, eq(chefRecipes.chef_id, chefs.id))
    .where(eq(chefs.slug, 'nancy-silverton'));

  console.log(`\nNancy Silverton: ${nancyRecipes.length} recipes`);
  if (nancyRecipes.length > 0) {
    console.log(
      `  Sample: ${nancyRecipes
        .slice(0, 3)
        .map((r) => r.recipes.name)
        .join(', ')}...`
    );
  }

  // Check for orphaned recipes (system recipes not linked to a chef)
  const orphanedRecipes = await db.execute(sql`
    SELECT r.id, r.name, r.source
    FROM recipes r
    WHERE r.is_system_recipe = true
    AND NOT EXISTS (
      SELECT 1 FROM chef_recipes cr
      WHERE cr.recipe_id = r.id
    )
  `);

  if (orphanedRecipes.rows.length > 0) {
    console.log(
      `\n⚠️  Warning: ${orphanedRecipes.rows.length} system recipes not linked to any chef:`
    );
    for (const recipe of orphanedRecipes.rows.slice(0, 5)) {
      console.log(`  - ${recipe.name}`);
    }
  } else {
    console.log(`\n✓ All system recipes are properly linked to chefs`);
  }

  console.log('\n=== Verification Complete ===');
}

verifyChefData()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Verification failed:', error);
    process.exit(1);
  });
