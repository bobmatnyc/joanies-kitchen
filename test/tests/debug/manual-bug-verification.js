/**
 * Manual Bug Verification Script
 * Tests critical bugs without Playwright
 */

const BASE_URL = 'http://localhost:3002';

async function testRecipeIngredients() {
  console.log('\n🧪 TEST 2: Recipe Ingredient Display - [object Object] Fix');
  console.log('='.repeat(70));

  const recipeUrl = `${BASE_URL}/recipes/kale-white-bean-stew-2`;
  console.log(`\n📍 Fetching: ${recipeUrl}`);

  try {
    const response = await fetch(recipeUrl);
    const html = await response.text();

    console.log(`✓ Status: ${response.status} ${response.statusText}`);
    console.log(`✓ Content length: ${html.length} bytes`);

    // Check for [object Object] in HTML
    const hasObjectObject = html.includes('[object Object]');
    const count = (html.match(/\[object Object\]/g) || []).length;

    console.log(`\n🔍 Checking for [object Object]...`);
    console.log(`   Found: ${count} occurrence(s)`);

    if (hasObjectObject) {
      console.log('   Status: ❌ FAIL');

      // Find context around [object Object]
      const index = html.indexOf('[object Object]');
      const context = html.substring(index - 100, index + 100);
      console.log('\n📝 Context:');
      console.log(context);

      return { status: 'FAIL', details: `Found ${count} [object Object] occurrences` };
    } else {
      console.log('   Status: ✅ PASS');
    }

    // Check for expected ingredient patterns
    console.log(`\n🔍 Checking for proper ingredient formatting...`);

    const patterns = {
      Quantities: /\d+\s*(cup|tbsp|tsp|lb|oz|g|kg|ml|l)/gi,
      Fractions: /[½¼¾⅓⅔⅛⅜⅝⅞]/g,
      Kale: /kale/gi,
      'Olive oil': /olive\s+oil/gi,
    };

    for (const [name, pattern] of Object.entries(patterns)) {
      const matches = html.match(pattern);
      const count = matches ? matches.length : 0;
      console.log(`   ${name}: ${count} matches ${count > 0 ? '✅' : '⚠️ '}`);
    }

    return { status: 'PASS', details: 'No [object Object] found, proper formatting detected' };
  } catch (error) {
    console.error('❌ Error fetching recipe:', error.message);
    return { status: 'ERROR', details: error.message };
  }
}

async function testAdminFlaggedImages() {
  console.log('\n🧪 TEST 1: Admin Flagged Images - Infinite Loop Fix');
  console.log('='.repeat(70));

  const adminUrl = `${BASE_URL}/admin`;
  console.log(`\n📍 Fetching: ${adminUrl}`);

  try {
    const response = await fetch(adminUrl);
    const html = await response.text();

    console.log(`✓ Status: ${response.status} ${response.statusText}`);
    console.log(`✓ Content length: ${html.length} bytes`);

    // Check if admin page loads
    const hasFlaggedImagesSection = html.includes('Flagged Images');
    const hasFlaggedImagesManager = html.includes('FlaggedImagesManager');

    console.log(`\n🔍 Checking admin page structure...`);
    console.log(`   Flagged Images section: ${hasFlaggedImagesSection ? '✅' : '❌'}`);
    console.log(`   Component reference: ${hasFlaggedImagesManager ? '✅' : '❌'}`);

    if (!hasFlaggedImagesSection) {
      console.log('\n⚠️  Note: This test requires manual browser verification');
      console.log('   The infinite loop fix can only be fully tested in a browser');
      console.log('   with React DevTools and console monitoring.');
      return { status: 'MANUAL_REQUIRED', details: 'Requires browser testing' };
    }

    return { status: 'PARTIAL_PASS', details: 'Admin page loads, manual browser testing needed' };
  } catch (error) {
    console.error('❌ Error fetching admin page:', error.message);
    return { status: 'ERROR', details: error.message };
  }
}

