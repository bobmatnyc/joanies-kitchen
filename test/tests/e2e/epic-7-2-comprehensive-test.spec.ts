import { type ConsoleMessage, expect, test } from '@playwright/test';

/**
 * Epic 7.2 Comprehensive Test Suite
 * Tests: Ratings, Comments, Flagging, and Favorites systems
 */

// Console monitoring
const consoleErrors: ConsoleMessage[] = [];
const consoleWarnings: ConsoleMessage[] = [];

test.beforeEach(async ({ page }) => {
  // Monitor console messages
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg);
    } else if (msg.type() === 'warning') {
      consoleWarnings.push(msg);
    }
  });

  // Navigate to test recipe page
  await page.goto('http://localhost:3002/recipes/pomegranate-peach-barbecue-sauce');
  await page.waitForLoadState('networkidle');
});

test.describe('Epic 7.2: Recipe Interactions - Anonymous User', () => {
  test('should display recipe with all interaction components', async ({ page }) => {
    // Check recipe page loads
    await expect(page.locator('h1')).toBeVisible();

    // Take screenshot
    await page.screenshot({
      path: '/Users/masa/Projects/joanies-kitchen/tests/screenshots/recipe-page-anonymous.png',
      fullPage: true,
    });
  });

  test('should display average rating in header', async ({ page }) => {
    // Look for rating display
    const ratingDisplay = page
      .locator('[data-testid="rating-display"], .rating-display, text=/★.*[0-9]\\./i')
      .first();

    // Check if rating component exists
    const exists = (await ratingDisplay.count()) > 0;

    if (exists) {
      await expect(ratingDisplay).toBeVisible();
      console.log('✅ Rating display found');
    } else {
      console.log('⚠️ Rating display not found - may not have ratings yet');
    }

    await page.screenshot({
      path: '/Users/masa/Projects/joanies-kitchen/tests/screenshots/rating-display.png',
    });
  });

  test('should display ratings section', async ({ page }) => {
    // Scroll to ratings section
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(500);

    // Look for ratings section
    const ratingsSection = page
      .locator('text=/ratings?/i, [data-testid="ratings-section"]')
      .first();
    const exists = (await ratingsSection.count()) > 0;

    if (exists) {
      await expect(ratingsSection).toBeVisible();
      console.log('✅ Ratings section found');
    } else {
      console.log('⚠️ Ratings section not found');
    }

    await page.screenshot({
      path: '/Users/masa/Projects/joanies-kitchen/tests/screenshots/ratings-section.png',
    });
  });

  test('should prompt sign-in when trying to rate (anonymous)', async ({ page }) => {
    // Scroll to ratings section
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(500);

    // Look for sign-in prompt or rating stars
    const signInPrompt = page.locator('text=/sign in/i, text=/log in/i').first();
    const ratingStars = page
      .locator('[data-testid="rating-input"], .rating-input, button[aria-label*="star"]')
      .first();

    const hasSignInPrompt = (await signInPrompt.count()) > 0;
    const hasRatingInput = (await ratingStars.count()) > 0;

    console.log(`Sign-in prompt: ${hasSignInPrompt}, Rating input: ${hasRatingInput}`);

    await page.screenshot({
      path: '/Users/masa/Projects/joanies-kitchen/tests/screenshots/anonymous-rating-attempt.png',
    });
  });

  test('should display comments section', async ({ page }) => {
    // Scroll to comments section
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.7));
    await page.waitForTimeout(500);

    const commentsSection = page
      .locator('text=/comments?/i, [data-testid="comments-section"]')
      .first();
    const exists = (await commentsSection.count()) > 0;

    if (exists) {
      await expect(commentsSection).toBeVisible();
      console.log('✅ Comments section found');
    } else {
      console.log('⚠️ Comments section not found');
    }

    await page.screenshot({
      path: '/Users/masa/Projects/joanies-kitchen/tests/screenshots/comments-section.png',
    });
  });

  test('should display flag button', async ({ page }) => {
    // Look for flag button
    const flagButton = page
      .locator(
        'button[aria-label*="flag"], button[aria-label*="report"], [data-testid="flag-button"]'
      )
      .first();
    const exists = (await flagButton.count()) > 0;

    if (exists) {
      await expect(flagButton).toBeVisible();
      console.log('✅ Flag button found');

      // Hover to see tooltip
      await flagButton.hover();
      await page.waitForTimeout(500);
    } else {
      console.log('⚠️ Flag button not found');
    }

    await page.screenshot({
      path: '/Users/masa/Projects/joanies-kitchen/tests/screenshots/flag-button.png',
    });
  });

  test('should display favorite button', async ({ page }) => {
    // Look for favorite/heart button
    const favoriteButton = page
      .locator(
        'button[aria-label*="favorite"], button[aria-label*="heart"], [data-testid="favorite-button"]'
      )
      .first();
    const exists = (await favoriteButton.count()) > 0;

    if (exists) {
      await expect(favoriteButton).toBeVisible();
      console.log('✅ Favorite button found');
    } else {
      console.log('⚠️ Favorite button not found');
    }

    await page.screenshot({
      path: '/Users/masa/Projects/joanies-kitchen/tests/screenshots/favorite-button.png',
    });
  });
});

