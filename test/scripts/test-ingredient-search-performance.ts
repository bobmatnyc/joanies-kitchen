#!/usr/bin/env tsx

/**
 * Performance Test for Ingredient Search
 * Tests the searchRecipesByIngredients function with various inputs
 *
 * Expected Performance (after optimizations):
 * - Simple searches: 100-300ms
 * - Complex searches: 200-500ms
 * - Cache hits: <10ms
 *
 * Usage:
 *   pnpm tsx scripts/test-ingredient-search-performance.ts
 */

import { searchRecipesByIngredients } from '@/app/actions/ingredient-search';

// Test cases covering different scenarios
const testCases = [
  {
    name: 'Basic search - single ingredient',
    ingredients: ['chicken'],
    description: 'Simple single-ingredient search',
  },
  {
    name: 'Common combination',
    ingredients: ['chicken', 'rice', 'tomatoes'],
    description: 'Common 3-ingredient combination',
  },
  {
    name: 'Alias test',
    ingredients: ['scallions'],
    description: 'Tests alias matching (scallions → green onions)',
  },
  {
    name: 'Complex search',
    ingredients: [
      'chicken',
      'rice',
      'tomatoes',
      'onions',
      'garlic',
      'olive oil',
      'basil',
      'parmesan',
    ],
    description: 'Complex multi-ingredient search (8 ingredients)',
  },
  {
    name: 'No results',
    ingredients: ['xyz123nonsense'],
    description: 'Search that should return no results quickly',
  },
];

async function runPerformanceTest() {
  console.log('🧪 Ingredient Search Performance Test\n');
  console.log('=' .repeat(70));
  console.log('\n');

  const results: Array<{
    name: string;
    time: number;
    recipeCount: number;
    success: boolean;
  }> = [];

  for (const testCase of testCases) {
    console.log(`📝 Test: ${testCase.name}`);
    console.log(`   Ingredients: ${testCase.ingredients.join(', ')}`);
    console.log(`   ${testCase.description}`);

    try {
      const startTime = performance.now();

      const result = await searchRecipesByIngredients(testCase.ingredients, {
        matchMode: 'any',
        limit: 50,
      });

      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);

      if (result.success) {
        console.log(`   ✅ Success: ${result.recipes.length} recipes found in ${duration}ms`);
        results.push({
          name: testCase.name,
          time: duration,
          recipeCount: result.recipes.length,
          success: true,
        });
      } else {
        console.log(`   ❌ Failed: ${result.error}`);
        results.push({
          name: testCase.name,
          time: duration,
          recipeCount: 0,
          success: false,
        });
      }
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
      results.push({
        name: testCase.name,
        time: 0,
        recipeCount: 0,
        success: false,
      });
    }

    console.log('');
  }

  console.log('=' .repeat(70));
  console.log('\n📊 Performance Summary\n');

  const successfulTests = results.filter((r) => r.success);
  const avgTime =
    successfulTests.reduce((sum, r) => sum + r.time, 0) / (successfulTests.length || 1);
  const maxTime = Math.max(...successfulTests.map((r) => r.time), 0);
  const minTime = Math.min(...successfulTests.map((r) => r.time), Infinity);

  console.log('Results:');
  results.forEach((r, i) => {
    const status = r.success ? '✅' : '❌';
    const timeDisplay = r.success ? `${r.time}ms` : 'N/A';
    const recipesDisplay = r.success ? `${r.recipeCount} recipes` : 'Failed';
    console.log(`  ${i + 1}. ${status} ${r.name}: ${timeDisplay} (${recipesDisplay})`);
  });

  console.log('');
  console.log('Statistics:');
  console.log(`  Average: ${Math.round(avgTime)}ms`);
  console.log(`  Fastest: ${minTime === Infinity ? 'N/A' : minTime + 'ms'}`);
  console.log(`  Slowest: ${maxTime}ms`);
  console.log(`  Success Rate: ${successfulTests.length}/${results.length}`);
  console.log('');

  // Performance assessment
  console.log('🎯 Performance Assessment:\n');
  if (avgTime < 300) {
    console.log('   ✅ EXCELLENT - Average response time < 300ms');
  } else if (avgTime < 500) {
    console.log('   ✅ GOOD - Average response time < 500ms');
  } else if (avgTime < 1000) {
    console.log('   ⚠️  ACCEPTABLE - Average response time < 1s');
  } else {
    console.log('   ❌ NEEDS IMPROVEMENT - Average response time > 1s');
  }

  console.log('');
  console.log('💡 Notes:');
  console.log('   - First run may be slower due to cold start');
  console.log('   - Subsequent searches should benefit from caching');
  console.log('   - GIN index on aliases improves fuzzy matching by ~200-300ms');
  console.log('   - Target: < 500ms for complex searches');
  console.log('');

  process.exit(0);
}

runPerformanceTest();
