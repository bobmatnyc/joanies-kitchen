#!/usr/bin/env node

/**
 * Tool Images Verification Script v2
 *
 * Verifies all tool images display correctly on the Tools page
 */

import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3003';
const EXPECTED_IMAGE_COUNT = 23;

async function verifyToolImages() {
  console.log('🔍 Starting Tool Images Verification v2...\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  const imageErrors = [];
  const networkErrors = [];
  const allImageRequests = [];

  // Listen for ALL network responses
  page.on('response', async (response) => {
    const url = response.url();
    const status = response.status();

    // Track all image requests
    if (url.match(/\.(jpg|jpeg|png|webp|gif)/) || url.includes('/_next/image')) {
      allImageRequests.push({ url, status });

      if (status >= 400) {
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
    await page.waitForTimeout(3000);

    console.log('🖼️  Analyzing images on page...\n');

    // Get all images
    const images = await page.locator('img').all();
    console.log(`Found ${images.length} total image elements on page\n`);

    // Analyze each image
    const toolImageDetails = [];
    let successfullyLoadedCount = 0;
    let brokenImageCount = 0;

    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const src = await img.getAttribute('src');
      const alt = await img.getAttribute('alt');
      const currentSrc = await img.evaluate((el) => el.currentSrc);

      if (!src) continue;

      // Check if image is actually loaded
      const imageInfo = await img.evaluate((el) => {
        return {
          complete: el.complete,
          naturalWidth: el.naturalWidth,
          naturalHeight: el.naturalHeight,
          width: el.width,
          height: el.height,
          currentSrc: el.currentSrc
        };
      });

      const isLoaded = imageInfo.complete && imageInfo.naturalWidth > 0;

      // Determine if this is a tool image (based on context - it's on the tools page)
      // Skip header/nav images (usually logos)
      const isLikelyToolImage = alt && alt !== 'Joanie\'s Kitchen' && !alt.includes('logo');

      if (isLikelyToolImage) {
        if (isLoaded) {
          successfullyLoadedCount++;
          console.log(`✅ [${successfullyLoadedCount}] ${alt}`);
          console.log(`   Dimensions: ${imageInfo.naturalWidth}x${imageInfo.naturalHeight}`);
          console.log(`   Src: ${src.substring(0, 80)}${src.length > 80 ? '...' : ''}`);
          console.log(`   Current: ${currentSrc ? currentSrc.substring(0, 80) + (currentSrc.length > 80 ? '...' : '') : 'N/A'}\n`);
        } else {
          brokenImageCount++;
          imageErrors.push({ alt: alt || 'unknown', src, imageInfo });
          console.log(`❌ FAILED: ${alt || 'unknown'}`);
          console.log(`   Src: ${src}`);
          console.log(`   Status: complete=${imageInfo.complete}, naturalWidth=${imageInfo.naturalWidth}\n`);
        }

        toolImageDetails.push({
          alt: alt || 'unknown',
          src: src,
          currentSrc: currentSrc || src,
          loaded: isLoaded,
          dimensions: {
            natural: { width: imageInfo.naturalWidth, height: imageInfo.naturalHeight },
            display: { width: imageInfo.width, height: imageInfo.height }
          }
        });
      }
    }

    const toolImageCount = toolImageDetails.length;

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

    // Count visible images on mobile
    const mobileImages = await page.locator('img').all();
    let mobileLoadedCount = 0;
    for (const img of mobileImages) {
      const isLoaded = await img.evaluate((el) => {
        return el.complete && el.naturalWidth > 0;
      });
      if (isLoaded) mobileLoadedCount++;
    }

    const mobileScreenshotPath = path.join(screenshotsDir, 'tools-page-mobile.png');
    await page.screenshot({
      path: mobileScreenshotPath,
      fullPage: true
    });
    console.log(`📸 Mobile screenshot saved: ${mobileScreenshotPath}`);
    console.log(`   Mobile: ${mobileLoadedCount} images loaded\n`);

    // Print detailed report
    console.log('═══════════════════════════════════════════════════════════');
    console.log('                 VERIFICATION REPORT                        ');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('📊 IMAGE STATISTICS:');
    console.log(`   Total images on page: ${images.length}`);
    console.log(`   Tool images identified: ${toolImageCount}`);
    console.log(`   Expected tool images: ${EXPECTED_IMAGE_COUNT}`);
    console.log(`   Successfully loaded: ${successfullyLoadedCount}`);
    console.log(`   Broken images: ${brokenImageCount}`);
    console.log(`   Mobile images loaded: ${mobileLoadedCount}\n`);

    console.log('🌐 NETWORK REQUESTS:');
    console.log(`   Total image requests: ${allImageRequests.length}`);
    console.log(`   Failed requests (4xx/5xx): ${networkErrors.length}\n`);

    if (networkErrors.length > 0) {
      console.log('⚠️  NETWORK ERRORS:');
      networkErrors.forEach(({ url, status }) => {
        console.log(`   ❌ ${status} - ${url.substring(0, 100)}${url.length > 100 ? '...' : ''}`);
      });
      console.log();
    }

    if (imageErrors.length > 0) {
      console.log('❌ BROKEN IMAGES:');
      imageErrors.forEach(({ alt, src, imageInfo }) => {
        console.log(`   • ${alt}`);
        console.log(`     Src: ${src}`);
        console.log(`     Complete: ${imageInfo.complete}, NaturalWidth: ${imageInfo.naturalWidth}`);
      });
      console.log();
    }

    // Check for Blob Storage usage in network requests
    const blobStorageRequests = allImageRequests.filter(req =>
      req.url.includes('vercel-storage.com/tools/')
    );
    console.log(`📦 Blob Storage Requests: ${blobStorageRequests.length}`);
    if (blobStorageRequests.length > 0) {
      console.log('   ✅ Images are being served from Vercel Blob Storage');
      blobStorageRequests.slice(0, 5).forEach(({ url, status }) => {
        console.log(`   ${status === 200 ? '✅' : '❌'} ${url.split('/').pop()}`);
      });
      if (blobStorageRequests.length > 5) {
        console.log(`   ... and ${blobStorageRequests.length - 5} more`);
      }
    }
    console.log();

    // Acceptance criteria check
    console.log('✅ ACCEPTANCE CRITERIA:');

    // Allow some tolerance for expected count (±2)
    const imageCountAcceptable = Math.abs(toolImageCount - EXPECTED_IMAGE_COUNT) <= 2;
    const noBrokenImages = brokenImageCount === 0;
    const noNetworkErrors = networkErrors.length === 0;
    const hasBlobStorageRequests = blobStorageRequests.length > 0;

    console.log(`   ${imageCountAcceptable ? '✅' : '⚠️'} Tool images present: ${toolImageCount} (expected ${EXPECTED_IMAGE_COUNT})`);
    console.log(`   ${noBrokenImages ? '✅' : '❌'} No broken images: ${brokenImageCount} broken`);
    console.log(`   ${noNetworkErrors ? '✅' : '❌'} No network errors: ${networkErrors.length} errors`);
    console.log(`   ${hasBlobStorageRequests ? '✅' : '❌'} Using Blob Storage: ${blobStorageRequests.length} requests`);

    const testPassed = imageCountAcceptable && noBrokenImages && noNetworkErrors;

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
        networkRequests: allImageRequests.length,
        networkErrors: networkErrors.length,
        blobStorageRequests: blobStorageRequests.length,
        mobileImagesLoaded: mobileLoadedCount
      },
      acceptanceCriteria: {
        imageCountAcceptable: imageCountAcceptable,
        noBrokenImages: noBrokenImages,
        noNetworkErrors: noNetworkErrors,
        usingBlobStorage: hasBlobStorageRequests
      },
      testPassed: testPassed,
      toolImages: toolImageDetails,
      networkErrors: networkErrors,
      brokenImages: imageErrors,
      blobStorageRequests: blobStorageRequests.map(r => ({ url: r.url, status: r.status })),
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
