#!/usr/bin/env tsx

/**
 * TheMealDB API Connection Test
 *
 * Simple test script to validate TheMealDB API connectivity
 * before running the full import.
 *
 * Usage:
 *   tsx scripts/test-themealdb-api.ts
 */

import { TheMealDBClient } from './lib/themealdb-client';

async function testTheMealDBAPI() {
  console.log('🧪 Testing TheMealDB API Connection\n');

  const client = new TheMealDBClient('1'); // Use free test key

  try {
    // Test 1: Fetch categories
    console.log('📋 Test 1: Fetching categories...');
    const categories = await client.getCategories();
    console.log(`  ✅ Success! Found ${categories.length} categories`);
    console.log(`  Sample categories: ${categories.slice(0, 3).map((c) => c.strCategory).join(', ')}\n`);

    // Test 2: Fetch recipes from a category
    if (categories.length > 0) {
      const testCategory = categories[0].strCategory;
      console.log(`📚 Test 2: Fetching recipes from "${testCategory}" category...`);
      const recipes = await client.getRecipesByCategory(testCategory);
      console.log(`  ✅ Success! Found ${recipes.length} recipes`);
      if (recipes.length > 0) {
        console.log(`  Sample recipe: "${recipes[0].strMeal}"\n`);
      }

      // Test 3: Fetch full recipe details
      if (recipes.length > 0) {
        const testRecipeId = recipes[0].idMeal;
        console.log(`📄 Test 3: Fetching full details for recipe ID ${testRecipeId}...`);
        const recipeDetails = await client.getRecipeById(testRecipeId);
        if (recipeDetails) {
          console.log(`  ✅ Success! Recipe: "${recipeDetails.strMeal}"`);
          console.log(`  Category: ${recipeDetails.strCategory}`);
          console.log(`  Area: ${recipeDetails.strArea}`);
          console.log(`  Has instructions: ${!!recipeDetails.strInstructions}\n`);
        } else {
          console.log('  ❌ Failed to fetch recipe details\n');
        }
      }
    }

    // Test 4: Get random recipe
    console.log('🎲 Test 4: Fetching random recipe...');
    const randomRecipe = await client.getRandomRecipe();
    if (randomRecipe) {
      console.log(`  ✅ Success! Random recipe: "${randomRecipe.strMeal}"`);
      console.log(`  Category: ${randomRecipe.strCategory}\n`);
    } else {
      console.log('  ❌ Failed to fetch random recipe\n');
    }

    console.log('✅ All tests passed! TheMealDB API is accessible.\n');
    console.log('You can now run the pilot import:');
    console.log('  pnpm import:themealdb:pilot\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ API Test Failed:', error);
    console.error('\nTroubleshooting:');
    console.error('  1. Check your internet connection');
    console.error('  2. Verify TheMealDB API is accessible: https://www.themealdb.com/api.php');
    console.error('  3. Try accessing directly: https://www.themealdb.com/api/json/v1/1/categories.php');
    console.error('  4. Check if you are behind a firewall or proxy\n');
    process.exit(1);
  }
}

// Run test
testTheMealDBAPI().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
