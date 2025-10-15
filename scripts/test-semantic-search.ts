/**
 * Test script for semantic search functionality
 *
 * This script tests:
 * 1. Semantic search with natural language queries
 * 2. Similar recipes feature
 * 3. Hybrid search combining vector and text search
 * 4. Filter functionality (cuisine, difficulty, dietary)
 */

import { semanticSearchRecipes, hybridSearchRecipes, findSimilarToRecipe } from '../src/app/actions/semantic-search';

// ANSI colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function section(title: string) {
  console.log('\n' + '='.repeat(80));
  log(title, colors.bright + colors.cyan);
  console.log('='.repeat(80));
}

async function testSemanticSearch() {
  section('TEST 1: Semantic Search with Natural Language Queries');

  const testQueries = [
    'comfort food for cold weather',
    'quick healthy breakfast',
    'spicy Asian dinner',
    'decadent chocolate dessert',
    'light summer salad',
  ];

  for (const query of testQueries) {
    log(`\nQuery: "${query}"`, colors.yellow);

    try {
      const result = await semanticSearchRecipes(query, {
        limit: 5,
        minSimilarity: 0.3,
      });

      if (result.success) {
        log(`✓ Found ${result.recipes.length} recipes`, colors.green);

        result.recipes.forEach((recipe, index) => {
          const similarity = (recipe.similarity * 100).toFixed(1);
          console.log(
            `  ${index + 1}. ${recipe.name} ` +
            `${colors.blue}(${similarity}% match)${colors.reset} ` +
            `${recipe.cuisine ? `[${recipe.cuisine}]` : ''}`
          );
        });
      } else {
        log(`✗ Search failed: ${result.error}`, colors.red);
      }
    } catch (error: any) {
      log(`✗ Error: ${error.message}`, colors.red);
    }
  }
}

async function testFilteredSearch() {
  section('TEST 2: Semantic Search with Filters');

  const testCases = [
    {
      query: 'pasta dish',
      options: { cuisine: 'Italian', difficulty: 'easy' as const, limit: 5 },
      description: 'Italian pasta, easy difficulty',
    },
    {
      query: 'healthy meal',
      options: { dietaryRestrictions: ['vegetarian', 'vegan'], limit: 5 },
      description: 'Vegetarian/Vegan healthy meals',
    },
    {
      query: 'quick dinner',
      options: { difficulty: 'easy' as const, limit: 5, minSimilarity: 0.4 },
      description: 'Easy quick dinners (40% min similarity)',
    },
  ];

  for (const testCase of testCases) {
    log(`\nTest: ${testCase.description}`, colors.yellow);
    log(`Query: "${testCase.query}"`, colors.cyan);

    try {
      const result = await semanticSearchRecipes(testCase.query, testCase.options);

      if (result.success) {
        log(`✓ Found ${result.recipes.length} recipes`, colors.green);

        result.recipes.slice(0, 3).forEach((recipe) => {
          const similarity = (recipe.similarity * 100).toFixed(1);
          console.log(
            `  - ${recipe.name} ` +
            `${colors.blue}(${similarity}% match)${colors.reset} ` +
            `[${recipe.difficulty || 'N/A'}] ` +
            `${recipe.cuisine ? `{${recipe.cuisine}}` : ''}`
          );
        });
      } else {
        log(`✗ Search failed: ${result.error}`, colors.red);
      }
    } catch (error: any) {
      log(`✗ Error: ${error.message}`, colors.red);
    }
  }
}

