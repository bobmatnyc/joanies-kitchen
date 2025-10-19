#!/usr/bin/env tsx

/**
 * Tasty API Connectivity Test
 *
 * Tests connection to Tasty API via RapidAPI
 * Verifies API key is valid and endpoints are accessible
 *
 * Usage:
 *   tsx scripts/test-tasty-api.ts
 */

import { config } from 'dotenv';
import { TastyClient } from './lib/tasty-client';

// Load environment variables
config({ path: '.env.local' });

async function testTastyAPI() {
  console.log('🧪 Testing Tasty API Connectivity\n');
  console.log('='.repeat(60));

  // Check for required environment variables
  const apiKey = process.env.RAPIDAPI_KEY;
  const apiHost = process.env.RAPIDAPI_HOST || 'tasty.p.rapidapi.com';

  if (!apiKey) {
    console.error('❌ RAPIDAPI_KEY not found in environment variables');
    console.log('\nPlease add your RapidAPI key to .env.local:');
    console.log('  RAPIDAPI_KEY=your_rapidapi_key_here');
    console.log('  RAPIDAPI_HOST=tasty.p.rapidapi.com');
    console.log('\nGet your API key from: https://rapidapi.com/apidojo/api/tasty');
    process.exit(1);
  }

  console.log(`✅ API Key found: ${apiKey.substring(0, 10)}...`);
  console.log(`✅ API Host: ${apiHost}\n`);
  console.log('='.repeat(60));

  // Initialize client
  const client = new TastyClient(apiKey, apiHost);

  try {
    // Test 1: Basic connectivity
    console.log('\n📡 Test 1: Basic API Connectivity');
    console.log('-'.repeat(60));
    const isConnected = await client.testConnection();
    if (isConnected) {
      console.log('✅ API connection successful!\n');
    } else {
      console.log('❌ API connection failed\n');
      process.exit(1);
    }

    // Test 2: Search recipes
    console.log('📡 Test 2: Search Recipes (first 5)');
    console.log('-'.repeat(60));
    const searchResults = await client.searchRecipes(0, 5);
    console.log(`✅ Found ${searchResults.count} total recipes`);
    console.log(`✅ Retrieved ${searchResults.results.length} recipes\n`);

    if (searchResults.results.length > 0) {
      console.log('Sample recipes:');
      for (const recipe of searchResults.results) {
        console.log(`  - ${recipe.name} (ID: ${recipe.id})`);
      }
      console.log('');
    }

    // Test 3: Get recipe details
    if (searchResults.results.length > 0) {
      const firstRecipe = searchResults.results[0];
      console.log('📡 Test 3: Get Recipe Details');
      console.log('-'.repeat(60));
      console.log(`Fetching details for: "${firstRecipe.name}"\n`);

      const recipeDetails = await client.getRecipeById(firstRecipe.id);

      if (recipeDetails) {
        console.log('✅ Recipe details retrieved successfully!\n');
        console.log('Recipe Information:');
        console.log(`  Name: ${recipeDetails.name}`);
        console.log(`  Description: ${recipeDetails.description?.substring(0, 100)}...`);
        console.log(`  Servings: ${recipeDetails.num_servings || 'N/A'}`);
        console.log(`  Prep Time: ${recipeDetails.prep_time_minutes || 'N/A'} min`);
        console.log(`  Cook Time: ${recipeDetails.cook_time_minutes || 'N/A'} min`);
        console.log(`  Total Time: ${recipeDetails.total_time_minutes || 'N/A'} min`);

        // Count ingredients
        let ingredientCount = 0;
        if (recipeDetails.sections) {
          for (const section of recipeDetails.sections) {
            ingredientCount += section.components?.length || 0;
          }
        }
        console.log(`  Ingredients: ${ingredientCount}`);

        // Count instructions
        const instructionCount = recipeDetails.instructions?.length || 0;
        console.log(`  Instructions: ${instructionCount} steps`);

        // Video URL
        const videoUrl = recipeDetails.video_url || recipeDetails.original_video_url;
        console.log(`  Video URL: ${videoUrl ? '✅ Available' : '❌ Not available'}`);

        // Image URL
        console.log(`  Image URL: ${recipeDetails.thumbnail_url ? '✅ Available' : '❌ Not available'}`);

        // Tags
        const tagCount = recipeDetails.tags?.length || 0;
        console.log(`  Tags: ${tagCount}`);

        // Nutrition
        const hasNutrition = recipeDetails.nutrition && Object.keys(recipeDetails.nutrition).length > 0;
        console.log(`  Nutrition Info: ${hasNutrition ? '✅ Available' : '❌ Not available'}`);

        console.log('');
      } else {
        console.log('❌ Failed to retrieve recipe details\n');
      }
    }

    // Test 4: Get available tags
    console.log('📡 Test 4: Get Available Tags');
    console.log('-'.repeat(60));
    const tags = await client.getTags();
    console.log(`✅ Retrieved ${tags.length} tags\n`);

    if (tags.length > 0) {
      console.log('Sample tags (first 10):');
      for (const tag of tags.slice(0, 10)) {
        console.log(`  - ${tag.display_name} (${tag.name})`);
      }
      console.log('');
    }

    // Success summary
    console.log('='.repeat(60));
    console.log('✅ All tests passed successfully!');
    console.log('='.repeat(60));
    console.log('\nYou can now run the pilot import:');
    console.log('  pnpm import:tasty:pilot\n');
  } catch (error) {
    console.error('\n❌ Test failed with error:');
    console.error(error);
    console.log('\nPlease check:');
    console.log('  1. Your API key is valid');
    console.log('  2. You have available API quota (free tier: 500 req/month)');
    console.log('  3. Your internet connection is working');
    console.log('\nAPI Dashboard: https://rapidapi.com/developer/dashboard');
    process.exit(1);
  }
}

// Run tests
testTastyAPI().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
