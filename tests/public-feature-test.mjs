#!/usr/bin/env node
/**
 * Public Feature Testing Suite
 * Tests all public-facing pages and data endpoints
 */

import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3005';

const testResults = {
  recipes: { passed: [], failed: [], total: 0 },
  meals: { passed: [], failed: [], total: 0 },
  chefs: { passed: [], failed: [], total: 0 },
  overall: { passed: 0, failed: 0, total: 0 },
};

const imageIssues = {
  recipesWithoutImages: [],
  mealsWithoutImages: [],
  brokenImageUrls: [],
};

const mealIssues = [];
const dataQualityIssues = [];

let browser;
let page;

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

// ============================================================================
// RECIPES PUBLIC TESTS
// ============================================================================

async function testRecipesPublic() {
  logSection('TESTING PUBLIC RECIPES');

  try {
    // Test 1: Recipes page loads
    await page.goto(`${BASE_URL}/recipes`, { waitUntil: 'networkidle' });
    const title = await page.title();
    recordResult('recipes', 'Recipes page loads', true, {
      summary: `Page title: "${title}"`,
    });

    // Test 2: Extract recipe data from the page
    const recipeData = await page.evaluate(() => {
      // Try to find recipe cards or list items
      const recipeElements = document.querySelectorAll('[data-recipe-id], .recipe-card, article');
      const recipes = [];

      recipeElements.forEach((el) => {
        const recipeId = el.getAttribute('data-recipe-id');
        const titleEl = el.querySelector('h2, h3, [data-recipe-title]');
        const imgEl = el.querySelector('img');
        const linkEl = el.querySelector('a[href*="/recipes/"]');

        if (titleEl || linkEl) {
          recipes.push({
            id: recipeId,
            title: titleEl?.textContent?.trim(),
            imageUrl: imgEl?.src,
            imageAlt: imgEl?.alt,
            link: linkEl?.href,
          });
        }
      });

      return {
        recipes,
        hasRecipes: recipes.length > 0,
        totalVisible: recipes.length,
      };
    });

    recordResult('recipes', 'Recipe data extraction', recipeData.hasRecipes, {
      summary: `${recipeData.totalVisible} recipes found on page`,
      count: recipeData.totalVisible,
    });

    // Test 3: Image validation
    if (recipeData.recipes.length > 0) {
      let recipesWithImages = 0;
      let recipesWithoutImages = 0;

      recipeData.recipes.forEach((recipe) => {
        if (recipe.imageUrl && recipe.imageUrl !== '' && !recipe.imageUrl.includes('placeholder')) {
          recipesWithImages++;
        } else {
          recipesWithoutImages++;
          imageIssues.recipesWithoutImages.push({
            title: recipe.title,
            link: recipe.link,
          });
        }
      });

      const imageHealthPercentage = ((recipesWithImages / recipeData.recipes.length) * 100).toFixed(
        2
      );

      recordResult(
        'recipes',
        'Recipe images validation',
        recipesWithImages > recipesWithoutImages,
        {
          summary: `${recipesWithImages}/${recipeData.recipes.length} with images (${imageHealthPercentage}%)`,
          withImages: recipesWithImages,
          withoutImages: recipesWithoutImages,
          total: recipeData.recipes.length,
        }
      );
    }

    // Test 4: Click on first recipe (if available)
    if (recipeData.recipes.length > 0 && recipeData.recipes[0].link) {
      const firstRecipeLink = recipeData.recipes[0].link;
      await page.goto(firstRecipeLink, { waitUntil: 'networkidle' });

      const detailPageData = await page.evaluate(() => {
        return {
          hasTitle: !!document.querySelector('h1'),
          hasImage: !!document.querySelector('img[alt*="recipe"], img[src*="recipe"]'),
          hasIngredients: !!document.querySelector('[data-ingredients], .ingredients'),
          hasInstructions: !!document.querySelector('[data-instructions], .instructions'),
          url: window.location.href,
        };
      });

      recordResult('recipes', 'Recipe detail page', detailPageData.hasTitle, {
        summary: `Title: ${detailPageData.hasTitle}, Image: ${detailPageData.hasImage}, Ingredients: ${detailPageData.hasIngredients}`,
        ...detailPageData,
      });
    }
  } catch (error) {
    recordResult('recipes', 'Public recipes test', false, {
      summary: `Error: ${error.message}`,
      error: error.message,
    });
  }
}

