#!/usr/bin/env node

import { chromium } from 'playwright';

async function verifyPomegranateImage() {
  console.log('🔍 Starting verification of pomegranate-peach-barbecue-sauce recipe image...\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();

  try {
    // Navigate to the recipe page
    console.log('📍 Navigating to: http://localhost:3002/recipes/pomegranate-peach-barbecue-sauce');
    await page.goto('http://localhost:3002/recipes/pomegranate-peach-barbecue-sauce', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // Wait for images to load
    await page.waitForTimeout(5000);

    // Find the hero/main recipe image (usually a large image, not the logo)
    // Look for images that are likely to be the recipe hero
    const heroImage = await page
      .locator('img[alt*="Pomegranate" i], img[class*="object-cover"], img[class*="rounded"]')
      .first();
    await heroImage.waitFor({ state: 'visible', timeout: 10000 });

    // Get image attributes
    const src = await heroImage.getAttribute('src');
    const alt = (await heroImage.getAttribute('alt')) || 'No alt text';
    const srcset = (await heroImage.getAttribute('srcset')) || 'No srcset';

    console.log('\n✅ IMAGE FOUND:');
    console.log('─'.repeat(80));
    console.log(`ALT TEXT: ${alt}`);
    console.log(`SRC: ${src}`);
    console.log(`SRCSET: ${srcset.substring(0, 200)}...`);
    console.log('─'.repeat(80));

    // Check if it's using Vercel Blob Storage
    const isVercelStorage =
      src?.includes('vercel-storage.com') || srcset?.includes('vercel-storage.com');
    const isPomegranateImage =
      src?.includes('pomegranate') ||
      srcset?.includes('pomegranate') ||
      alt?.toLowerCase().includes('pomegranate');

    console.log('\n📊 VERIFICATION RESULTS:');
    console.log('─'.repeat(80));
    console.log(`✓ Image loads: ${src ? '✅ YES' : '❌ NO'}`);
    console.log(`✓ Uses Vercel Storage: ${isVercelStorage ? '✅ YES' : '❌ NO'}`);
    console.log(`✓ Pomegranate-related: ${isPomegranateImage ? '✅ YES' : '⚠️  UNCERTAIN'}`);
    console.log('─'.repeat(80));

    // Take screenshot
    const screenshotPath =
      '/Users/masa/Projects/joanies-kitchen/tests/pomegranate-recipe-screenshot.png';
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`\n📸 Screenshot saved: ${screenshotPath}`);

    // Get all images on the page for additional context
    const allImages = await page.locator('img').all();
    console.log(`\n📋 Total images on page: ${allImages.length}`);

    // Check for any broken images
    const brokenImages = await page.locator('img[src=""], img:not([src])').count();
    if (brokenImages > 0) {
      console.log(`⚠️  Warning: ${brokenImages} images without src attribute`);
    }

    // Final verdict
    console.log(`\n${'═'.repeat(80)}`);
    if (src && isVercelStorage && isPomegranateImage) {
      console.log('🎉 SUCCESS: Recipe image is fixed and using Vercel Blob Storage!');
      console.log('═'.repeat(80));
      await browser.close();
      process.exit(0);
    } else if (src && isVercelStorage) {
      console.log('⚠️  PARTIAL: Image loads from Vercel but may not be pomegranate-specific');
      console.log('═'.repeat(80));
      await browser.close();
      process.exit(0);
    } else {
      console.log('❌ FAILED: Image is not properly configured');
      console.log('═'.repeat(80));
      await browser.close();
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ ERROR during verification:');
    console.error(error.message);

    // Take error screenshot
    try {
      await page.screenshot({
        path: '/Users/masa/Projects/joanies-kitchen/tests/pomegranate-error-screenshot.png',
        fullPage: true,
      });
      console.log('📸 Error screenshot saved: tests/pomegranate-error-screenshot.png');
    } catch (screenshotError) {
      console.error('Failed to capture error screenshot:', screenshotError.message);
    }

    await browser.close();
    process.exit(1);
  }
}

verifyPomegranateImage();
