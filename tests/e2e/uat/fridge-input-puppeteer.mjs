#!/usr/bin/env node

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://localhost:3002';
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');

// Ensure screenshots directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

// Tracking arrays
const consoleMessages = [];
const networkRequests = [];
const pageErrors = [];

console.log('\n' + '='.repeat(80));
console.log('FRIDGE INPUT COMPONENT UAT - PUPPETEER');
console.log('='.repeat(80) + '\n');

async function runTests() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Set viewport
  await page.setViewport({ width: 1920, height: 1080 });

  // Capture console messages
  page.on('console', (msg) => {
    const entry = {
      type: msg.type(),
      text: msg.text(),
      timestamp: new Date().toISOString()
    };
    consoleMessages.push(entry);
    console.log(`[CONSOLE ${msg.type().toUpperCase()}] ${msg.text()}`);
  });

  // Capture network requests
  page.on('request', (request) => {
    networkRequests.push({
      method: request.method(),
      url: request.url(),
      resourceType: request.resourceType()
    });
  });

  // Capture page errors
  page.on('pageerror', (error) => {
    pageErrors.push({
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    console.error(`[PAGE ERROR] ${error.message}`);
  });

  page.on('requestfailed', (request) => {
    console.error(`[REQUEST FAILED] ${request.method()} ${request.url()}`);
  });

  try {
    // TEST 1: Page Load and Component Visibility
    await test1PageLoad(page);

    // TEST 2: Input Field Interaction
    await test2InputInteraction(page);

    // TEST 3: Autocomplete Behavior
    await test3Autocomplete(page);

    // TEST 4: Search Execution
    await test4SearchExecution(page);

    // TEST 5: Console and Network Analysis
    await test5Analysis(page);

    // Generate summary report
    generateSummaryReport();

  } catch (error) {
    console.error('\n❌ TEST SUITE ERROR:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
    console.log('\n' + '='.repeat(80));
    console.log('TEST SUITE COMPLETE');
    console.log('='.repeat(80));
  }
}

async function test1PageLoad(page) {
  console.log('\n' + '='.repeat(80));
  console.log('TEST 1: Page Load and Component Visibility');
  console.log('='.repeat(80));

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Take screenshot
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'homepage-initial-load.png'),
    fullPage: true
  });
  console.log('✓ Screenshot saved: homepage-initial-load.png');

  // Get page info
  const bodyLength = await page.evaluate(() => document.body.innerHTML.length);
  console.log(`Page loaded, body length: ${bodyLength} chars`);

  // Count input fields
  const inputCount = await page.$$eval('input', inputs => inputs.length);
  console.log(`Total input fields found: ${inputCount}`);

  // Analyze input fields
  const inputInfo = await page.$$eval('input', inputs => {
    return inputs.map(input => ({
      type: input.getAttribute('type'),
      placeholder: input.getAttribute('placeholder'),
      name: input.getAttribute('name'),
      id: input.getAttribute('id'),
      className: input.getAttribute('class'),
      visible: input.offsetParent !== null
    }));
  });

  console.log('\nInput fields on page:');
  inputInfo.forEach((input, i) => {
    console.log(`  ${i + 1}. Type: ${input.type}, Placeholder: "${input.placeholder}"`);
    console.log(`      ID: ${input.id}, Name: ${input.name}, Visible: ${input.visible}`);
  });

  // Look for FridgeInput-related elements
  const fridgeElements = await page.evaluate(() => {
    const keywords = ['fridge', 'ingredient', 'search'];
    const results = {};

    keywords.forEach(keyword => {
      const selector = `[class*="${keyword}"], [id*="${keyword}"]`;
      results[keyword] = document.querySelectorAll(selector).length;
    });

    return results;
  });

  console.log('\nFridge-related elements:');
  Object.entries(fridgeElements).forEach(([keyword, count]) => {
    if (count > 0) {
      console.log(`  ${keyword}: ${count} elements`);
    }
  });
}

