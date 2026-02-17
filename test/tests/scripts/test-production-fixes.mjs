#!/usr/bin/env node
import { chromium } from 'playwright';

async function testProductionFixes() {
  console.log('Starting production fixes validation...\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();

  // Collect console errors
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  const results = {
    mealsPage: { status: 'PENDING', details: '' },
    chefsPage: { status: 'PENDING', details: '' },
    mobileChefTags: { status: 'PENDING', details: '' },
    recipeImages: { status: 'PENDING', details: '' },
    betaLaunchDate: { status: 'PENDING', details: '' },
  };

  try {
    // TEST 1: Meals Page Access (WITHOUT authentication)
    console.log('TEST 1: Meals Page Access');
    await page.goto('http://localhost:3005/meals', { waitUntil: 'networkidle' });
    const mealsStatus = page.url().includes('/meals');
    const mealsHeading = await page.locator('h1').first().textContent();
    const mealCards = await page.locator('[data-slot="card"]').count();

    results.mealsPage.status = mealsStatus && mealCards > 0 ? 'PASS' : 'FAIL';
    results.mealsPage.details = `HTTP: 200, URL: ${page.url()}, Heading: "${mealsHeading?.trim()}", Meal count: ${mealCards}`;
    console.log(`✓ Status: ${results.mealsPage.status}`);
    console.log(`  ${results.mealsPage.details}\n`);

    // TEST 2: Chefs Page Access (WITHOUT authentication)
    console.log('TEST 2: Chefs Page Access');
    await page.goto('http://localhost:3005/discover/chefs', { waitUntil: 'networkidle' });
    const chefsStatus = page.url().includes('/discover/chefs');
    const chefsHeading = await page.locator('h1').first().textContent();
    const chefCards = await page.locator('[data-slot="card"]').count();
    const chefCount = await page.locator('text=/Featuring.*chef/i').textContent();

    results.chefsPage.status = chefsStatus && chefCards > 0 ? 'PASS' : 'FAIL';
    results.chefsPage.details = `HTTP: 200, URL: ${page.url()}, Heading: "${chefsHeading?.trim()}", Chef count: ${chefCards}, Info: "${chefCount?.trim()}"`;
    console.log(`✓ Status: ${results.chefsPage.status}`);
    console.log(`  ${results.chefsPage.details}\n`);

    // TEST 3: Mobile Chef Tags (UI Fix)
    console.log('TEST 3: Mobile Chef Tags UI Fix');
    const mobilePage = await context.newPage();
    await mobilePage.setViewportSize({ width: 375, height: 667 }); // iPhone SE
    await mobilePage.goto('http://localhost:3005/discover/chefs', { waitUntil: 'networkidle' });

    // Check first chef card for tag overflow
    const firstCard = mobilePage.locator('[data-slot="card"]').first();
    const cardBox = await firstCard.boundingBox();
    const tags = firstCard.locator('[data-slot="badge"]');
    const tagCount = await tags.count();

    let overflowDetected = false;
    if (tagCount > 0) {
      for (let i = 0; i < Math.min(tagCount, 3); i++) {
        const tagBox = await tags.nth(i).boundingBox();
        if (tagBox && cardBox && tagBox.x + tagBox.width > cardBox.x + cardBox.width) {
          overflowDetected = true;
          break;
        }
      }
    }

    results.mobileChefTags.status = !overflowDetected ? 'PASS' : 'FAIL';
    results.mobileChefTags.details = `Viewport: 375px, Tags: ${tagCount}, Overflow: ${overflowDetected ? 'YES' : 'NO'}`;
    console.log(`✓ Status: ${results.mobileChefTags.status}`);
    console.log(`  ${results.mobileChefTags.details}\n`);
    await mobilePage.close();

    // TEST 4: Recipe Images (Database Fix)
    console.log('TEST 4: Recipe Images Database Fix');
    await page.goto('http://localhost:3005/recipes', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000); // Wait for images to load

    const totalRecipes = await page.locator('article').count();
    const recipesWithImages = await page.locator('article img[alt]:not([alt=""])').count();
    const imagePercentage =
      totalRecipes > 0 ? ((recipesWithImages / totalRecipes) * 100).toFixed(1) : '0.0';

    results.recipeImages.status = parseFloat(imagePercentage) > 10 ? 'PASS' : 'FAIL';
    results.recipeImages.details = `Total recipes: ${totalRecipes}, With images: ${recipesWithImages}, Percentage: ${imagePercentage}%`;
    console.log(`✓ Status: ${results.recipeImages.status}`);
    console.log(`  ${results.recipeImages.details}\n`);

    // TEST 5: Beta Launch Date (Text Update)
    console.log('TEST 5: Beta Launch Date Text Update');
    await page.goto('http://localhost:3005', { waitUntil: 'networkidle' });
    const betaText = await page
      .locator('text=/beta launch/i')
      .first()
      .textContent()
      .catch(() => '');
    const contains1116 = betaText.includes('11/16');

    results.betaLaunchDate.status = contains1116 ? 'PASS' : 'FAIL';
    results.betaLaunchDate.details = `Found text: "${betaText?.trim()}", Contains "11/16": ${contains1116 ? 'YES' : 'NO'}`;
    console.log(`✓ Status: ${results.betaLaunchDate.status}`);
    console.log(`  ${results.betaLaunchDate.details}\n`);
  } catch (error) {
    console.error('Error during testing:', error.message);
  } finally {
    await browser.close();
  }

  // Print Summary
  console.log('\n========================================');
  console.log('PRODUCTION FIXES VALIDATION SUMMARY');
  console.log('========================================\n');

  const tests = [
    { name: 'Meals Page Access (Critical)', ...results.mealsPage },
    { name: 'Chefs Page Access (Critical)', ...results.chefsPage },
    { name: 'Mobile Chef Tags UI', ...results.mobileChefTags },
    { name: 'Recipe Images Fix', ...results.recipeImages },
    { name: 'Beta Launch Date', ...results.betaLaunchDate },
  ];

  tests.forEach((test, index) => {
    console.log(`${index + 1}. ${test.name}: ${test.status}`);
    console.log(`   ${test.details}`);
  });

  const passed = tests.filter((t) => t.status === 'PASS').length;
  const total = tests.length;

  console.log(`\n========================================`);
  console.log(`RESULTS: ${passed}/${total} tests passed`);
  console.log(`========================================`);

  if (consoleErrors.length > 0) {
    console.log('\nConsole Errors Detected:');
    consoleErrors.slice(0, 5).forEach((err, i) => {
      console.log(`  ${i + 1}. ${err}`);
    });
  } else {
    console.log('\nNo console errors detected.');
  }

  process.exit(passed === total ? 0 : 1);
}

testProductionFixes();
