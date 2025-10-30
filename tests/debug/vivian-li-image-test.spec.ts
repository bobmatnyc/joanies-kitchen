import { expect, test } from '@playwright/test';

test.describe('Vivian Li Chef Page - Recipe Image Verification', () => {
  test('should display recipe images from Vercel Blob Storage', async ({ page }) => {
    // Navigate to Vivian Li chef page
    await page.goto('http://localhost:3002/chef/vivian-li');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Wait for recipe cards to appear
    await page.waitForSelector('.recipe-card', { timeout: 10000 });

    // Get all recipe cards
    const recipeCards = await page.locator('.recipe-card').all();
    console.log(`Found ${recipeCards.length} recipe cards`);

    expect(recipeCards.length).toBeGreaterThan(0);

    // Track image results
    const imageResults: Array<{
      recipeName: string;
      hasImage: boolean;
      imageUrl: string;
      isVercelStorage: boolean;
      status: string;
    }> = [];

    // Check each recipe card
    for (let i = 0; i < recipeCards.length; i++) {
      const card = recipeCards[i];

      // Get recipe name
      const recipeName = (await card.locator('h3').first().textContent()) || `Recipe ${i + 1}`;
      console.log(`\n=== Checking: ${recipeName} ===`);

      // Find the image within this card
      const imageLocator = card.locator('img').first();
      const imageCount = await card.locator('img').count();

      if (imageCount === 0) {
        console.log(`⚠️  No image found for: ${recipeName}`);
        imageResults.push({
          recipeName,
          hasImage: false,
          imageUrl: 'NONE',
          isVercelStorage: false,
          status: 'FAIL - No image',
        });
        continue;
      }

      // Get image src
      const imageSrc = await imageLocator.getAttribute('src');
      console.log(`Image src: ${imageSrc}`);

      // Check if image is from Vercel Blob Storage
      const isVercelStorage =
        imageSrc?.includes('ljqhvy0frzhuigv1.public.blob.vercel-storage.com') || false;
      const hasImage = !!imageSrc && imageSrc !== '';

      // Check if image loaded successfully (not broken)
      const isImageVisible = await imageLocator.isVisible();

      let status = 'PASS';
      if (!hasImage) {
        status = 'FAIL - No src';
      } else if (!isVercelStorage) {
        status = 'WARN - Not Vercel Storage';
      } else if (!isImageVisible) {
        status = 'FAIL - Not visible';
      }

      console.log(`Image visible: ${isImageVisible}`);
      console.log(`Is Vercel Storage: ${isVercelStorage}`);
      console.log(`Status: ${status}`);

      imageResults.push({
        recipeName,
        hasImage,
        imageUrl: imageSrc || 'NONE',
        isVercelStorage,
        status,
      });

      // Verify image displays
      expect(hasImage, `Recipe "${recipeName}" should have an image`).toBe(true);
    }

    // Print summary table
    console.log('\n\n=== IMAGE VERIFICATION SUMMARY ===');
    console.log('| Recipe | Image Displays? | Image URL Source | Status |');
    console.log('|--------|----------------|------------------|--------|');
    imageResults.forEach((result) => {
      const displays = result.hasImage ? 'YES' : 'NO';
      const source = result.isVercelStorage ? 'vercel-storage' : 'other/none';
      console.log(`| ${result.recipeName} | ${displays} | ${source} | ${result.status} |`);
    });

    // Check console for 404 errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Check for network errors
    const failedRequests: Array<{ url: string; status: number }> = [];
    page.on('response', (response) => {
      if (response.status() === 404 && response.url().includes('/images/')) {
        failedRequests.push({
          url: response.url(),
          status: response.status(),
        });
      }
    });

    // Wait a bit to capture any late errors
    await page.waitForTimeout(2000);

    console.log('\n=== CONSOLE ERRORS ===');
    if (consoleErrors.length === 0) {
      console.log('✅ No console errors detected');
    } else {
      console.log('❌ Console errors found:');
      consoleErrors.forEach((err) => console.log(`  - ${err}`));
    }

    console.log('\n=== NETWORK 404 ERRORS ===');
    if (failedRequests.length === 0) {
      console.log('✅ No 404 errors for image requests');
    } else {
      console.log('❌ 404 errors found:');
      failedRequests.forEach((req) => console.log(`  - ${req.url} (${req.status})`));
    }

    // Verify at least some images are from Vercel Storage
    const vercelStorageCount = imageResults.filter((r) => r.isVercelStorage).length;
    console.log(
      `\n✅ ${vercelStorageCount}/${imageResults.length} images from Vercel Blob Storage`
    );

    // Take screenshot for evidence
    await page.screenshot({
      path: '/tmp/vivian-li-chef-page.png',
      fullPage: true,
    });
    console.log('\n📸 Screenshot saved to: /tmp/vivian-li-chef-page.png');
  });

  test('should not have 404 errors for local image paths', async ({ page }) => {
    const failedRequests: Array<{ url: string; status: number }> = [];

    page.on('response', (response) => {
      if (response.status() === 404 && response.url().includes('/images/recipes/')) {
        failedRequests.push({
          url: response.url(),
          status: response.status(),
        });
      }
    });

    await page.goto('http://localhost:3002/chef/vivian-li');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    console.log('\n=== 404 CHECK RESULTS ===');
    if (failedRequests.length === 0) {
      console.log('✅ No 404 errors for /images/recipes/ paths');
    } else {
      console.log('❌ Found 404 errors:');
      failedRequests.forEach((req) => {
        console.log(`  - ${req.url}`);
      });
    }

    expect(failedRequests.length, 'Should have no 404 errors for local image paths').toBe(0);
  });

  test('should check network requests for Vercel Blob Storage', async ({ page }) => {
    const imageRequests: Array<{ url: string; status: number }> = [];

    page.on('response', async (response) => {
      if (response.url().includes('ljqhvy0frzhuigv1.public.blob.vercel-storage.com')) {
        imageRequests.push({
          url: response.url(),
          status: response.status(),
        });
      }
    });

    await page.goto('http://localhost:3002/chef/vivian-li');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    console.log('\n=== VERCEL BLOB STORAGE REQUESTS ===');
    if (imageRequests.length === 0) {
      console.log('⚠️  No requests to Vercel Blob Storage detected');
    } else {
      console.log(`✅ Found ${imageRequests.length} Vercel Blob Storage requests:`);
      imageRequests.forEach((req) => {
        console.log(`  - ${req.url.substring(0, 80)}... (${req.status})`);
      });
    }

    // All Vercel Storage requests should be 200 OK
    const failed = imageRequests.filter((req) => req.status !== 200);
    if (failed.length > 0) {
      console.log('\n❌ Failed Vercel Storage requests:');
      failed.forEach((req) => console.log(`  - ${req.url} (${req.status})`));
    }

    expect(imageRequests.length, 'Should have at least one Vercel Storage request').toBeGreaterThan(
      0
    );
    expect(failed.length, 'All Vercel Storage requests should return 200').toBe(0);
  });
});
