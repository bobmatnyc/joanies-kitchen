import { type ConsoleMessage, expect, test } from '@playwright/test';

test.describe('FridgeInput Component UAT', () => {
  const BASE_URL = 'http://localhost:3002';
  const consoleMessages: ConsoleMessage[] = [];
  const networkRequests: any[] = [];

  test.beforeEach(async ({ page }) => {
    // Capture console messages
    page.on('console', (msg) => {
      consoleMessages.push(msg);
      console.log(`[${msg.type()}] ${msg.text()}`);
    });

    // Capture network requests
    page.on('request', (request) => {
      networkRequests.push({
        method: request.method(),
        url: request.url(),
        resourceType: request.resourceType(),
      });
    });

    // Capture page errors
    page.on('pageerror', (error) => {
      console.error('[PAGE ERROR]', error.message);
    });
  });

  test('1. Page Load and Component Visibility', async ({ page }) => {
    console.log('\n=== TEST 1: Page Load and Component Visibility ===');

    // Navigate to homepage
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000); // Wait for any dynamic content

    // Take initial screenshot
    await page.screenshot({
      path: 'tests/e2e/uat/screenshots/homepage-initial-load.png',
      fullPage: true,
    });

    // Check if FridgeInput component exists
    const _fridgeInput = page.locator('input[type="text"]').filter({ hasText: '' }).first();
    const _searchInput = page
      .locator(
        'input[placeholder*="ingredient"], input[placeholder*="search"], input[placeholder*="fridge"]'
      )
      .first();

    // Try to find the input field
    const inputField =
      (await page.locator('input[type="text"]').count()) > 0
        ? page.locator('input[type="text"]').first()
        : null;

    if (inputField) {
      const isVisible = await inputField.isVisible();
      const isEnabled = await inputField.isEnabled();
      const placeholder = await inputField.getAttribute('placeholder');

      console.log(`Input field visible: ${isVisible}`);
      console.log(`Input field enabled: ${isEnabled}`);
      console.log(`Input placeholder: ${placeholder}`);

      expect(isVisible).toBe(true);
      expect(isEnabled).toBe(true);
    } else {
      console.log('No input field found on page');
    }

    // Check for any FridgeInput-related elements
    const fridgeElements = await page.locator('[class*="fridge"], [id*="fridge"]').count();
    console.log(`FridgeInput-related elements found: ${fridgeElements}`);
  });

  test('2. Input Field Interaction', async ({ page }) => {
    console.log('\n=== TEST 2: Input Field Interaction ===');

    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Find the search input field
    const searchSelectors = [
      'input[placeholder*="ingredient"]',
      'input[placeholder*="search"]',
      'input[placeholder*="fridge"]',
      'input[type="text"]',
      'input[type="search"]',
    ];

    let inputField = null;
    for (const selector of searchSelectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        inputField = page.locator(selector).first();
        console.log(`Found input field with selector: ${selector}`);
        break;
      }
    }

    if (inputField) {
      // Click on the input field
      await inputField.click();
      await page.waitForTimeout(500);

      // Type "chicken"
      await inputField.fill('chicken');
      await page.waitForTimeout(500);

      // Verify text appears
      const inputValue = await inputField.inputValue();
      console.log(`Input value after typing: ${inputValue}`);
      expect(inputValue).toBe('chicken');

      // Take screenshot
      await page.screenshot({
        path: 'tests/e2e/uat/screenshots/fridge-input-typing.png',
        fullPage: true,
      });

      // Check for console errors
      const errors = consoleMessages.filter((msg) => msg.type() === 'error');
      console.log(`Console errors found: ${errors.length}`);
      errors.forEach((err) => console.error(`Error: ${err.text()}`));
    } else {
      console.log('ERROR: No search input field found on page');
      await page.screenshot({
        path: 'tests/e2e/uat/screenshots/fridge-input-no-field.png',
        fullPage: true,
      });
      throw new Error('Search input field not found');
    }
  });

  test('3. Autocomplete Behavior', async ({ page }) => {
    console.log('\n=== TEST 3: Autocomplete Behavior ===');

    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Clear previous network requests
    networkRequests.length = 0;

    // Find input field
    const inputField = page.locator('input[type="text"]').first();

    if ((await inputField.count()) > 0) {
      // Type "chick" and wait for debounce
      await inputField.click();
      await inputField.fill('chick');
      await page.waitForTimeout(1000); // Wait for debounce + API call

      // Check for autocomplete dropdown
      const dropdownSelectors = [
        '[role="listbox"]',
        '[class*="autocomplete"]',
        '[class*="dropdown"]',
        '[class*="suggestions"]',
        'ul[class*="result"]',
        'div[class*="result"]',
      ];

      let dropdownFound = false;
      for (const selector of dropdownSelectors) {
        const count = await page.locator(selector).count();
        if (count > 0) {
          console.log(`Autocomplete dropdown found with selector: ${selector}`);
          dropdownFound = true;
          break;
        }
      }

      if (!dropdownFound) {
        console.log('No autocomplete dropdown found (may not be implemented)');
      }

      // Check for API requests
      const apiRequests = networkRequests.filter(
        (req) =>
          req.url.includes('api') || req.url.includes('ingredient') || req.url.includes('search')
      );
      console.log(`API requests made: ${apiRequests.length}`);
      apiRequests.forEach((req) => {
        console.log(`  ${req.method} ${req.url}`);
      });

      // Take screenshot
      await page.screenshot({
        path: 'tests/e2e/uat/screenshots/fridge-input-autocomplete.png',
        fullPage: true,
      });
    }
  });

  test('4. Search Execution', async ({ page }) => {
    console.log('\n=== TEST 4: Search Execution ===');

    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const inputField = page.locator('input[type="text"]').first();

    if ((await inputField.count()) > 0) {
      // Type search term
      await inputField.click();
      await inputField.fill('chicken');
      await page.waitForTimeout(500);

      // Look for search button
      const buttonSelectors = [
        'button[type="submit"]',
        'button:has-text("Search")',
        'button:has-text("Find")',
        'button[class*="search"]',
        'button[aria-label*="search"]',
      ];

      let searchButton = null;
      for (const selector of buttonSelectors) {
        const count = await page.locator(selector).count();
        if (count > 0) {
          searchButton = page.locator(selector).first();
          console.log(`Found search button with selector: ${selector}`);
          break;
        }
      }

      // Try to submit search
      const urlBefore = page.url();
      console.log(`URL before search: ${urlBefore}`);

      if (searchButton) {
        await searchButton.click();
        await page.waitForTimeout(1500);
      } else {
        // Try pressing Enter
        console.log('No search button found, trying Enter key');
        await inputField.press('Enter');
        await page.waitForTimeout(1500);
      }

      const urlAfter = page.url();
      console.log(`URL after search: ${urlAfter}`);

      // Check if URL changed or results appeared
      if (urlBefore !== urlAfter) {
        console.log('✓ Navigation occurred after search');
      } else {
        console.log('No navigation - checking for dynamic results');
        const resultsSelectors = [
          '[class*="result"]',
          '[class*="recipe"]',
          '[data-testid*="result"]',
          'article',
          'li',
        ];

        for (const selector of resultsSelectors) {
          const count = await page.locator(selector).count();
          if (count > 0) {
            console.log(`Found ${count} potential result elements with selector: ${selector}`);
          }
        }
      }

      // Take screenshot
      await page.screenshot({
        path: 'tests/e2e/uat/screenshots/fridge-input-search.png',
        fullPage: true,
      });

      // Check for error messages
      const errorSelectors = [
        '[role="alert"]',
        '[class*="error"]',
        'text=/error/i',
        'text=/failed/i',
      ];

      for (const selector of errorSelectors) {
        const count = await page.locator(selector).count();
        if (count > 0) {
          const errorText = await page.locator(selector).first().textContent();
          console.log(`Error message found: ${errorText}`);
        }
      }
    }
  });

  test('5. Console and Error Detection', async ({ page }) => {
    console.log('\n=== TEST 5: Console and Error Detection ===');

    // Clear console messages
    consoleMessages.length = 0;

    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Interact with the page
    const inputField = page.locator('input[type="text"]').first();
    if ((await inputField.count()) > 0) {
      await inputField.click();
      await inputField.fill('test');
      await page.waitForTimeout(500);
      await inputField.press('Enter');
      await page.waitForTimeout(1000);
    }

    // Analyze console messages
    console.log('\n=== Console Message Summary ===');
    const messagesByType = {
      log: consoleMessages.filter((m) => m.type() === 'log'),
      error: consoleMessages.filter((m) => m.type() === 'error'),
      warning: consoleMessages.filter((m) => m.type() === 'warning'),
      info: consoleMessages.filter((m) => m.type() === 'info'),
    };

    console.log(`Total messages: ${consoleMessages.length}`);
    console.log(`Errors: ${messagesByType.error.length}`);
    console.log(`Warnings: ${messagesByType.warning.length}`);
    console.log(`Info: ${messagesByType.info.length}`);
    console.log(`Log: ${messagesByType.log.length}`);

    if (messagesByType.error.length > 0) {
      console.log('\n=== ERROR MESSAGES ===');
      messagesByType.error.forEach((msg, i) => {
        console.log(`${i + 1}. ${msg.text()}`);
      });
    }

    if (messagesByType.warning.length > 0) {
      console.log('\n=== WARNING MESSAGES ===');
      messagesByType.warning.forEach((msg, i) => {
        console.log(`${i + 1}. ${msg.text()}`);
      });
    }

    // Network requests summary
    console.log('\n=== Network Requests Summary ===');
    console.log(`Total requests: ${networkRequests.length}`);

    const requestsByType = networkRequests.reduce((acc: any, req) => {
      acc[req.resourceType] = (acc[req.resourceType] || 0) + 1;
      return acc;
    }, {});

    console.log('Requests by type:', requestsByType);

    // XHR/Fetch requests
    const xhrRequests = networkRequests.filter(
      (req) => req.resourceType === 'xhr' || req.resourceType === 'fetch'
    );
    console.log('\n=== XHR/Fetch Requests ===');
    xhrRequests.forEach((req, i) => {
      console.log(`${i + 1}. ${req.method} ${req.url}`);
    });
  });

  test.afterAll(async () => {
    console.log('\n=== TEST SUITE COMPLETE ===');
    console.log('Screenshots saved to: tests/e2e/uat/screenshots/');
  });
});
