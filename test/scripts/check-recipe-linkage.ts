#!/usr/bin/env tsx
import { db } from '@/lib/db';
import { chefs, chefRecipes } from '@/lib/db/chef-schema';
import { recipes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
  // Find Lidia
  const [lidia] = await db
    .select()
    .from(chefs)
    .where(eq(chefs.slug, 'lidia-bastianich'))
    .limit(1);

  if (!lidia) {
    console.log('Lidia not found');
    process.exit(1);
  }

  console.log('=== CHECKING RECIPE LINKAGE ===\n');

  // Method 1: Direct chef_id field
  const directRecipes = await db.select().from(recipes).where(eq(recipes.chef_id, lidia.id));

  console.log(`Method 1 - recipes.chef_id = lidia.id:`);
  console.log(`  Found: ${directRecipes.length} recipes`);
  if (directRecipes.length > 0) {
    directRecipes.slice(0, 3).forEach((r) => {
      console.log(`    - ${r.name}`);
    });
  }

  // Method 2: Via chef_recipes join table
  const joinRecipes = await db
    .select({
      recipe: recipes,
    })
    .from(chefRecipes)
    .innerJoin(recipes, eq(chefRecipes.recipe_id, recipes.id))
    .where(eq(chefRecipes.chef_id, lidia.id));

  console.log(`\nMethod 2 - via chef_recipes join table:`);
  console.log(`  Found: ${joinRecipes.length} recipes`);
  if (joinRecipes.length > 0) {
    joinRecipes.slice(0, 3).forEach(({ recipe }) => {
      console.log(
        `    - ${recipe.name} (chef_id in recipe: ${recipe.chef_id || 'NULL'}, images: ${recipe.images ? 'YES' : 'NO'})`
      );
    });
  }

  console.log('\n=== ANALYSIS ===');
  console.log(
    `The script uses Method 1 (chef_id field), but recipes are linked via Method 2 (join table).`
  );
  console.log(`\nSolution: Update the script to use the chef_recipes join table approach.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
