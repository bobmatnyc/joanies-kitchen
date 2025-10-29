#!/usr/bin/env node

/**
 * Comprehensive verification of 4 critical fixes using Puppeteer
 */

import puppeteer from 'puppeteer';

const BASE_URL = 'http://localhost:3002';
const results = {
  fix1: { pass: false, details: [] },
  fix2: { pass: false, details: [] },
  fix3: { pass: false, details: [] },
  fix4: { pass: false, details: [] },
};

console.log('=== Puppeteer Fix Verification ===\n');

async function testFix1AdminInfiniteLoop(browser) {
  console.log('🔍 Testing Fix 1: Admin Flagged Images - Infinite Loop');
  console.log('--------------------------------------------------------');

  const page = await browser.newPage();

  try {
    // Monitor console errors
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate to admin page
    await page.goto(`${BASE_URL}/admin`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    console.log('✓ Page loaded');

    // Wait for initial render
    await page.waitForTimeout(3000);

    // Check for loading spinners
    const spinners = await page.$$('[role="status"], .animate-spin');
    console.log(`✓ Initial spinners: ${spinners.length}`);

    // Wait another 5 seconds and check if still loading
    await page.waitForTimeout(5000);

    const stillSpinning = await page
      .evaluate(() => {
        const spinners = document.querySelectorAll(
          '[role="status"], .animate-spin'
        );
        return Array.from(spinners).some((el) => el.offsetHeight > 0);
      })
      .catch(() => false);

    console.log(`✓ Still showing spinner after 8s: ${stillSpinning ? 'YES (ISSUE)' : 'NO (GOOD)'}`);

    // Check console errors
    console.log(`✓ Console errors: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
      console.log(`  First 3 errors: ${consoleErrors.slice(0, 3).join(', ')}`);
    }

    // Take screenshot
    await page.screenshot({
      path: '/Users/masa/Projects/joanies-kitchen/tests/fix1-admin.png',
      fullPage: true,
    });
    console.log('✓ Screenshot saved: tests/fix1-admin.png');

    const passed = !stillSpinning && consoleErrors.length < 5;
    results.fix1.pass = passed;
    results.fix1.details = [
      `Persistent spinner: ${stillSpinning}`,
      `Console errors: ${consoleErrors.length}`,
    ];

    console.log(`\n${passed ? '✅ PASS' : '❌ FAIL'}: Fix 1\n`);
  } catch (error) {
    console.error(`✗ Error: ${error.message}\n`);
    results.fix1.details.push(`Error: ${error.message}`);
  } finally {
    await page.close();
  }
}

async function testFix2RecipeIngredients(browser) {
  console.log('🔍 Testing Fix 2: Recipe Ingredients - [object Object]');
  console.log('-------------------------------------------------------');

  const page = await browser.newPage();

  try {
    await page.goto(`${BASE_URL}/recipes/kale-white-bean-stew-2`, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });

    console.log('✓ Recipe page loaded');

    // Wait for content
    await page.waitForTimeout(3000);

    // Get page content
    const content = await page.content();
    const hasObjectObject = content.includes('[object Object]');

    console.log(`${hasObjectObject ? '✗' : '✓'} Contains [object Object]: ${hasObjectObject ? 'YES (FAIL)' : 'NO (PASS)'}`);

    // Look for ingredients section
    const ingredientsText = await page
      .evaluate(() => {
        // Find ingredients heading
        const headings = Array.from(
          document.querySelectorAll('h2, h3, h4, .text-xl, .font-semibold')
        );
        const ingredientsHeading = headings.find((h) =>
          h.textContent.toLowerCase().includes('ingredient')
        );

        if (!ingredientsHeading) return 'Ingredients section not found';

        // Get next sibling or parent's next sibling
        let container =
          ingredientsHeading.nextElementSibling ||
          ingredientsHeading.parentElement.nextElementSibling;

        return container ? container.textContent.substring(0, 500) : 'No content';
      })
      .catch(() => 'Could not extract ingredients');

    console.log(`✓ Ingredients preview:\n  ${ingredientsText.substring(0, 200).replace(/\n/g, ' ')}`);

    // Take screenshot
    await page.screenshot({
      path: '/Users/masa/Projects/joanies-kitchen/tests/fix2-ingredients.png',
      fullPage: true,
    });
    console.log('✓ Screenshot saved: tests/fix2-ingredients.png');

    const passed = !hasObjectObject;
    results.fix2.pass = passed;
    results.fix2.details = [
      `Has [object Object]: ${hasObjectObject}`,
      `Ingredients preview: ${ingredientsText.substring(0, 100)}`,
    ];

    console.log(`\n${passed ? '✅ PASS' : '❌ FAIL'}: Fix 2\n`);
  } catch (error) {
    console.error(`✗ Error: ${error.message}\n`);
    results.fix2.details.push(`Error: ${error.message}`);
  } finally {
    await page.close();
  }
}

async function testFix3ChefImages(browser) {
  console.log('🔍 Testing Fix 3: Recipe Card Images on Chef Pages');
  console.log('----------------------------------------------------');

  const page = await browser.newPage();

  try {
    // Track network requests
    const failedImages = [];
    const loadedImages = [];

    page.on('response', (response) => {
      const url = response.url();
      if (
        url.includes('/images/recipes/') ||
        url.includes('blob.vercel-storage.com')
      ) {
        if (response.status() === 404) {
          failedImages.push(url);
        } else if (response.status() === 200) {
          loadedImages.push(url);
        }
      }
    });

    await page.goto(`${BASE_URL}/chef/vivian-li`, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });

    console.log('✓ Chef page loaded');

    // Wait for images to load
    await page.waitForTimeout(5000);

    // Check all images
    const imageStats = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));
      return images.map((img) => ({
        src: img.src,
        alt: img.alt,
        loaded: img.complete && img.naturalHeight > 0,
        width: img.naturalWidth,
        height: img.naturalHeight,
      }));
    });

    const brokenImages = imageStats.filter((img) => !img.loaded);
    const validImages = imageStats.filter((img) => img.loaded);

    console.log(`✓ Total images: ${imageStats.length}`);
    console.log(`✓ Loaded successfully: ${validImages.length}`);
    console.log(`✗ Broken images: ${brokenImages.length}`);
    console.log(`✗ 404 errors: ${failedImages.length}`);

    if (brokenImages.length > 0) {
      console.log(`  Broken: ${brokenImages.slice(0, 3).map((i) => i.alt || i.src.substring(0, 60)).join(', ')}`);
    }

    if (failedImages.length > 0) {
      console.log(`  Failed: ${failedImages.slice(0, 3).join(', ')}`);
    }

    // Check if images are from Vercel Blob Storage
    const blobImages = validImages.filter((img) =>
      img.src.includes('blob.vercel-storage.com')
    );
    console.log(`✓ Images from Vercel Blob: ${blobImages.length}`);

    // Take screenshot
    await page.screenshot({
      path: '/Users/masa/Projects/joanies-kitchen/tests/fix3-chef-images.png',
      fullPage: true,
    });
    console.log('✓ Screenshot saved: tests/fix3-chef-images.png');

    const passed = failedImages.length === 0 && brokenImages.length < 2;
    results.fix3.pass = passed;
    results.fix3.details = [
      `404 errors: ${failedImages.length}`,
      `Broken images: ${brokenImages.length}`,
      `Vercel Blob images: ${blobImages.length}`,
    ];

    console.log(`\n${passed ? '✅ PASS' : '❌ FAIL'}: Fix 3\n`);
  } catch (error) {
    console.error(`✗ Error: ${error.message}\n`);
    results.fix3.details.push(`Error: ${error.message}`);
  } finally {
    await page.close();
  }
}

async function testFix4FridgeTimeout(browser) {
  console.log('🔍 Testing Fix 4: Fridge Search Timeout Protection');
  console.log('----------------------------------------------------');

  const page = await browser.newPage();

  try {
    await page.goto(`${BASE_URL}/fridge`, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });

    console.log('✓ Fridge page loaded');

    // Wait for page to settle
    await page.waitForTimeout(2000);

    // Find input and enter ingredients
    const inputSelector = 'input[type="text"], textarea';
    await page.waitForSelector(inputSelector, { timeout: 5000 });
    await page.type(inputSelector, 'chicken, rice, tomatoes');

    console.log('✓ Entered ingredients: chicken, rice, tomatoes');

    // Find and click submit button
    const submitButton = await page.$(
      'button[type="submit"], button:has-text("Search"), button:has-text("Find")'
    );

    if (!submitButton) {
      throw new Error('Submit button not found');
    }

    const startTime = Date.now();
    await submitButton.click();
    console.log('✓ Submitted search');

    // Wait for navigation or results
    try {
      await page.waitForNavigation({ timeout: 35000, waitUntil: 'networkidle0' });
      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);

      console.log(`✓ Response time: ${duration}s`);

      // Wait for content to render
      await page.waitForTimeout(3000);

      // Check for timeout error or results
      const content = await page.content();
      const hasTimeout = content.toLowerCase().includes('timeout');
      const hasResults =
        content.toLowerCase().includes('recipe') ||
        content.toLowerCase().includes('found');

      console.log(`✓ Has timeout error: ${hasTimeout ? 'YES' : 'NO'}`);
      console.log(`✓ Has results: ${hasResults ? 'YES' : 'NO'}`);
      console.log(`✓ Final URL: ${page.url()}`);

      // Take screenshot
      await page.screenshot({
        path: '/Users/masa/Projects/joanies-kitchen/tests/fix4-fridge.png',
        fullPage: true,
      });
      console.log('✓ Screenshot saved: tests/fix4-fridge.png');

      const passed = duration < 30 && !hasTimeout && hasResults;
      results.fix4.pass = passed;
      results.fix4.details = [
        `Response time: ${duration}s`,
        `Has timeout error: ${hasTimeout}`,
        `Has results: ${hasResults}`,
      ];

      console.log(`\n${passed ? '✅ PASS' : '⚠️  CHECK RESULTS'}: Fix 4\n`);
    } catch (error) {
      console.error(`✗ Navigation timeout after 35s: ${error.message}`);
      await page.screenshot({
        path: '/Users/masa/Projects/joanies-kitchen/tests/fix4-fridge-timeout.png',
        fullPage: true,
      });
      results.fix4.details.push(`Timeout after 35s`);
      console.log('\n⚠️  NEEDS INVESTIGATION: Fix 4\n');
    }
  } catch (error) {
    console.error(`✗ Error: ${error.message}\n`);
    results.fix4.details.push(`Error: ${error.message}`);
  } finally {
    await page.close();
  }
}

async function runAllTests() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  console.log('✓ Browser launched\n');

  await testFix1AdminInfiniteLoop(browser);
  await testFix2RecipeIngredients(browser);
  await testFix3ChefImages(browser);
  await testFix4FridgeTimeout(browser);

  await browser.close();

  // Print summary
  console.log('=== TEST SUMMARY ===\n');
  console.log(`Fix 1 - Admin Infinite Loop:       ${results.fix1.pass ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  ${results.fix1.details.join(', ')}`);
  console.log(`\nFix 2 - Recipe Ingredients:        ${results.fix2.pass ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  ${results.fix2.details.join(', ')}`);
  console.log(`\nFix 3 - Chef Page Images:          ${results.fix3.pass ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  ${results.fix3.details.join(', ')}`);
  console.log(`\nFix 4 - Fridge Search Timeout:     ${results.fix4.pass ? '✅ PASS' : '⚠️  CHECK'}`);
  console.log(`  ${results.fix4.details.join(', ')}`);

  const allPassed = Object.values(results).every((r) => r.pass);
  console.log(`\n${'='.repeat(50)}`);
  console.log(
    allPassed
      ? '✅ ALL TESTS PASSED'
      : '⚠️  SOME TESTS NEED REVIEW - Check screenshots in tests/'
  );
  console.log(`${'='.repeat(50)}\n`);

  process.exit(allPassed ? 0 : 1);
}

// Run tests
runAllTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
