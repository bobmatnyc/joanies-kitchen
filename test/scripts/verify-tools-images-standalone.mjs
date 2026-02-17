#!/usr/bin/env node

/**
 * Standalone Tool Images Verification Script
 *
 * Verifies that all 23 tool images display correctly after database migration
 * Tests: http://localhost:3003/tools
 */

import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3003';
const EXPECTED_IMAGE_COUNT = 23;
const BLOB_STORAGE_BASE = 'https://ljqhvy0frzhuigv1.public.blob.vercel-storage.com/tools/';

async function verifyToolImages() {
  console.log('🔍 Starting Tool Images Verification...\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  const imageErrors = [];
  const networkErrors = [];
  const imageLoadStatus = [];

  // Listen for network responses
  page.on('response', async (response) => {
    const url = response.url();
    const isImageRequest = url.includes('/tools/') &&
      (url.endsWith('.jpg') || url.endsWith('.png') || url.endsWith('.jpeg') || url.endsWith('.webp'));

    if (isImageRequest) {
      const status = response.status();
      const isSuccess = status >= 200 && status < 300;

      imageLoadStatus.push({
        url: url.substring(url.lastIndexOf('/') + 1),
        fullUrl: url,
        status: status,
        loaded: isSuccess
      });

      if (!isSuccess) {
        networkErrors.push({ url, status });
      }
    }
  });

  // Listen for console messages
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.log('❌ Browser console error:', msg.text());
    }
  });

  try {
    console.log(`📍 Navigating to ${BASE_URL}/tools...`);
    await page.goto(`${BASE_URL}/tools`, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    console.log('⏳ Waiting for page to load completely...');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000); // Give images time to load

    console.log('🖼️  Analyzing images on page...\n');

    // Get all images
    const images = await page.locator('img').all();
    console.log(`Found ${images.length} total image elements on page\n`);

    let toolImageCount = 0;
    let successfullyLoadedCount = 0;
    let brokenImageCount = 0;
    const toolImageDetails = [];

    for (const img of images) {
      const src = await img.getAttribute('src');
      const alt = await img.getAttribute('alt');

      if (!src) continue;

      // Check if this is a tool image
      const isToolImage = src.includes('/tools/') &&
        (src.includes('vercel-storage.com') || src.startsWith(BLOB_STORAGE_BASE));

      if (isToolImage) {
        toolImageCount++;

        // Check if image is loaded
        const isLoaded = await img.evaluate((el) => {
          return el.complete && el.naturalWidth > 0 && el.naturalHeight > 0;
        });

        const dimensions = await img.evaluate((el) => ({
          width: el.naturalWidth,
          height: el.naturalHeight
        }));

        if (isLoaded) {
          successfullyLoadedCount++;
          console.log(`✅ ${alt || 'unknown'}`);
          console.log(`   ${src.substring(0, 80)}...`);
          console.log(`   Dimensions: ${dimensions.width}x${dimensions.height}\n`);
        } else {
          brokenImageCount++;
          imageErrors.push({ alt: alt || 'unknown', src });
          console.log(`❌ FAILED: ${alt || 'unknown'}`);
          console.log(`   ${src}\n`);
        }

        toolImageDetails.push({
          alt: alt || 'unknown',
          src: src.substring(src.lastIndexOf('/') + 1),
          loaded: isLoaded,
          dimensions
        });
      }
    }

    // Take screenshots
    const screenshotsDir = './tests/screenshots';
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    const screenshotPath = path.join(screenshotsDir, 'tools-page-verification.png');
    await page.screenshot({
      path: screenshotPath,
      fullPage: true
    });
    console.log(`📸 Screenshot saved: ${screenshotPath}\n`);

    // Test mobile viewport
    console.log('📱 Testing mobile viewport...');
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(2000);

    const mobileScreenshotPath = path.join(screenshotsDir, 'tools-page-mobile.png');
    await page.screenshot({
      path: mobileScreenshotPath,
      fullPage: true
    });
    console.log(`📸 Mobile screenshot saved: ${mobileScreenshotPath}\n`);

    // Print detailed report
    console.log('═══════════════════════════════════════════════════════════');
    console.log('                 VERIFICATION REPORT                        ');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('📊 IMAGE STATISTICS:');
    console.log(`   Total images on page: ${images.length}`);
    console.log(`   Tool images found: ${toolImageCount}`);
    console.log(`   Expected tool images: ${EXPECTED_IMAGE_COUNT}`);
    console.log(`   Successfully loaded: ${successfullyLoadedCount}`);
    console.log(`   Broken images: ${brokenImageCount}\n`);

    if (networkErrors.length > 0) {
      console.log('⚠️  NETWORK ERRORS:');
      networkErrors.forEach(({ url, status }) => {
        console.log(`   ❌ ${status} - ${url}`);
      });
      console.log();
    }

    if (imageErrors.length > 0) {
      console.log('❌ BROKEN IMAGES:');
      imageErrors.forEach(({ alt, src }) => {
        console.log(`   • ${alt}`);
        console.log(`     ${src}`);
      });
      console.log();
    }

    // Acceptance criteria check
    console.log('✓ ACCEPTANCE CRITERIA:');
    const allImagesFound = toolImageCount === EXPECTED_IMAGE_COUNT;
    const noBrokenImages = brokenImageCount === 0;
    const noNetworkErrors = networkErrors.length === 0;
    const allFromBlobStorage = toolImageDetails.every(img =>
      img.src.includes('vercel-storage.com') || img.src.startsWith('https://ljqhvy0frzhuigv1')
    );

    console.log(`   ${allImagesFound ? '✅' : '❌'} All 23 tool images present: ${toolImageCount}/23`);
    console.log(`   ${noBrokenImages ? '✅' : '❌'} No broken images: ${brokenImageCount} broken`);
    console.log(`   ${noNetworkErrors ? '✅' : '❌'} No network errors: ${networkErrors.length} errors`);
    console.log(`   ${allFromBlobStorage ? '✅' : '❌'} All images from Blob Storage`);

    const testPassed = allImagesFound && noBrokenImages && noNetworkErrors && allFromBlobStorage;

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log(`   OVERALL STATUS: ${testPassed ? '✅ PASS' : '❌ FAIL'}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    // Generate JSON report
    const report = {
      timestamp: new Date().toISOString(),
      testUrl: `${BASE_URL}/tools`,
      summary: {
        totalImages: images.length,
        toolImagesFound: toolImageCount,
        expectedToolImages: EXPECTED_IMAGE_COUNT,
        successfullyLoaded: successfullyLoadedCount,
        brokenImages: brokenImageCount,
        networkErrors: networkErrors.length
      },
      acceptanceCriteria: {
        allImagesPresent: allImagesFound,
        noBrokenImages: noBrokenImages,
        noNetworkErrors: noNetworkErrors,
        allFromBlobStorage: allFromBlobStorage
      },
      testPassed: testPassed,
      toolImages: toolImageDetails,
      networkErrors: networkErrors,
      brokenImages: imageErrors,
      screenshots: [
        screenshotPath,
        mobileScreenshotPath
      ]
    };

    const reportPath = './tests/tools-images-verification-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 Detailed report saved: ${reportPath}\n`);

    await browser.close();

    process.exit(testPassed ? 0 : 1);

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    await browser.close();
    process.exit(1);
  }
}

verifyToolImages().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
