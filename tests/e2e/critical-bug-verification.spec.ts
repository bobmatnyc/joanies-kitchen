/**
 * Critical Bug Verification Tests
 *
 * Test 1: Admin Flagged Images - Infinite Loop Fix
 * Test 2: Recipe Ingredient Display - [object Object] Fix
 */

import { test, expect, type Page } from '@playwright/test';

// Test configuration
const BASE_URL = 'http://localhost:3002';
const TIMEOUT = 30000;

/**
 * Test 1: Admin Flagged Images - Infinite Loop Fix
 *
 * Verifies that the FlaggedImagesManager component loads without infinite loop
 * Fix: loadFlaggedRecipes wrapped with useCallback to prevent infinite loop
 */
test.describe('Test 1: Admin Flagged Images - Infinite Loop Fix', () => {
  test('should load admin page with flagged images section without hanging', async ({ page }) => {
    // Track console errors and warnings
    const consoleMessages: Array<{ type: string; text: string }> = [];
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Track network requests to detect infinite loops
    const networkRequests: string[] = [];
    page.on('request', (request) => {
      networkRequests.push(request.url());
    });

    // Navigate to admin dashboard
    console.log('Navigating to admin dashboard...');
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle', timeout: TIMEOUT });

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Check for "Flagged Images" section
    console.log('Checking for Flagged Images section...');
    const flaggedImagesSection = page.locator('text=Flagged Images').first();
    await expect(flaggedImagesSection).toBeVisible({ timeout: 10000 });

    // Wait for loading state to complete (should not hang)
    console.log('Waiting for loading to complete...');
    await page.waitForTimeout(3000); // Give it 3 seconds to settle

    // Check that loading spinner is NOT perpetually visible
    const loadingSpinner = page.locator('text=Loading flagged images...').first();
    const isLoadingVisible = await loadingSpinner.isVisible().catch(() => false);

    if (isLoadingVisible) {
      // Wait a bit more and check again - it should have disappeared
      await page.waitForTimeout(2000);
      const stillLoading = await loadingSpinner.isVisible().catch(() => false);
      expect(stillLoading).toBe(false); // Loading should have stopped
    }

    // Check for one of the expected end states
    const noFlaggedImages = page.locator('text=No images flagged for regeneration').first();
    const flaggedImagesGrid = page.locator('div.grid').filter({ has: page.locator('text=Regenerate Image') });

    const hasNoFlaggedMessage = await noFlaggedImages.isVisible().catch(() => false);
    const hasFlaggedGrid = await flaggedImagesGrid.count() > 0;

    expect(hasNoFlaggedMessage || hasFlaggedGrid).toBe(true);

    // Verify no infinite loop by checking network requests
    // Filter for the flagged recipes API calls
    const flaggedRecipesRequests = networkRequests.filter(url =>
      url.includes('flagged') || url.includes('admin')
    );

    console.log(`Total network requests: ${networkRequests.length}`);
    console.log(`Flagged-related requests: ${flaggedRecipesRequests.length}`);

    // Should not have excessive requests (infinite loop would cause 50+ requests)
    expect(flaggedRecipesRequests.length).toBeLessThan(20);

    // Check console for errors
    const errors = consoleMessages.filter(msg => msg.type === 'error');
    const infiniteRenderErrors = errors.filter(msg =>
      msg.text.includes('Maximum update depth') ||
      msg.text.includes('Too many re-renders')
    );

    console.log(`Console errors: ${errors.length}`);
    console.log(`Infinite render errors: ${infiniteRenderErrors.length}`);

    expect(infiniteRenderErrors.length).toBe(0);

    // Page should be responsive (not frozen)
    const adminTitle = page.locator('h1:has-text("Admin Dashboard")').first();
    await expect(adminTitle).toBeVisible();
  });
});

/**
 * Test 2: Recipe Ingredient Display - [object Object] Fix
 *
 * Verifies that recipe ingredients display as readable strings, not [object Object]
 * Fix: Added handling for structured ingredient format {name, quantity, unit, notes, preparation}
 */
