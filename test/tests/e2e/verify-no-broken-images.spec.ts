import { expect, type Page, test } from '@playwright/test';

interface ImageCheckResult {
  url: string;
  status: number;
  naturalWidth: number;
  naturalHeight: number;
  isSvgPlaceholder: boolean;
  isDataUri: boolean;
  error?: string;
}

interface PageImageReport {
  pageUrl: string;
  totalImages: number;
  brokenImages: ImageCheckResult[];
  placeholderImages: number;
  successfulImages: number;
  failedRequests: string[];
}

/**
 * Check if an image element is properly loaded or is an acceptable placeholder
 */
async function checkImageStatus(page: Page, img: any): Promise<ImageCheckResult> {
  const result = await img.evaluate((element: HTMLImageElement) => {
    const src = element.src || element.currentSrc || '';
    const naturalWidth = element.naturalWidth;
    const naturalHeight = element.naturalHeight;

    // Check if it's an SVG placeholder (data URI or inline SVG)
    const isSvgPlaceholder = src.startsWith('data:image/svg+xml');
    const isDataUri = src.startsWith('data:');

    return {
      url: src,
      naturalWidth,
      naturalHeight,
      isSvgPlaceholder,
      isDataUri,
      complete: element.complete,
      currentSrc: element.currentSrc,
    };
  });

  return {
    url: result.url,
    status: 0, // Will be filled from network monitoring
    naturalWidth: result.naturalWidth,
    naturalHeight: result.naturalHeight,
    isSvgPlaceholder: result.isSvgPlaceholder,
    isDataUri: result.isDataUri,
  };
}

/**
 * Monitor network requests and track failed image loads
 */
function setupNetworkMonitoring(page: Page): { get404s: () => string[] } {
  const failed404s: string[] = [];

  page.on('response', async (response) => {
    const url = response.url();
    const status = response.status();
    const contentType = response.headers()['content-type'] || '';

    // Check if this is an image request that failed
    if (contentType.includes('image/') || url.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)$/i)) {
      if (status === 404) {
        failed404s.push(url);
        console.error(`❌ 404 Image Error: ${url}`);
      } else if (status >= 400) {
        failed404s.push(url);
        console.error(`❌ ${status} Image Error: ${url}`);
      }
    }
  });

  return {
    get404s: () => [...failed404s],
  };
}

/**
 * Check all images on a page and generate a report
 */
async function checkPageImages(page: Page, pageUrl: string): Promise<PageImageReport> {
  console.log(`\n🔍 Checking images on: ${pageUrl}`);

  // Set up network monitoring BEFORE navigation
  const networkMonitor = setupNetworkMonitoring(page);

  // Navigate to the page
  await page.goto(pageUrl, { waitUntil: 'networkidle' });

  // Wait a bit for lazy-loaded images
  await page.waitForTimeout(2000);

  // Find all image elements
  const images = await page.locator('img').all();
  console.log(`   Found ${images.length} image elements`);

  const brokenImages: ImageCheckResult[] = [];
  let placeholderCount = 0;
  let successfulCount = 0;

  // Check each image
  for (const img of images) {
    const result = await checkImageStatus(page, img);

    // Categorize the image
    if (result.isSvgPlaceholder || result.isDataUri) {
      placeholderCount++;
      console.log(`   ✓ Placeholder: ${result.url.substring(0, 50)}...`);
    } else if (result.naturalWidth > 0 && result.naturalHeight > 0) {
      successfulCount++;
      console.log(`   ✓ Loaded: ${result.url}`);
    } else {
      // Image might be broken
      brokenImages.push({
        ...result,
        error: 'Failed to load or has 0 dimensions',
      });
      console.log(`   ⚠️  Suspicious: ${result.url}`);
    }
  }

  const failed404s = networkMonitor.get404s();

  return {
    pageUrl,
    totalImages: images.length,
    brokenImages,
    placeholderImages: placeholderCount,
    successfulImages: successfulCount,
    failedRequests: failed404s,
  };
}

