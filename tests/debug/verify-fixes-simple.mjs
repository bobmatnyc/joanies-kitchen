#!/usr/bin/env node

/**
 * Simple verification script for 4 critical fixes
 * Uses basic HTTP requests and manual browser testing guidance
 */

console.log('=== Fix Verification Script ===\n');

const BASE_URL = 'http://localhost:3002';

// Test 1: Admin page loads without errors
async function testFix1AdminInfiniteLoop() {
  console.log('Fix 1: Admin Flagged Images - Infinite Loop');
  console.log('-------------------------------------------');

  try {
    const response = await fetch(`${BASE_URL}/admin`);
    const html = await response.text();

    console.log(`✓ Status: ${response.status}`);
    console.log(`✓ Response size: ${html.length} bytes`);

    // Check for basic HTML structure
    const hasHtml = html.includes('<html') && html.includes('</html>');
    const hasBody = html.includes('<body') && html.includes('</body>');

    console.log(`✓ Valid HTML: ${hasHtml ? 'Yes' : 'No'}`);
    console.log(`✓ Has body: ${hasBody ? 'Yes' : 'No'}`);

    // Look for Flagged Images section
    const hasFlaggedSection = html.includes('Flagged Images') || html.includes('flagged-images');
    console.log(`✓ Flagged section present: ${hasFlaggedSection ? 'Yes' : 'No'}`);

    console.log('\n✅ MANUAL TEST REQUIRED:');
    console.log('   1. Open http://localhost:3002/admin in browser');
    console.log('   2. Scroll to "Flagged Images" section');
    console.log('   3. Verify: No infinite spinner/loading');
    console.log('   4. Verify: Shows content or "No flagged images"');
    console.log('   5. Check browser console for errors\n');

  } catch (error) {
    console.error(`✗ Error: ${error.message}\n`);
  }
}

// Test 2: Recipe ingredients display correctly
async function testFix2RecipeIngredients() {
  console.log('Fix 2: Recipe Ingredients - [object Object] Display');
  console.log('------------------------------------------------------');

  try {
    const response = await fetch(`${BASE_URL}/recipes/kale-white-bean-stew-2`);
    const html = await response.text();

    console.log(`✓ Status: ${response.status}`);
    console.log(`✓ Response size: ${html.length} bytes`);

    // Check for [object Object]
    const hasObjectObject = html.includes('[object Object]');
    console.log(`${hasObjectObject ? '✗' : '✓'} Contains [object Object]: ${hasObjectObject ? 'YES (FAIL)' : 'NO (PASS)'}`);

    // Look for ingredients section
    const hasIngredients = html.includes('Ingredients') || html.includes('ingredients');
    console.log(`✓ Has ingredients section: ${hasIngredients ? 'Yes' : 'No'}`);

    // Try to find ingredient patterns (numbers followed by text)
    const ingredientPattern = /\d+\s*(lb|oz|cup|tbsp|tsp|g|kg|ml|l)\s+[\w\s,]+/gi;
    const matches = html.match(ingredientPattern);
    console.log(`✓ Found ingredient-like patterns: ${matches ? matches.length : 0}`);

    if (matches && matches.length > 0) {
      console.log(`✓ Sample ingredients found: ${matches.slice(0, 3).join(', ')}`);
    }

    if (hasObjectObject) {
      console.log('\n❌ FAIL: Page contains [object Object]');
    } else {
      console.log('\n✅ PASS: No [object Object] found');
    }

    console.log('\n✅ MANUAL TEST REQUIRED:');
    console.log('   1. Open http://localhost:3002/recipes/kale-white-bean-stew-2');
    console.log('   2. Scroll to "Ingredients" section');
    console.log('   3. Verify: All ingredients show as readable text');
    console.log('   4. Verify: NO "[object Object]" anywhere\n');

  } catch (error) {
    console.error(`✗ Error: ${error.message}\n`);
  }
}