// ============================================================================
// MEALS PUBLIC TESTS (CRITICAL - "meal not found" issue)
// ============================================================================

async function testMealsPublic() {
  logSection('TESTING PUBLIC MEALS');

  try {
    // Test 1: Meals page loads
    await page.goto(`${BASE_URL}/meals`, { waitUntil: 'networkidle' });
    const title = await page.title();
    recordResult('meals', 'Meals page loads', true, {
      summary: `Page title: "${title}"`,
    });

    // Test 2: Extract meal data
    const mealData = await page.evaluate(() => {
      const mealElements = document.querySelectorAll(
        '[data-meal-slug], [data-meal-id], .meal-card, article'
      );
      const meals = [];

      mealElements.forEach((el) => {
        const slug = el.getAttribute('data-meal-slug');
        const mealId = el.getAttribute('data-meal-id');
        const titleEl = el.querySelector('h2, h3, [data-meal-title]');
        const imgEl = el.querySelector('img');
        const linkEl = el.querySelector('a[href*="/meals/"]');

        if (titleEl || linkEl) {
          meals.push({
            id: mealId,
            slug: slug || linkEl?.href?.split('/meals/')[1]?.split('?')[0],
            title: titleEl?.textContent?.trim(),
            imageUrl: imgEl?.src,
            link: linkEl?.href,
          });
        }
      });

      return {
        meals,
        hasMeals: meals.length > 0,
        totalVisible: meals.length,
      };
    });

    recordResult('meals', 'Meal data extraction', mealData.hasMeals, {
      summary: `${mealData.totalVisible} meals found on page`,
      count: mealData.totalVisible,
    });

    // Test 3: Image validation for meals
    if (mealData.meals.length > 0) {
      let mealsWithImages = 0;
      let mealsWithoutImages = 0;

      mealData.meals.forEach((meal) => {
        if (meal.imageUrl && meal.imageUrl !== '' && !meal.imageUrl.includes('placeholder')) {
          mealsWithImages++;
        } else {
          mealsWithoutImages++;
          imageIssues.mealsWithoutImages.push({
            slug: meal.slug,
            title: meal.title,
            link: meal.link,
          });
        }
      });

      const imageHealthPercentage = ((mealsWithImages / mealData.meals.length) * 100).toFixed(2);

      recordResult('meals', 'Meal images validation', mealsWithImages >= mealsWithoutImages, {
        summary: `${mealsWithImages}/${mealData.meals.length} with images (${imageHealthPercentage}%)`,
        withImages: mealsWithImages,
        withoutImages: mealsWithoutImages,
        total: mealData.meals.length,
      });
    }

    // Test 4: CRITICAL - Test each meal slug (the "meal not found" issue)
    if (mealData.meals.length > 0) {
      console.log(`\nTesting ${mealData.meals.length} meal slugs for "not found" errors...`);

      let slugsPassed = 0;
      let slugsFailed = 0;

      for (const meal of mealData.meals.slice(0, 10)) {
        // Test first 10
        if (!meal.slug) {
          slugsFailed++;
          mealIssues.push({
            slug: null,
            title: meal.title,
            error: 'No slug found',
            link: meal.link,
          });
          continue;
        }

        try {
          const response = await page.goto(`${BASE_URL}/meals/${meal.slug}`, {
            waitUntil: 'networkidle',
            timeout: 10000,
          });

          const pageContent = await page.evaluate(() => {
            const bodyText = document.body.textContent || '';
            return {
              hasNotFoundError:
                bodyText.toLowerCase().includes('not found') ||
                bodyText.toLowerCase().includes('404'),
              hasTitle: !!document.querySelector('h1'),
              title: document.querySelector('h1')?.textContent,
              url: window.location.href,
            };
          });

          if (pageContent.hasNotFoundError || !pageContent.hasTitle) {
            slugsFailed++;
            mealIssues.push({
              slug: meal.slug,
              title: meal.title,
              error: pageContent.hasNotFoundError ? 'Page shows "not found"' : 'Missing h1 title',
              pageTitle: pageContent.title,
              url: pageContent.url,
            });
            console.log(
              `  ✗ Meal "${meal.title}" (slug: ${meal.slug}) - ${pageContent.hasNotFoundError ? 'NOT FOUND' : 'NO TITLE'}`
            );
          } else {
            slugsPassed++;
            console.log(`  ✓ Meal "${meal.title}" (slug: ${meal.slug})`);
          }
        } catch (error) {
          slugsFailed++;
          mealIssues.push({
            slug: meal.slug,
            title: meal.title,
            error: `Navigation error: ${error.message}`,
          });
          console.log(`  ✗ Meal "${meal.title}" (slug: ${meal.slug}) - ERROR: ${error.message}`);
        }
      }

      recordResult('meals', 'Meal slug navigation (CRITICAL)', slugsFailed === 0, {
        summary: `${slugsPassed}/${slugsPassed + slugsFailed} slugs working, ${slugsFailed} failed`,
        passed: slugsPassed,
        failed: slugsFailed,
        total: slugsPassed + slugsFailed,
      });
    }
  } catch (error) {
    recordResult('meals', 'Public meals test', false, {
      summary: `Error: ${error.message}`,
      error: error.message,
    });
  }
}

