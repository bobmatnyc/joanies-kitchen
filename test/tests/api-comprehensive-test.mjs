#!/usr/bin/env node
/**
 * Comprehensive API Testing Suite
 * Tests all public endpoints against localhost:3005
 */

const BASE_URL = 'http://localhost:3005';

const testResults = {
  recipes: { passed: [], failed: [], total: 0 },
  meals: { passed: [], failed: [], total: 0 },
  chefs: { passed: [], failed: [], total: 0 },
  collections: { passed: [], failed: [], total: 0 },
  ingredients: { passed: [], failed: [], total: 0 },
  overall: { passed: 0, failed: 0, total: 0 },
};

const imageIssues = {
  nullImageUrl: [],
  emptyImageUrl: [],
  http404: [],
  invalidFormat: [],
};

const mealSlugIssues = [];
const dataQualityIssues = [];

// Utility functions
function logSection(title) {
  console.log('\n' + '='.repeat(80));
  console.log(title);
  console.log('='.repeat(80));
}

function logTest(category, testName, status, details = '') {
  const symbol = status === 'PASS' ? '✓' : '✗';
  console.log(`[${category}] ${symbol} ${testName}${details ? ': ' + details : ''}`);
}

function recordResult(category, testName, passed, details = {}) {
  testResults[category].total++;
  testResults.overall.total++;

  const result = { test: testName, ...details };

  if (passed) {
    testResults[category].passed.push(result);
    testResults.overall.passed++;
    logTest(category.toUpperCase(), testName, 'PASS', details.summary);
  } else {
    testResults[category].failed.push(result);
    testResults.overall.failed++;
    logTest(category.toUpperCase(), testName, 'FAIL', details.summary);
  }
}

async function makeRequest(endpoint, options = {}) {
  try {
    const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const contentType = response.headers.get('content-type');
    let data = null;

    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return {
      status: response.status,
      ok: response.ok,
      data,
      headers: Object.fromEntries(response.headers.entries()),
    };
  } catch (error) {
    return {
      status: 0,
      ok: false,
      error: error.message,
      data: null,
    };
  }
}

// ============================================================================
// RECIPES API TESTS
// ============================================================================

