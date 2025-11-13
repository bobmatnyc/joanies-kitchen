import { test, expect, type Page } from '@playwright/test';
import { chromium } from '@playwright/test';

/**
 * Manual Inventory Management Testing Suite
 *
 * Comprehensive testing of inventory functionality:
 * - Page access and layout
 * - Autocomplete functionality
 * - CRUD operations
 * - Console and network monitoring
 *
 * Target URL: http://localhost:3005/inventory
 */

// Test configuration
const BASE_URL = 'http://localhost:3005';
const SCREENSHOT_DIR = '/Users/masa/Projects/joanies-kitchen/test-screenshots/inventory';

// Helper to take screenshots with proper naming
async function takeScreenshot(page: Page, name: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/${timestamp}_${name}.png`,
    fullPage: true
  });
}

// Helper to wait with logging
async function waitAndLog(page: Page, message: string, ms: number = 1000) {
  console.log(`⏳ ${message}`);
  await page.waitForTimeout(ms);
}

// Setup: Create screenshot directory
test.beforeAll(async () => {
  const fs = require('fs');
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
});

test.describe('Inventory Management Manual Testing', () => {
  let consoleMessages: string[] = [];
  let networkRequests: Array<{ url: string; status: number; method: string }> = [];

  test.beforeEach(async ({ page }) => {
    // Clear arrays
    consoleMessages = [];
    networkRequests = [];

    // Listen to console messages
    page.on('console', (msg) => {
      const text = `[${msg.type().toUpperCase()}] ${msg.text()}`;
      consoleMessages.push(text);
      console.log(`🖥️  Console: ${text}`);
    });

    // Listen to network requests
    page.on('request', (request) => {
      console.log(`📤 Request: ${request.method()} ${request.url()}`);
    });

    page.on('response', async (response) => {
      const url = response.url();
      const status = response.status();
      const method = response.request().method();

      networkRequests.push({ url, status, method });

      const emoji = status >= 200 && status < 300 ? '✅' : '❌';
      console.log(`${emoji} Response: ${method} ${url} - ${status}`);
    });

    // Listen to page errors
    page.on('pageerror', (error) => {
      console.error(`❌ Page Error: ${error.message}`);
      consoleMessages.push(`[ERROR] ${error.message}`);
    });
  });

  test('Test 1: Inventory Page Access & Layout', async ({ page }) => {
    console.log('\n========================================');
    console.log('TEST 1: INVENTORY PAGE ACCESS & LAYOUT');
    console.log('========================================\n');

    // Navigate to inventory page
    console.log('📍 Navigating to /inventory...');
    await page.goto(`${BASE_URL}/inventory`, { waitUntil: 'networkidle' });

    // Check if page loaded (no 404, no blank)
    const title = await page.title();
    console.log(`📄 Page title: ${title}`);

    // Verify no 404
    const content = await page.content();
    expect(content).not.toContain('404');
    expect(content).not.toContain('Not Found');
    console.log('✅ Page loaded successfully (no 404)');

    // Wait for page to be fully loaded
    await waitAndLog(page, 'Waiting for page to settle...', 2000);

    // Check for main page structure
    console.log('\n📋 Checking page structure...');

    // Take initial screenshot
    await takeScreenshot(page, 'test1_initial_layout');
    console.log('📸 Screenshot saved: test1_initial_layout');

    // Try to identify key elements
    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log('\n📝 Page content preview:');
    console.log(bodyText.substring(0, 500) + '...');

    // Look for form elements
    const inputs = await page.locator('input').count();
    const buttons = await page.locator('button').count();
    const selects = await page.locator('select').count();

    console.log(`\n🔍 Elements found:`);
    console.log(`   - Input fields: ${inputs}`);
    console.log(`   - Buttons: ${buttons}`);
    console.log(`   - Select dropdowns: ${selects}`);

    expect(inputs).toBeGreaterThan(0);
    console.log('✅ Form elements detected');

    // Take final screenshot
    await takeScreenshot(page, 'test1_final_layout');
    console.log('📸 Screenshot saved: test1_final_layout');

    console.log('\n✅ TEST 1 COMPLETE\n');
  });

  test('Test 2: Add Inventory Item with Autocomplete', async ({ page }) => {
    console.log('\n========================================');
    console.log('TEST 2: ADD INVENTORY ITEM WITH AUTOCOMPLETE');
    console.log('========================================\n');

    await page.goto(`${BASE_URL}/inventory`, { waitUntil: 'networkidle' });
    await waitAndLog(page, 'Page loaded, waiting for stability...', 2000);

    // Take initial screenshot
    await takeScreenshot(page, 'test2_initial_state');

    // Look for ingredient input field
    console.log('\n🔍 Looking for ingredient input field...');

    // Try multiple selectors to find the ingredient input
    const possibleSelectors = [
      'input[name="ingredient"]',
      'input[placeholder*="ingredient" i]',
      'input[placeholder*="item" i]',
      'input[type="text"]',
      'input[id*="ingredient" i]'
    ];

    let ingredientInput = null;
    for (const selector of possibleSelectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        console.log(`✅ Found input with selector: ${selector}`);
        ingredientInput = page.locator(selector).first();
        break;
      }
    }

    if (!ingredientInput) {
      console.log('⚠️  Could not find ingredient input, trying first text input...');
      ingredientInput = page.locator('input[type="text"]').first();
    }

    // Click and type slowly
    console.log('\n⌨️  Typing "tomato" slowly...');
    await ingredientInput.click();
    await page.waitForTimeout(500);

    // Type character by character
    const searchTerm = 'tomato';
    for (const char of searchTerm) {
      await ingredientInput.type(char);
      await page.waitForTimeout(200);
    }

    console.log(`✅ Typed: ${searchTerm}`);

    // Wait for autocomplete dropdown
    console.log('\n⏳ Waiting for autocomplete dropdown (up to 3 seconds)...');
    await page.waitForTimeout(3000);

    await takeScreenshot(page, 'test2_autocomplete_dropdown');
    console.log('📸 Screenshot saved: test2_autocomplete_dropdown');

    // Look for dropdown/suggestions
    const dropdownSelectors = [
      '[role="listbox"]',
      '[role="menu"]',
      '.autocomplete',
      '[data-testid*="suggestion"]',
      'ul li',
      'div[class*="suggestion"]'
    ];

    let suggestionsFound = false;
    for (const selector of dropdownSelectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        console.log(`✅ Found ${count} suggestions with selector: ${selector}`);
        suggestionsFound = true;

        // Try to click first suggestion
        try {
          await page.locator(selector).first().click();
          console.log('✅ Clicked first suggestion');
          break;
        } catch (e) {
          console.log(`⚠️  Could not click suggestion: ${e}`);
        }
      }
    }

    if (!suggestionsFound) {
      console.log('⚠️  No autocomplete dropdown detected, continuing anyway...');
    }

    await page.waitForTimeout(1000);
    await takeScreenshot(page, 'test2_after_autocomplete');

    // Fill remaining fields
    console.log('\n📝 Filling remaining form fields...');

    // Storage location
    const storageSelect = page.locator('select').first();
    if (await storageSelect.count() > 0) {
      await storageSelect.selectOption({ label: 'Fridge' });
      console.log('✅ Selected storage: Fridge');
    }

    // Quantity
    const quantityInput = page.locator('input[type="number"]').first();
    if (await quantityInput.count() > 0) {
      await quantityInput.fill('3');
      console.log('✅ Entered quantity: 3');
    }

    // Unit
    const unitInputs = page.locator('input[type="text"]');
    if (await unitInputs.count() > 1) {
      await unitInputs.nth(1).fill('pounds');
      console.log('✅ Entered unit: pounds');
    }

    // Expiry date (3 days from now)
    const dateInput = page.locator('input[type="date"]').first();
    if (await dateInput.count() > 0) {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 3);
      const dateString = futureDate.toISOString().split('T')[0];
      await dateInput.fill(dateString);
      console.log(`✅ Set expiry date: ${dateString}`);
    }

    // Notes
    const textareas = page.locator('textarea');
    if (await textareas.count() > 0) {
      await textareas.first().fill("From farmer's market");
      console.log("✅ Entered notes: From farmer's market");
    }

    await page.waitForTimeout(1000);
    await takeScreenshot(page, 'test2_form_filled');
    console.log('📸 Screenshot saved: test2_form_filled');

    // Submit form
    console.log('\n🚀 Submitting form...');
    const submitButton = page.locator('button:has-text("Add"), button:has-text("Submit")').first();

    if (await submitButton.count() > 0) {
      await submitButton.click();
      console.log('✅ Clicked submit button');

      // Wait for response
      await page.waitForTimeout(2000);

      // Look for success toast
      const toastSelectors = [
        '[role="status"]',
        '.toast',
        '[class*="toast"]',
        '[data-testid*="toast"]'
      ];

      for (const selector of toastSelectors) {
        if (await page.locator(selector).count() > 0) {
          const toastText = await page.locator(selector).first().textContent();
          console.log(`✅ Toast notification: ${toastText}`);
          break;
        }
      }
    } else {
      console.log('⚠️  Could not find submit button');
    }

    await page.waitForTimeout(2000);
    await takeScreenshot(page, 'test2_after_submit');
    console.log('📸 Screenshot saved: test2_after_submit');

    console.log('\n✅ TEST 2 COMPLETE\n');
  });

  test('Test 3: Autocomplete for Different Ingredients', async ({ page }) => {
    console.log('\n========================================');
    console.log('TEST 3: AUTOCOMPLETE FOR DIFFERENT INGREDIENTS');
    console.log('========================================\n');

    await page.goto(`${BASE_URL}/inventory`, { waitUntil: 'networkidle' });
    await waitAndLog(page, 'Page loaded...', 1000);

    const testIngredients = ['chicken', 'rice', 'onion'];
    const ingredientInput = page.locator('input[type="text"]').first();

    for (const ingredient of testIngredients) {
      console.log(`\n🔍 Testing autocomplete for: ${ingredient}`);

      await ingredientInput.clear();
      await page.waitForTimeout(500);

      for (const char of ingredient) {
        await ingredientInput.type(char);
        await page.waitForTimeout(150);
      }

      await page.waitForTimeout(2000);
      await takeScreenshot(page, `test3_autocomplete_${ingredient}`);
      console.log(`📸 Screenshot saved: test3_autocomplete_${ingredient}`);

      const dropdownCount = await page.locator('[role="listbox"], [role="menu"], ul li').count();
      console.log(`   Found ${dropdownCount} suggestions`);
    }

    console.log('\n✅ TEST 3 COMPLETE\n');
  });

  test('Test 4: View Inventory List', async ({ page }) => {
    console.log('\n========================================');
    console.log('TEST 4: VIEW INVENTORY LIST');
    console.log('========================================\n');

    await page.goto(`${BASE_URL}/inventory`, { waitUntil: 'networkidle' });
    await waitAndLog(page, 'Page loaded...', 2000);

    console.log('\n🔍 Analyzing inventory list structure...');

    // Look for list items
    const listItems = await page.locator('li, [role="listitem"], .inventory-item, [class*="item"]').count();
    console.log(`   Found ${listItems} potential list items`);

    // Look for storage location groupings
    const headings = await page.locator('h2, h3, h4').all();
    console.log(`\n📋 Section headings found: ${headings.length}`);
    for (const heading of headings) {
      const text = await heading.textContent();
      console.log(`   - ${text}`);
    }

    // Look for filter/sort controls
    const selects = await page.locator('select').all();
    console.log(`\n🎛️  Dropdown controls: ${selects.length}`);
    for (let i = 0; i < selects.length; i++) {
      const label = await selects[i].getAttribute('aria-label') || `Select ${i + 1}`;
      console.log(`   - ${label}`);
    }

    // Look for action buttons
    const buttons = await page.locator('button').all();
    console.log(`\n🔘 Buttons found: ${buttons.length}`);

    await takeScreenshot(page, 'test4_inventory_list');
    console.log('📸 Screenshot saved: test4_inventory_list');

    console.log('\n✅ TEST 4 COMPLETE\n');
  });

  test('Test 10: Console & Network Monitoring Summary', async ({ page }) => {
    console.log('\n========================================');
    console.log('TEST 10: CONSOLE & NETWORK MONITORING');
    console.log('========================================\n');

    await page.goto(`${BASE_URL}/inventory`, { waitUntil: 'networkidle' });

    // Trigger some actions
    await page.waitForTimeout(2000);

    // Try clicking around
    const buttons = await page.locator('button').all();
    if (buttons.length > 0) {
      await buttons[0].click();
      await page.waitForTimeout(1000);
    }

    console.log('\n📊 CONSOLE LOG SUMMARY:');
    console.log(`   Total messages: ${consoleMessages.length}`);

    const errors = consoleMessages.filter(msg => msg.includes('[ERROR]'));
    const warnings = consoleMessages.filter(msg => msg.includes('[WARNING]'));

    console.log(`   Errors: ${errors.length}`);
    console.log(`   Warnings: ${warnings.length}`);

    if (errors.length > 0) {
      console.log('\n❌ ERRORS DETECTED:');
      errors.forEach(err => console.log(`   ${err}`));
    }

    console.log('\n📡 NETWORK REQUEST SUMMARY:');
    console.log(`   Total requests: ${networkRequests.length}`);

    const successRequests = networkRequests.filter(r => r.status >= 200 && r.status < 300);
    const failedRequests = networkRequests.filter(r => r.status >= 400);

    console.log(`   Successful: ${successRequests.length}`);
    console.log(`   Failed: ${failedRequests.length}`);

    if (failedRequests.length > 0) {
      console.log('\n❌ FAILED REQUESTS:');
      failedRequests.forEach(req => {
        console.log(`   ${req.method} ${req.url} - ${req.status}`);
      });
    }

    // API requests
    const apiRequests = networkRequests.filter(r => r.url.includes('/api/'));
    console.log(`\n🔌 API Requests: ${apiRequests.length}`);
    apiRequests.forEach(req => {
      console.log(`   ${req.method} ${req.url} - ${req.status}`);
    });

    console.log('\n✅ TEST 10 COMPLETE\n');
  });
});

test.afterAll(async () => {
  console.log('\n========================================');
  console.log('ALL TESTS COMPLETE');
  console.log('========================================\n');
  console.log('Screenshots saved to:', SCREENSHOT_DIR);
  console.log('\nTo view the report, run: npx playwright show-report');
});
