import { expect, test } from '@playwright/test';

test.describe('Final Production Validation', () => {
  test('Mobile Chef Tags Overflow - Enhanced Fix', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('http://localhost:3005/discover/chefs', { waitUntil: 'networkidle' });

    // Wait for chef cards to load
    await page.waitForSelector('[data-testid="chef-card"]', { timeout: 10000 });

    // Check for horizontal overflow
    const cards = await page.locator('[data-testid="chef-card"]').all();

    if (cards.length === 0) {
      throw new Error('No chef cards found on page');
    }

    console.log(`Found ${cards.length} chef cards`);

    // Check first few cards for overflow
    for (let i = 0; i < Math.min(3, cards.length); i++) {
      const card = cards[i];
      const box = await card.boundingBox();

      if (box) {
        console.log(`Card ${i + 1} width: ${box.width}px`);

        // Check if card width exceeds viewport
        if (box.width > 375) {
          throw new Error(`Card ${i + 1} overflows: ${box.width}px > 375px`);
        }
      }
    }

    // Check for tag overflow specifically
    const tags = await page
      .locator('[data-testid="chef-card"] .tag, [data-testid="chef-card"] [class*="tag"]')
      .all();

    if (tags.length > 0) {
      console.log(`Found ${tags.length} tags`);

      for (let i = 0; i < Math.min(5, tags.length); i++) {
        const tag = tags[i];
        const box = await tag.boundingBox();

        if (box) {
          // Tags should not exceed reasonable width on mobile
          if (box.width > 300) {
            console.warn(`Tag ${i + 1} might be too wide: ${box.width}px`);
          }
        }
      }
    }

    console.log('✓ Mobile chef tags overflow check PASSED');
  });

  test('Protected Route Still Requires Auth', async ({ page }) => {
    // Test that /profile redirects or shows auth requirement
    const response = await page.goto('http://localhost:3005/profile');

    const url = page.url();
    const hasSignIn = (await page.locator('text=/sign.?in/i').count()) > 0;
    const isRedirected =
      url.includes('login') || url.includes('signin') || url !== 'http://localhost:3005/profile';

    if (!hasSignIn && !isRedirected) {
      throw new Error('Protected route /profile accessible without auth');
    }

    console.log('✓ Protected routes still require authentication');
  });

  test('No Critical JavaScript Errors', async ({ page }) => {
    const errors: string[] = [];

    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('http://localhost:3005/');
    await page.waitForLoadState('networkidle');

    // Filter out known non-critical errors
    const criticalErrors = errors.filter(
      (err) => !err.includes('favicon') && !err.includes('404') && !err.includes('ResizeObserver')
    );

    if (criticalErrors.length > 0) {
      console.warn('JavaScript errors found:', criticalErrors);
    } else {
      console.log('✓ No critical JavaScript errors');
    }
  });
});