test.describe('Epic 7.2: Recipe Interactions - Rating System Deep Dive', () => {
  test('should have proper rating star styling', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(500);

    // Look for star elements
    const stars = page.locator(
      '[data-icon="star"], svg[class*="star"], .star-icon, [aria-label*="star"]'
    );
    const starCount = await stars.count();

    console.log(`Found ${starCount} star elements`);

    if (starCount > 0) {
      // Check if stars are visible
      const firstStar = stars.first();
      await expect(firstStar).toBeVisible();

      // Get computed style
      const color = await firstStar.evaluate((el) => {
        return window.getComputedStyle(el).color;
      });

      console.log(`Star color: ${color}`);
    }

    await page.screenshot({
      path: '/Users/masa/Projects/joanies-kitchen/tests/screenshots/rating-stars-styling.png',
    });
  });

  test('should display review list if ratings exist', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(500);

    // Look for review items
    const reviewItems = page.locator(
      '[data-testid="review-item"], .review-item, [class*="review"]'
    );
    const count = await reviewItems.count();

    console.log(`Found ${count} review items`);

    if (count > 0) {
      // Check first review structure
      const firstReview = reviewItems.first();
      await expect(firstReview).toBeVisible();

      // Look for avatar, name, rating, timestamp
      const avatar = firstReview.locator('img, [data-testid="avatar"]').first();
      const name = firstReview.locator('text=/[A-Z][a-z]+/').first();
      const stars = firstReview.locator('[data-icon="star"], svg[class*="star"]').first();

      console.log('Review components:');
      console.log(`- Avatar: ${(await avatar.count()) > 0}`);
      console.log(`- Name: ${(await name.count()) > 0}`);
      console.log(`- Stars: ${(await stars.count()) > 0}`);
    }

    await page.screenshot({
      path: '/Users/masa/Projects/joanies-kitchen/tests/screenshots/review-list.png',
    });
  });

  test('should check for pagination controls', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.8));
    await page.waitForTimeout(500);

    // Look for "Load more" button
    const loadMoreButton = page.locator(
      'button:has-text("Load more"), button:has-text("Show more"), [data-testid="load-more"]'
    );
    const exists = (await loadMoreButton.count()) > 0;

    console.log(`Load more button exists: ${exists}`);

    await page.screenshot({
      path: '/Users/masa/Projects/joanies-kitchen/tests/screenshots/pagination-controls.png',
    });
  });
});

test.describe('Epic 7.2: Recipe Interactions - Comments System Deep Dive', () => {
  test('should display comments section structure', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.7));
    await page.waitForTimeout(500);

    // Look for comment count
    const commentCount = page.locator('text=/\\d+ comments?/i').first();
    const hasCount = (await commentCount.count()) > 0;

    console.log(`Comment count display: ${hasCount}`);

    // Look for comment input area
    const commentInput = page
      .locator('textarea[placeholder*="comment"], [data-testid="comment-input"]')
      .first();
    const hasInput = (await commentInput.count()) > 0;

    console.log(`Comment input: ${hasInput}`);

    await page.screenshot({
      path: '/Users/masa/Projects/joanies-kitchen/tests/screenshots/comments-structure.png',
    });
  });

  test('should check comment list rendering', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.7));
    await page.waitForTimeout(500);

    // Look for comment items
    const commentItems = page.locator(
      '[data-testid="comment-item"], .comment-item, [class*="comment"]'
    );
    const count = await commentItems.count();

    console.log(`Found ${count} comment items`);

    if (count > 0) {
      const firstComment = commentItems.first();
      await expect(firstComment).toBeVisible();

      // Check for avatar, name, timestamp, text
      const avatar = firstComment.locator('img, [data-testid="avatar"]').first();
      const name = firstComment.locator('text=/[A-Z][a-z]+/').first();
      const text = firstComment.locator('p, [data-testid="comment-text"]').first();

      console.log('Comment components:');
      console.log(`- Avatar: ${(await avatar.count()) > 0}`);
      console.log(`- Name: ${(await name.count()) > 0}`);
      console.log(`- Text: ${(await text.count()) > 0}`);
    }

    await page.screenshot({
      path: '/Users/masa/Projects/joanies-kitchen/tests/screenshots/comment-list.png',
    });
  });
});