async function test2InputInteraction(page) {
  console.log('\n' + '='.repeat(80));
  console.log('TEST 2: Input Field Interaction');
  console.log('='.repeat(80));

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Clear console messages for this test
  const errorsBefore = consoleMessages.filter(m => m.type === 'error').length;

  // Find text inputs
  const textInputs = await page.$$('input[type="text"], input[type="search"], input:not([type])');
  console.log(`Found ${textInputs.length} potential text input fields`);

  if (textInputs.length > 0) {
    const firstInput = textInputs[0];

    // Check visibility
    const isVisible = await firstInput.evaluate(el => {
      return el.offsetParent !== null && window.getComputedStyle(el).visibility !== 'hidden';
    });

    if (isVisible) {
      console.log('✓ First input is visible');

      // Get placeholder
      const placeholder = await firstInput.evaluate(el => el.getAttribute('placeholder'));
      console.log(`Input placeholder: "${placeholder}"`);

      // Click and type
      await firstInput.click();
      await page.waitForTimeout(500);

      console.log('Typing "chicken"...');
      await firstInput.type('chicken', { delay: 50 });
      await page.waitForTimeout(1000);

      // Verify value
      const value = await firstInput.evaluate(el => el.value);
      console.log(`Input value after typing: "${value}"`);

      if (value === 'chicken') {
        console.log('✅ SUCCESS: Text appears correctly in input field');
      } else {
        console.log(`❌ FAIL: Expected "chicken", got "${value}"`);
      }

      // Take screenshot
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, 'fridge-input-typing.png'),
        fullPage: true
      });
      console.log('✓ Screenshot saved: fridge-input-typing.png');

      // Check for errors
      const errorsAfter = consoleMessages.filter(m => m.type === 'error').length;
      const newErrors = errorsAfter - errorsBefore;
      console.log(`Console errors during typing: ${newErrors}`);

      if (newErrors > 0) {
        console.log('Errors:');
        consoleMessages
          .filter(m => m.type === 'error')
          .slice(-newErrors)
          .forEach((err, i) => console.log(`  ${i + 1}. ${err.text}`));
      }

    } else {
      console.log('❌ First input is not visible');
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, 'fridge-input-no-visible-field.png'),
        fullPage: true
      });
    }
  } else {
    console.log('❌ ERROR: No text input fields found on page');
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'fridge-input-no-field.png'),
      fullPage: true
    });
  }
}

async function test3Autocomplete(page) {
  console.log('\n' + '='.repeat(80));
  console.log('TEST 3: Autocomplete Behavior');
  console.log('='.repeat(80));

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const requestsBefore = networkRequests.length;

  const textInputs = await page.$$('input[type="text"], input[type="search"], input:not([type])');

  if (textInputs.length > 0) {
    const firstInput = textInputs[0];
    const isVisible = await firstInput.evaluate(el => el.offsetParent !== null);

    if (isVisible) {
      await firstInput.click();
      await firstInput.type('chick', { delay: 50 });
      console.log('Typed "chick", waiting 1.5 seconds for autocomplete...');
      await page.waitForTimeout(1500);

      // Check for autocomplete dropdown
      const dropdownSelectors = [
        '[role="listbox"]',
        '[role="menu"]',
        '[class*="autocomplete"]',
        '[class*="dropdown"]',
        '[class*="suggestions"]',
        '[class*="results"]',
        'ul[class*="list"]'
      ];

      let dropdownFound = false;
      for (const selector of dropdownSelectors) {
        const elements = await page.$$(selector);
        if (elements.length > 0) {
          const isVisible = await elements[0].evaluate(el => {
            return el.offsetParent !== null && window.getComputedStyle(el).display !== 'none';
          });

          if (isVisible) {
            const text = await elements[0].evaluate(el => el.textContent);
            console.log(`✓ Autocomplete dropdown found: ${selector}`);
            console.log(`  Content preview: ${text.substring(0, 100)}`);
            dropdownFound = true;
            break;
          }
        }
      }

      if (!dropdownFound) {
        console.log('❌ No autocomplete dropdown visible (may not be implemented)');
      }

      // Check for API requests
      const requestsAfter = networkRequests.length;
      const newRequests = networkRequests.slice(requestsBefore);
      const apiRequests = newRequests.filter(req =>
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
        path: path.join(SCREENSHOTS_DIR, 'fridge-input-autocomplete.png'),
        fullPage: true
      });
      console.log('✓ Screenshot saved: fridge-input-autocomplete.png');
    }
  }
}

async function test4SearchExecution(page) {
  console.log('\n' + '='.repeat(80));
  console.log('TEST 4: Search Execution');
  console.log('='.repeat(80));

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const textInputs = await page.$$('input[type="text"], input[type="search"], input:not([type])');

  if (textInputs.length > 0) {
    const firstInput = textInputs[0];
    const isVisible = await firstInput.evaluate(el => el.offsetParent !== null);

    if (isVisible) {
      await firstInput.click();
      await firstInput.type('chicken', { delay: 50 });
      await page.waitForTimeout(500);
      console.log('Typed "chicken" in search field');

      // Look for search button
      const buttonSelectors = [
        'button[type="submit"]',
        'button[aria-label*="search" i]',
        'button[class*="search"]'
      ];

      let searchButton = null;
      for (const selector of buttonSelectors) {
        const buttons = await page.$$(selector);
        if (buttons.length > 0) {
          searchButton = buttons[0];
          const buttonText = await searchButton.evaluate(el => el.textContent);
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
        console.log('✅ Navigation occurred after search');
      } else {
        console.log('No URL change - checking for dynamic results...');

        const resultsCount = await page.evaluate(() => {
          const selectors = [
            '[class*="result"]',
            '[class*="recipe"]',
            'article',
            'main li'
          ];

          let total = 0;
          selectors.forEach(selector => {
            total += document.querySelectorAll(selector).length;
          });
          return total;
        });

        if (resultsCount > 0) {
          console.log(`Found ${resultsCount} potential result elements`);
        } else {
          console.log('❌ No results elements found');
        }
      }

      // Check for error messages
      const errorMessages = await page.evaluate(() => {
        const selectors = [
          '[role="alert"]',
          '[class*="error"]'
        ];

        const messages = [];
        selectors.forEach(selector => {
          document.querySelectorAll(selector).forEach(el => {
            if (el.textContent.trim()) {
              messages.push(el.textContent.trim());
            }
          });
        });
        return messages;
      });

      if (errorMessages.length > 0) {
        console.log('⚠️ Error messages found:');
        errorMessages.forEach((msg, i) => console.log(`  ${i + 1}. ${msg}`));
      }

      // Take screenshot
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, 'fridge-input-search.png'),
        fullPage: true
      });
      console.log('✓ Screenshot saved: fridge-input-search.png');
    }
  }
}

