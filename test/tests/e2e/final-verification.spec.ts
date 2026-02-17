import { test, expect, Page } from '@playwright/test';
import { chromium } from '@playwright/test';

const BASE_URL = 'http://localhost:3005';

// Helper to collect console messages
class ConsoleMonitor {
  private messages: Array<{ type: string; text: string; timestamp: number }> = [];

  attach(page: Page) {
    page.on('console', (msg) => {
      this.messages.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: Date.now(),
      });
    });
  }

  getMessages() {
    return this.messages;
  }

  getWarnings() {
    return this.messages.filter((m) => m.type === 'warning');
  }

  getErrors() {
    return this.messages.filter((m) => m.type === 'error');
  }

  getClerkWarnings() {
    return this.messages.filter(
      (m) =>
        m.type === 'warning' &&
        (m.text.includes('Clerk') || m.text.includes('@clerk'))
    );
  }

  clear() {
    this.messages = [];
  }
}

// Helper to measure performance
async function measurePerformance(page: Page) {
  return await page.evaluate(() => {
    const perfData = window.performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const paintEntries = window.performance.getEntriesByType('paint');

    return {
      ttfb: perfData.responseStart - perfData.requestStart,
      fcp: paintEntries.find((e) => e.name === 'first-contentful-paint')?.startTime || 0,
      domContentLoaded: perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart,
      loadComplete: perfData.loadEventEnd - perfData.loadEventStart,
      totalTime: perfData.loadEventEnd - perfData.fetchStart,
    };
  });
}

