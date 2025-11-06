#!/usr/bin/env node
import { chromium } from 'playwright';

async function testRecipeImages() {
  console.log('Testing Recipe Images...\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto('http://localhost:3005/recipes', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // Try different selectors to find recipes
    const recipeSelectors = [
      'article',
      '[data-testid="recipe-card"]',
      '.recipe-card',
      '[class*="recipe"]',
      'div[class*="grid"] > div',
      'a[href*="/recipe/"]',
    ];

    console.log('Searching for recipes with different selectors...\n');
    for (const selector of recipeSelectors) {
      const count = await page.locator(selector).count();
      console.log(`  ${selector}: ${count} elements`);
    }

    // Look for images in the page
    console.log('\nSearching for images...\n');
    const allImages = await page.locator('img').count();
    const recipeImages = await page.locator('img[alt*="recipe" i]').count();
    const anyImagesWithSrc = await page.locator('img[src]:not([src=""])').count();

    console.log(`  Total <img> tags: ${allImages}`);
    console.log(`  Images with 'recipe' in alt: ${recipeImages}`);
    console.log(`  Images with src attribute: ${anyImagesWithSrc}`);

    // Get actual content
    console.log('\nPage structure analysis:');
    const pageText = await page.locator('main').textContent();
    const hasRecipes = pageText.includes('recipe') || pageText.includes('Recipe');
    console.log(`  Main content includes 'recipe': ${hasRecipes}`);

    // Check if it's showing a loading state
    const loadingElements = await page
      .locator('[class*="loading"], [class*="skeleton"], [class*="pulse"]')
      .count();
    console.log(`  Loading/skeleton elements: ${loadingElements}`);

    // Look for recipe links
    const recipeLinks = await page.locator('a[href*="/recipe/"], a[href*="/recipes/"]').count();
    console.log(`  Recipe links found: ${recipeLinks}`);

    if (recipeLinks > 0) {
      console.log('\nFirst 5 recipe links:');
      const links = await page.locator('a[href*="/recipe/"]').all();
      for (let i = 0; i < Math.min(5, links.length); i++) {
        const href = await links[i].getAttribute('href');
        const text = await links[i].textContent();
        console.log(`    ${i + 1}. ${href} - "${text?.trim().substring(0, 50)}"`);
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

testRecipeImages();
