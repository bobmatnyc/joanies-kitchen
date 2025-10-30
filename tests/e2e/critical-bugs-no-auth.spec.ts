/**
 * Critical Bug Verification Tests (No Auth Required)
 *
 * Test 1: Admin Flagged Images - Infinite Loop Fix (Skipped - requires auth)
 * Test 2: Recipe Ingredient Display - [object Object] Fix
 */

import { expect, test } from '@playwright/test';

const BASE_URL = 'http://localhost:3002';

/**
 * Test 2: Recipe Ingredient Display - [object Object] Fix
 *
 * Verifies that recipe ingredients display as readable strings, not [object Object]
 * Fix: Added handling for structured ingredient format {name, quantity, unit, notes, preparation}
 */
test.describe('Recipe Ingredient Display Fix', () => {
  test('should display ingredients as readable strings on kale-white-bean-stew-2', async ({
    page,
  }) => {
    // Track console messages
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    console.log('🧪 Test: Recipe Ingredient Display - [object Object] Fix');
    console.log('📍 Navigating to: /recipes/kale-white-bean-stew-2');

    // Navigate to the specific recipe
    await page.goto(`${BASE_URL}/recipes/kale-white-bean-stew-2`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // Wait a bit for hydration
    await page.waitForTimeout(2000);

    console.log('✓ Page loaded');

    // Check for [object Object] anywhere on the page
    const bodyText = await page.textContent('body');
    const hasObjectObject = bodyText?.includes('[object Object]') || false;

    console.log(`\n🔍 Checking for [object Object] in page content...`);
    console.log(`   Result: ${hasObjectObject ? '❌ FOUND' : '✅ NOT FOUND'}`);

    if (hasObjectObject) {
      console.log('\n❌ FAIL: Found [object Object] on page');
      // Take screenshot for debugging
      await page.screenshot({ path: 'test-results/object-object-found.png' });
    }

    expect(hasObjectObject).toBe(false);

    // Try to find ingredients section
    console.log('\n🔍 Locating ingredients section...');

    // Look for ingredients heading
    const ingredientsHeading = page.locator('text=Ingredients').first();
    const hasIngredientsHeading = await ingredientsHeading
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    console.log(`   Ingredients heading found: ${hasIngredientsHeading ? '✅' : '❌'}`);

    if (hasIngredientsHeading) {
      // Get all list items near the ingredients heading
      const listItems = page.locator('ul li, ol li');
      const count = await listItems.count();

      console.log(`\n📋 Found ${count} list items on page`);

      if (count > 0) {
        console.log('\n📝 Sample ingredients:');
        const sampleCount = Math.min(5, count);

        for (let i = 0; i < sampleCount; i++) {
          const text = await listItems.nth(i).textContent();
          console.log(`   ${i + 1}. ${text}`);

          // Check this ingredient for [object Object]
          if (text?.includes('[object Object]')) {
            console.log(`      ❌ FAIL: Ingredient contains [object Object]`);
          }
        }
      }
    }

    // Check console errors
    console.log(`\n🖥️  Console errors: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
      console.log('   Errors:');
      consoleErrors.forEach((err) => console.log(`   - ${err}`));
    }

    console.log('\n✅ TEST PASSED: No [object Object] found on page');
  });

  test('should display ingredients correctly on multiple recipe pages', async ({ page }) => {
    console.log('\n🧪 Test: Regression Test - Multiple Recipe Pages');

    // Get a list of recipe slugs to test
    console.log('📍 Navigating to recipes page to find test recipes...');

    await page.goto(`${BASE_URL}/recipes`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    await page.waitForTimeout(2000);

    // Find recipe links
    const recipeLinks = page.locator('a[href^="/recipes/"]');
    const linkCount = await recipeLinks.count();

    console.log(`\n📋 Found ${linkCount} recipe links`);

    // Test first 3 recipes
    const testCount = Math.min(3, linkCount);
    const testedRecipes: Array<{ slug: string; hasObjectObject: boolean }> = [];

    for (let i = 0; i < testCount; i++) {
      const href = await recipeLinks.nth(i).getAttribute('href');
      if (!href) continue;

      const slug = href.replace('/recipes/', '');
      console.log(`\n📖 Testing recipe: ${slug}`);

      await page.goto(`${BASE_URL}${href}`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      await page.waitForTimeout(1500);

      const bodyText = await page.textContent('body');
      const hasObjectObject = bodyText?.includes('[object Object]') || false;

      console.log(`   [object Object] found: ${hasObjectObject ? '❌ YES' : '✅ NO'}`);

      testedRecipes.push({ slug, hasObjectObject });

      expect(hasObjectObject).toBe(false);
    }

    console.log('\n📊 Regression Test Summary:');
    testedRecipes.forEach((recipe) => {
      console.log(`   ${recipe.hasObjectObject ? '❌' : '✅'} ${recipe.slug}`);
    });

    console.log('\n✅ REGRESSION TEST PASSED: All tested recipes display correctly');
  });
});

/**
 * Performance Test: Check page responsiveness
 */
test.describe('Performance Check', () => {
  test('recipe page should load and be responsive', async ({ page }) => {
    console.log('\n🧪 Test: Page Performance and Responsiveness');

    const startTime = Date.now();

    await page.goto(`${BASE_URL}/recipes/kale-white-bean-stew-2`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    const loadTime = Date.now() - startTime;
    console.log(`⏱️  Page load time: ${loadTime}ms`);

    // Check page is interactive
    const recipeTitle = page.locator('h1').first();
    const isTitleVisible = await recipeTitle.isVisible({ timeout: 5000 });

    console.log(`✓ Page title visible: ${isTitleVisible ? '✅' : '❌'}`);

    expect(isTitleVisible).toBe(true);
    expect(loadTime).toBeLessThan(10000); // Should load in under 10 seconds

    console.log('\n✅ PERFORMANCE TEST PASSED');
  });
});