// ============================================================================
// CHEFS PUBLIC TESTS
// ============================================================================

async function testChefsPublic() {
  logSection('TESTING PUBLIC CHEFS');

  try {
    await page.goto(`${BASE_URL}/chefs`, { waitUntil: 'networkidle' });
    const title = await page.title();
    recordResult('chefs', 'Chefs page loads', true, {
      summary: `Page title: "${title}"`,
    });

    const chefData = await page.evaluate(() => {
      const chefElements = document.querySelectorAll('[data-chef-id], .chef-card');
      const chefs = [];

      chefElements.forEach((el) => {
        const nameEl = el.querySelector('h2, h3');
        const imgEl = el.querySelector('img');
        const specialtiesEl = el.querySelector('[data-specialties]');

        chefs.push({
          name: nameEl?.textContent?.trim(),
          hasImage: !!imgEl?.src,
          specialties: specialtiesEl?.textContent?.trim(),
        });
      });

      return {
        chefs,
        hasChefs: chefs.length > 0,
        totalVisible: chefs.length,
      };
    });

    recordResult('chefs', 'Chef data extraction', chefData.hasChefs, {
      summary: `${chefData.totalVisible} chefs found`,
      count: chefData.totalVisible,
    });
  } catch (error) {
    recordResult('chefs', 'Public chefs test', false, {
      summary: `Error: ${error.message}`,
      error: error.message,
    });
  }
}

// ============================================================================
// DATABASE QUERY TEST (Direct data validation)
// ============================================================================

