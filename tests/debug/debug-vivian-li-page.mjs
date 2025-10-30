#!/usr/bin/env node

/**
 * Debug script to see what's actually on the Vivian Li page
 */

import { chromium } from '@playwright/test';

const TEST_URL = 'http://localhost:3002/chef/vivian-li';

async function debug() {
  console.log('🔍 Debugging Vivian Li page...\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Track console messages
  page.on('console', (msg) => {
    console.log(`[BROWSER ${msg.type()}] ${msg.text()}`);
  });

  // Track network errors
  page.on('response', (response) => {
    if (response.status() >= 400) {
      console.log(`[NETWORK ERROR] ${response.status()} ${response.url()}`);
    }
  });

  try {
    console.log(`Navigating to: ${TEST_URL}\n`);
    await page.goto(TEST_URL, { waitUntil: 'networkidle', timeout: 30000 });

    // Take screenshot immediately
    await page.screenshot({ path: '/tmp/vivian-li-initial.png', fullPage: true });
    console.log('📸 Screenshot saved: /tmp/vivian-li-initial.png\n');

    // Get page title
    const title = await page.title();
    console.log(`Page title: ${title}\n`);

    // Check for recipe cards
    const recipeCardCount = await page.locator('.recipe-card').count();
    console.log(`Recipe cards found: ${recipeCardCount}\n`);

    if (recipeCardCount === 0) {
      // Check what's actually on the page
      const bodyHTML = await page.evaluate(() => {
        const body = document.body;
        return {
          text: body.innerText.substring(0, 500),
          classes: body.className,
          childrenCount: body.children.length,
        };
      });

      console.log('Body content preview:', bodyHTML.text);
      console.log('Body classes:', bodyHTML.classes);
      console.log('Body children count:', bodyHTML.childrenCount);

      // Check for error messages
      const errorText = await page.evaluate(() => {
        const errorElements = document.querySelectorAll('[class*="error"], [class*="Error"]');
        return Array.from(errorElements)
          .map((el) => el.textContent)
          .join('\n');
      });

      if (errorText) {
        console.log('\nError messages found:');
        console.log(errorText);
      }
    } else {
      // Get recipe info
      const recipes = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('.recipe-card'));
        return cards.map((card) => {
          const title = card.querySelector('h3')?.textContent?.trim() || 'Unknown';
          const img = card.querySelector('img');
          return {
            title,
            hasSrc: !!img?.src,
            src: img?.src?.substring(0, 100) || 'NO IMAGE',
          };
        });
      });

      console.log('Recipes found:');
      recipes.forEach((r, i) => {
        console.log(`${i + 1}. ${r.title}`);
        console.log(`   Image: ${r.hasSrc ? `${r.src}...` : 'NO IMAGE'}`);
      });
    }

    // Wait for user to see the browser
    console.log('\n⏳ Keeping browser open for 5 seconds...\n');
    await page.waitForTimeout(5000);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ path: '/tmp/vivian-li-error.png', fullPage: true });
    console.log('📸 Error screenshot saved: /tmp/vivian-li-error.png');
  } finally {
    await browser.close();
  }
}

debug();