async function testRecipesAPI() {
  logSection('TESTING RECIPES API');

  // Test 1: GET /api/v1/recipes (list)
  const listResponse = await makeRequest('/api/v1/recipes?limit=50');
  recordResult(
    'recipes',
    'GET /api/v1/recipes - List recipes',
    listResponse.ok && Array.isArray(listResponse.data),
    {
      status: listResponse.status,
      summary: `${listResponse.ok ? 'OK' : 'FAILED'} - ${listResponse.status}`,
      count: Array.isArray(listResponse.data) ? listResponse.data.length : 0,
    }
  );

  // Test 2: Pagination
  const page1 = await makeRequest('/api/v1/recipes?limit=10&offset=0');
  const page2 = await makeRequest('/api/v1/recipes?limit=10&offset=10');
  const paginationWorks =
    page1.ok && page2.ok && Array.isArray(page1.data) && Array.isArray(page2.data);

  recordResult('recipes', 'Pagination (limit & offset)', paginationWorks, {
    status: page1.status,
    summary: `Page 1: ${page1.data?.length || 0} items, Page 2: ${page2.data?.length || 0} items`,
  });

  // Test 3: Image URL validation (CRITICAL)
  if (Array.isArray(listResponse.data) && listResponse.data.length > 0) {
    const recipes = listResponse.data;
    let nullCount = 0;
    let emptyCount = 0;
    let validCount = 0;

    for (const recipe of recipes) {
      if (recipe.image_url === null || recipe.image_url === undefined) {
        nullCount++;
        imageIssues.nullImageUrl.push({
          id: recipe.id,
          title: recipe.title,
          slug: recipe.slug,
        });
      } else if (recipe.image_url === '') {
        emptyCount++;
        imageIssues.emptyImageUrl.push({
          id: recipe.id,
          title: recipe.title,
          slug: recipe.slug,
        });
      } else {
        validCount++;
        // Test if URL is accessible (sample first 5)
        if (validCount <= 5) {
          const imgTest = await makeRequest(recipe.image_url);
          if (!imgTest.ok) {
            imageIssues.http404.push({
              id: recipe.id,
              title: recipe.title,
              url: recipe.image_url,
              status: imgTest.status,
            });
          }
        }
      }
    }

    const totalRecipes = recipes.length;
    const healthyPercentage = ((validCount / totalRecipes) * 100).toFixed(2);

    recordResult('recipes', 'Recipe image URLs validation', validCount > nullCount + emptyCount, {
      summary: `${validCount}/${totalRecipes} valid (${healthyPercentage}%), ${nullCount} null, ${emptyCount} empty`,
      nullCount,
      emptyCount,
      validCount,
      totalRecipes,
    });
  }

  // Test 4: Individual recipe detail
  if (Array.isArray(listResponse.data) && listResponse.data.length > 0) {
    const firstRecipe = listResponse.data[0];
    const detailResponse = await makeRequest(`/api/v1/recipes/${firstRecipe.id}`);

    recordResult('recipes', `GET /api/v1/recipes/:id - Recipe detail`, detailResponse.ok, {
      status: detailResponse.status,
      summary: `Recipe ID ${firstRecipe.id}`,
      recipeId: firstRecipe.id,
    });

    // Test 5: Recipe data structure validation
    if (detailResponse.ok && detailResponse.data) {
      const recipe = detailResponse.data;
      const hasRequiredFields = recipe.id && recipe.title && recipe.slug;
      const hasIngredients = Array.isArray(recipe.ingredients);
      const hasInstructions = Array.isArray(recipe.instructions);

      recordResult(
        'recipes',
        'Recipe data structure',
        hasRequiredFields && hasIngredients && hasInstructions,
        {
          summary: `Required fields: ${hasRequiredFields}, Ingredients: ${hasIngredients}, Instructions: ${hasInstructions}`,
          ingredientCount: recipe.ingredients?.length || 0,
          instructionCount: recipe.instructions?.length || 0,
        }
      );
    }
  }

  // Test 6: Paginated recipes endpoint
  const paginatedResponse = await makeRequest('/api/recipes/paginated?page=1&limit=20');
  recordResult('recipes', 'GET /api/recipes/paginated', paginatedResponse.ok, {
    status: paginatedResponse.status,
    summary: `Status ${paginatedResponse.status}`,
  });

  // Test 7: Search functionality
  const searchResponse = await makeRequest('/api/search/semantic?q=chicken');
  recordResult('recipes', 'Recipe search (semantic)', searchResponse.ok, {
    status: searchResponse.status,
    summary: `Status ${searchResponse.status}`,
    resultCount: Array.isArray(searchResponse.data) ? searchResponse.data.length : 0,
  });
}

// ============================================================================
// MEALS API TESTS
// ============================================================================

async function testMealsAPI() {
  logSection('TESTING MEALS API');

  // Test 1: GET /api/v1/meals (list all meals)
  const listResponse = await makeRequest('/api/v1/meals');
  recordResult(
    'meals',
    'GET /api/v1/meals - List meals',
    listResponse.ok && Array.isArray(listResponse.data),
    {
      status: listResponse.status,
      summary: `${listResponse.ok ? 'OK' : 'FAILED'} - ${listResponse.status}`,
      count: Array.isArray(listResponse.data) ? listResponse.data.length : 0,
    }
  );

  // Test 2: Meal slug testing (CRITICAL - "meal not found" issue)
  if (Array.isArray(listResponse.data) && listResponse.data.length > 0) {
    const meals = listResponse.data;
    console.log(`\nTesting ${meals.length} meal slugs...`);

    let slugTestsPassed = 0;
    let slugTestsFailed = 0;

    for (const meal of meals) {
      // Test API endpoint
      const apiResponse = await makeRequest(`/api/v1/meals/${meal.id}`);

      // Also test the page route (simulated)
      const pageResponse = await makeRequest(`/meals/${meal.slug}`);

      const apiWorks = apiResponse.ok;
      const pageWorks = pageResponse.ok || pageResponse.status === 200;

      if (!apiWorks || !pageWorks) {
        slugTestsFailed++;
        mealSlugIssues.push({
          id: meal.id,
          slug: meal.slug,
          title: meal.title,
          apiStatus: apiResponse.status,
          pageStatus: pageResponse.status,
          apiError: apiResponse.error || apiResponse.data?.error,
          pageError: pageResponse.error,
        });

        console.log(
          `  ✗ Meal "${meal.title}" (slug: ${meal.slug}): API=${apiResponse.status}, Page=${pageResponse.status}`
        );
      } else {
        slugTestsPassed++;
      }
    }

    recordResult('meals', 'Meal slug resolution', slugTestsFailed === 0, {
      summary: `${slugTestsPassed}/${meals.length} slugs working, ${slugTestsFailed} failed`,
      passed: slugTestsPassed,
      failed: slugTestsFailed,
      total: meals.length,
    });
  }

  // Test 3: Meal image URLs
  if (Array.isArray(listResponse.data)) {
    const meals = listResponse.data;
    let nullImages = 0;
    let emptyImages = 0;
    let validImages = 0;

    for (const meal of meals) {
      if (meal.image_url === null || meal.image_url === undefined) {
        nullImages++;
      } else if (meal.image_url === '') {
        emptyImages++;
      } else {
        validImages++;
      }
    }

    recordResult('meals', 'Meal image URLs validation', validImages > nullImages + emptyImages, {
      summary: `${validImages}/${meals.length} valid, ${nullImages} null, ${emptyImages} empty`,
      validImages,
      nullImages,
      emptyImages,
      totalMeals: meals.length,
    });
  }

  // Test 4: Meal recipes endpoint
  if (Array.isArray(listResponse.data) && listResponse.data.length > 0) {
    const firstMeal = listResponse.data[0];
    const recipesResponse = await makeRequest(`/api/v1/meals/${firstMeal.id}/recipes`);

    recordResult('meals', 'GET /api/v1/meals/:id/recipes', recipesResponse.ok, {
      status: recipesResponse.status,
      summary: `Meal ID ${firstMeal.id}`,
      recipeCount: Array.isArray(recipesResponse.data) ? recipesResponse.data.length : 0,
    });
  }

  // Test 5: Meal shopping list endpoint
  if (Array.isArray(listResponse.data) && listResponse.data.length > 0) {
    const firstMeal = listResponse.data[0];
    const shoppingResponse = await makeRequest(`/api/v1/meals/${firstMeal.id}/shopping-list`);

    recordResult('meals', 'GET /api/v1/meals/:id/shopping-list', shoppingResponse.ok, {
      status: shoppingResponse.status,
      summary: `Meal ID ${firstMeal.id}`,
    });
  }
}

