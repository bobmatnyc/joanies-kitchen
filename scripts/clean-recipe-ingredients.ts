/**
 * Clean Recipe Ingredients Script
 *
 * This script cleans up messy ingredient formatting in a specific recipe.
 *
 * Fixes:
 * - Missing spaces between quantity and unit/ingredient
 * - Removes brackets around ingredient names
 * - Removes affiliate links
 * - Removes markup characters (**, ▢)
 * - Adds proper spacing in measurements
 *
 * Usage:
 *   pnpm tsx scripts/clean-recipe-ingredients.ts <recipe-id>
 *   pnpm tsx scripts/clean-recipe-ingredients.ts 42c99b0f-05d2-4b96-95b0-d8d611c8bcde
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';

/**
 * Clean a single ingredient string
 */
function cleanIngredient(ingredient: string): string {
  let cleaned = ingredient;

  // Remove leading bullet points (▢)
  cleaned = cleaned.replace(/^▢\s*/, '');

  // Remove markdown formatting (**text**)
  cleaned = cleaned.replace(/\*\*/g, '');

  // Remove markdown links [text](url) - keep just the text
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // Remove remaining URLs and URL fragments
  cleaned = cleaned.replace(/https?:\/\/[^\s,)]+/g, '');
  cleaned = cleaned.replace(/\([^)]*(?:amzn|http|www|PH3|OGV)[^)]*\)/gi, ''); // Remove parentheses with URL fragments

  // Remove any remaining parentheses that contain only uppercase letters, numbers, or spaces (URL fragments)
  cleaned = cleaned.replace(/\([A-Z0-9\s]+\)/g, '');

  // Remove brackets around plain text (not markdown links)
  cleaned = cleaned.replace(/\[([^\]]+)\]/g, '$1');

  // Remove escaped asterisks (\*\*)
  cleaned = cleaned.replace(/\\?\*+/g, '');

  // Fix spacing issues between numbers/fractions and units
  // "¼cupfreshly" → "¼ cup freshly"
  cleaned = cleaned.replace(/([¼½¾⅓⅔⅛⅜⅝⅞])\s*(cup|tablespoon|teaspoon|pound|ounce)([a-z])/gi, '$1 $2 $3');

  // "2clovesgarlic" → "2 cloves garlic"
  // "8ouncesdried" → "8 ounces dried"
  cleaned = cleaned.replace(/(\d+)\s*(clove|cup|tablespoon|teaspoon|pound|ounce)(s?)([a-z])/gi, '$1 $2$3 $4');

  // Fix broken spacing from previous runs: "clove s" → "cloves", "ounce s" → "ounces"
  cleaned = cleaned.replace(/\b(clove|cup|tablespoon|teaspoon|pound|ounce)\s+s\b/gi, '$1s');

  // Fix cases where unit got split: "8 ounce sdried" → "8 ounces dried"
  cleaned = cleaned.replace(/\b(cloves?|cups?|tablespoons?|teaspoons?|pounds?|ounces?)\s+s([a-z])/gi, '$1s $2');

  // Clean up multiple spaces
  cleaned = cleaned.replace(/\s+/g, ' ');

  // Remove comma followed by nothing or just whitespace
  cleaned = cleaned.replace(/,\s*$/, '');

  // Trim whitespace
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * Main function to clean recipe ingredients
 */
async function cleanRecipeIngredients(recipeId: string) {
  console.log('🧹 Recipe Ingredient Cleaner\n');
  console.log(`Recipe ID: ${recipeId}\n`);
  console.log('━'.repeat(80) + '\n');

  try {
    // Fetch the recipe
    const [recipe] = await db
      .select()
      .from(recipes)
      .where(eq(recipes.id, recipeId));

    if (!recipe) {
      console.error(`❌ Recipe not found: ${recipeId}`);
      process.exit(1);
    }

    console.log(`📝 Recipe: ${recipe.name}\n`);

    // Parse ingredients
    let ingredients: string[];
    try {
      ingredients = JSON.parse(recipe.ingredients as string);
      if (!Array.isArray(ingredients)) {
        throw new Error('Ingredients is not an array');
      }
    } catch (error) {
      console.error('❌ Invalid ingredients format:', error);
      process.exit(1);
    }

    console.log(`📊 Found ${ingredients.length} ingredients\n`);
    console.log('BEFORE CLEANUP:');
    console.log('━'.repeat(80));
    ingredients.forEach((ing, i) => {
      console.log(`${i + 1}. ${ing}`);
    });

    // Clean each ingredient
    const cleanedIngredients = ingredients.map(cleanIngredient);

    console.log('\n\nAFTER CLEANUP:');
    console.log('━'.repeat(80));
    cleanedIngredients.forEach((ing, i) => {
      console.log(`${i + 1}. ${ing}`);
    });

    // Show changes
    console.log('\n\nCHANGES:');
    console.log('━'.repeat(80));
    let changeCount = 0;
    ingredients.forEach((original, i) => {
      const cleaned = cleanedIngredients[i];
      if (original !== cleaned) {
        changeCount++;
        console.log(`\n${i + 1}. Changed:`);
        console.log(`   BEFORE: "${original}"`);
        console.log(`   AFTER:  "${cleaned}"`);
      }
    });

    if (changeCount === 0) {
      console.log('No changes needed - ingredients are already clean!');
      return;
    }

    console.log(`\n✅ Total changes: ${changeCount}/${ingredients.length} ingredients\n`);

    // Update database
    console.log('💾 Updating database...');
    await db
      .update(recipes)
      .set({
        ingredients: JSON.stringify(cleanedIngredients),
        updated_at: new Date(),
      })
      .where(eq(recipes.id, recipeId));

    console.log('✅ Database updated successfully!\n');
    console.log('━'.repeat(80));
    console.log('\n✨ Ingredient cleanup complete!\n');
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

// Get recipe ID from command line
const recipeId = process.argv[2];

if (!recipeId) {
  console.error('❌ Usage: pnpm tsx scripts/clean-recipe-ingredients.ts <recipe-id>');
  console.error('Example: pnpm tsx scripts/clean-recipe-ingredients.ts 42c99b0f-05d2-4b96-95b0-d8d611c8bcde');
  process.exit(1);
}

// Run the script
cleanRecipeIngredients(recipeId)
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
