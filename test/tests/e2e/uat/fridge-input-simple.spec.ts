import { type ConsoleMessage, test } from '@playwright/test';

const consoleMessages: ConsoleMessage[] = [];
const networkRequests: any[] = [];

test.describe('FridgeInput Component UAT - No Auth', () => {
  const BASE_URL = 'http://localhost:3002';

  test.beforeEach(async ({ page }) => {
    // Clear arrays
    consoleMessages.length = 0;
    networkRequests.length = 0;

    // Capture console messages
    page.on('console', (msg) => {
      consoleMessages.push(msg);
      console.log(`[${msg.type().toUpperCase()}] ${msg.text()}`);
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

    // Capture request failures
    page.on('requestfailed', (request) => {
      console.error(`[REQUEST FAILED] ${request.method()} ${request.url()}`);
    });
  });

  test('1. Page Load and Component Visibility', async ({ page }) => {
    console.log('\n=== TEST 1: Page Load and Component Visibility ===');

    // Navigate to homepage
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000); // Wait for any dynamic content

    // Take initial screenshot
    await page.screenshot({
      path: 'tests/e2e/uat/screenshots/homepage-initial-load.png',
      fullPage: true,
    });

    // Get page HTML to inspect
    const bodyHTML = await page.locator('body').innerHTML();
    console.log(`Page loaded, body length: ${bodyHTML.length} chars`);

    // Check for input fields
    const allInputs = await page.locator('input').count();
    console.log(`Total input fields found: ${allInputs}`);

    // Try to find search/fridge input
    const inputTypes = await page.locator('input').evaluateAll((inputs) => {
      return inputs.map((input) => ({
        type: input.getAttribute('type'),
        placeholder: input.getAttribute('placeholder'),
        name: input.getAttribute('name'),
        id: input.getAttribute('id'),
        visible: input instanceof HTMLElement ? input.offsetParent !== null : false,
      }));
    });

    console.log('Input fields on page:');
    inputTypes.forEach((input, i) => {
      console.log(
        `  ${i + 1}. Type: ${input.type}, Placeholder: "${input.placeholder}", ID: ${input.id}, Visible: ${input.visible}`
      );
    });

    // Look for FridgeInput-related elements
    const fridgeKeywords = ['fridge', 'ingredient', 'search'];
    for (const keyword of fridgeKeywords) {
      const elements = await page
        .locator(`[class*="${keyword}"], [id*="${keyword}"], input[placeholder*="${keyword}" i]`)
        .count();
      if (elements > 0) {
        console.log(`Found ${elements} elements with keyword "${keyword}"`);
      }
    }
  });

  test('2. Input Field Interaction', async ({ page }) => {
    console.log('\n=== TEST 2: Input Field Interaction ===');

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Find all text inputs
    const textInputs = page.locator('input[type="text"], input[type="search"], input:not([type])');
    const inputCount = await textInputs.count();
    console.log(`Found ${inputCount} potential text input fields`);

    if (inputCount > 0) {
      // Try the first visible input
      const firstInput = textInputs.first();
      const isVisible = await firstInput.isVisible().catch(() => false);

      if (isVisible) {
        console.log('Testing first visible input field...');

        // Get placeholder before interaction
        const placeholder = await firstInput.getAttribute('placeholder');
        console.log(`Input placeholder: "${placeholder}"`);

        // Click and type
        await firstInput.click();
        await page.waitForTimeout(500);

        console.log('Typing "chicken"...');
        await firstInput.fill('chicken');
        await page.waitForTimeout(1000);

        // Verify text appears
        const inputValue = await firstInput.inputValue();
        console.log(`✓ Input value after typing: "${inputValue}"`);

        if (inputValue === 'chicken') {
          console.log('✓ SUCCESS: Text appears correctly in input field');
        } else {
          console.log(`✗ FAIL: Expected "chicken", got "${inputValue}"`);
        }

        // Take screenshot
        await page.screenshot({
          path: 'tests/e2e/uat/screenshots/fridge-input-typing.png',
          fullPage: true,
        });

        // Check for console errors during typing
        const errors = consoleMessages.filter((msg) => msg.type() === 'error');
        console.log(`Console errors during typing: ${errors.length}`);
        if (errors.length > 0) {
          console.log('Errors:');
          errors.forEach((err, i) => console.log(`  ${i + 1}. ${err.text()}`));
        }
      } else {
        console.log('✗ First input not visible');
        await page.screenshot({
          path: 'tests/e2e/uat/screenshots/fridge-input-no-visible-field.png',
          fullPage: true,
        });
      }
    } else {
      console.log('✗ ERROR: No text input fields found on page');
      await page.screenshot({
        path: 'tests/e2e/uat/screenshots/fridge-input-no-field.png',
        fullPage: true,
      });
    }
  });

  test('3. Autocomplete Behavior', async ({ page }) => {
    console.log('\n=== TEST 3: Autocomplete Behavior ===');

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const textInputs = page.locator('input[type="text"], input[type="search"], input:not([type])');
    const inputCount = await textInputs.count();

    if (inputCount > 0) {
      const firstInput = textInputs.first();
      const isVisible = await firstInput.isVisible().catch(() => false);

      if (isVisible) {
        // Clear network requests
        networkRequests.length = 0;

        // Type partial word
        await firstInput.click();
        await firstInput.fill('chick');
        console.log('Typed "chick", waiting 1.5 seconds for autocomplete...');
        await page.waitForTimeout(1500);

        // Check for autocomplete UI
        const dropdownSelectors = [
          '[role="listbox"]',
          '[role="menu"]',
          '[class*="autocomplete"]',
          '[class*="dropdown"]',
          '[class*="suggestions"]',
          '[class*="results"]',
          'ul[class*="list"]',
          'div[class*="options"]',
        ];

        let dropdownFound = false;
        for (const selector of dropdownSelectors) {
          const count = await page.locator(selector).count();
          if (count > 0) {
            const isVisible = await page.locator(selector).first().isVisible();
            if (isVisible) {
              console.log(`✓ Autocomplete dropdown found: ${selector}`);
              dropdownFound = true;

              // Get dropdown content
              const text = await page.locator(selector).first().textContent();
              console.log(`Dropdown content preview: ${text?.substring(0, 100)}`);
              break;
            }
          }
        }

        if (!dropdownFound) {
          console.log('✗ No autocomplete dropdown visible (may not be implemented)');
        }

        // Check for API requests
        const apiRequests = networkRequests.filter(
          (req) =>
            req.url.includes('/api') ||
            req.url.includes('ingredient') ||
            req.url.includes('search') ||
            req.url.includes('autocomplete')
        );

        console.log(`API/Search requests made: ${apiRequests.length}`);
        if (apiRequests.length > 0) {
          console.log('API requests:');
          apiRequests.forEach((req, i) => {
            console.log(`  ${i + 1}. ${req.method} ${req.url}`);
          });
        }

        // Take screenshot
        await page.screenshot({
          path: 'tests/e2e/uat/screenshots/fridge-input-autocomplete.png',
          fullPage: true,
        });
      }
    }
  });

  test('4. Search Execution', async ({ page }) => {
    console.log('\n=== TEST 4: Search Execution ===');

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const textInputs = page.locator('input[type="text"], input[type="search"], input:not([type])');
    const inputCount = await textInputs.count();

    if (inputCount > 0) {
      const firstInput = textInputs.first();
      const isVisible = await firstInput.isVisible().catch(() => false);

      if (isVisible) {
        // Type search term
        await firstInput.click();
        await firstInput.fill('chicken');
        await page.waitForTimeout(500);
        console.log('Typed "chicken" in search field');

        // Look for search button
        const buttonSelectors = [
          'button[type="submit"]',
          'button:has-text("Search")',
          'button:has-text("Find")',
          'button[aria-label*="search" i]',
          'button[class*="search"]',
          'button:near(input)',
        ];

        let searchButton = null;
        for (const selector of buttonSelectors) {
          const count = await page.locator(selector).count();
          if (count > 0) {
            searchButton = page.locator(selector).first();
            const buttonText = await searchButton.textContent();
            console.log(`Found search button: "${buttonText}" (${selector})`);
            break;
          }
        }

        // Capture URL before search
        const urlBefore = page.url();
        console.log(`URL before search: ${urlBefore}`);

        // Try to submit search
        if (searchButton) {
          console.log('Clicking search button...');
          await searchButton.click();
          await page.waitForTimeout(2000);
        } else {
          console.log('No search button found, trying Enter key...');
          await firstInput.press('Enter');
          await page.waitForTimeout(2000);
        }

        // Check URL after search
        const urlAfter = page.url();
        console.log(`URL after search: ${urlAfter}`);

        if (urlBefore !== urlAfter) {
          console.log('✓ Navigation occurred after search');
        } else {
          console.log('No URL change - checking for dynamic results...');

          // Check for results elements
          const resultsSelectors = [
            '[class*="result"]',
            '[class*="recipe"]',
            '[data-testid*="result"]',
            'article',
            'main li',
          ];

          let resultsFound = false;
          for (const selector of resultsSelectors) {
            const count = await page.locator(selector).count();
            if (count > 0) {
              console.log(`Found ${count} potential result elements: ${selector}`);
              resultsFound = true;
            }
          }

          if (!resultsFound) {
            console.log('✗ No results elements found');
          }
        }

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
            console.log(`⚠️ Error message found: "${errorText}"`);
          }
        }

        // Take screenshot
        await page.screenshot({
          path: 'tests/e2e/uat/screenshots/fridge-input-search.png',
          fullPage: true,
        });
      }
    }
  });

  test('5. Console and Network Analysis', async ({ page }) => {
    console.log('\n=== TEST 5: Console and Network Analysis ===');

    // Clear tracking arrays
    consoleMessages.length = 0;
    networkRequests.length = 0;

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Interact with the page
    const textInputs = page.locator('input[type="text"], input[type="search"], input:not([type])');
    const inputCount = await textInputs.count();

    if (inputCount > 0) {
      const firstInput = textInputs.first();
      const isVisible = await firstInput.isVisible().catch(() => false);

      if (isVisible) {
        await firstInput.click();
        await firstInput.fill('test ingredient');
        await page.waitForTimeout(1000);
        await firstInput.press('Enter');
        await page.waitForTimeout(2000);
      }
    }

    // Analyze console messages
    console.log('\n=== Console Messages Summary ===');
    const messagesByType = {
      log: consoleMessages.filter((m) => m.type() === 'log'),
      error: consoleMessages.filter((m) => m.type() === 'error'),
      warning: consoleMessages.filter((m) => m.type() === 'warning'),
      info: consoleMessages.filter((m) => m.type() === 'info'),
    };

    console.log(`Total console messages: ${consoleMessages.length}`);
    console.log(`  Errors: ${messagesByType.error.length}`);
    console.log(`  Warnings: ${messagesByType.warning.length}`);
    console.log(`  Info: ${messagesByType.info.length}`);
    console.log(`  Log: ${messagesByType.log.length}`);

    if (messagesByType.error.length > 0) {
      console.log('\n❌ ERROR MESSAGES:');
      messagesByType.error.forEach((msg, i) => {
        console.log(`  ${i + 1}. ${msg.text()}`);
      });
    }

    if (messagesByType.warning.length > 0) {
      console.log('\n⚠️ WARNING MESSAGES:');
      messagesByType.warning.slice(0, 5).forEach((msg, i) => {
        console.log(`  ${i + 1}. ${msg.text()}`);
      });
      if (messagesByType.warning.length > 5) {
        console.log(`  ... and ${messagesByType.warning.length - 5} more warnings`);
      }
    }

    // Network requests summary
    console.log('\n=== Network Requests Summary ===');
    console.log(`Total requests: ${networkRequests.length}`);

    const requestsByType = networkRequests.reduce((acc: any, req) => {
      acc[req.resourceType] = (acc[req.resourceType] || 0) + 1;
      return acc;
    }, {});

    console.log('Requests by type:');
    Object.entries(requestsByType).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });

    // XHR/Fetch requests
    const xhrRequests = networkRequests.filter(
      (req) => req.resourceType === 'xhr' || req.resourceType === 'fetch'
    );

    if (xhrRequests.length > 0) {
      console.log('\n=== XHR/Fetch Requests ===');
      xhrRequests.forEach((req, i) => {
        console.log(`  ${i + 1}. ${req.method} ${req.url}`);
      });
    } else {
      console.log('\nNo XHR/Fetch requests detected');
    }
  });
});