// ============================================================================
// CHEFS API TESTS
// ============================================================================

async function testChefsAPI() {
  logSection('TESTING CHEFS API');

  // Since there's no direct /api/v1/chefs endpoint visible,
  // we'll test through server actions or page rendering
  // For now, we'll mark this as a limitation

  recordResult('chefs', 'Chef API endpoint discovery', false, {
    summary: 'No public /api/v1/chefs endpoint found',
    note: 'Chefs may be server-action only',
  });
}

// ============================================================================
// COLLECTIONS API TESTS
// ============================================================================

async function testCollectionsAPI() {
  logSection('TESTING COLLECTIONS API');

  // Similar to chefs, collections might be server-action based
  recordResult('collections', 'Collections API endpoint discovery', false, {
    summary: 'No public /api/v1/collections endpoint found',
    note: 'Collections may be server-action only',
  });
}

// ============================================================================
// INGREDIENTS API TESTS
// ============================================================================

async function testIngredientsAPI() {
  logSection('TESTING INGREDIENTS API');

  // Test 1: Ingredient filter
  const filterResponse = await makeRequest('/api/ingredients/filter?q=tomato');
  recordResult('ingredients', 'GET /api/ingredients/filter', filterResponse.ok, {
    status: filterResponse.status,
    summary: `Search for "tomato"`,
    resultCount: Array.isArray(filterResponse.data) ? filterResponse.data.length : 0,
  });

  // Test 2: Ingredient ontology
  const ontologyResponse = await makeRequest('/api/ingredients/ontology');
  recordResult('ingredients', 'GET /api/ingredients/ontology', ontologyResponse.ok, {
    status: ontologyResponse.status,
    summary: `Status ${ontologyResponse.status}`,
  });
}

// ============================================================================
// GENERATE COMPREHENSIVE REPORT
// ============================================================================