test.describe('Image Verification - No Broken Images (404s)', () => {
  test.setTimeout(120000); // 2 minutes for all checks

  const allReports: PageImageReport[] = [];

  test('1. Check Recipes Page (/recipes)', async ({ page }) => {
    const report = await checkPageImages(page, 'http://localhost:3005/recipes');
    allReports.push(report);

    console.log(`\n📊 Recipes Page Summary:`);
    console.log(`   Total Images: ${report.totalImages}`);
    console.log(`   Successful: ${report.successfulImages}`);
    console.log(`   Placeholders: ${report.placeholderImages}`);
    console.log(`   Suspicious: ${report.brokenImages.length}`);
    console.log(`   404 Errors: ${report.failedRequests.length}`);

    // Assert no 404 errors
    expect(
      report.failedRequests.length,
      `Found ${report.failedRequests.length} 404 image errors on /recipes: ${report.failedRequests.join(', ')}`
    ).toBe(0);
  });

  test('2. Check Recipe Detail Page', async ({ page }) => {
    // First, get a recipe ID from the recipes page
    await page.goto('http://localhost:3005/recipes', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const recipeLinks = await page.locator('a[href^="/recipes/"]').all();

    if (recipeLinks.length > 0) {
      const firstRecipeHref = await recipeLinks[0].getAttribute('href');
      const recipeUrl = `http://localhost:3005${firstRecipeHref}`;

      const report = await checkPageImages(page, recipeUrl);
      allReports.push(report);

      console.log(`\n📊 Recipe Detail Page Summary:`);
      console.log(`   Total Images: ${report.totalImages}`);
      console.log(`   Successful: ${report.successfulImages}`);
      console.log(`   Placeholders: ${report.placeholderImages}`);
      console.log(`   Suspicious: ${report.brokenImages.length}`);
      console.log(`   404 Errors: ${report.failedRequests.length}`);

      expect(
        report.failedRequests.length,
        `Found ${report.failedRequests.length} 404 image errors on recipe detail: ${report.failedRequests.join(', ')}`
      ).toBe(0);
    } else {
      console.log('   ⚠️  No recipe links found, skipping detail page test');
    }
  });

  test('3. Check Meals Page (/meals)', async ({ page }) => {
    const report = await checkPageImages(page, 'http://localhost:3005/meals');
    allReports.push(report);

    console.log(`\n📊 Meals Page Summary:`);
    console.log(`   Total Images: ${report.totalImages}`);
    console.log(`   Successful: ${report.successfulImages}`);
    console.log(`   Placeholders: ${report.placeholderImages}`);
    console.log(`   Suspicious: ${report.brokenImages.length}`);
    console.log(`   404 Errors: ${report.failedRequests.length}`);

    expect(
      report.failedRequests.length,
      `Found ${report.failedRequests.length} 404 image errors on /meals: ${report.failedRequests.join(', ')}`
    ).toBe(0);
  });

  test('4. Check Chefs Page (/discover/chefs)', async ({ page }) => {
    const report = await checkPageImages(page, 'http://localhost:3005/discover/chefs');
    allReports.push(report);

    console.log(`\n📊 Chefs Page Summary:`);
    console.log(`   Total Images: ${report.totalImages}`);
    console.log(`   Successful: ${report.successfulImages}`);
    console.log(`   Placeholders: ${report.placeholderImages}`);
    console.log(`   Suspicious: ${report.brokenImages.length}`);
    console.log(`   404 Errors: ${report.failedRequests.length}`);

    expect(
      report.failedRequests.length,
      `Found ${report.failedRequests.length} 404 image errors on /discover/chefs: ${report.failedRequests.join(', ')}`
    ).toBe(0);
  });

  test.afterAll(async () => {
    console.log('\n' + '='.repeat(80));
    console.log('📋 FINAL REPORT: IMAGE VERIFICATION');
    console.log('='.repeat(80));

    let totalImages = 0;
    let totalSuccessful = 0;
    let totalPlaceholders = 0;
    let totalBroken = 0;
    let total404s = 0;

    for (const report of allReports) {
      totalImages += report.totalImages;
      totalSuccessful += report.successfulImages;
      totalPlaceholders += report.placeholderImages;
      totalBroken += report.brokenImages.length;
      total404s += report.failedRequests.length;
    }

    console.log('\n📊 Overall Statistics:');
    console.log(`   Pages Tested: ${allReports.length}`);
    console.log(`   Total Images Found: ${totalImages}`);
    console.log(`   ✅ Successfully Loaded: ${totalSuccessful}`);
    console.log(`   🖼️  Placeholder Images: ${totalPlaceholders}`);
    console.log(`   ⚠️  Suspicious Images: ${totalBroken}`);
    console.log(`   ❌ 404 Errors: ${total404s}`);

    console.log('\n📄 Detailed Results by Page:');
    for (const report of allReports) {
      console.log(`\n   ${report.pageUrl}`);
      console.log(
        `      Total: ${report.totalImages} | Success: ${report.successfulImages} | Placeholders: ${report.placeholderImages}`
      );

      if (report.failedRequests.length > 0) {
        console.log(`      ❌ 404 Errors Found:`);
        for (const url of report.failedRequests) {
          console.log(`         - ${url}`);
        }
      }

      if (report.brokenImages.length > 0) {
        console.log(`      ⚠️  Suspicious Images:`);
        for (const img of report.brokenImages) {
          console.log(`         - ${img.url} (${img.naturalWidth}x${img.naturalHeight})`);
        }
      }
    }

    console.log('\n' + '='.repeat(80));

    if (total404s === 0) {
      console.log('✅ SUCCESS: No broken images (404 errors) found!');
    } else {
      console.log(`❌ FAILURE: Found ${total404s} broken images with 404 errors`);
    }

    console.log('='.repeat(80) + '\n');
  });
});
