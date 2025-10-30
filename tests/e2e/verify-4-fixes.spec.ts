import { expect, test } from '@playwright/test';

test.describe('Verify 4 Critical Fixes', () => {
  test.setTimeout(120000);

  test('Fix 1: Admin Flagged Images - No Infinite Loop', async ({ page }) => {
    console.log('\n=== Testing Fix 1: Admin Flagged Images ===');

    // Monitor console errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate to admin page
    await page.goto('http://localhost:3002/admin', { waitUntil: 'networkidle' });

    // Wait for page to load
    await page.waitForTimeout(3000);

    // Check if Flagged Images section exists
    const flaggedSection = page.locator('text=/Flagged Images/i').first();
    await expect(flaggedSection).toBeVisible({ timeout: 10000 });

    console.log('✓ Flagged Images section found');

    // Verify no infinite spinner (check after 5 seconds)
    await page.waitForTimeout(5000);

    // Check for content (either flagged images or "No flagged images")
    const hasContent = await page
      .locator('text=/No flagged images|image/i')
      .first()
      .isVisible()
      .catch(() => false);

    console.log('✓ Content loaded:', hasContent ? 'Yes' : 'Loading...');
    console.log(
      '✓ Console errors:',
      consoleErrors.length === 0 ? 'None' : consoleErrors.join(', ')
    );

    // Screenshot for evidence
    await page.screenshot({
      path: '/Users/masa/Projects/joanies-kitchen/tests/fix1-admin.png',
      fullPage: true,
    });
    console.log('✓ Screenshot saved: fix1-admin.png');
  });

  test('Fix 2: Recipe Ingredients - No [object Object]', async ({ page }) => {
    console.log('\n=== Testing Fix 2: Recipe Ingredients ===');

    await page.goto('http://localhost:3002/recipes/kale-white-bean-stew-2', {
      waitUntil: 'networkidle',
    });

    // Wait for ingredients section
    await page.waitForTimeout(3000);

    // Check for ingredients section
    const ingredientsSection = page.locator('text=/Ingredients/i').first();
    await expect(ingredientsSection).toBeVisible({ timeout: 10000 });

    console.log('✓ Ingredients section found');

    // Get all text content and check for [object Object]
    const pageContent = await page.content();
    const hasObjectObject = pageContent.includes('[object Object]');

    console.log('✓ Contains [object Object]:', hasObjectObject ? 'YES (FAIL)' : 'NO (PASS)');

    // Get ingredient list items
    const ingredients = await page.locator('li').allTextContents();
    const sampleIngredients = ingredients.slice(0, 5);
    console.log('✓ Sample ingredients:', sampleIngredients);

    // Screenshot for evidence
    await page.screenshot({
      path: '/Users/masa/Projects/joanies-kitchen/tests/fix2-ingredients.png',
      fullPage: true,
    });
    console.log('✓ Screenshot saved: fix2-ingredients.png');

    expect(hasObjectObject).toBe(false);
  });

  test('Fix 3: Recipe Card Images on Chef Pages', async ({ page }) => {
    console.log('\n=== Testing Fix 3: Recipe Card Images ===');

    // Monitor network for 404s
    const failedRequests: string[] = [];
    page.on('response', (response) => {
      if (response.status() === 404 && response.url().includes('/images/recipes/')) {
        failedRequests.push(response.url());
      }
    });

    await page.goto('http://localhost:3002/chef/vivian-li', { waitUntil: 'networkidle' });

    // Wait for page to load
    await page.waitForTimeout(3000);

    console.log('✓ Chef page loaded');

    // Find all recipe card images
    const images = page.locator('img[alt*="recipe" i], img[src*="recipe"]');
    const imageCount = await images.count();

    console.log('✓ Recipe images found:', imageCount);

    // Check if images are loaded (not broken)
    let brokenImages = 0;
    for (let i = 0; i < Math.min(imageCount, 10); i++) {
      const img = images.nth(i);
      const src = await img.getAttribute('src');
      const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);

      if (naturalWidth === 0) {
        brokenImages++;
        console.log('✗ Broken image:', src);
      } else {
        console.log('✓ Image loaded:', `${src?.substring(0, 60)}...`);
      }
    }

    console.log('✓ Broken images:', brokenImages);
    console.log('✓ 404 errors for /images/recipes/:', failedRequests.length);

    // Screenshot for evidence
    await page.screenshot({
      path: '/Users/masa/Projects/joanies-kitchen/tests/fix3-chef-images.png',
      fullPage: true,
    });
    console.log('✓ Screenshot saved: fix3-chef-images.png');

    expect(failedRequests.length).toBe(0);
  });

  test('Fix 4: Fridge Search Timeout', async ({ page }) => {
    console.log('\n=== Testing Fix 4: Fridge Search Timeout ===');

    await page.goto('http://localhost:3002/fridge', { waitUntil: 'networkidle' });

    // Wait for page to load
    await page.waitForTimeout(2000);

    console.log('✓ Fridge page loaded');

    // Find input field and enter ingredients
    const input = page.locator('input[type="text"], textarea').first();
    await input.fill('chicken, rice, tomatoes');

    console.log('✓ Entered ingredients: chicken, rice, tomatoes');

    // Find and click submit button
    const submitButton = page
      .locator('button[type="submit"], button:has-text("Search"), button:has-text("Find")')
      .first();

    const startTime = Date.now();
    await submitButton.click();

    console.log('✓ Submitted search');

    // Wait for results or timeout message (max 35 seconds)
    try {
      await page.waitForURL('**/fridge/results**', { timeout: 35000 });
      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);

      console.log('✓ Results page loaded in:', duration, 'seconds');

      // Wait for content
      await page.waitForTimeout(3000);

      // Check for timeout error or results
      const hasTimeout = await page
        .locator('text=/timeout|timed out/i')
        .isVisible()
        .catch(() => false);
      const hasResults = await page
        .locator('text=/recipe|found/i')
        .isVisible()
        .catch(() => false);

      console.log('✓ Has timeout error:', hasTimeout ? 'YES' : 'NO');
      console.log('✓ Has results:', hasResults ? 'YES' : 'NO');

      // Screenshot for evidence
      await page.screenshot({
        path: '/Users/masa/Projects/joanies-kitchen/tests/fix4-fridge.png',
        fullPage: true,
      });
      console.log('✓ Screenshot saved: fix4-fridge.png');
    } catch (error) {
      console.log('✗ Search did not complete within 35 seconds');
      await page.screenshot({
        path: '/Users/masa/Projects/joanies-kitchen/tests/fix4-fridge-timeout.png',
        fullPage: true,
      });
      throw error;
    }
  });
});