function generateReport() {
  logSection('COMPREHENSIVE TEST REPORT');

  console.log('\n📊 OVERALL RESULTS');
  console.log('-'.repeat(80));
  console.log(`Total Tests: ${testResults.overall.total}`);
  console.log(
    `Passed: ${testResults.overall.passed} (${((testResults.overall.passed / testResults.overall.total) * 100).toFixed(2)}%)`
  );
  console.log(
    `Failed: ${testResults.overall.failed} (${((testResults.overall.failed / testResults.overall.total) * 100).toFixed(2)}%)`
  );

  // Category breakdown
  console.log('\n📋 RESULTS BY CATEGORY');
  console.log('-'.repeat(80));
  for (const [category, results] of Object.entries(testResults)) {
    if (category === 'overall') continue;
    const passRate =
      results.total > 0 ? ((results.passed.length / results.total) * 100).toFixed(2) : 0;
    console.log(
      `${category.toUpperCase()}: ${results.passed.length}/${results.total} passed (${passRate}%)`
    );
  }

  // Image issues
  console.log('\n🖼️  IMAGE ISSUES (HIGH PRIORITY)');
  console.log('-'.repeat(80));
  console.log(`Recipes with NULL image_url: ${imageIssues.nullImageUrl.length}`);
  console.log(`Recipes with EMPTY image_url: ${imageIssues.emptyImageUrl.length}`);
  console.log(`Recipes with 404 images: ${imageIssues.http404.length}`);

  if (imageIssues.nullImageUrl.length > 0) {
    console.log('\nSample recipes with null images (first 10):');
    imageIssues.nullImageUrl.slice(0, 10).forEach((issue) => {
      console.log(`  - ID: ${issue.id}, Title: "${issue.title}", Slug: ${issue.slug}`);
    });
  }

  // Meal slug issues
  console.log('\n🍽️  MEAL ROUTING ISSUES (HIGH PRIORITY)');
  console.log('-'.repeat(80));
  console.log(`Total meal slug failures: ${mealSlugIssues.length}`);

  if (mealSlugIssues.length > 0) {
    console.log('\nFailed meal slugs:');
    mealSlugIssues.forEach((issue) => {
      console.log(`  - Slug: "${issue.slug}", Title: "${issue.title}"`);
      console.log(`    API: ${issue.apiStatus}, Page: ${issue.pageStatus}`);
      if (issue.apiError) console.log(`    Error: ${issue.apiError}`);
    });
  }

  // Failed tests detail
  console.log('\n❌ FAILED TESTS DETAIL');
  console.log('-'.repeat(80));
  for (const [category, results] of Object.entries(testResults)) {
    if (category === 'overall') continue;
    if (results.failed.length > 0) {
      console.log(`\n${category.toUpperCase()}:`);
      results.failed.forEach((failure) => {
        console.log(`  ✗ ${failure.test}`);
        console.log(`    ${failure.summary || 'No details'}`);
      });
    }
  }

  // Recommendations
  console.log('\n💡 RECOMMENDATIONS');
  console.log('-'.repeat(80));

  if (imageIssues.nullImageUrl.length > 0 || imageIssues.emptyImageUrl.length > 0) {
    console.log('1. IMAGE URL FIXES:');
    console.log('   - Run data migration to populate missing image_url fields');
    console.log(
      `   - ${imageIssues.nullImageUrl.length + imageIssues.emptyImageUrl.length} recipes need image URLs`
    );
    console.log('   - Consider default placeholder images for recipes without images');
  }

  if (mealSlugIssues.length > 0) {
    console.log('\n2. MEAL ROUTING FIXES:');
    console.log('   - Review getMealBySlug query logic');
    console.log('   - Check slug generation and uniqueness');
    console.log('   - Verify meal detail page routing');
    console.log(`   - ${mealSlugIssues.length} meal slugs are failing`);
  }

  console.log('\n3. API ENDPOINT IMPROVEMENTS:');
  console.log('   - Add public /api/v1/chefs endpoint');
  console.log('   - Add public /api/v1/collections endpoint');
  console.log('   - Improve error messages for failed requests');
  console.log('   - Add API documentation');

  // Export results
  const reportData = {
    timestamp: new Date().toISOString(),
    summary: testResults,
    imageIssues,
    mealSlugIssues,
    dataQualityIssues,
  };

  return reportData;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function runAllTests() {
  console.log('🚀 Starting Comprehensive API Test Suite');
  console.log(`Testing against: ${BASE_URL}`);
  console.log(`Started at: ${new Date().toISOString()}\n`);

  try {
    await testRecipesAPI();
    await testMealsAPI();
    await testChefsAPI();
    await testCollectionsAPI();
    await testIngredientsAPI();

    const report = generateReport();

    // Save report to file
    const fs = await import('fs');
    const reportPath = '/Users/masa/Projects/joanies-kitchen/tests/api-test-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Full report saved to: ${reportPath}`);
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  }

  console.log(`\n✅ Test suite completed at: ${new Date().toISOString()}`);

  // Exit with error code if tests failed
  process.exit(testResults.overall.failed > 0 ? 1 : 0);
}

runAllTests();
