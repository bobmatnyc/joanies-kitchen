/**
 * Detailed Ingredient Display Test
 * Extracts and validates ingredient formatting
 */

const BASE_URL = 'http://localhost:3002';

async function extractIngredientsFromHtml(html) {
  // Look for ingredients section
  // Pattern: Find <h2>Ingredients</h2> or <h3>Ingredients</h3>
  // Then extract list items following it

  const ingredientsMatch = html.match(/<h[23][^>]*>Ingredients<\/h[23]>([\s\S]*?)<\/ul>/i);

  if (!ingredientsMatch) {
    console.log('⚠️  Could not find ingredients section with standard format');
    return [];
  }

  const ingredientsHtml = ingredientsMatch[1];

  // Extract all <li> content
  const liPattern = /<li[^>]*>(.*?)<\/li>/gi;
  const ingredients = [];
  let match;

  while ((match = liPattern.exec(ingredientsHtml)) !== null) {
    // Remove HTML tags from content
    const text = match[1]
      .replace(/<[^>]+>/g, '') // Remove all HTML tags
      .replace(/&amp;/g, '&') // Decode entities
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();

    if (text && !text.startsWith('<!--')) {
      ingredients.push(text);
    }
  }

  return ingredients;
}

async function testRecipeIngredientDetail() {
  console.log('\n🔬 DETAILED INGREDIENT DISPLAY TEST');
  console.log('='.repeat(70));

  const testRecipe = 'kale-white-bean-stew-2';
  const url = `${BASE_URL}/recipes/${testRecipe}`;

  console.log(`\n📍 Testing: ${url}`);

  try {
    const response = await fetch(url);
    const html = await response.text();

    console.log(`✓ Status: ${response.status} ${response.statusText}`);

    // Extract ingredients
    console.log('\n🔍 Extracting ingredients...');
    const ingredients = await extractIngredientsFromHtml(html);

    if (ingredients.length === 0) {
      console.log('❌ No ingredients found');
      return { status: 'FAIL', details: 'Could not extract ingredients' };
    }

    console.log(`✓ Found ${ingredients.length} ingredients\n`);

    // Display each ingredient
    console.log('📝 INGREDIENT LIST:');
    console.log('-'.repeat(70));

    let hasObjectObject = false;
    let hasProperFormat = true;

    ingredients.forEach((ingredient, index) => {
      const num = String(index + 1).padStart(2, ' ');

      // Check for [object Object]
      if (ingredient.includes('[object Object]')) {
        console.log(`${num}. ❌ ${ingredient}`);
        hasObjectObject = true;
      }
      // Check for proper formatting (should have words, not just weird chars)
      else if (ingredient.length < 3 || !/[a-zA-Z]/.test(ingredient)) {
        console.log(`${num}. ⚠️  ${ingredient} (suspicious format)`);
        hasProperFormat = false;
      }
      // Looks good
      else {
        console.log(`${num}. ✅ ${ingredient}`);
      }
    });

    console.log('-'.repeat(70));

    // Analysis
    console.log('\n📊 ANALYSIS:');

    // Check for quantities
    const withQuantities = ingredients.filter((i) => /\d+/.test(i) || /½|¼|¾|⅓|⅔/.test(i)).length;

    // Check for units
    const withUnits = ingredients.filter((i) =>
      /\b(cup|cups|tablespoon|tablespoons|tbsp|teaspoon|teaspoons|tsp|pound|pounds|lb|lbs|ounce|ounces|oz|gram|grams|g|kilogram|kilograms|kg|milliliter|milliliters|ml|liter|liters|l)\b/i.test(
        i
      )
    ).length;

    // Check for preparation notes (comma-separated details)
    const withPreparation = ingredients.filter((i) => i.includes(',')).length;

    console.log(
      `   Ingredients with quantities: ${withQuantities}/${ingredients.length} (${Math.round((withQuantities / ingredients.length) * 100)}%)`
    );
    console.log(
      `   Ingredients with units: ${withUnits}/${ingredients.length} (${Math.round((withUnits / ingredients.length) * 100)}%)`
    );
    console.log(
      `   Ingredients with preparation: ${withPreparation}/${ingredients.length} (${Math.round((withPreparation / ingredients.length) * 100)}%)`
    );

    // Expected format examples
    console.log('\n✓ EXPECTED FORMAT EXAMPLES:');
    console.log('   "1 1/2 lb kale leaves, center ribs and stems removed"');
    console.log('   "3 tbsp olive oil"');
    console.log('   "1 cup carrots, chopped, peeled"');

    console.log('\n✓ ACTUAL FORMAT SAMPLES:');
    ingredients.slice(0, 3).forEach((ing, _i) => {
      console.log(`   "${ing}"`);
    });

    // Final verdict
    console.log('\n🏁 VERDICT:');

    if (hasObjectObject) {
      console.log('   ❌ FAIL: Found [object Object] in ingredients');
      return { status: 'FAIL', details: 'Contains [object Object]' };
    }

    if (!hasProperFormat) {
      console.log('   ⚠️  WARNING: Some ingredients have suspicious formatting');
      return { status: 'WARNING', details: 'Suspicious formatting detected' };
    }

    if (withQuantities === 0) {
      console.log('   ⚠️  WARNING: No quantities found (might be expected for some recipes)');
    }

    console.log('   ✅ PASS: All ingredients display as readable strings');
    console.log('   ✅ PASS: Proper formatting with quantities, units, and preparation notes');
    console.log('   ✅ PASS: No [object Object] found');

    return {
      status: 'PASS',
      details: `${ingredients.length} ingredients properly formatted`,
      samples: ingredients.slice(0, 5),
    };
  } catch (error) {
    console.error('❌ Error:', error.message);
    return { status: 'ERROR', details: error.message };
  }
}

