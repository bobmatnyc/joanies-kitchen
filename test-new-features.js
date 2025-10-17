const { chromium } = require('playwright');
const _fs = require('node:fs');
const _path = require('node:path');

async function testRecipeManagerFeatures() {
  console.log('🚀 Starting Recipe Manager Feature Testing...\n');

  // Launch browser with console monitoring
  const browser = await chromium.launch({
    headless: false, // Show browser for visual verification
    slowMo: 1000, // Slow down for better observation
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  // Enable console monitoring
  const consoleMessages = [];
  const errors = [];

  page.on('console', (msg) => {
    const entry = `[${msg.type().toUpperCase()}] ${msg.text()}`;
    consoleMessages.push(entry);
    console.log(`📝 Console: ${entry}`);
  });

  page.on('pageerror', (error) => {
    const errorMsg = `JavaScript Error: ${error.message}`;
    errors.push(errorMsg);
    console.error(`❌ ${errorMsg}`);
  });

  try {
    // Test 1: Navigate to home page
    console.log('🏠 Testing home page...');
    await page.goto('http://localhost:3004');
    await page.waitForLoadState('networkidle');

    // Take screenshot of home page
    await page.screenshot({ path: '/tmp/recipe-manager-home-test.png', fullPage: true });
    console.log('✅ Home page loaded successfully');

    // Test 2: Navigate to Discover page
    console.log('\n🔍 Testing Discover page and web search features...');
    await page.click('a[href="/discover"]');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: '/tmp/recipe-manager-discover-test.png', fullPage: true });

    // Check for tabbed interface
    const generateTab = await page.locator('button[role="tab"]:has-text("Generate Recipe")');
    const searchTab = await page.locator('button[role="tab"]:has-text("Search Web")');

    if ((await generateTab.isVisible()) && (await searchTab.isVisible())) {
      console.log('✅ Tabbed interface found with Generate Recipe and Search Web tabs');

      // Test web search tab
      await searchTab.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: '/tmp/recipe-manager-websearch-tab.png', fullPage: true });
      console.log('✅ Web search tab is accessible');

      // Look for web search form elements
      const searchInput = await page.locator('input[placeholder*="search"]').first();
      const urlInput = await page.locator('input[placeholder*="URL"]').first();

      if ((await searchInput.isVisible()) || (await urlInput.isVisible())) {
        console.log('✅ Web search form elements found');
      } else {
        console.log('⚠️  Web search form elements not clearly visible');
      }
    } else {
      console.log('❌ Tabbed interface not found');
    }

    // Test 3: Navigate to Recipes page (will redirect to sign-in)
    console.log('\n📚 Testing Recipes page (authentication flow)...');
    await page.click('a[href="/recipes"]');
    await page.waitForLoadState('networkidle');

    // Should redirect to sign-in
    if (page.url().includes('/sign-in')) {
      console.log('✅ Authentication redirect working correctly');
      await page.screenshot({ path: '/tmp/recipe-manager-signin.png', fullPage: true });
    } else {
      console.log('⚠️  Expected redirect to sign-in page');
    }

    // Test 4: Check for Import/Export UI elements by examining the page source
    console.log('\n📄 Testing for Markdown Import/Export features...');

    // Go back to discover to look for import functionality
    await page.goto('http://localhost:3004/discover');
    await page.waitForLoadState('networkidle');

    // Look for import-related elements
    const pageContent = await page.content();
    const hasImportFeatures =
      pageContent.includes('import') ||
      pageContent.includes('upload') ||
      pageContent.includes('drag');
    const hasExportFeatures = pageContent.includes('export') || pageContent.includes('download');

    if (hasImportFeatures) {
      console.log('✅ Import-related functionality detected in page');
    } else {
      console.log('⚠️  Import functionality not clearly visible');
    }

    if (hasExportFeatures) {
      console.log('✅ Export-related functionality detected in page');
    } else {
      console.log('⚠️  Export functionality not clearly visible');
    }

    // Test 5: Check responsive design
    console.log('\n📱 Testing responsive design...');

    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/tmp/recipe-manager-mobile.png', fullPage: true });
    console.log('✅ Mobile viewport tested');

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/tmp/recipe-manager-tablet.png', fullPage: true });
    console.log('✅ Tablet viewport tested');

    // Reset to desktop
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(1000);

    // Test 6: Performance and Core Web Vitals
    console.log('\n⚡ Testing performance...');

    const navigationStart = await page.evaluate(() => performance.timing.navigationStart);
    const loadComplete = await page.evaluate(() => performance.timing.loadEventEnd);
    const loadTime = loadComplete - navigationStart;

    console.log(`✅ Page load time: ${loadTime}ms`);

    if (loadTime < 3000) {
      console.log('✅ Good page load performance');
    } else {
      console.log('⚠️  Page load could be optimized');
    }
  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
    errors.push(error.message);
  } finally {
    // Generate test report
    console.log('\n📊 Test Report Summary:');
    console.log('========================');
    console.log(`Total console messages: ${consoleMessages.length}`);
    console.log(`JavaScript errors: ${errors.length}`);

    if (errors.length > 0) {
      console.log('\n❌ Errors found:');
      errors.forEach((error) => console.log(`  - ${error}`));
    } else {
      console.log('\n✅ No JavaScript errors detected');
    }

    console.log('\n📸 Screenshots saved:');
    console.log('  - /tmp/recipe-manager-home-test.png');
    console.log('  - /tmp/recipe-manager-discover-test.png');
    console.log('  - /tmp/recipe-manager-websearch-tab.png');
    console.log('  - /tmp/recipe-manager-signin.png');
    console.log('  - /tmp/recipe-manager-mobile.png');
    console.log('  - /tmp/recipe-manager-tablet.png');

    await browser.close();
    console.log('\n🎉 Testing completed!');
  }
}

// Run the tests
testRecipeManagerFeatures().catch(console.error);
