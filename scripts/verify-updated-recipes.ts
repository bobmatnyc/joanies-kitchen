/**
 * Verify Updated Recipes
 * Quick script to check if recipes were successfully updated with amounts
 */

import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { inArray } from 'drizzle-orm';

async function verifyUpdates() {
  console.log('🔍 Verifying Updated Recipes\n');

  // Check the first few recipes that should have been updated
  const recipesToCheck = ['2', '3', '4', '5', '6'];

  const updatedRecipes = await db
    .select({
      id: recipes.id,
      name: recipes.name,
      ingredients: recipes.ingredients,
    })
    .from(recipes)
    .where(inArray(recipes.id, recipesToCheck));

  console.log(`Found ${updatedRecipes.length} recipes to verify:\n`);

  for (const recipe of updatedRecipes) {
    console.log(`Recipe: ${recipe.name} (ID: ${recipe.id})`);

    try {
      const ingredients = JSON.parse(recipe.ingredients as string);
      console.log(`Ingredients (${ingredients.length} total):`);

      // Show first 3 ingredients
      ingredients.slice(0, 3).forEach((ing: string, i: number) => {
        console.log(`  ${i + 1}. ${ing}`);
      });

      if (ingredients.length > 3) {
        console.log(`  ... and ${ingredients.length - 3} more`);
      }

      console.log();
    } catch (error) {
      console.error(`  ✗ Error parsing ingredients: ${error}`);
      console.log();
    }
  }
}

verifyUpdates()
  .then(() => {
    console.log('✅ Verification complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