async function testSimilarRecipes() {
  section('TEST 3: Find Similar Recipes');

  // First, find a recipe to test with
  log('\nFinding a recipe to test with...', colors.yellow);

  try {
    const searchResult = await semanticSearchRecipes('pasta', { limit: 1 });

    if (!searchResult.success || searchResult.recipes.length === 0) {
      log('✗ Could not find a recipe to test with', colors.red);
      return;
    }

    const testRecipe = searchResult.recipes[0];
    log(`Using recipe: "${testRecipe.name}" (ID: ${testRecipe.id})`, colors.cyan);

    // Find similar recipes
    log('\nFinding similar recipes...', colors.yellow);
    const similarResult = await findSimilarToRecipe(testRecipe.id, 5);

    if (similarResult.success) {
      log(`✓ Found ${similarResult.recipes.length} similar recipes`, colors.green);

      similarResult.recipes.forEach((recipe, index) => {
        const similarity = (recipe.similarity * 100).toFixed(1);
        console.log(
          `  ${index + 1}. ${recipe.name} ` +
          `${colors.blue}(${similarity}% similar)${colors.reset} ` +
          `${recipe.cuisine ? `[${recipe.cuisine}]` : ''}`
        );
      });
    } else {
      log(`✗ Failed to find similar recipes: ${similarResult.error}`, colors.red);
    }
  } catch (error: any) {
    log(`✗ Error: ${error.message}`, colors.red);
  }
}

async function testHybridSearch() {
  section('TEST 4: Hybrid Search (Semantic + Text)');

  const testQueries = [
    'spaghetti carbonara',
    'chocolate cake',
    'chicken soup',
  ];

  for (const query of testQueries) {
    log(`\nQuery: "${query}"`, colors.yellow);

    try {
      const hybridResult = await hybridSearchRecipes(query, { limit: 5 });

      if (hybridResult.success) {
        log(`✓ Found ${hybridResult.recipes.length} recipes (hybrid search)`, colors.green);

        hybridResult.recipes.slice(0, 3).forEach((recipe) => {
          const similarity = recipe.similarity > 0
            ? `${(recipe.similarity * 100).toFixed(1)}% match`
            : 'text match';
          console.log(
            `  - ${recipe.name} ` +
            `${colors.blue}(${similarity})${colors.reset}`
          );
        });
      } else {
        log(`✗ Hybrid search failed: ${hybridResult.error}`, colors.red);
      }
    } catch (error: any) {
      log(`✗ Error: ${error.message}`, colors.red);
    }
  }
}

async function testPerformance() {
  section('TEST 5: Performance Testing');

  const query = 'quick easy dinner';

  log(`\nTesting search performance for: "${query}"`, colors.yellow);

  try {
    const startTime = Date.now();
    const result = await semanticSearchRecipes(query, { limit: 20 });
    const endTime = Date.now();
    const duration = endTime - startTime;

    if (result.success) {
      log(`✓ Search completed in ${duration}ms`, colors.green);
      log(`  Found ${result.recipes.length} recipes`, colors.cyan);

      if (duration < 1000) {
        log('  Performance: Excellent (< 1s)', colors.green);
      } else if (duration < 3000) {
        log('  Performance: Good (1-3s)', colors.yellow);
      } else {
        log('  Performance: Slow (> 3s)', colors.red);
      }
    } else {
      log(`✗ Search failed: ${result.error}`, colors.red);
    }
  } catch (error: any) {
    log(`✗ Error: ${error.message}`, colors.red);
  }
}

async function runAllTests() {
  log('\n' + '█'.repeat(80), colors.bright + colors.green);
  log('SEMANTIC SEARCH TEST SUITE', colors.bright + colors.green);
  log('█'.repeat(80) + '\n', colors.bright + colors.green);

  try {
    await testSemanticSearch();
    await testFilteredSearch();
    await testSimilarRecipes();
    await testHybridSearch();
    await testPerformance();

    section('TEST SUMMARY');
    log('✓ All tests completed successfully!', colors.bright + colors.green);
    log('\nNote: Check for any errors or warnings above.', colors.yellow);
  } catch (error: any) {
    section('TEST FAILED');
    log(`✗ Fatal error: ${error.message}`, colors.bright + colors.red);
    console.error(error);
    process.exit(1);
  }
}

// Run tests
runAllTests().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
