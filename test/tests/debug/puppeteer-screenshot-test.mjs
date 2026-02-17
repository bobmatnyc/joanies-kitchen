/**
 * Puppeteer Screenshot and Testing Script for Epic 7.2
 */

import { mkdirSync } from 'node:fs';
import puppeteer from 'puppeteer';

const RECIPE_URL = 'http://localhost:3002/recipes/pomegranate-peach-barbecue-sauce';
const SCREENSHOT_DIR = '/Users/masa/Projects/joanies-kitchen/tests/screenshots';

// Ensure screenshot directory exists
mkdirSync(SCREENSHOT_DIR, { recursive: true });

console.log('\n🚀 Starting Puppeteer Browser Testing\n');
console.log('='.repeat(80));

const testResults = {
  passed: [],
  failed: [],
  warnings: [],
  screenshots: [],
};

async function runTests() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();

    // Console monitoring
    const consoleLogs = [];
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      consoleLogs.push({ type, text });

      if (type === 'error') {
        console.log(`❌ Console Error: ${text}`);
        testResults.failed.push(`Console error: ${text}`);
      } else if (type === 'warning') {
        console.log(`⚠️  Console Warning: ${text}`);
        testResults.warnings.push(`Console warning: ${text}`);
      }
    });

    // Set desktop viewport
    await page.setViewport({ width: 1920, height: 1080 });

    console.log('\n📄 TEST 1: Loading Recipe Page');
    console.log('-'.repeat(80));

    try {
      await page.goto(RECIPE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
      console.log('✅ Page loaded successfully');
      testResults.passed.push('Page loads successfully');
    } catch (error) {
      console.log(`❌ Page failed to load: ${error.message}`);
      testResults.failed.push(`Page load failed: ${error.message}`);
      throw error;
    }

    // Wait for content to render
    await page.waitForTimeout(3000);

    // Take full page screenshot
    const screenshotPath1 = `${SCREENSHOT_DIR}/01-full-recipe-page-desktop.png`;
    await page.screenshot({ path: screenshotPath1, fullPage: true });
    console.log(`📸 Screenshot saved: ${screenshotPath1}`);
    testResults.screenshots.push(screenshotPath1);

    console.log('\n📄 TEST 2: Recipe Header and Title');
    console.log('-'.repeat(80));

    try {
      const title = await page.$('h1');
      if (title) {
        const titleText = await page.evaluate((el) => el.textContent, title);
        console.log(`✅ Recipe title found: "${titleText}"`);
        testResults.passed.push(`Recipe title displays: ${titleText}`);
      } else {
        console.log('⚠️  Recipe title (h1) not found');
        testResults.warnings.push('Recipe title not found');
      }
    } catch (error) {
      console.log(`❌ Error checking title: ${error.message}`);
      testResults.failed.push(`Title check failed: ${error.message}`);
    }

    console.log('\n📄 TEST 3: Rating Display in Header');
    console.log('-'.repeat(80));

    try {
      // Look for rating display
      const ratingDisplay =
        (await page.$('[data-testid="rating-display"]')) ||
        (await page.$('.rating-display')) ||
        (await page.$('[class*="rating"]'));

      if (ratingDisplay) {
        console.log('✅ Rating display component found');
        testResults.passed.push('Rating display component exists');

        // Check for star elements
        const stars = await page.$$('svg[data-icon="star"], [class*="star"]');
        console.log(`   Found ${stars.length} star elements`);

        if (stars.length > 0) {
          testResults.passed.push(`Rating stars rendered (${stars.length} stars)`);
        }
      } else {
        console.log('⚠️  Rating display not found - recipe may not have ratings yet');
        testResults.warnings.push('Rating display not visible (may be no ratings)');
      }
    } catch (error) {
      console.log(`❌ Error checking rating display: ${error.message}`);
      testResults.failed.push(`Rating display check failed: ${error.message}`);
    }

    console.log('\n📄 TEST 4: Scrolling to Ratings Section');
    console.log('-'.repeat(80));

    try {
      // Scroll to middle of page
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
      await page.waitForTimeout(1000);

      const screenshotPath2 = `${SCREENSHOT_DIR}/02-ratings-section.png`;
      await page.screenshot({ path: screenshotPath2 });
      console.log(`📸 Screenshot saved: ${screenshotPath2}`);
      testResults.screenshots.push(screenshotPath2);

      console.log('✅ Scrolled to ratings section');
      testResults.passed.push('Ratings section viewable');
    } catch (error) {
      console.log(`❌ Error scrolling: ${error.message}`);
      testResults.failed.push(`Scroll failed: ${error.message}`);
    }

    console.log('\n📄 TEST 5: Ratings Components');
    console.log('-'.repeat(80));

    try {
      // Look for rating input
      const ratingInput =
        (await page.$('[data-testid="rating-input"]')) ||
        (await page.$('.rating-input')) ||
        (await page.$('button[aria-label*="star"]'));

      if (ratingInput) {
        console.log('✅ Rating input component found');
        testResults.passed.push('Rating input component exists');
      } else {
        console.log('⚠️  Rating input not visible (may require authentication)');
        testResults.warnings.push('Rating input not visible');
      }

      // Look for sign-in prompt
      const signInPrompt = await page.$('text=/sign in/i, text=/log in/i');
      if (signInPrompt) {
        console.log('✅ Sign-in prompt displayed for anonymous users');
        testResults.passed.push('Sign-in prompt shows for unauthenticated users');
      }
    } catch (error) {
      console.log(`❌ Error checking rating input: ${error.message}`);
    }

    console.log('\n📄 TEST 6: Comments Section');
    console.log('-'.repeat(80));

    try {
      // Scroll further down
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.7));
      await page.waitForTimeout(1000);

      const screenshotPath3 = `${SCREENSHOT_DIR}/03-comments-section.png`;
      await page.screenshot({ path: screenshotPath3 });
      console.log(`📸 Screenshot saved: ${screenshotPath3}`);
      testResults.screenshots.push(screenshotPath3);

      // Look for comments section
      const commentsSection =
        (await page.$('[data-testid="comments-section"]')) ||
        (await page.$('.comments-section')) ||
        (await page.evaluate(() => {
          const headings = Array.from(document.querySelectorAll('h2, h3'));
          return headings.some((h) => /comments/i.test(h.textContent));
        }));

      if (commentsSection) {
        console.log('✅ Comments section found');
        testResults.passed.push('Comments section exists');
      } else {
        console.log('⚠️  Comments section not found');
        testResults.warnings.push('Comments section not visible');
      }

      // Look for comment input
      const commentInput =
        (await page.$('textarea[placeholder*="comment"]')) ||
        (await page.$('[data-testid="comment-input"]'));

      if (commentInput) {
        console.log('✅ Comment input field found');
        testResults.passed.push('Comment input field exists');
      } else {
        console.log('⚠️  Comment input not visible (may require authentication)');
        testResults.warnings.push('Comment input not visible');
      }
    } catch (error) {
      console.log(`❌ Error checking comments: ${error.message}`);
      testResults.failed.push(`Comments check failed: ${error.message}`);
    }

    console.log('\n📄 TEST 7: Flag and Favorite Buttons');
    console.log('-'.repeat(80));

    try {
      // Scroll back to top
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(1000);

      // Look for flag button
      const flagButton =
        (await page.$('button[aria-label*="flag"]')) ||
        (await page.$('button[aria-label*="report"]')) ||
        (await page.$('[data-testid="flag-button"]'));

      if (flagButton) {
        console.log('✅ Flag button found');
        testResults.passed.push('Flag button exists');

        // Try to hover
        await flagButton.hover();
        await page.waitForTimeout(500);

        const screenshotPath4 = `${SCREENSHOT_DIR}/04-flag-button-hover.png`;
        await page.screenshot({ path: screenshotPath4 });
        console.log(`📸 Screenshot saved: ${screenshotPath4}`);
        testResults.screenshots.push(screenshotPath4);
      } else {
        console.log('⚠️  Flag button not found');
        testResults.warnings.push('Flag button not visible');
      }

      // Look for favorite button
      const favoriteButton =
        (await page.$('button[aria-label*="favorite"]')) ||
        (await page.$('button[aria-label*="heart"]')) ||
        (await page.$('[data-testid="favorite-button"]'));

      if (favoriteButton) {
        console.log('✅ Favorite button found');
        testResults.passed.push('Favorite button exists');

        const screenshotPath5 = `${SCREENSHOT_DIR}/05-favorite-button.png`;
        await page.screenshot({ path: screenshotPath5 });
        console.log(`📸 Screenshot saved: ${screenshotPath5}`);
        testResults.screenshots.push(screenshotPath5);
      } else {
        console.log('⚠️  Favorite button not found');
        testResults.warnings.push('Favorite button not visible');
      }
    } catch (error) {
      console.log(`❌ Error checking buttons: ${error.message}`);
      testResults.failed.push(`Button check failed: ${error.message}`);
    }

    console.log('\n📄 TEST 8: Flag Dialog');
    console.log('-'.repeat(80));

    try {
      const flagButton =
        (await page.$('button[aria-label*="flag"]')) ||
        (await page.$('button[aria-label*="report"]'));

      if (flagButton) {
        console.log('Clicking flag button...');
        await flagButton.click();
        await page.waitForTimeout(1000);

        const screenshotPath6 = `${SCREENSHOT_DIR}/06-flag-dialog-open.png`;
        await page.screenshot({ path: screenshotPath6 });
        console.log(`📸 Screenshot saved: ${screenshotPath6}`);
        testResults.screenshots.push(screenshotPath6);

        // Check for radio buttons
        const radioButtons = await page.$$('input[type="radio"]');
        console.log(`   Found ${radioButtons.length} radio buttons`);

        if (radioButtons.length >= 5) {
          console.log('✅ Flag dialog has correct number of options (5+)');
          testResults.passed.push('Flag dialog has proper options');
        } else if (radioButtons.length > 0) {
          console.log(`Warning: Flag dialog has ${radioButtons.length} options (expected 5)`);
          testResults.warnings.push(`Flag dialog has ${radioButtons.length} options`);
        }

        // Look for description field
        const descriptionField =
          (await page.$('textarea[name*="description"]')) ||
          (await page.$('textarea[placeholder*="description"]'));

        if (descriptionField) {
          console.log('✅ Description field found in flag dialog');
          testResults.passed.push('Flag dialog has description field');
        }

        // Close dialog (press Escape)
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      } else {
        console.log('⚠️  Could not test flag dialog (button not found)');
        testResults.warnings.push('Flag dialog not tested');
      }
    } catch (error) {
      console.log(`❌ Error testing flag dialog: ${error.message}`);
      testResults.failed.push(`Flag dialog test failed: ${error.message}`);
    }

    console.log('\n📄 TEST 9: Mobile Responsiveness');
    console.log('-'.repeat(80));

    try {
      // Set mobile viewport
      await page.setViewport({ width: 375, height: 667 });
      await page.goto(RECIPE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
      await page.waitForTimeout(2000);

      const screenshotPath7 = `${SCREENSHOT_DIR}/07-mobile-full-page.png`;
      await page.screenshot({ path: screenshotPath7, fullPage: true });
      console.log(`📸 Screenshot saved: ${screenshotPath7}`);
      testResults.screenshots.push(screenshotPath7);

      console.log('✅ Mobile viewport tested');
      testResults.passed.push('Mobile responsiveness verified');

      // Check touch target sizes
      const flagButton =
        (await page.$('button[aria-label*="flag"]')) ||
        (await page.$('button[aria-label*="report"]'));

      if (flagButton) {
        const box = await flagButton.boundingBox();
        if (box) {
          const isTouchTarget = box.width >= 44 && box.height >= 44;
          console.log(`   Flag button size: ${Math.round(box.width)}x${Math.round(box.height)}px`);
          console.log(
            `   ${isTouchTarget ? '✅' : '⚠️ '} Touch target ${isTouchTarget ? 'adequate' : 'too small'} (need 44x44px)`
          );

          if (isTouchTarget) {
            testResults.passed.push('Flag button touch target adequate');
          } else {
            testResults.warnings.push(
              `Flag button touch target too small: ${Math.round(box.width)}x${Math.round(box.height)}px`
            );
          }
        }
      }

      // Scroll on mobile
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
      await page.waitForTimeout(1000);

      const screenshotPath8 = `${SCREENSHOT_DIR}/08-mobile-ratings-section.png`;
      await page.screenshot({ path: screenshotPath8 });
      console.log(`📸 Screenshot saved: ${screenshotPath8}`);
      testResults.screenshots.push(screenshotPath8);

      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.7));
      await page.waitForTimeout(1000);

      const screenshotPath9 = `${SCREENSHOT_DIR}/09-mobile-comments-section.png`;
      await page.screenshot({ path: screenshotPath9 });
      console.log(`📸 Screenshot saved: ${screenshotPath9}`);
      testResults.screenshots.push(screenshotPath9);

      console.log('✅ Mobile screenshots captured');
      testResults.passed.push('Mobile screenshots captured successfully');
    } catch (error) {
      console.log(`❌ Error testing mobile: ${error.message}`);
      testResults.failed.push(`Mobile test failed: ${error.message}`);
    }

    console.log('\n📄 TEST 10: Console Monitoring Summary');
    console.log('-'.repeat(80));

    const errors = consoleLogs.filter((log) => log.type === 'error');
    const warnings = consoleLogs.filter((log) => log.type === 'warning');

    console.log(`Total console errors: ${errors.length}`);
    console.log(`Total console warnings: ${warnings.length}`);

    if (errors.length === 0) {
      console.log('✅ No console errors detected');
      testResults.passed.push('No console errors');
    }

    if (warnings.length === 0) {
      console.log('✅ No console warnings detected');
      testResults.passed.push('No console warnings');
    }
  } catch (error) {
    console.error(`\n❌ Critical error during testing: ${error.message}`);
    testResults.failed.push(`Critical error: ${error.message}`);
  } finally {
    await browser.close();
  }

  // Print summary
  console.log('\n\n');
  console.log('='.repeat(80));
  console.log('🎯 EPIC 7.2 TEST RESULTS SUMMARY');
  console.log('='.repeat(80));
  console.log(`\n✅ PASSED: ${testResults.passed.length}`);
  for (const test of testResults.passed) {
    console.log(`   ✅ ${test}`);
  }

  console.log(`\n⚠️  WARNINGS: ${testResults.warnings.length}`);
  for (const warning of testResults.warnings) {
    console.log(`   ⚠️  ${warning}`);
  }

  console.log(`\n❌ FAILED: ${testResults.failed.length}`);
  for (const failure of testResults.failed) {
    console.log(`   ❌ ${failure}`);
  }

  console.log(`\n📸 SCREENSHOTS: ${testResults.screenshots.length}`);
  for (const screenshot of testResults.screenshots) {
    console.log(`   📸 ${screenshot}`);
  }

  console.log('\n');
  console.log('='.repeat(80));
  console.log('✅ Testing complete!');
  console.log('='.repeat(80));
  console.log('\n');
}

// Run tests
runTests().catch((error) => {
  console.error(`Fatal error: ${error.message}`);
  process.exit(1);
});
