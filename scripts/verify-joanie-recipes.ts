/**
 * Verify Joanie Chef Page Recipes
 *
 * Confirms that the problematic recipes no longer appear on /chef/joanie
 */

import { db } from '../src/lib/db/index';
import { recipes } from '../src/lib/db/schema';
import { chefs, chefRecipes } from '../src/lib/db/chef-schema';
import { eq, and, desc } from 'drizzle-orm';

const PROBLEMATIC_RECIPE_IDS = [
  'd8e9184c-144a-4bff-a518-a4d63e3146ab',
  'fc3bb79b-a596-4c9c-bbe8-10a08a3e621f',
];

async function checkJoanieRecipes() {
  console.log('🔍 Checking Joanie chef profile recipes...\n');

  // Find Joanie chef
  const joanie = await db.query.chefs.findFirst({
    where: and(eq(chefs.slug, 'joanie'), eq(chefs.is_active, true)),
  });

  if (!joanie) {
    console.log('❌ Joanie chef not found');
    return;
  }

  console.log(`✓ Found chef: ${joanie.display_name || joanie.name}`);
  console.log(`  ID: ${joanie.id}`);

  // Get recipes using the same query as the chef page
  const chefRecipesData = await db
    .select({
      recipe: recipes,
      chefRecipe: chefRecipes,
    })
    .from(chefRecipes)
    .innerJoin(recipes, eq(chefRecipes.recipe_id, recipes.id))
    .where(eq(chefRecipes.chef_id, joanie.id))
    .orderBy(desc(recipes.created_at))
    .limit(24);

  console.log(`\n📊 Total recipes on /chef/joanie page: ${chefRecipesData.length}`);

  // Check if the problematic recipes are in the list
  const foundProblematic = chefRecipesData.filter((cr) =>
    PROBLEMATIC_RECIPE_IDS.includes(cr.recipe.id)
  );

  if (foundProblematic.length === 0) {
    console.log('✅ SUCCESS: Problematic recipes NOT found on Joanie page');
  } else {
    console.log(
      '❌ ERROR: Found problematic recipes:',
      foundProblematic.map((cr) => cr.recipe.name)
    );
  }

  // Show first 5 recipes for context
  if (chefRecipesData.length > 0) {
    console.log('\n📋 First 5 recipes on page:');
    chefRecipesData.slice(0, 5).forEach((cr, i) => {
      console.log(`  ${i + 1}. ${cr.recipe.name}`);
    });
  }

  console.log('\n✨ Verification complete!');
}

checkJoanieRecipes()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