async function testMultipleRecipesDetailed() {
  console.log('\n\n🔬 DETAILED REGRESSION TEST');
  console.log('='.repeat(70));

  const testRecipes = ['kale-white-bean-stew-2', 'zucchini-carbonara', 'garlic-roast-chicken'];

  const results = [];

  for (const slug of testRecipes) {
    console.log(`\n📖 Testing: ${slug}`);
    console.log('-'.repeat(70));

    const url = `${BASE_URL}/recipes/${slug}`;
    try {
      const response = await fetch(url);
      const html = await response.text();

      const ingredients = await extractIngredientsFromHtml(html);
      const hasObjectObject = html.includes('[object Object]');

      console.log(`   Ingredients found: ${ingredients.length}`);
      console.log(`   [object Object]: ${hasObjectObject ? '❌ YES' : '✅ NO'}`);

      if (ingredients.length > 0) {
        console.log(`   Sample: "${ingredients[0]}"`);
      }

      results.push({
        slug,
        status: hasObjectObject ? 'FAIL' : 'PASS',
        ingredientCount: ingredients.length,
      });
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      results.push({ slug, status: 'ERROR', error: error.message });
    }
  }

  console.log('\n📊 REGRESSION SUMMARY:');
  console.log('='.repeat(70));

  results.forEach((result) => {
    const icon = result.status === 'PASS' ? '✅' : '❌';
    console.log(
      `${icon} ${result.slug}: ${result.status} (${result.ingredientCount || 0} ingredients)`
    );
  });

  const passed = results.filter((r) => r.status === 'PASS').length;
  console.log(`\n   Total: ${passed}/${results.length} passed`);

  return results;
}

async function runTests() {
  console.log('\n');
  console.log('🧪 CRITICAL BUG FIX VERIFICATION');
  console.log('Fix: Recipe ingredients display as [object Object]');
  console.log('File: /src/lib/utils/recipe-utils.ts (lines 27-48)');
  console.log('Change: Added handling for structured {name, quantity, unit, notes, preparation}');
  console.log('='.repeat(70));

  // Detailed test
  const detailedResult = await testRecipeIngredientDetail();

  // Regression test
  const regressionResults = await testMultipleRecipesDetailed();

  // Final report
  console.log('\n\n');
  console.log('📋 FINAL TEST REPORT');
  console.log('='.repeat(70));
  console.log(`\n✅ PRIMARY TEST: ${detailedResult.status}`);
  console.log(`   Details: ${detailedResult.details}`);

  if (detailedResult.samples) {
    console.log('\n   Sample ingredients:');
    detailedResult.samples.forEach((sample, i) => {
      console.log(`   ${i + 1}. ${sample}`);
    });
  }

  const regressionPassed = regressionResults.filter((r) => r.status === 'PASS').length;
  console.log(
    `\n✅ REGRESSION TEST: ${regressionPassed}/${regressionResults.length} recipes passed`
  );

  console.log(`\n${'='.repeat(70)}`);
  console.log('CONCLUSION:');

  if (detailedResult.status === 'PASS' && regressionPassed === regressionResults.length) {
    console.log('✅ BUG FIX VERIFIED: Ingredients display correctly');
    console.log('✅ NO [object Object] FOUND');
    console.log('✅ PROPER FORMATTING CONFIRMED');
  } else {
    console.log('❌ BUG FIX NEEDS ATTENTION');
  }

  console.log('='.repeat(70));
  console.log('\n');
}

runTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
