import { test, expect } from '@playwright/test';

test.describe('Tools Page - Image Verification', () => {
  const BASE_URL = 'http://localhost:3003';
  const EXPECTED_IMAGE_COUNT = 23;
  const BLOB_STORAGE_BASE = 'https://ljqhvy0frzhuigv1.public.blob.vercel-storage.com/tools/';

  test('should display all tool images correctly on desktop', async ({ page }) => {
    // Set viewport to desktop size
    await page.setViewportSize({ width: 1920, height: 1080 });

    const imageErrors: string[] = [];
    const networkErrors: string[] = [];
    const imageLoadStatus: { url: string; status: string; loaded: boolean }[] = [];

    // Listen for failed image requests
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/tools/') && (url.endsWith('.jpg') || url.endsWith('.png') || url.endsWith('.jpeg') || url.endsWith('.webp'))) {
        const status = response.status();
        const isSuccess = status >= 200 && status < 300;

        imageLoadStatus.push({
          url,
          status: `${status}`,
          loaded: isSuccess
        });

        if (!isSuccess) {
          networkErrors.push(`${url} - Status: ${status}`);
        }
      }
    });

    // Listen for console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log('Browser console error:', msg.text());
      }
    });

    // Navigate to tools page
    console.log('Navigating to Tools page...');
    await page.goto(`${BASE_URL}/tools`, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Wait for page to be fully loaded
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000); // Give images time to load

    // Find all image elements on the page
    const images = await page.locator('img').all();
    console.log(`Found ${images.length} total image elements on page`);

    // Check each image
    let toolImageCount = 0;
    let successfullyLoadedCount = 0;
    let brokenImageCount = 0;

    for (const img of images) {
      const src = await img.getAttribute('src');
      const alt = await img.getAttribute('alt');

      if (!src) continue;

      // Check if this is a tool image (from Blob Storage)
      const isToolImage = src.includes('/tools/');

      if (isToolImage) {
        toolImageCount++;

        // Check if image uses Blob Storage URL
        const usesBlobStorage = src.startsWith(BLOB_STORAGE_BASE) || src.includes('vercel-storage.com/tools/');

        // Check if image is actually loaded (natural dimensions > 0)
        const isLoaded = await img.evaluate((el: HTMLImageElement) => {
          return el.complete && el.naturalWidth > 0 && el.naturalHeight > 0;
        });

        if (isLoaded) {
          successfullyLoadedCount++;
          console.log(`✅ Loaded: ${alt || 'unknown'} - ${src.substring(0, 80)}...`);
        } else {
          brokenImageCount++;
          imageErrors.push(`❌ Failed to load: ${alt || 'unknown'} - ${src}`);
          console.log(`❌ Failed to load: ${alt || 'unknown'} - ${src}`);
        }

        // Verify Blob Storage usage
        expect(usesBlobStorage, `Image should use Blob Storage: ${alt}`).toBeTruthy();
      }
    }

    // Take screenshot
    const screenshotPath = 'tests/screenshots/tools-page-desktop.png';
    await page.screenshot({
      path: screenshotPath,
      fullPage: true
    });
    console.log(`Screenshot saved to: ${screenshotPath}`);

    // Print summary
    console.log('\n=== IMAGE VERIFICATION SUMMARY (Desktop) ===');
    console.log(`Total images on page: ${images.length}`);
    console.log(`Tool images found: ${toolImageCount}`);
    console.log(`Successfully loaded: ${successfullyLoadedCount}`);
    console.log(`Broken images: ${brokenImageCount}`);
    console.log(`Expected tool images: ${EXPECTED_IMAGE_COUNT}`);

    if (imageErrors.length > 0) {
      console.log('\n=== IMAGE ERRORS ===');
      imageErrors.forEach(error => console.log(error));
    }

    if (networkErrors.length > 0) {
      console.log('\n=== NETWORK ERRORS ===');
      networkErrors.forEach(error => console.log(error));
    }

    if (imageLoadStatus.length > 0) {
      console.log('\n=== IMAGE LOAD STATUS ===');
      imageLoadStatus.forEach(status => {
        console.log(`${status.loaded ? '✅' : '❌'} ${status.url} - ${status.status}`);
      });
    }

    // Assertions
    expect(toolImageCount, 'Should find expected number of tool images').toBe(EXPECTED_IMAGE_COUNT);
    expect(brokenImageCount, 'Should have no broken images').toBe(0);
    expect(successfullyLoadedCount, 'All tool images should load successfully').toBe(EXPECTED_IMAGE_COUNT);
    expect(networkErrors.length, 'Should have no network errors for images').toBe(0);
  });

  test('should display all tool images correctly on mobile', async ({ page }) => {
    // Set viewport to mobile size
    await page.setViewportSize({ width: 375, height: 667 });

    const imageErrors: string[] = [];
    const networkErrors: string[] = [];

    // Listen for failed image requests
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/tools/') && (url.endsWith('.jpg') || url.endsWith('.png') || url.endsWith('.jpeg') || url.endsWith('.webp'))) {
        const status = response.status();
        if (status < 200 || status >= 300) {
          networkErrors.push(`${url} - Status: ${status}`);
        }
      }
    });

    // Navigate to tools page
    console.log('Navigating to Tools page (mobile)...');
    await page.goto(`${BASE_URL}/tools`, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Wait for page to be fully loaded
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Find all image elements
    const images = await page.locator('img').all();
    console.log(`Found ${images.length} total image elements on mobile`);

    let toolImageCount = 0;
    let successfullyLoadedCount = 0;
    let brokenImageCount = 0;

    for (const img of images) {
      const src = await img.getAttribute('src');
      const alt = await img.getAttribute('alt');

      if (!src) continue;

      const isToolImage = src.includes('/tools/');

      if (isToolImage) {
        toolImageCount++;

        const isLoaded = await img.evaluate((el: HTMLImageElement) => {
          return el.complete && el.naturalWidth > 0 && el.naturalHeight > 0;
        });

        if (isLoaded) {
          successfullyLoadedCount++;
          console.log(`✅ Loaded (mobile): ${alt || 'unknown'}`);
        } else {
          brokenImageCount++;
          imageErrors.push(`❌ Failed to load (mobile): ${alt || 'unknown'} - ${src}`);
        }
      }
    }

    // Take screenshot
    const screenshotPath = 'tests/screenshots/tools-page-mobile.png';
    await page.screenshot({
      path: screenshotPath,
      fullPage: true
    });
    console.log(`Screenshot saved to: ${screenshotPath}`);

    // Print summary
    console.log('\n=== IMAGE VERIFICATION SUMMARY (Mobile) ===');
    console.log(`Tool images found: ${toolImageCount}`);
    console.log(`Successfully loaded: ${successfullyLoadedCount}`);
    console.log(`Broken images: ${brokenImageCount}`);

    if (imageErrors.length > 0) {
      console.log('\n=== IMAGE ERRORS (Mobile) ===');
      imageErrors.forEach(error => console.log(error));
    }

    // Assertions
    expect(brokenImageCount, 'Should have no broken images on mobile').toBe(0);
    expect(successfullyLoadedCount, 'All visible tool images should load on mobile').toBeGreaterThan(0);
    expect(networkErrors.length, 'Should have no network errors on mobile').toBe(0);
  });

  test('should verify specific tool images are present', async ({ page }) => {
    await page.goto(`${BASE_URL}/tools`, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    await page.waitForTimeout(2000);

    // Check for some specific expected tools (adjust based on your actual tools)
    const expectedTools = [
      'Stand Mixer',
      'Food Processor',
      'Blender',
      'Cast Iron Skillet',
      'Chef\'s Knife'
    ];

    for (const toolName of expectedTools) {
      const toolImage = page.locator(`img[alt*="${toolName}" i]`).first();

      if (await toolImage.count() > 0) {
        const src = await toolImage.getAttribute('src');
        console.log(`Found tool: ${toolName} - ${src}`);

        // Verify it uses Blob Storage
        expect(src).toContain('vercel-storage.com/tools/');

        // Verify it's loaded
        const isLoaded = await toolImage.evaluate((el: HTMLImageElement) => {
          return el.complete && el.naturalWidth > 0;
        });
        expect(isLoaded, `${toolName} image should be loaded`).toBeTruthy();
      }
    }
  });
});
