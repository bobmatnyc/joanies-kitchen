#!/usr/bin/env tsx
/**
 * Test AI Recipe Extraction
 *
 * Test the enhanced AI extraction with 3 sample URLs from different sources
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });

import Firecrawl from '@mendable/firecrawl-js';
import { extractRecipeWithAI } from './lib/recipe-parser-script';

// Test URLs from different sources
const TEST_URLS = [
  {
    name: 'Food Network (Ina Garten)',
    url: 'https://www.foodnetwork.com/recipes/ina-garten/perfect-roast-chicken-recipe-1940592',
  },
  {
    name: 'Personal Blog (Spring Restaurant - Skye Gyngell)',
    url: 'https://springrestaurant.co.uk/scroll/skye-gyngell-fresh-pasta/',
  },
  {
    name: 'Recipe Site (Great British Chefs)',
    url: 'https://www.greatbritishchefs.com/recipes/monkfish-chard-beans-recipe',
  },
];

async function testUrl(testCase: { name: string; url: string }) {
  console.log('\n' + '='.repeat(80));
  console.log(`Testing: ${testCase.name}`);
  console.log(`URL: ${testCase.url}`);
  console.log('='.repeat(80));

  try {
    // Step 1: Firecrawl scraping
    console.log('\n1. Scraping with Firecrawl...');
    const firecrawl = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY });
    const result = await firecrawl.scrape(testCase.url, {
      formats: ['markdown', 'html'],
      onlyMainContent: true,
      timeout: 30000,
    }) as any;

    if (!result || !result.markdown) {
      throw new Error('No content returned from Firecrawl');
    }

    console.log(`   ✓ Scraped ${result.markdown.length} characters`);
    console.log(`   Metadata: title="${result.metadata?.title || 'N/A'}"`);

    // Step 2: AI extraction
    console.log('\n2. Extracting recipe with AI...');
    const recipeData = await extractRecipeWithAI(
      result.markdown,
      testCase.url,
      result.metadata
    );

    if (!recipeData) {
      console.log('   ✗ AI extraction failed');
      console.log('\n   Markdown preview (first 800 chars):');
      console.log('   ' + result.markdown.substring(0, 800).replace(/\n/g, '\n   '));
      return false;
    }

    // Step 3: Display results
    console.log('\n3. Extraction Results:');
    console.log(`   Name: ${recipeData.name}`);
    console.log(`   Description: ${recipeData.description || 'N/A'}`);
    console.log(`   Ingredients: ${recipeData.ingredients.length}`);
    console.log(`   Instructions: ${recipeData.instructions.length}`);
    console.log(`   Prep Time: ${recipeData.prepTime || 'N/A'}`);
    console.log(`   Cook Time: ${recipeData.cookTime || 'N/A'}`);
    console.log(`   Servings: ${recipeData.servings || 'N/A'}`);
    console.log(`   Difficulty: ${recipeData.difficulty || 'N/A'}`);
    console.log(`   Cuisine: ${recipeData.cuisine || 'N/A'}`);
    console.log(`   Confidence: ${recipeData.confidence || 'N/A'}`);

    console.log('\n   Sample Ingredients (first 3):');
    recipeData.ingredients.slice(0, 3).forEach((ing, i) => {
      console.log(`     ${i + 1}. ${ing}`);
    });

    console.log('\n   Sample Instructions (first 2):');
    recipeData.instructions.slice(0, 2).forEach((step, i) => {
      console.log(`     ${i + 1}. ${step.substring(0, 100)}${step.length > 100 ? '...' : ''}`);
    });

    console.log('\n   ✓ SUCCESS');
    return true;

  } catch (error: any) {
    console.error(`\n   ✗ FAILED: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('='.repeat(80));
  console.log('AI RECIPE EXTRACTION TEST');
  console.log('='.repeat(80));

  if (!process.env.FIRECRAWL_API_KEY) {
    console.error('\n❌ FIRECRAWL_API_KEY not found');
    process.exit(1);
  }

  if (!process.env.OPENROUTER_API_KEY) {
    console.error('\n❌ OPENROUTER_API_KEY not found');
    process.exit(1);
  }

  console.log('✓ API keys validated\n');

  let successCount = 0;
  let failCount = 0;

  for (const testCase of TEST_URLS) {
    const success = await testUrl(testCase);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }

    // Rate limiting between tests
    if (testCase !== TEST_URLS[TEST_URLS.length - 1]) {
      console.log('\n⏳ Waiting 4 seconds before next test...');
      await new Promise(resolve => setTimeout(resolve, 4000));
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total tests: ${TEST_URLS.length}`);
  console.log(`✓ Success: ${successCount} (${Math.round(successCount / TEST_URLS.length * 100)}%)`);
  console.log(`✗ Failed: ${failCount}`);
  console.log('='.repeat(80));

  if (successCount === TEST_URLS.length) {
    console.log('\n🎉 ALL TESTS PASSED! Ready to run full batch.\n');
  } else {
    console.log('\n⚠ Some tests failed. Review errors before running full batch.\n');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ FATAL ERROR:', error);
    process.exit(1);
  });