async function test5Analysis(page) {
  console.log('\n' + '='.repeat(80));
  console.log('TEST 5: Console and Network Analysis');
  console.log('='.repeat(80));

  // This test aggregates findings from all previous tests
  console.log('\n=== Console Messages Summary ===');

  const messagesByType = {
    log: consoleMessages.filter(m => m.type === 'log'),
    error: consoleMessages.filter(m => m.type === 'error'),
    warning: consoleMessages.filter(m => m.type === 'warning'),
    info: consoleMessages.filter(m => m.type === 'info')
  };

  console.log(`Total console messages: ${consoleMessages.length}`);
  console.log(`  Errors: ${messagesByType.error.length}`);
  console.log(`  Warnings: ${messagesByType.warning.length}`);
  console.log(`  Info: ${messagesByType.info.length}`);
  console.log(`  Log: ${messagesByType.log.length}`);

  if (messagesByType.error.length > 0) {
    console.log('\n❌ ERROR MESSAGES:');
    messagesByType.error.forEach((msg, i) => {
      console.log(`  ${i + 1}. ${msg.text}`);
    });
  }

  if (messagesByType.warning.length > 0) {
    console.log('\n⚠️ WARNING MESSAGES (first 5):');
    messagesByType.warning.slice(0, 5).forEach((msg, i) => {
      console.log(`  ${i + 1}. ${msg.text}`);
    });
    if (messagesByType.warning.length > 5) {
      console.log(`  ... and ${messagesByType.warning.length - 5} more warnings`);
    }
  }

  // Page errors
  if (pageErrors.length > 0) {
    console.log('\n❌ PAGE ERRORS:');
    pageErrors.forEach((err, i) => {
      console.log(`  ${i + 1}. ${err.message}`);
    });
  }

  // Network summary
  console.log('\n=== Network Requests Summary ===');
  console.log(`Total requests: ${networkRequests.length}`);

  const requestsByType = networkRequests.reduce((acc, req) => {
    acc[req.resourceType] = (acc[req.resourceType] || 0) + 1;
    return acc;
  }, {});

  console.log('Requests by type:');
  Object.entries(requestsByType).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });

  // XHR/Fetch requests
  const xhrRequests = networkRequests.filter(req =>
    req.resourceType === 'xhr' || req.resourceType === 'fetch'
  );

  if (xhrRequests.length > 0) {
    console.log('\n=== XHR/Fetch Requests ===');
    xhrRequests.forEach((req, i) => {
      console.log(`  ${i + 1}. ${req.method} ${req.url}`);
    });
  } else {
    console.log('\nNo XHR/Fetch requests detected');
  }
}

function generateSummaryReport() {
  console.log('\n' + '='.repeat(80));
  console.log('UAT TEST SUMMARY REPORT');
  console.log('='.repeat(80));

  const report = {
    'Test Date': new Date().toISOString(),
    'URL Tested': BASE_URL,
    'Screenshots Generated': fs.readdirSync(SCREENSHOTS_DIR).length,
    'Console Errors': consoleMessages.filter(m => m.type === 'error').length,
    'Console Warnings': consoleMessages.filter(m => m.type === 'warning').length,
    'Page Errors': pageErrors.length,
    'Total Network Requests': networkRequests.length,
    'API Requests': networkRequests.filter(r => r.url.includes('/api')).length
  };

  console.log('\nKey Metrics:');
  Object.entries(report).forEach(([key, value]) => {
    console.log(`  ${key}: ${value}`);
  });

  console.log('\nScreenshots location:');
  console.log(`  ${SCREENSHOTS_DIR}`);

  console.log('\nScreenshots generated:');
  fs.readdirSync(SCREENSHOTS_DIR).forEach((file, i) => {
    console.log(`  ${i + 1}. ${file}`);
  });

  // Save report to JSON
  const reportPath = path.join(SCREENSHOTS_DIR, 'test-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    ...report,
    consoleMessages,
    pageErrors,
    networkRequests
  }, null, 2));

  console.log(`\n✓ Full test report saved: ${reportPath}`);
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
