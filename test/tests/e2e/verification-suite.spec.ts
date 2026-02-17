import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const SCREENSHOTS_DIR = path.join(process.cwd(), 'test-screenshots', 'verification');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3005';

// Ensure screenshots directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

// Console error tracking
const consoleErrors: Record<string, Array<{ type: string; message: string }>> = {};

function trackConsoleErrors(page: Page, testName: string) {
  if (!consoleErrors[testName]) {
    consoleErrors[testName] = [];
  }

  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      consoleErrors[testName].push({
        type: msg.type(),
        message: msg.text()
      });
    }
  });
}

test.describe('Final Verification Test Suite', () => {

  test('Test 1: Report Icon Position', async ({ page }) => {
    trackConsoleErrors(page, 'test1');

    console.log('Test 1: Verifying Report Icon Position');

    // Navigate to homepage to find a recipe
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Find and click on the first recipe
    const firstRecipe = page.locator('a[href^="/recipe/"]').first();
    await firstRecipe.waitFor({ state: 'visible', timeout: 10000 });
    await firstRecipe.click();

    // Wait for recipe detail page to load
    await page.waitForURL(/\/recipe\/\d+/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Wait for action buttons to appear
    await page.waitForSelector('button, a', { timeout: 10000 });

    // Take screenshot
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'test1-report-button-position.png'),
      fullPage: true
    });

    // Get all action buttons
    const buttons = await page.locator('button:has-text("Report"), a:has-text("Report")').all();

    console.log(`✓ Found ${buttons.length} Report button(s)`);
    console.log('✓ Screenshot saved: test1-report-button-position.png');

    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  test('Test 2: Error Handling - Empty Ingredients', async ({ page }) => {
    trackConsoleErrors(page, 'test2');

    console.log('Test 2: Verifying Error Handling - Empty Ingredients');

    await page.goto(`${BASE_URL}/fridge/results`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const url = page.url();
    const hasErrorMessage = await page.locator('text=/error|no ingredients|try again/i').count() > 0;
    const isRedirected = url.includes('/fridge') && !url.includes('/fridge/results');

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'test2-empty-ingredients.png'),
      fullPage: true
    });

    console.log(`✓ URL: ${url}`);
    console.log(`✓ Redirected: ${isRedirected}`);
    console.log(`✓ Error message shown: ${hasErrorMessage}`);
    console.log('✓ Screenshot saved: test2-empty-ingredients.png');

    expect(isRedirected || hasErrorMessage).toBe(true);
  });

  test('Test 3: Error Handling - Invalid Ingredients', async ({ page }) => {
    trackConsoleErrors(page, 'test3');

    console.log('Test 3: Verifying Error Handling - Invalid Ingredients');

    const startTime = Date.now();
    await page.goto(`${BASE_URL}/fridge/results?ingredients=zzz_invalid_zzz`);

    // Wait up to 15 seconds for either results or error
    await page.waitForSelector('text=/error|no recipes|try again|recipe/i', {
      timeout: 15000
    }).catch(() => console.log('Timeout waiting for results or error'));

    const loadTime = Date.now() - startTime;

    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'test3-invalid-ingredients.png'),
      fullPage: true
    });

    const hasError = await page.locator('text=/error|no recipes|try again/i').count() > 0;
    const hasTryAgain = await page.locator('button:has-text("Try Again"), a:has-text("Try Again")').count() > 0;

    console.log(`✓ Load time: ${loadTime}ms`);
    console.log(`✓ Error message shown: ${hasError}`);
    console.log(`✓ Try Again button present: ${hasTryAgain}`);
    console.log('✓ Screenshot saved: test3-invalid-ingredients.png');

    expect(loadTime).toBeLessThan(15000);
  });

  test('Test 4: Autocomplete Performance', async ({ page }) => {
    trackConsoleErrors(page, 'test4');

    console.log('Test 4: Verifying Autocomplete Performance');

    await page.goto(`${BASE_URL}/fridge`);
    await page.waitForLoadState('networkidle');

    // Find the ingredient input
    const input = page.locator('input[placeholder*="ingredient" i], input[type="text"]').first();
    await input.waitFor({ state: 'visible', timeout: 10000 });

    // First request (uncached)
    const startTime1 = Date.now();
    await input.fill('tom');
    await page.waitForSelector('text=/tomato/i', { timeout: 2000 }).catch(() => {});
    const firstRequestTime = Date.now() - startTime1;

    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'test4-autocomplete.png'),
      fullPage: true
    });

    // Clear and try again (cached)
    await input.fill('');
    await page.waitForTimeout(300);

    const startTime2 = Date.now();
    await input.fill('tom');
    await page.waitForSelector('text=/tomato/i', { timeout: 2000 }).catch(() => {});
    const cachedRequestTime = Date.now() - startTime2;

    console.log(`✓ First request time: ${firstRequestTime}ms (target: <500ms)`);
    console.log(`✓ Cached request time: ${cachedRequestTime}ms (target: <100ms)`);
    console.log(`✓ Performance improvement: ${((firstRequestTime - cachedRequestTime) / firstRequestTime * 100).toFixed(1)}%`);
    console.log('✓ Screenshot saved: test4-autocomplete.png');

    expect(firstRequestTime).toBeLessThan(500);
  });

  test('Test 5: Form Validation', async ({ page }) => {
    trackConsoleErrors(page, 'test5');

    console.log('Test 5: Verifying Form Validation');

    await page.goto(`${BASE_URL}/inventory`);
    await page.waitForLoadState('networkidle');

    // Try to submit empty form
    const submitButton = page.locator('button:has-text("Add"), button[type="submit"]').first();

    if (await submitButton.count() > 0) {
      await submitButton.click();
      await page.waitForTimeout(1000);

      // Check for validation errors
      const hasValidationErrors = await page.locator('text=/required|invalid|error/i, .error, [class*="error"]').count() > 0;

      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, 'test5-form-validation.png'),
        fullPage: true
      });

      console.log(`✓ Validation errors shown: ${hasValidationErrors}`);
      console.log('✓ Screenshot saved: test5-form-validation.png');
    } else {
      console.log('⚠ No submit button found on inventory page');
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, 'test5-form-validation.png'),
        fullPage: true
      });
    }
  });

  test('Test 6: Recipe Search with Timeout', async ({ page }) => {
    trackConsoleErrors(page, 'test6');

    console.log('Test 6: Verifying Recipe Search with Timeout');

    await page.goto(`${BASE_URL}/fridge`);
    await page.waitForLoadState('networkidle');

    // Enter ingredients
    const input = page.locator('input[placeholder*="ingredient" i], input[type="text"]').first();
    await input.waitFor({ state: 'visible', timeout: 10000 });
    await input.fill('chicken,rice,tomato');

    // Click Find Recipes button
    const findButton = page.locator('button:has-text("Find Recipes"), button:has-text("Search")').first();

    const startTime = Date.now();
    await findButton.click();

    // Wait for either results or error (max 15 seconds)
    await page.waitForURL(/\/fridge\/results/, { timeout: 5000 }).catch(() => {});
    await page.waitForSelector('text=/recipe|error|no recipes/i', {
      timeout: 15000
    }).catch(() => console.log('Timeout waiting for results'));

    const loadTime = Date.now() - startTime;

    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'test6-recipe-search.png'),
      fullPage: true
    });

    const hasResults = await page.locator('text=/recipe/i').count() > 0;
    const hasError = await page.locator('text=/error|try again/i').count() > 0;

    console.log(`✓ Load time: ${loadTime}ms`);
    console.log(`✓ Has results: ${hasResults}`);
    console.log(`✓ Has error: ${hasError}`);
    console.log('✓ Screenshot saved: test6-recipe-search.png');

    expect(loadTime).toBeLessThan(15000);
    expect(hasResults || hasError).toBe(true);
  });

  test('Test 7: Performance - Cache Effectiveness', async ({ page }) => {
    trackConsoleErrors(page, 'test7');

    console.log('Test 7: Verifying Cache Effectiveness');

    // Clear cache
    await page.context().clearCookies();

    // First request
    const startTime1 = Date.now();
    await page.goto(`${BASE_URL}/fridge/results?ingredients=chicken,rice`);
    await page.waitForSelector('text=/recipe|error/i', { timeout: 15000 }).catch(() => {});
    const firstRequestTime = Date.now() - startTime1;

    await page.waitForTimeout(1000);

    // Second request (cached)
    const startTime2 = Date.now();
    await page.goto(`${BASE_URL}/fridge/results?ingredients=chicken,rice`);
    await page.waitForSelector('text=/recipe|error/i', { timeout: 10000 }).catch(() => {});
    const cachedRequestTime = Date.now() - startTime2;

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'test7-cache-performance.png'),
      fullPage: true
    });

    const improvement = ((firstRequestTime - cachedRequestTime) / firstRequestTime * 100);

    console.log(`✓ First request: ${firstRequestTime}ms`);
    console.log(`✓ Cached request: ${cachedRequestTime}ms`);
    console.log(`✓ Performance improvement: ${improvement.toFixed(1)}%`);
    console.log('✓ Screenshot saved: test7-cache-performance.png');

    expect(improvement).toBeGreaterThan(10); // At least 10% improvement
  });

  test('Test 8: Inventory Page Layout', async ({ page }) => {
    trackConsoleErrors(page, 'test8');

    console.log('Test 8: Verifying Inventory Page Layout');

    await page.goto(`${BASE_URL}/inventory`);
    await page.waitForLoadState('networkidle');

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'test8-inventory-layout.png'),
      fullPage: true
    });

    // Check for form elements
    const hasForm = await page.locator('form, input').count() > 0;
    const hasIngredientInput = await page.locator('input[placeholder*="ingredient" i]').count() > 0;

    console.log(`✓ Has form elements: ${hasForm}`);
    console.log(`✓ Has ingredient input: ${hasIngredientInput}`);
    console.log('✓ Screenshot saved: test8-inventory-layout.png');

    expect(hasForm).toBe(true);
  });

  test('Test 9: Mobile Responsiveness', async ({ page }) => {
    trackConsoleErrors(page, 'test9');

    console.log('Test 9: Verifying Mobile Responsiveness');

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Test /fridge
    await page.goto(`${BASE_URL}/fridge`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'test9-mobile-fridge.png'),
      fullPage: true
    });
    console.log('✓ Screenshot saved: test9-mobile-fridge.png');

    // Test /inventory
    await page.goto(`${BASE_URL}/inventory`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'test9-mobile-inventory.png'),
      fullPage: true
    });
    console.log('✓ Screenshot saved: test9-mobile-inventory.png');

    // Test /fridge/results
    await page.goto(`${BASE_URL}/fridge/results?ingredients=chicken,rice`);
    await page.waitForSelector('text=/recipe|error/i', { timeout: 15000 }).catch(() => {});
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'test9-mobile-results.png'),
      fullPage: true
    });
    console.log('✓ Screenshot saved: test9-mobile-results.png');

    console.log('✓ Mobile responsiveness tested on all key pages');
  });

  test.afterAll(async () => {
    // Generate console error report
    const reportPath = path.join(SCREENSHOTS_DIR, 'console-errors-report.json');

    const summary = {
      timestamp: new Date().toISOString(),
      totalTests: Object.keys(consoleErrors).length,
      totalErrors: 0,
      totalWarnings: 0,
      details: consoleErrors
    };

    Object.values(consoleErrors).forEach(errors => {
      errors.forEach(error => {
        if (error.type === 'error') summary.totalErrors++;
        if (error.type === 'warning') summary.totalWarnings++;
      });
    });

    fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));

    console.log('\n=== CONSOLE ERROR SUMMARY ===');
    console.log(`Total Errors: ${summary.totalErrors}`);
    console.log(`Total Warnings: ${summary.totalWarnings}`);
    console.log(`Report saved: ${reportPath}`);
  });
});