// Test 3: Chef page images load correctly
async function testFix3ChefImages() {
  console.log('Fix 3: Recipe Card Images on Chef Pages');
  console.log('------------------------------------------');

  try {
    const response = await fetch(`${BASE_URL}/chef/vivian-li`);
    const html = await response.text();

    console.log(`✓ Status: ${response.status}`);
    console.log(`✓ Response size: ${html.length} bytes`);

    // Look for image references
    const imgTags = html.match(/<img[^>]*>/gi);
    console.log(`✓ Total <img> tags found: ${imgTags ? imgTags.length : 0}`);

    // Check for Vercel Blob Storage URLs (correct source)
    const blobUrls = (html.match(/https:\/\/[^"]*\.public\.blob\.vercel-storage\.com/gi) || []);
    console.log(`✓ Vercel Blob Storage URLs: ${blobUrls.length}`);

    // Check for local /images/recipes/ paths (incorrect, should be minimal)
    const localImagePaths = (html.match(/\/images\/recipes\/[^"]+/gi) || []);
    console.log(`✓ Local /images/recipes/ paths: ${localImagePaths.length}`);

    // Sample some image sources
    const srcPattern = /src="([^"]+)"/gi;
    const sources = [...html.matchAll(srcPattern)];
    if (sources.length > 0) {
      console.log('\n✓ Sample image sources:');
      sources.slice(0, 5).forEach((match, i) => {
        const src = match[1];
        const isBlob = src.includes('blob.vercel-storage.com');
        const isLocal = src.startsWith('/images/');
        console.log(`   ${i + 1}. ${isBlob ? '✓ (Blob)' : isLocal ? '⚠ (Local)' : '?'} ${src.substring(0, 80)}`);
      });
    }

    console.log('\n✅ MANUAL TEST REQUIRED:');
    console.log('   1. Open http://localhost:3002/chef/vivian-li');
    console.log('   2. Check recipe cards (Carrot Soup, Sugar Cookie Icing, Indian Shrimp Curry)');
    console.log('   3. Verify: All 3 recipes show images (no broken icons)');
    console.log('   4. Open DevTools Network tab');
    console.log('   5. Verify: Images load from blob.vercel-storage.com');
    console.log('   6. Verify: No 404 errors for /images/recipes/\n');

  } catch (error) {
    console.error(`✗ Error: ${error.message}\n`);
  }
}

// Test 4: Fridge search responds quickly
async function testFix4FridgeTimeout() {
  console.log('Fix 4: Fridge Search Timeout Protection');
  console.log('------------------------------------------');

  try {
    const response = await fetch(`${BASE_URL}/fridge`);
    const html = await response.text();

    console.log(`✓ Status: ${response.status}`);
    console.log(`✓ Response size: ${html.length} bytes`);

    // Check for fridge-related content
    const hasFridgeContent = html.includes('fridge') || html.includes('ingredients');
    console.log(`✓ Has fridge content: ${hasFridgeContent ? 'Yes' : 'No'}`);

    console.log('\n✅ MANUAL TEST REQUIRED:');
    console.log('   1. Open http://localhost:3002/fridge');
    console.log('   2. Enter ingredients: chicken, rice, tomatoes');
    console.log('   3. Submit search');
    console.log('   4. Verify: Results appear quickly (< 1 second)');
    console.log('   5. Verify: No infinite "Finding recipes..." spinner');
    console.log('   6. Verify: If >30s, shows timeout error (unlikely)\n');

  } catch (error) {
    console.error(`✗ Error: ${error.message}\n`);
  }
}

// Run all tests
async function runAllTests() {
  console.log(`Testing server: ${BASE_URL}\n`);

  // Quick server check
  try {
    const healthCheck = await fetch(BASE_URL);
    console.log(`✓ Server is running (Status: ${healthCheck.status})\n`);
  } catch (error) {
    console.error(`✗ Server not accessible: ${error.message}`);
    console.error('Please start the server with: npm run dev\n');
    process.exit(1);
  }

  await testFix1AdminInfiniteLoop();
  await testFix2RecipeIngredients();
  await testFix3ChefImages();
  await testFix4FridgeTimeout();

  console.log('=== Summary ===');
  console.log('Automated checks complete.');
  console.log('Please complete the MANUAL TESTS listed above to fully verify all fixes.\n');
  console.log('Expected outcomes:');
  console.log('  ✅ Fix 1: Admin page loads Flagged Images section without infinite loop');
  console.log('  ✅ Fix 2: Recipe ingredients display as text, not [object Object]');
  console.log('  ✅ Fix 3: Chef page recipe images load from Vercel Blob Storage');
  console.log('  ✅ Fix 4: Fridge search completes quickly with timeout protection\n');
}

// Run tests
runAllTests().catch(console.error);
