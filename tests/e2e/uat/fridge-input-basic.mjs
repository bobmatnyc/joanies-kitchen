#!/usr/bin/env node

/**
 * Basic FridgeInput Component UAT
 * Tests the homepage without browser automation
 */

const BASE_URL = 'http://localhost:3002';

console.log(`\n${'='.repeat(80)}`);
console.log('FRIDGE INPUT COMPONENT UAT - BASIC TEST');
console.log(`${'='.repeat(80)}\n`);

async function runBasicTests() {
  console.log('TEST: Homepage Accessibility and HTML Structure\n');

  try {
    // Test 1: Can we reach the homepage?
    console.log('1. Testing homepage response...');
    const response = await fetch(BASE_URL);
    const status = response.status;
    const contentType = response.headers.get('content-type');

    console.log(`   Status: ${status}`);
    console.log(`   Content-Type: ${contentType}`);

    if (status !== 200) {
      console.log(`   ❌ FAIL: Expected 200, got ${status}`);
      return;
    }
    console.log('   ✅ PASS: Homepage is accessible\n');

    // Test 2: Analyze HTML content
    console.log('2. Analyzing HTML content...');
    const html = await response.text();
    console.log(`   HTML length: ${html.length} characters`);

    // Test 3: Check for input fields
    console.log('\n3. Checking for input fields...');
    const inputMatches = html.match(/<input[^>]*>/gi) || [];
    console.log(`   Found ${inputMatches.length} <input> tags`);

    if (inputMatches.length === 0) {
      console.log('   ❌ FAIL: No input fields found in HTML');
      return;
    }

    console.log('\n   Input fields found:');
    inputMatches.forEach((match, i) => {
      const typeMatch = match.match(/type="([^"]*)"/);
      const placeholderMatch = match.match(/placeholder="([^"]*)"/);
      const nameMatch = match.match(/name="([^"]*)"/);
      const idMatch = match.match(/id="([^"]*)"/);

      console.log(`   ${i + 1}. ${match.substring(0, 100)}...`);
      console.log(`      Type: ${typeMatch ? typeMatch[1] : 'not specified'}`);
      console.log(`      Placeholder: ${placeholderMatch ? placeholderMatch[1] : 'none'}`);
      console.log(`      Name: ${nameMatch ? nameMatch[1] : 'none'}`);
      console.log(`      ID: ${idMatch ? idMatch[1] : 'none'}`);
      console.log('');
    });

    // Test 4: Check for FridgeInput-related keywords
    console.log('4. Checking for FridgeInput-related keywords...');
    const keywords = ['fridge', 'ingredient', 'search'];
    const keywordResults = {};

    keywords.forEach((keyword) => {
      const regex = new RegExp(keyword, 'gi');
      const matches = html.match(regex) || [];
      keywordResults[keyword] = matches.length;
      console.log(`   "${keyword}": ${matches.length} occurrences`);
    });

    // Test 5: Check for form elements
    console.log('\n5. Checking for form elements...');
    const formMatches = html.match(/<form[^>]*>/gi) || [];
    console.log(`   Found ${formMatches.length} <form> tags`);

    if (formMatches.length > 0) {
      formMatches.forEach((match, i) => {
        console.log(`   ${i + 1}. ${match.substring(0, 100)}`);
      });
    }

    // Test 6: Check for buttons
    console.log('\n6. Checking for button elements...');
    const buttonMatches = html.match(/<button[^>]*>.*?<\/button>/gi) || [];
    console.log(`   Found ${buttonMatches.length} <button> elements`);

    if (buttonMatches.length > 0) {
      buttonMatches.slice(0, 5).forEach((match, i) => {
        const buttonText = match.replace(/<[^>]+>/g, '').trim();
        console.log(`   ${i + 1}. "${buttonText}"`);
      });
      if (buttonMatches.length > 5) {
        console.log(`   ... and ${buttonMatches.length - 5} more buttons`);
      }
    }

    // Test 7: Check for React/Next.js hydration
    console.log('\n7. Checking for React/Next.js markers...');
    const hasReact = html.includes('__NEXT_DATA__');
    const hasHydration = html.includes('self.__next_f') || html.includes('__BUILD_MANIFEST');
    console.log(`   Next.js data: ${hasReact ? 'Present' : 'Missing'}`);
    console.log(`   Hydration markers: ${hasHydration ? 'Present' : 'Missing'}`);

    // Test 8: Check for errors in HTML
    console.log('\n8. Checking for error indicators in HTML...');
    const errorKeywords = ['error', 'failed', 'not found', '404', '500'];
    let errorsFound = false;

    errorKeywords.forEach((keyword) => {
      const regex = new RegExp(keyword, 'gi');
      const matches = html.match(regex) || [];
      if (matches.length > 0) {
        console.log(`   ⚠️ Found "${keyword}": ${matches.length} times`);
        errorsFound = true;
      }
    });

    if (!errorsFound) {
      console.log('   ✅ No obvious error indicators found');
    }

    // Test 9: Summary and recommendations
    console.log(`\n${'='.repeat(80)}`);
    console.log('TEST SUMMARY');
    console.log('='.repeat(80));

    const hasInputs = inputMatches.length > 0;
    const hasFridgeKeywords = Object.values(keywordResults).some((v) => v > 0);
    const hasInteractiveElements = buttonMatches.length > 0 || formMatches.length > 0;

    console.log('\nFindings:');
    console.log(`  ✓ Homepage accessible: YES`);
    console.log(`  ✓ HTML content loaded: YES (${html.length} chars)`);
    console.log(
      `  ${hasInputs ? '✓' : '✗'} Input fields present: ${hasInputs ? 'YES' : 'NO'} (${inputMatches.length})`
    );
    console.log(
      `  ${hasFridgeKeywords ? '✓' : '✗'} Fridge/search keywords: ${hasFridgeKeywords ? 'YES' : 'NO'}`
    );
    console.log(
      `  ${hasInteractiveElements ? '✓' : '✗'} Interactive elements: ${hasInteractiveElements ? 'YES' : 'NO'}`
    );
    console.log(`  ${hasReact ? '✓' : '✗'} Next.js/React setup: ${hasReact ? 'YES' : 'NO'}`);

    console.log('\nNext Steps for Full UAT:');
    if (!hasInputs) {
      console.log(
        '  ❌ BLOCKER: No input fields found. The FridgeInput component may not be rendering.'
      );
      console.log('  → Check if component is imported and used in the homepage');
      console.log('  → Verify no JavaScript errors preventing rendering');
    } else if (!hasFridgeKeywords) {
      console.log('  ⚠️ WARNING: No fridge/ingredient keywords found.');
      console.log('  → Verify the FridgeInput component is correctly placed');
      console.log('  → Check component props and configuration');
    } else {
      console.log('  ✅ Ready for browser-based testing');
      console.log('  → Run Playwright tests to verify interactivity');
      console.log('  → Test typing, autocomplete, and search functionality');
      console.log('  → Monitor console for JavaScript errors');
    }

    console.log('\nTo run full browser tests:');
    console.log(
      '  npx playwright test tests/e2e/uat/fridge-input-simple.spec.ts --project=webkit-desktop'
    );
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
  }
}

// Run tests
runBasicTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