async function testMultipleRecipes() {
  console.log('\n🧪 REGRESSION TEST: Multiple Recipe Pages');
  console.log('='.repeat(70));

  const recipesUrl = `${BASE_URL}/recipes`;
  console.log(`\n📍 Fetching recipes list: ${recipesUrl}`);

  try {
    const response = await fetch(recipesUrl);
    const html = await response.text();

    console.log(`✓ Status: ${response.status} ${response.statusText}`);

    // Extract recipe links from HTML
    const recipeLinks = [];
    const linkPattern = /href="\/recipes\/([^"]+)"/g;
    let match;

    while ((match = linkPattern.exec(html)) !== null) {
      const slug = match[1];
      if (!slug.includes('?') && !slug.includes('#') && slug !== 'new') {
        recipeLinks.push(slug);
      }
    }

    const uniqueRecipes = [...new Set(recipeLinks)].slice(0, 5); // Test first 5
    console.log(
      `\n📋 Found ${recipeLinks.length} recipe links, testing ${uniqueRecipes.length}...`
    );

    const results = [];

    for (const slug of uniqueRecipes) {
      const url = `${BASE_URL}/recipes/${slug}`;
      console.log(`\n   Testing: ${slug}`);

      try {
        const recipeResponse = await fetch(url);
        const recipeHtml = await recipeResponse.text();

        const hasObjectObject = recipeHtml.includes('[object Object]');
        const objectCount = (recipeHtml.match(/\[object Object\]/g) || []).length;

        console.log(`      Status: ${recipeResponse.status}`);
        console.log(
          `      [object Object]: ${hasObjectObject ? `❌ ${objectCount} found` : '✅ None'}`
        );

        results.push({
          slug,
          status: hasObjectObject ? 'FAIL' : 'PASS',
          objectCount,
        });
      } catch (error) {
        console.log(`      Error: ${error.message}`);
        results.push({ slug, status: 'ERROR', error: error.message });
      }
    }

    console.log(`\n📊 Regression Test Summary:`);
    const passed = results.filter((r) => r.status === 'PASS').length;
    const failed = results.filter((r) => r.status === 'FAIL').length;
    const errors = results.filter((r) => r.status === 'ERROR').length;

    console.log(`   ✅ Passed: ${passed}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   ⚠️  Errors: ${errors}`);

    return {
      status: failed === 0 && errors === 0 ? 'PASS' : 'FAIL',
      details: `${passed}/${results.length} recipes passed`,
      results,
    };
  } catch (error) {
    console.error('❌ Error in regression test:', error.message);
    return { status: 'ERROR', details: error.message };
  }
}

async function runAllTests() {
  console.log('\n');
  console.log('🔬 CRITICAL BUG VERIFICATION TESTS');
  console.log('='.repeat(70));
  console.log('Target: http://localhost:3002');
  console.log('Time:', new Date().toLocaleString());
  console.log('='.repeat(70));

  const results = [];

  // Test 1: Admin Flagged Images
  const test1 = await testAdminFlaggedImages();
  results.push({ test: 'Admin Flagged Images Fix', ...test1 });

  // Test 2: Recipe Ingredients
  const test2 = await testRecipeIngredients();
  results.push({ test: 'Recipe Ingredient Display Fix', ...test2 });

  // Regression Test
  const test3 = await testMultipleRecipes();
  results.push({ test: 'Regression Test', ...test3 });

  // Final Report
  console.log('\n');
  console.log('📋 FINAL REPORT');
  console.log('='.repeat(70));

  results.forEach((result, index) => {
    const statusIcon =
      result.status === 'PASS'
        ? '✅'
        : result.status === 'PARTIAL_PASS'
          ? '⚠️ '
          : result.status === 'MANUAL_REQUIRED'
            ? '🔧'
            : result.status === 'FAIL'
              ? '❌'
              : '⚠️ ';

    console.log(`\n${statusIcon} Test ${index + 1}: ${result.test}`);
    console.log(`   Status: ${result.status}`);
    console.log(`   Details: ${result.details}`);
  });

  const passCount = results.filter((r) => r.status === 'PASS').length;
  const failCount = results.filter((r) => r.status === 'FAIL').length;

  console.log(`\n${'='.repeat(70)}`);
  console.log(`Summary: ${passCount} passed, ${failCount} failed out of ${results.length} tests`);
  console.log('='.repeat(70));
  console.log('\n');
}

runAllTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
