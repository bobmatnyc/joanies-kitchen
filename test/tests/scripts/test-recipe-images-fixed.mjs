#!/usr/bin/env node
import { chromium } from 'playwright';

async function testRecipeImages() {
  console.log('Testing Recipe Images Fix...\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto('http://localhost:3005/recipes', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // Count recipe cards
    const recipeCards = await page.locator('.recipe-card').count();
    console.log(`Total recipe cards: ${recipeCards}`);

    // Count images within recipe cards
    let cardsWithImages = 0;
    let cardsWithoutImages = 0;

    for (let i = 0; i < recipeCards; i++) {
      const card = page.locator('.recipe-card').nth(i);
      const images = await card.locator('img[src]:not([src=""]):not([alt*="logo" i])').count();
      if (images > 0) {
        cardsWithImages++;
      } else {
        cardsWithoutImages++;
      }
    }

    const imagePercentage =
      recipeCards > 0 ? ((cardsWithImages / recipeCards) * 100).toFixed(1) : '0.0';

    console.log(`Recipe cards with images: ${cardsWithImages}`);
    console.log(`Recipe cards without images: ${cardsWithoutImages}`);
    console.log(`Percentage with images: ${imagePercentage}%`);

    // Expected improvement: from ~6% to ~13%
    const meetsExpectation = parseFloat(imagePercentage) >= 10;
    console.log(`\nMeets expectation (>10%): ${meetsExpectation ? 'YES ✓' : 'NO ✗'}`);

    // Get sample of image URLs
    console.log('\nSample image sources (first 3):');
    const sampleImages = await page.locator('.recipe-card img[src]:not([alt*="logo" i])').all();
    for (let i = 0; i < Math.min(3, sampleImages.length); i++) {
      const src = await sampleImages[i].getAttribute('src');
      console.log(`  ${i + 1}. ${src?.substring(0, 80)}...`);
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

testRecipeImages();
