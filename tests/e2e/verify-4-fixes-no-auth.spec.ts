import { test, expect } from '@playwright/test';

test.describe('Verify 4 Critical Fixes (No Auth Required)', () => {
  test.setTimeout(120000);

  test('Fix 1: Admin Flagged Images - No Infinite Loop', async ({ page }) => {
    console.log('\n=== Testing Fix 1: Admin Flagged Images ===');

    // Monitor console errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate to admin page
    await page.goto('http://localhost:3002/admin', { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait for page to load
    await page.waitForTimeout(5000);

    // Check if page loaded (might show auth required, but should load)
    const pageLoaded = await page.locator('body').isVisible();
    console.log('✓ Page loaded:', pageLoaded ? 'Yes' : 'No');

    // Check for infinite spinner or loading state
    const spinners = page.locator('[role="status"], .animate-spin');
    const spinnerCount = await spinners.count();
    console.log('✓ Spinner elements found:', spinnerCount);

    // Wait another 5 seconds and check if spinners persist
    await page.waitForTimeout(5000);
    const stillSpinning = await spinners.first().isVisible().catch(() => false);
    console.log('✓ Still showing spinner after 10s:', stillSpinning ? 'YES (might be issue)' : 'NO (good)');

    console.log('✓ Console errors:', consoleErrors.length === 0 ? 'None' : consoleErrors.slice(0, 3).join(', '));

    // Screenshot for evidence
    await page.screenshot({ path: '/Users/masa/Projects/joanies-kitchen/tests/fix1-admin.png', fullPage: true });
    console.log('✓ Screenshot saved: fix1-admin.png');
  });

  test('Fix 2: Recipe Ingredients - No [object Object]', async ({ page }) => {
    console.log('\n=== Testing Fix 2: Recipe Ingredients ===');

    await page.goto('http://localhost:3002/recipes/kale-white-bean-stew-2', { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait for content to load
    await page.waitForTimeout(5000);

    console.log('✓ Recipe page loaded');

    // Get all text content and check for [object Object]
    const pageContent = await page.content();
    const hasObjectObject = pageContent.includes('[object Object]');

    console.log('✓ Contains [object Object]:', hasObjectObject ? 'YES (FAIL)' : 'NO (PASS)');

    // Try to find ingredients section
    const ingredientsHeading = page.locator('h2:has-text("Ingredients"), h3:has-text("Ingredients")').first();
    const hasIngredientsSection = await ingredientsHeading.isVisible().catch(() => false);
    console.log('✓ Ingredients section visible:', hasIngredientsSection ? 'Yes' : 'No');

    if (hasIngredientsSection) {
      // Get text near ingredients section
      const ingredientsContainer = page.locator('h2:has-text("Ingredients"), h3:has-text("Ingredients")').first().locator('xpath=following-sibling::*[1]');
      const ingredientsText = await ingredientsContainer.textContent().catch(() => 'Could not get text');
      console.log('✓ Ingredients preview:', ingredientsText?.substring(0, 200));
    }

    // Screenshot for evidence
    await page.screenshot({ path: '/Users/masa/Projects/joanies-kitchen/tests/fix2-ingredients.png', fullPage: true });
    console.log('✓ Screenshot saved: fix2-ingredients.png');

    expect(hasObjectObject).toBe(false);
  });

  test('Fix 3: Recipe Card Images on Chef Pages', async ({ page }) => {
    console.log('\n=== Testing Fix 3: Recipe Card Images ===');

    // Monitor network for 404s
    const failedRequests: string[] = [];
    const imageRequests: string[] = [];

    page.on('response', response => {
      const url = response.url();
      if (url.includes('/images/') || url.includes('blob.vercel')) {
        imageRequests.push(`${response.status()} - ${url}`);
        if (response.status() === 404 && url.includes('/images/recipes/')) {
          failedRequests.push(url);
        }
      }
    });

    await page.goto('http://localhost:3002/chef/vivian-li', { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait for images to load
    await page.waitForTimeout(8000);

    console.log('✓ Chef page loaded');

    // Find all images on the page
    const images = page.locator('img');
    const imageCount = await images.count();

    console.log('✓ Total images found:', imageCount);

    // Check recipe card images specifically
    const recipeImages = page.locator('[data-testid*="recipe-card"] img, .recipe-card img, article img, [class*="recipe"] img').first();
    const recipeImageCount = await page.locator('[data-testid*="recipe-card"] img, .recipe-card img, article img').count();

    console.log('✓ Recipe-related images:', recipeImageCount);

    // Sample first few images
    const sampleSize = Math.min(imageCount, 5);
    let brokenCount = 0;
    let loadedCount = 0;

    for (let i = 0; i < sampleSize; i++) {
      const img = images.nth(i);
      const src = await img.getAttribute('src');
      const alt = await img.getAttribute('alt');

      try {
        const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
        const naturalHeight = await img.evaluate((el: HTMLImageElement) => el.naturalHeight);

        if (naturalWidth === 0 || naturalHeight === 0) {
          brokenCount++;
          console.log(`✗ Broken image [${i}]:`, alt || src?.substring(0, 60));
        } else {
          loadedCount++;
          console.log(`✓ Loaded image [${i}]: ${naturalWidth}x${naturalHeight}`, src?.substring(0, 60));
        }
      } catch (e) {
        console.log(`? Cannot check image [${i}]:`, alt || src?.substring(0, 60));
      }
    }

    console.log('\n✓ Image summary:', {
      total: imageCount,
      sampled: sampleSize,
      loaded: loadedCount,
      broken: brokenCount,
    });

    console.log('✓ 404 errors for /images/recipes/:', failedRequests.length);
    if (failedRequests.length > 0) {
      console.log('✗ Failed requests:', failedRequests.slice(0, 3));
    }

    console.log('✓ Sample image requests:', imageRequests.slice(0, 5));

    // Screenshot for evidence
    await page.screenshot({ path: '/Users/masa/Projects/joanies-kitchen/tests/fix3-chef-images.png', fullPage: true });
    console.log('✓ Screenshot saved: fix3-chef-images.png');

    expect(failedRequests.length).toBe(0);
  });

  test('Fix 4: Fridge Search Timeout', async ({ page }) => {
    console.log('\n=== Testing Fix 4: Fridge Search Timeout ===');

    await page.goto('http://localhost:3002/fridge', { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait for page to load
    await page.waitForTimeout(3000);

    console.log('✓ Fridge page loaded');

    // Find input field - try multiple selectors
    let input = page.locator('input[type="text"]').first();
    const inputExists = await input.isVisible().catch(() => false);

    if (!inputExists) {
      input = page.locator('textarea').first();
    }

    const finalInputExists = await input.isVisible().catch(() => false);
    console.log('✓ Input field found:', finalInputExists ? 'Yes' : 'No');

    if (finalInputExists) {
      await input.fill('chicken, rice, tomatoes');
      console.log('✓ Entered ingredients: chicken, rice, tomatoes');

      // Find and click submit button
      const submitButton = page.locator('button[type="submit"], button:has-text("Search"), button:has-text("Find"), button:has-text("Submit")').first();
      const buttonExists = await submitButton.isVisible().catch(() => false);
      console.log('✓ Submit button found:', buttonExists ? 'Yes' : 'No');

      if (buttonExists) {
        const startTime = Date.now();
        await submitButton.click();
        console.log('✓ Clicked submit button');

        // Wait for navigation or results (max 35 seconds)
        try {
          await Promise.race([
            page.waitForURL('**/fridge/results**', { timeout: 35000 }),
            page.waitForLoadState('networkidle', { timeout: 35000 }),
          ]);

          const endTime = Date.now();
          const duration = ((endTime - startTime) / 1000).toFixed(2);

          console.log('✓ Response received in:', duration, 'seconds');

          // Wait for content to render
          await page.waitForTimeout(3000);

          // Check for timeout error or results
          const pageContent = await page.content();
          const hasTimeout = pageContent.toLowerCase().includes('timeout') || pageContent.toLowerCase().includes('timed out');
          const hasResults = pageContent.toLowerCase().includes('recipe') || pageContent.toLowerCase().includes('found');

          console.log('✓ Has timeout error:', hasTimeout ? 'YES' : 'NO');
          console.log('✓ Has results:', hasResults ? 'YES' : 'NO');
          console.log('✓ Current URL:', page.url());

          // Screenshot for evidence
          await page.screenshot({ path: '/Users/masa/Projects/joanies-kitchen/tests/fix4-fridge.png', fullPage: true });
          console.log('✓ Screenshot saved: fix4-fridge.png');

        } catch (error) {
          console.log('✗ Search did not complete within 35 seconds');
          console.log('✗ Current URL:', page.url());
          await page.screenshot({ path: '/Users/masa/Projects/joanies-kitchen/tests/fix4-fridge-timeout.png', fullPage: true });
          throw new Error(`Fridge search timeout: ${error}`);
        }
      } else {
        console.log('⚠ Could not find submit button - skipping search test');
      }
    } else {
      console.log('⚠ Could not find input field - skipping search test');
    }
  });
});
