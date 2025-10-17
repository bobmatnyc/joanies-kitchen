#!/usr/bin/env tsx

/**
 * Make all chef recipes public
 */

import { inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chefRecipes } from '@/lib/db/chef-schema';
import { recipes } from '@/lib/db/schema';

async function makeChefRecipesPublic() {
  console.log('🌐 Making all chef recipes public...\n');

  // Get all recipe IDs linked to chefs
  const chefRecipeLinks = await db.select({ recipe_id: chefRecipes.recipe_id }).from(chefRecipes);

  const recipeIds = chefRecipeLinks.map((link) => link.recipe_id);

  console.log(`Found ${recipeIds.length} recipes linked to chefs\n`);

  // Update all to be public
  const result = await db
    .update(recipes)
    .set({
      is_public: true,
      updated_at: new Date(),
    })
    .where(inArray(recipes.id, recipeIds))
    .returning({ id: recipes.id, name: recipes.name });

  console.log(`✅ Made ${result.length} recipes public:\n`);
  result.forEach((r) => console.log(`   - ${r.name}`));

  console.log('\n🎉 All chef recipes are now public!');
}

makeChefRecipesPublic()
  .then(() => {
    console.log('\n✅ Script completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