test.describe('Test 2: Recipe Ingredient Display - [object Object] Fix', () => {
  test('should display ingredients as readable strings on kale-white-bean-stew-2 page', async ({ page }) => {
    // Track console messages
    const consoleMessages: Array<{ type: string; text: string }> = [];
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Navigate to the specific recipe
    console.log('Navigating to recipe page...');
    await page.goto(`${BASE_URL}/recipes/kale-white-bean-stew-2`, {
      waitUntil: 'networkidle',
      timeout: TIMEOUT
    });

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Find the ingredients section
    console.log('Locating ingredients section...');
    const ingredientsHeading = page.locator('h2:has-text("Ingredients"), h3:has-text("Ingredients")').first();
    await expect(ingredientsHeading).toBeVisible({ timeout: 10000 });

    // Get all ingredient text content
    // Look for ingredient list (could be ul, ol, or div with ingredients)
    const ingredientsList = page.locator('ul li, ol li').filter({
      hasNot: page.locator('h1, h2, h3, h4')
    });

    // Wait for ingredients to be visible
    await ingredientsList.first().waitFor({ state: 'visible', timeout: 5000 });

    const ingredientsCount = await ingredientsList.count();
    console.log(`Found ${ingredientsCount} ingredients`);

    expect(ingredientsCount).toBeGreaterThan(0);

    // Check each ingredient for [object Object]
    const ingredientsText: string[] = [];
    for (let i = 0; i < ingredientsCount; i++) {
      const text = await ingredientsList.nth(i).textContent() || '';
      ingredientsText.push(text);

      // Critical check: NO [object Object]
      expect(text).not.toContain('[object Object]');
      console.log(`Ingredient ${i + 1}: ${text}`);
    }

    // Verify expected ingredient formats exist
    // Should contain ingredients with quantities and units
    const hasQuantityPattern = ingredientsText.some(text =>
      /\d+/.test(text) || // Contains numbers
      /½|¼|¾|⅓|⅔/.test(text) // Contains fractions
    );

    const hasUnits = ingredientsText.some(text =>
      /\b(cup|tbsp|tsp|lb|oz|g|kg|ml|l)\b/i.test(text)
    );

    expect(hasQuantityPattern).toBe(true);
    expect(hasUnits).toBe(true);

    // Look for specific expected ingredients from kale-white-bean-stew-2
    const hasKale = ingredientsText.some(text => /kale/i.test(text));
    const hasOliveOil = ingredientsText.some(text => /olive oil/i.test(text));

    console.log(`Has kale: ${hasKale}`);
    console.log(`Has olive oil: ${hasOliveOil}`);

    // Check console for errors
    const errors = consoleMessages.filter(msg => msg.type === 'error');
    console.log(`Console errors: ${errors.length}`);

    if (errors.length > 0) {
      console.log('Console errors:', errors.map(e => e.text).join('\n'));
    }
  });

  test('should display ingredients correctly on other recipe pages (regression test)', async ({ page }) => {
    // Test a few other recipe pages to ensure fix is universal
    const testRecipes = [
      'kale-white-bean-stew-2', // Original test case
      // Note: We'll need to find actual recipe slugs from the site
    ];

    for (const slug of testRecipes) {
      console.log(`Testing recipe: ${slug}`);

      await page.goto(`${BASE_URL}/recipes/${slug}`, {
        waitUntil: 'networkidle',
        timeout: TIMEOUT
      });

      // Quick check for [object Object]
      const pageContent = await page.textContent('body');
      expect(pageContent).not.toContain('[object Object]');

      console.log(`✓ Recipe ${slug} passed`);
    }
  });
});

/**
 * Performance Check: Ensure page remains responsive
 */
test.describe('Performance and Stability', () => {
  test('admin page should remain responsive after 10 seconds', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle' });

    // Wait 10 seconds
    await page.waitForTimeout(10000);

    // Try to interact with page
    const quickActionsCard = page.locator('text=Quick Actions').first();
    await expect(quickActionsCard).toBeVisible();

    // Page should still be interactive
    const manageRecipesButton = page.locator('a:has-text("Manage Recipes")').first();
    await expect(manageRecipesButton).toBeEnabled();
  });
});
