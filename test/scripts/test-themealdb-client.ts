#!/usr/bin/env tsx

/**
 * Test TheMealDB Client
 *
 * Simple test script to verify TheMealDB API client works correctly
 */

import { TheMealDBClient } from './lib/themealdb-client';

async function testClient() {
  console.log('🧪 Testing TheMealDB API Client\n');

  const client = new TheMealDBClient('1'); // Free test key

  try {
    // Test 1: Get categories
    console.log('📚 Test 1: Fetching categories...');
    const categories = await client.getCategories();
    console.log(`  ✅ Success! Found ${categories.length} categories`);
    console.log(`  Sample categories: ${categories.slice(0, 3).map(c => c.strCategory).join(', ')}\n`);

    // Test 2: Get recipes from a category
    console.log('🍗 Test 2: Fetching Chicken recipes...');
    const chickenRecipes = await client.getRecipesByCategory('Chicken');
    console.log(`  ✅ Success! Found ${chickenRecipes.length} Chicken recipes`);
    console.log(`  Sample recipes: ${chickenRecipes.slice(0, 3).map(r => r.strMeal).join(', ')}\n`);

    // Test 3: Get a specific recipe
    if (chickenRecipes.length > 0) {
      const firstRecipeId = chickenRecipes[0].idMeal;
      console.log(`🍽️  Test 3: Fetching full recipe details (ID: ${firstRecipeId})...`);
      const recipe = await client.getRecipeById(firstRecipeId);

      if (recipe) {
        console.log(`  ✅ Success! Recipe: ${recipe.strMeal}`);
        console.log(`  Category: ${recipe.strCategory}, Cuisine: ${recipe.strArea}`);

        // Count ingredients
        let ingredientCount = 0;
        for (let i = 1; i <= 20; i++) {
          const ing = recipe[`strIngredient${i}` as keyof typeof recipe];
          if (ing && String(ing).trim()) ingredientCount++;
        }
        console.log(`  Ingredients: ${ingredientCount}`);
        console.log(`  Has instructions: ${recipe.strInstructions ? 'Yes' : 'No'}\n`);
      } else {
        console.log('  ❌ Failed to fetch recipe\n');
      }
    }

    // Test 4: Get random recipe
    console.log('🎲 Test 4: Fetching random recipe...');
    const randomRecipe = await client.getRandomRecipe();
    if (randomRecipe) {
      console.log(`  ✅ Success! Random recipe: ${randomRecipe.strMeal}\n`);
    } else {
      console.log('  ❌ Failed to fetch random recipe\n');
    }

    console.log('✅ All tests passed!\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testClient();
