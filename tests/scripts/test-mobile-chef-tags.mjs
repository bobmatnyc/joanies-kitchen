#!/usr/bin/env node
import { chromium } from 'playwright';

async function testMobileChefTags() {
  console.log('Testing Mobile Chef Tags UI Fix...\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 375, height: 667 }, // iPhone SE
  });
  const page = await context.newPage();

  try {
    await page.goto('http://localhost:3005/discover/chefs', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    console.log('Mobile viewport: 375px width (iPhone SE)\n');

    // Get all chef cards
    const chefCards = await page.locator('[data-slot="card"]').all();
    console.log(`Total chef cards: ${chefCards.length}\n`);

    let overflowCount = 0;
    let noOverflowCount = 0;

    // Check first 5 cards for overflow
    for (let i = 0; i < Math.min(5, chefCards.length); i++) {
      const card = chefCards[i];
      const cardBox = await card.boundingBox();
      const tags = card.locator('[data-slot="badge"]');
      const tagCount = await tags.count();

      console.log(`Chef Card ${i + 1}:`);
      console.log(`  Card width: ${cardBox?.width}px`);
      console.log(`  Number of tags: ${tagCount}`);

      let cardHasOverflow = false;

      if (tagCount > 0 && cardBox) {
        for (let j = 0; j < tagCount; j++) {
          const tag = tags.nth(j);
          const tagBox = await tag.boundingBox();
          const tagText = await tag.textContent();

          if (tagBox) {
            const isOverflowing = tagBox.x + tagBox.width > cardBox.x + cardBox.width;
            console.log(
              `    Tag ${j + 1}: "${tagText?.trim()}" - width: ${tagBox.width}px, overflow: ${isOverflowing ? 'YES' : 'NO'}`
            );

            if (isOverflowing) {
              cardHasOverflow = true;
            }
          }
        }
      }

      if (cardHasOverflow) {
        overflowCount++;
        console.log(`  ❌ OVERFLOW DETECTED`);
      } else {
        noOverflowCount++;
        console.log(`  ✓ No overflow`);
      }
      console.log('');
    }

    console.log('Summary:');
    console.log(`  Cards with overflow: ${overflowCount}`);
    console.log(`  Cards without overflow: ${noOverflowCount}`);
    console.log(`  Status: ${overflowCount === 0 ? 'PASS ✓' : 'FAIL ✗'}`);

    // Additional check: are tags using flex-wrap or truncate?
    const firstCardTagContainer = chefCards[0].locator('[class*="flex"][class*="gap"]').first();
    const containerClass = await firstCardTagContainer.getAttribute('class');
    console.log(`\nTag container classes: ${containerClass}`);
    console.log(`  Has flex-wrap: ${containerClass?.includes('flex-wrap') ? 'YES' : 'NO'}`);
    console.log(`  Has max-w: ${containerClass?.includes('max-w') ? 'YES' : 'NO'}`);
    console.log(
      `  Has overflow-hidden: ${containerClass?.includes('overflow-hidden') ? 'YES' : 'NO'}`
    );
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

testMobileChefTags();
