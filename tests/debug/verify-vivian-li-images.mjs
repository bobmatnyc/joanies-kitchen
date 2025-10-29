#!/usr/bin/env node

/**
 * Vivian Li Chef Page - Recipe Image Verification Test
 *
 * This script verifies that recipe images display correctly after the RecipeCard fix.
 * Expected: Images should load from Vercel Blob Storage, not broken local paths.
 */

import puppeteer from 'puppeteer';

const TEST_URL = 'http://localhost:3002/chef/vivian-li';
const EXPECTED_RECIPES = ['Carrot Soup', 'Sugar Cookie Icing', 'Indian Shrimp Curry'];

async function runTest() {
  console.log('\n🧪 Starting Vivian Li Chef Page Image Verification Test\n');
  console.log(`Testing URL: ${TEST_URL}\n`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();

    // Track network requests
    const imageRequests = [];
    const failedRequests = [];
    const consoleMessages = [];

    page.on('response', async (response) => {
      const url = response.url();
      const status = response.status();

      // Track Vercel Blob Storage requests
      if (url.includes('ljqhvy0frzhuigv1.public.blob.vercel-storage.com')) {
        imageRequests.push({ url, status });
      }

      // Track failed requests to /images/ paths
      if (status === 404 && url.includes('/images/')) {
        failedRequests.push({ url, status });
      }
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
      }
    });

    // Navigate to page
    console.log('📄 Navigating to Vivian Li chef page...\n');
    await page.goto(TEST_URL, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for recipe cards to load
    await page.waitForSelector('.recipe-card', { timeout: 10000 });

    // Get all recipe cards
    const recipes = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.recipe-card'));
      return cards.map(card => {
        const title = card.querySelector('h3')?.textContent?.trim() || 'Unknown';
        const imgElement = card.querySelector('img');
        const imgSrc = imgElement?.src || '';
        const imgAlt = imgElement?.alt || '';
        const isVisible = imgElement && imgElement.offsetWidth > 0 && imgElement.offsetHeight > 0;

        return {
          title,
          imgSrc,
          imgAlt,
          isVisible,
          hasImage: !!imgSrc,
          isVercelStorage: imgSrc.includes('ljqhvy0frzhuigv1.public.blob.vercel-storage.com'),
          isLocalPath: imgSrc.includes('/images/recipes/'),
          isHttps: imgSrc.startsWith('https://'),
        };
      });
    });

    // Take screenshot
    await page.screenshot({ path: '/tmp/vivian-li-chef-page.png', fullPage: true });
    console.log('📸 Screenshot saved: /tmp/vivian-li-chef-page.png\n');

    // Print results
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('📊 TEST RESULTS SUMMARY\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log(`✅ Total recipes found: ${recipes.length}\n`);

    console.log('📋 RECIPE IMAGE VERIFICATION TABLE\n');
    console.log('| Recipe | Image? | Visible? | Source | Status |');
    console.log('|--------|--------|----------|--------|--------|');

    let passCount = 0;
    let failCount = 0;

    recipes.forEach(recipe => {
      const hasImage = recipe.hasImage ? 'YES' : 'NO';
      const visible = recipe.isVisible ? 'YES' : 'NO';
      let source = 'none';
      let status = 'FAIL';

      if (recipe.isVercelStorage) {
        source = 'vercel-storage';
        status = recipe.isVisible ? 'PASS' : 'WARN';
      } else if (recipe.isLocalPath) {
        source = 'local-path';
        status = 'FAIL';
      } else if (recipe.isHttps) {
        source = 'https';
        status = recipe.isVisible ? 'PASS' : 'WARN';
      }

      if (status === 'PASS') passCount++;
      else if (status === 'FAIL') failCount++;

      const recipeName = recipe.title.substring(0, 30).padEnd(30);
      console.log(`| ${recipeName} | ${hasImage} | ${visible} | ${source} | ${status} |`);
    });

    console.log('\n');

    // Detailed image URLs
    console.log('🔗 DETAILED IMAGE URLS\n');
    recipes.forEach((recipe, idx) => {
      console.log(`${idx + 1}. ${recipe.title}`);
      if (recipe.imgSrc) {
        const shortUrl = recipe.imgSrc.length > 80
          ? recipe.imgSrc.substring(0, 77) + '...'
          : recipe.imgSrc;
        console.log(`   URL: ${shortUrl}`);
        console.log(`   Type: ${recipe.isVercelStorage ? '✅ Vercel Storage' : recipe.isLocalPath ? '❌ Local Path' : '⚠️  Other'}`);
      } else {
        console.log(`   URL: ❌ NO IMAGE`);
      }
      console.log('');
    });

    // Network requests summary
    console.log('🌐 NETWORK REQUESTS SUMMARY\n');
    console.log(`Vercel Blob Storage requests: ${imageRequests.length}`);
    if (imageRequests.length > 0) {
      console.log('✅ All Vercel Storage requests:');
      imageRequests.forEach(req => {
        const shortUrl = req.url.substring(0, 80) + '...';
        console.log(`   [${req.status}] ${shortUrl}`);
      });
    }
    console.log('');

    // Failed requests check
    console.log('❌ 404 ERROR CHECK\n');
    if (failedRequests.length === 0) {
      console.log('✅ No 404 errors for /images/ paths');
    } else {
      console.log(`❌ Found ${failedRequests.length} 404 errors:`);
      failedRequests.forEach(req => {
        console.log(`   [${req.status}] ${req.url}`);
      });
    }
    console.log('');

    // Console messages check
    console.log('🔍 CONSOLE MESSAGES\n');
    if (consoleMessages.length === 0) {
      console.log('✅ No console errors or warnings');
    } else {
      console.log(`⚠️  Found ${consoleMessages.length} console messages:`);
      consoleMessages.slice(0, 10).forEach(msg => {
        console.log(`   ${msg}`);
      });
      if (consoleMessages.length > 10) {
        console.log(`   ... and ${consoleMessages.length - 10} more`);
      }
    }
    console.log('');

    // Final verdict
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('🎯 FINAL VERDICT\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const allHaveImages = recipes.every(r => r.hasImage);
    const allVisible = recipes.every(r => r.isVisible);
    const noLocalPaths = recipes.every(r => !r.isLocalPath);
    const no404Errors = failedRequests.length === 0;
    const hasVercelStorage = recipes.some(r => r.isVercelStorage);

    console.log(`✅ All recipes have images: ${allHaveImages ? 'YES' : 'NO'}`);
    console.log(`✅ All images visible: ${allVisible ? 'YES' : 'NO'}`);
    console.log(`✅ No broken local paths: ${noLocalPaths ? 'YES' : 'NO'}`);
    console.log(`✅ No 404 errors: ${no404Errors ? 'YES' : 'NO'}`);
    console.log(`✅ Using Vercel Storage: ${hasVercelStorage ? 'YES' : 'NO'}`);
    console.log('');

    console.log(`📊 Pass Rate: ${passCount}/${recipes.length} (${Math.round(passCount/recipes.length*100)}%)`);
    console.log('');

    if (allHaveImages && noLocalPaths && no404Errors) {
      console.log('✅ ✅ ✅  ALL TESTS PASSED! Recipe images are displaying correctly.');
    } else {
      console.log('❌ SOME TESTS FAILED. Review the detailed results above.');
    }

    console.log('\n═══════════════════════════════════════════════════════════════\n');

    // Return exit code
    const success = allHaveImages && noLocalPaths && no404Errors;
    await browser.close();
    process.exit(success ? 0 : 1);

  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error(error.stack);
    await browser.close();
    process.exit(1);
  }
}

runTest();