test.describe('Final Comprehensive QA Verification', () => {
  let consoleMonitor: ConsoleMonitor;

  test.beforeEach(({ page }) => {
    consoleMonitor = new ConsoleMonitor();
    consoleMonitor.attach(page);
  });

  test('Test 1: Autocomplete Performance (<500ms first, <100ms cached)', async ({ page }) => {
    console.log('\n=== TEST 1: AUTOCOMPLETE PERFORMANCE ===');

    await page.goto(`${BASE_URL}/fridge`);
    await page.waitForLoadState('networkidle');

    // Clear cache
    await page.context().clearCookies();

    // Find the ingredient input
    const ingredientInput = page.locator('input[placeholder*="ingredient" i]').first();
    await ingredientInput.waitFor({ state: 'visible' });

    // Test 1: First request (uncached)
    const startTime1 = Date.now();
    await ingredientInput.fill('tom');

    // Wait for dropdown to appear
    const dropdown = page.locator('[role="listbox"], [role="menu"], .autocomplete-results').first();
    await dropdown.waitFor({ state: 'visible', timeout: 2000 });

    const firstRequestTime = Date.now() - startTime1;
    console.log(`First request time: ${firstRequestTime}ms`);

    // Clear input
    await ingredientInput.clear();
    await page.waitForTimeout(500);

    // Test 2: Cached request
    const startTime2 = Date.now();
    await ingredientInput.fill('tom');
    await dropdown.waitFor({ state: 'visible', timeout: 2000 });
    const cachedRequestTime = Date.now() - startTime2;
    console.log(`Cached request time: ${cachedRequestTime}ms`);

    // Take screenshot
    await page.screenshot({ path: 'test-screenshots/test1-autocomplete.png', fullPage: true });

    // Assertions
    expect(firstRequestTime, 'First autocomplete request should be <500ms').toBeLessThan(500);
    expect(cachedRequestTime, 'Cached autocomplete request should be <100ms').toBeLessThan(100);

    console.log(`✅ Test 1 PASSED: First=${firstRequestTime}ms, Cached=${cachedRequestTime}ms`);
  });

  test('Test 2: Recipe Detail Page Load (<5 seconds)', async ({ page }) => {
    console.log('\n=== TEST 2: RECIPE DETAIL PAGE LOAD ===');

    const recipeSlugs = [
      'kale-white-bean-stew-2',
      'chicken-rice-onion',
      'pasta-primavera',
    ];

    const loadTimes: number[] = [];

    for (const slug of recipeSlugs) {
      try {
        const startTime = Date.now();

        await page.goto(`${BASE_URL}/recipes/${slug}`, {
          waitUntil: 'networkidle',
          timeout: 10000,
        });

        const loadTime = Date.now() - startTime;
        loadTimes.push(loadTime);

        console.log(`Recipe '${slug}' loaded in ${loadTime}ms`);

        // Verify content is visible
        const hasContent = await page.locator('h1, h2, .recipe-title').first().isVisible();
        expect(hasContent, `Recipe ${slug} should have visible content`).toBeTruthy();

        // Check for timeout errors in console
        const errors = consoleMonitor.getErrors();
        const timeoutErrors = errors.filter((e) => e.text.includes('timeout'));
        expect(timeoutErrors.length, `No timeout errors for ${slug}`).toBe(0);

        // Verify load time
        expect(loadTime, `Recipe ${slug} should load in <5 seconds`).toBeLessThan(5000);
      } catch (error) {
        console.error(`Failed to load recipe ${slug}:`, error);
        throw error;
      }
    }

    // Take screenshot of last recipe
    await page.screenshot({ path: 'test-screenshots/test2-recipe-detail.png', fullPage: true });

    const avgLoadTime = loadTimes.reduce((a, b) => a + b, 0) / loadTimes.length;
    console.log(`✅ Test 2 PASSED: Average load time=${avgLoadTime.toFixed(0)}ms`);
  });

  test('Test 3: Zero Clerk Deprecation Warnings', async ({ page }) => {
    console.log('\n=== TEST 3: CLERK WARNINGS ===');

    consoleMonitor.clear();

    const pages = [
      '/',
      '/fridge',
      '/inventory',
      '/recipes/kale-white-bean-stew-2',
    ];

    for (const path of pages) {
      await page.goto(`${BASE_URL}${path}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000); // Wait for any async warnings
      console.log(`Checked: ${path}`);
    }

    const clerkWarnings = consoleMonitor.getClerkWarnings();

    console.log(`Total console messages: ${consoleMonitor.getMessages().length}`);
    console.log(`Total warnings: ${consoleMonitor.getWarnings().length}`);
    console.log(`Clerk warnings: ${clerkWarnings.length}`);

    if (clerkWarnings.length > 0) {
      console.log('Clerk warnings found:');
      clerkWarnings.forEach((w) => console.log(`  - ${w.text}`));
    }

    // Take screenshot of console (will need manual review)
    await page.screenshot({ path: 'test-screenshots/test3-console.png', fullPage: true });

    expect(clerkWarnings.length, 'Should have zero Clerk deprecation warnings').toBe(0);

    console.log('✅ Test 3 PASSED: Zero Clerk warnings');
  });

  test('Test 4: Report Button Position (Last in Action Buttons)', async ({ page }) => {
    console.log('\n=== TEST 4: REPORT BUTTON POSITION ===');

    await page.goto(`${BASE_URL}/recipes/kale-white-bean-stew-2`);
    await page.waitForLoadState('networkidle');

    // Find all action buttons
    const actionButtons = page.locator('button:has-text("Fork"), button:has-text("Similar"), button:has-text("Copy"), button:has-text("Export"), button:has-text("Print"), button:has-text("Report")');

    const buttonCount = await actionButtons.count();
    console.log(`Found ${buttonCount} action buttons`);

    // Get text of all buttons in order
    const buttonTexts: string[] = [];
    for (let i = 0; i < buttonCount; i++) {
      const text = await actionButtons.nth(i).textContent();
      buttonTexts.push(text?.trim() || '');
    }

    console.log('Button order:', buttonTexts);

    // Take screenshot
    await page.screenshot({ path: 'test-screenshots/test4-report-button.png', fullPage: true });

    // Verify Report is last
    const reportIndex = buttonTexts.findIndex((t) => t.includes('Report'));
    expect(reportIndex, 'Report button should be found').toBeGreaterThanOrEqual(0);
    expect(reportIndex, 'Report button should be last').toBe(buttonTexts.length - 1);

    console.log(`✅ Test 4 PASSED: Report button is in position ${reportIndex + 1} (last)`);
  });

  test('Test 5: End-to-End Fridge Workflow (<10 seconds)', async ({ page }) => {
    console.log('\n=== TEST 5: END-TO-END FRIDGE WORKFLOW ===');

    const workflowStart = Date.now();

    // Step 1: Navigate to /fridge
    await page.goto(`${BASE_URL}/fridge`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-screenshots/test5-step1-fridge.png', fullPage: true });

    // Step 2: Enter ingredients using autocomplete
    const ingredientInput = page.locator('input[placeholder*="ingredient" i]').first();
    await ingredientInput.fill('chicken');
    await page.waitForTimeout(500);

    // Add more ingredients (simulate real usage)
    await ingredientInput.press('Enter');
    await ingredientInput.fill('rice');
    await page.waitForTimeout(500);
    await ingredientInput.press('Enter');
    await ingredientInput.fill('onion');
    await page.waitForTimeout(500);
    await ingredientInput.press('Enter');

    await page.screenshot({ path: 'test-screenshots/test5-step2-ingredients.png', fullPage: true });

    // Step 3: Click "Find Recipes"
    const findButton = page.locator('button:has-text("Find Recipes")').first();
    await findButton.click();
    await page.waitForLoadState('networkidle');

    await page.screenshot({ path: 'test-screenshots/test5-step3-results.png', fullPage: true });

    // Step 4: Click on a recipe
    const recipeLink = page.locator('a[href*="/recipes/"]').first();
    await recipeLink.click();
    await page.waitForLoadState('networkidle');

    await page.screenshot({ path: 'test-screenshots/test5-step4-detail.png', fullPage: true });

    const workflowTime = Date.now() - workflowStart;
    console.log(`Total workflow time: ${workflowTime}ms`);

    // Check for errors
    const errors = consoleMonitor.getErrors();
    console.log(`Console errors during workflow: ${errors.length}`);

    expect(workflowTime, 'Complete workflow should be <10 seconds').toBeLessThan(10000);
    expect(errors.length, 'Should have no errors during workflow').toBe(0);

    console.log(`✅ Test 5 PASSED: Workflow completed in ${workflowTime}ms with no errors`);
  });

  test('Test 6: Error Handling Works Gracefully', async ({ page }) => {
    console.log('\n=== TEST 6: ERROR HANDLING ===');

    await page.goto(`${BASE_URL}/fridge/results?ingredients=zzz_invalid`);
    await page.waitForLoadState('networkidle');

    // Verify page doesn't crash (page should load)
    const pageLoaded = await page.locator('body').isVisible();
    expect(pageLoaded, 'Page should load even with invalid ingredients').toBeTruthy();

    // Look for error message or empty state
    const hasErrorMessage = await page.locator('text=/error|not found|try again|no recipes/i').count() > 0;
    console.log(`Has error/empty state message: ${hasErrorMessage}`);

    // Take screenshot
    await page.screenshot({ path: 'test-screenshots/test6-error-handling.png', fullPage: true });

    // Verify no crash (no unhandled exceptions)
    const errors = consoleMonitor.getErrors();
    const criticalErrors = errors.filter((e) =>
      e.text.includes('Uncaught') ||
      e.text.includes('Unhandled') ||
      e.text.includes('crash')
    );

    expect(criticalErrors.length, 'Should have no critical/unhandled errors').toBe(0);

    console.log('✅ Test 6 PASSED: Error handling works gracefully');
  });

  test('Test 7: Form Validation Works', async ({ page }) => {
    console.log('\n=== TEST 7: FORM VALIDATION ===');

    await page.goto(`${BASE_URL}/inventory`);
    await page.waitForLoadState('networkidle');

    // Find submit button
    const submitButton = page.locator('button[type="submit"]').first();

    // Try to submit empty form
    await submitButton.click();
    await page.waitForTimeout(1000);

    // Check for validation messages
    const validationMessages = await page.locator('text=/required|cannot be empty|invalid/i').count();
    console.log(`Validation messages found: ${validationMessages}`);

    // Take screenshot
    await page.screenshot({ path: 'test-screenshots/test7-validation.png', fullPage: true });

    // Verify validation prevented submission
    const currentUrl = page.url();
    expect(currentUrl, 'Should still be on inventory page (not submitted)').toContain('/inventory');

    console.log('✅ Test 7 PASSED: Form validation works');
  });

  test('Test 8: Mobile Responsiveness', async ({ page }) => {
    console.log('\n=== TEST 8: MOBILE RESPONSIVENESS ===');

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    const testPages = [
      '/fridge',
      '/inventory',
      '/recipes/kale-white-bean-stew-2',
    ];

    for (const path of testPages) {
      await page.goto(`${BASE_URL}${path}`);
      await page.waitForLoadState('networkidle');

      // Check for horizontal scroll (bad on mobile)
      const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
      const clientWidth = await page.evaluate(() => document.body.clientWidth);

      console.log(`${path}: scrollWidth=${scrollWidth}, clientWidth=${clientWidth}`);

      expect(scrollWidth, `${path} should not have horizontal scroll on mobile`).toBeLessThanOrEqual(clientWidth + 5);

      // Take screenshot
      const safePath = path.replace(/\//g, '-');
      await page.screenshot({ path: `test-screenshots/test8-mobile${safePath}.png`, fullPage: true });
    }

    console.log('✅ Test 8 PASSED: Mobile responsiveness verified');
  });

  test('Test 9: Performance Metrics', async ({ page }) => {
    console.log('\n=== TEST 9: PERFORMANCE METRICS ===');

    const testPages = [
      '/',
      '/fridge',
      '/recipes/kale-white-bean-stew-2',
    ];

    const metrics: any[] = [];

    for (const path of testPages) {
      await page.goto(`${BASE_URL}${path}`);
      await page.waitForLoadState('networkidle');

      const perf = await measurePerformance(page);
      metrics.push({ path, ...perf });

      console.log(`\nMetrics for ${path}:`);
      console.log(`  TTFB: ${perf.ttfb.toFixed(0)}ms`);
      console.log(`  FCP: ${perf.fcp.toFixed(0)}ms`);
      console.log(`  DOM Content Loaded: ${perf.domContentLoaded.toFixed(0)}ms`);
      console.log(`  Load Complete: ${perf.loadComplete.toFixed(0)}ms`);
      console.log(`  Total Time: ${perf.totalTime.toFixed(0)}ms`);
    }

    // Take screenshot of performance tab (will need manual review)
    await page.screenshot({ path: 'test-screenshots/test9-performance.png', fullPage: true });

    // Basic performance assertions
    metrics.forEach((m) => {
      expect(m.ttfb, `${m.path} TTFB should be reasonable`).toBeLessThan(2000);
      expect(m.fcp, `${m.path} FCP should be reasonable`).toBeLessThan(3000);
    });

    console.log('✅ Test 9 PASSED: Performance metrics collected');
  });

  test('Test 10: Console Error Count', async ({ page }) => {
    console.log('\n=== TEST 10: CONSOLE ERROR COUNT ===');

    consoleMonitor.clear();

    const testPages = [
      '/',
      '/fridge',
      '/inventory',
      '/recipes/kale-white-bean-stew-2',
    ];

    for (const path of testPages) {
      await page.goto(`${BASE_URL}${path}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
    }

    const messages = consoleMonitor.getMessages();
    const errors = consoleMonitor.getErrors();
    const warnings = consoleMonitor.getWarnings();
    const info = messages.filter((m) => m.type === 'info' || m.type === 'log');

    console.log('\nConsole Summary:');
    console.log(`  Total messages: ${messages.length}`);
    console.log(`  Errors: ${errors.length}`);
    console.log(`  Warnings: ${warnings.length}`);
    console.log(`  Info/Log: ${info.length}`);

    if (errors.length > 0) {
      console.log('\nErrors found:');
      errors.slice(0, 5).forEach((e) => console.log(`  - ${e.text}`));
    }

    if (warnings.length > 0) {
      console.log('\nWarnings found:');
      warnings.slice(0, 5).forEach((w) => console.log(`  - ${w.text}`));
    }

    // Take screenshot
    await page.screenshot({ path: 'test-screenshots/test10-console-summary.png', fullPage: true });

    // Verify error count
    expect(errors.length, 'Should have <5 console errors per page').toBeLessThan(5 * testPages.length);

    console.log('✅ Test 10 PASSED: Console error count acceptable');
  });
});
