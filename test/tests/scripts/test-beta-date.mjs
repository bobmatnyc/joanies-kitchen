#!/usr/bin/env node
import { chromium } from 'playwright';

async function testBetaDate() {
  console.log('Testing Beta Launch Date...\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto('http://localhost:3005', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Search for AlphaStamp or beta text in different ways
    console.log('Searching for beta launch date...\n');

    // Method 1: Look for specific text patterns
    const betaTexts = await page.locator('text=/beta/i').all();
    console.log(`Found ${betaTexts.length} elements containing 'beta'`);
    for (let i = 0; i < Math.min(5, betaTexts.length); i++) {
      const text = await betaTexts[i].textContent();
      console.log(`  ${i + 1}. "${text?.trim()}"`);
    }

    // Mirrors BETA_LAUNCH_DATE in src/config/beta.ts (2027-02-01), formatted M/D/YY (#62)
    const betaDateText = '2/1/27';

    // Method 2: Look for date patterns (2/1/27, 2-1-27, Feb 1, etc.)
    console.log(`\nSearching for date "${betaDateText}":`);
    const dateElements = await page.locator('text=/2\\/1\\/27|2-1-27|Feb.*1/i').all();
    console.log(`Found ${dateElements.length} elements with date patterns`);
    for (let i = 0; i < Math.min(3, dateElements.length); i++) {
      const text = await dateElements[i].textContent();
      console.log(`  ${i + 1}. "${text?.trim()}"`);
    }

    // Method 3: Check specific component/class names
    console.log('\nSearching by class/component names:');
    const alphaStamp = await page
      .locator('[class*="alpha"], [class*="stamp"], [class*="badge"]')
      .all();
    console.log(`Found ${alphaStamp.length} potential AlphaStamp elements`);
    for (let i = 0; i < Math.min(5, alphaStamp.length); i++) {
      const text = await alphaStamp[i].textContent();
      const classes = await alphaStamp[i].getAttribute('class');
      console.log(`  ${i + 1}. "${text?.trim()}" (class: ${classes?.substring(0, 50)}...)`);
    }

    // Method 4: Get full page text and search
    console.log('\nSearching in full page content:');
    const bodyText = await page.locator('body').textContent();
    const contains1116 = bodyText.includes(betaDateText);
    const containsBeta = bodyText.toLowerCase().includes('beta launch');
    console.log(`  Page contains "${betaDateText}": ${contains1116 ? 'YES ✓' : 'NO ✗'}`);
    console.log(`  Page contains "beta launch": ${containsBeta ? 'YES ✓' : 'NO ✗'}`);

    if (contains1116) {
      // Find context around the date
      const match = bodyText.match(/.{0,30}2\/1\/27.{0,30}/);
      console.log(`  Context: "...${match?.[0]}..."`);
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

testBetaDate();