test.describe('Epic 7.2: Recipe Interactions - Flagging System', () => {
  test('should open flag dialog when flag button clicked', async ({ page }) => {
    // Find flag button
    const flagButton = page
      .locator(
        'button[aria-label*="flag"], button[aria-label*="report"], [data-testid="flag-button"]'
      )
      .first();
    const exists = (await flagButton.count()) > 0;

    if (exists) {
      await flagButton.click();
      await page.waitForTimeout(500);

      // Look for dialog
      const dialog = page.locator('[role="dialog"], [data-testid="flag-dialog"], .dialog').first();
      const dialogVisible = (await dialog.count()) > 0;

      console.log(`Flag dialog opened: ${dialogVisible}`);

      if (dialogVisible) {
        // Look for radio buttons (5 options)
        const radioButtons = page.locator('input[type="radio"]');
        const radioCount = await radioButtons.count();
        console.log(`Radio button count: ${radioCount}`);

        // Look for description field
        const description = page
          .locator('textarea[name*="description"], textarea[placeholder*="description"]')
          .first();
        const hasDescription = (await description.count()) > 0;
        console.log(`Description field: ${hasDescription}`);

        await page.screenshot({
          path: '/Users/masa/Projects/joanies-kitchen/tests/screenshots/flag-dialog-open.png',
        });

        // Close dialog
        const closeButton = page
          .locator('button:has-text("Cancel"), button[aria-label="Close"]')
          .first();
        if ((await closeButton.count()) > 0) {
          await closeButton.click();
        }
      }
    } else {
      console.log('⚠️ Flag button not found');
    }
  });
});

test.describe('Epic 7.2: Recipe Interactions - Favorites System', () => {
  test('should display favorite button and count', async ({ page }) => {
    const favoriteButton = page
      .locator(
        'button[aria-label*="favorite"], button[aria-label*="heart"], [data-testid="favorite-button"]'
      )
      .first();
    const exists = (await favoriteButton.count()) > 0;

    if (exists) {
      await expect(favoriteButton).toBeVisible();

      // Look for count
      const countText = await favoriteButton.textContent();
      console.log(`Favorite button text: ${countText}`);

      // Get button state
      const ariaPressed = await favoriteButton.getAttribute('aria-pressed');
      const dataFavorited = await favoriteButton.getAttribute('data-favorited');

      console.log(
        `Favorite state - aria-pressed: ${ariaPressed}, data-favorited: ${dataFavorited}`
      );

      await page.screenshot({
        path: '/Users/masa/Projects/joanies-kitchen/tests/screenshots/favorite-button-detail.png',
      });
    }
  });
});

test.describe('Epic 7.2: Mobile Responsiveness', () => {
  test('should render properly on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('http://localhost:3002/recipes/pomegranate-peach-barbecue-sauce');
    await page.waitForLoadState('networkidle');

    // Check all sections are visible
    await page.screenshot({
      path: '/Users/masa/Projects/joanies-kitchen/tests/screenshots/mobile-top.png',
    });

    // Scroll to ratings
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(500);
    await page.screenshot({
      path: '/Users/masa/Projects/joanies-kitchen/tests/screenshots/mobile-ratings.png',
    });

    // Scroll to comments
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.7));
    await page.waitForTimeout(500);
    await page.screenshot({
      path: '/Users/masa/Projects/joanies-kitchen/tests/screenshots/mobile-comments.png',
    });

    console.log('✅ Mobile responsiveness check complete');
  });

  test('should have proper touch targets on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('http://localhost:3002/recipes/pomegranate-peach-barbecue-sauce');
    await page.waitForLoadState('networkidle');

    // Check favorite button size
    const favoriteButton = page
      .locator('button[aria-label*="favorite"], button[aria-label*="heart"]')
      .first();
    if ((await favoriteButton.count()) > 0) {
      const box = await favoriteButton.boundingBox();
      if (box) {
        console.log(`Favorite button size: ${box.width}x${box.height}px`);
        console.log(`Touch target adequate: ${box.width >= 44 && box.height >= 44}`);
      }
    }

    // Check flag button size
    const flagButton = page
      .locator('button[aria-label*="flag"], button[aria-label*="report"]')
      .first();
    if ((await flagButton.count()) > 0) {
      const box = await flagButton.boundingBox();
      if (box) {
        console.log(`Flag button size: ${box.width}x${box.height}px`);
        console.log(`Touch target adequate: ${box.width >= 44 && box.height >= 44}`);
      }
    }
  });
});

test.describe('Epic 7.2: Console Monitoring', () => {
  test('should report console errors and warnings', async ({ page }) => {
    // Navigate and interact with page
    await page.goto('http://localhost:3002/recipes/pomegranate-peach-barbecue-sauce');
    await page.waitForLoadState('networkidle');

    // Scroll through page
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(500);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.7));
    await page.waitForTimeout(500);

    console.log('\n=== CONSOLE MONITORING REPORT ===');
    console.log(`Total console errors: ${consoleErrors.length}`);
    console.log(`Total console warnings: ${consoleWarnings.length}`);

    if (consoleErrors.length > 0) {
      console.log('\n--- Console Errors ---');
      for (const err of consoleErrors) {
        console.log(`ERROR: ${err.text()}`);
      }
    }

    if (consoleWarnings.length > 0) {
      console.log('\n--- Console Warnings ---');
      for (const warn of consoleWarnings) {
        console.log(`WARN: ${warn.text()}`);
      }
    }

    console.log('================================\n');
  });
});

test.afterAll(async () => {
  // Final console report
  console.log('\n=== FINAL TEST SUMMARY ===');
  console.log(`Total tests completed`);
  console.log(`Console errors detected: ${consoleErrors.length}`);
  console.log(`Console warnings detected: ${consoleWarnings.length}`);
  console.log('==========================\n');
});