async function testDatabaseData() {
  logSection('DIRECT DATABASE VALIDATION');

  try {
    // We'll use a simple fetch to paginated endpoint which doesn't require auth
    const response = await fetch(`${BASE_URL}/api/recipes/paginated?page=1&limit=100`);
    const data = await response.json();

    if (data && Array.isArray(data.recipes)) {
      const recipes = data.recipes;

      // Image URL validation
      let nullImages = 0;
      let emptyImages = 0;
      let validImages = 0;

      recipes.forEach((recipe) => {
        if (recipe.image_url === null || recipe.image_url === undefined) {
          nullImages++;
        } else if (recipe.image_url === '') {
          emptyImages++;
        } else {
          validImages++;
        }
      });

      const totalRecipes = recipes.length;
      const problemPercentage = (((nullImages + emptyImages) / totalRecipes) * 100).toFixed(2);

      console.log(`\n📊 Recipe Image Data Quality:`);
      console.log(`   Total recipes: ${totalRecipes}`);
      console.log(
        `   Valid image URLs: ${validImages} (${((validImages / totalRecipes) * 100).toFixed(2)}%)`
      );
      console.log(
        `   NULL image URLs: ${nullImages} (${((nullImages / totalRecipes) * 100).toFixed(2)}%)`
      );
      console.log(
        `   Empty image URLs: ${emptyImages} (${((emptyImages / totalRecipes) * 100).toFixed(2)}%)`
      );

      recordResult('recipes', 'Database image data quality', problemPercentage < 10, {
        summary: `${problemPercentage}% of recipes have image problems`,
        validImages,
        nullImages,
        emptyImages,
        totalRecipes,
      });
    }
  } catch (error) {
    console.log(`Error in database validation: ${error.message}`);
  }
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
  console.log('\n🖼️  IMAGE ISSUES');
  console.log('-'.repeat(80));
  console.log(`Recipes without images: ${imageIssues.recipesWithoutImages.length}`);
  console.log(`Meals without images: ${imageIssues.mealsWithoutImages.length}`);

  // Meal issues (CRITICAL)
  console.log('\n🚨 MEAL "NOT FOUND" ISSUES (CRITICAL)');
  console.log('-'.repeat(80));
  console.log(`Total meal slug failures: ${mealIssues.length}`);

  if (mealIssues.length > 0) {
    console.log('\nFailed meal slugs:');
    mealIssues.forEach((issue) => {
      console.log(`  ✗ Slug: "${issue.slug}", Title: "${issue.title}"`);
      console.log(`    Error: ${issue.error}`);
    });
  }

  // Recommendations
  console.log('\n💡 RECOMMENDATIONS');
  console.log('-'.repeat(80));

  if (imageIssues.recipesWithoutImages.length > 0) {
    console.log('1. RECIPE IMAGE FIXES:');
    console.log(
      `   - ${imageIssues.recipesWithoutImages.length} recipes are displaying without images`
    );
    console.log('   - Review image_url field population in database');
  }

  if (imageIssues.mealsWithoutImages.length > 0) {
    console.log('\n2. MEAL IMAGE FIXES:');
    console.log(
      `   - ${imageIssues.mealsWithoutImages.length} meals are displaying without images`
    );
    console.log('   - Review meal image_url field population');
  }

  if (mealIssues.length > 0) {
    console.log('\n3. MEAL ROUTING FIXES (HIGH PRIORITY):');
    console.log(`   - ${mealIssues.length} meal slugs are failing with "not found" errors`);
    console.log('   - Review getMealBySlug function');
    console.log('   - Check slug generation and database storage');
    console.log('   - Verify [slug]/page.tsx routing logic');
  }

  return {
    timestamp: new Date().toISOString(),
    summary: testResults,
    imageIssues,
    mealIssues,
  };
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function runAllTests() {
  console.log('🚀 Starting Public Feature Test Suite');
  console.log(`Testing against: ${BASE_URL}`);
  console.log(`Started at: ${new Date().toISOString()}\n`);

  try {
    // Launch browser
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();

    // Set viewport
    await page.setViewportSize({ width: 1280, height: 720 });

    // Run tests
    await testRecipesPublic();
    await testMealsPublic();
    await testChefsPublic();
    await testDatabaseData();

    const report = generateReport();

    // Save report
    const fs = await import('fs');
    const reportPath = '/Users/masa/Projects/joanies-kitchen/tests/public-feature-test-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Full report saved to: ${reportPath}`);
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  console.log(`\n✅ Test suite completed at: ${new Date().toISOString()}`);
  process.exit(testResults.overall.failed > 0 ? 1 : 0);
}

runAllTests();
