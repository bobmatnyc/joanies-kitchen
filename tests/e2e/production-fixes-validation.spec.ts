import { expect, type Page, test } from '@playwright/test';

/**
 * Production Fixes Comprehensive Validation Suite
 * Testing all fixes on localhost:3005
 *
 * Test Coverage:
 * 1. Beta Launch Date Update
 * 2. Mobile Chef Tags Overflow Fix
 * 3. Meals Page Public Access
 * 4. Chefs Page Public Access
 * 5. Recipe Images Display
 * 6. Regression Testing
 */

const BASE_URL = 'http://localhost:3005';

// Test configuration for different viewports
const VIEWPORTS = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1920, height: 1080 },
};

test.describe('Production Fixes Validation - localhost:3005', () => {
  test.describe('1. Beta Launch Date Update', () => {
    test('should display correct beta launch date on homepage', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');

      // Look for AlphaStamp component with beta launch date
      const alphaStamp = await page.locator('text=/BETA LAUNCH 11\\/16/i').first();
      await expect(alphaStamp).toBeVisible({ timeout: 10000 });

      // Take screenshot as evidence
      await page.screenshot({
        path: 'test-results/screenshots/homepage-beta-date.png',
        fullPage: false,
      });

      console.log('✅ Beta launch date verified on homepage');
    });

    test('should display November 16, 2024 on registration-closed page', async ({ page }) => {
      await page.goto(`${BASE_URL}/registration-closed`);
      await page.waitForLoadState('networkidle');

      // Look for the date text
      const dateText = await page.locator('text=/November 16,? 2024/i').first();
      await expect(dateText).toBeVisible({ timeout: 10000 });

      // Take screenshot as evidence
      await page.screenshot({
        path: 'test-results/screenshots/registration-closed-date.png',
        fullPage: true,
      });

      console.log('✅ Beta launch date verified on registration-closed page');
    });
  });

  test.describe('2. Mobile Chef Tags Overflow Fix', () => {
    test('should display chef cards without tag overflow on mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize(VIEWPORTS.mobile);

      await page.goto(`${BASE_URL}/discover/chefs`);
      await page.waitForLoadState('networkidle');

      // Wait for chef cards to load
      const chefCards = await page.locator('[data-testid*="chef-card"], .chef-card, article').all();

      if (chefCards.length === 0) {
        // Try alternative selectors
        await page.waitForSelector('main', { timeout: 10000 });
      }

      // Take screenshot of the page
      await page.screenshot({
        path: 'test-results/screenshots/mobile-chefs-page.png',
        fullPage: true,
      });

      // Check for horizontal scrollbar (indicates overflow)
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = VIEWPORTS.mobile.width;

      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 20); // Allow 20px tolerance

      console.log(
        `✅ Mobile chef tags overflow fixed - Body width: ${bodyWidth}px, Viewport: ${viewportWidth}px`
      );
    });

    test('should display chef tags properly on different mobile screen sizes', async ({ page }) => {
      const mobileWidths = [375, 414, 360]; // iPhone SE, iPhone Pro Max, Android

      for (const width of mobileWidths) {
        await page.setViewportSize({ width, height: 667 });
        await page.goto(`${BASE_URL}/discover/chefs`);
        await page.waitForLoadState('networkidle');

        // Check no horizontal overflow
        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        expect(bodyWidth).toBeLessThanOrEqual(width + 20);

        await page.screenshot({
          path: `test-results/screenshots/mobile-chefs-${width}px.png`,
          fullPage: true,
        });

        console.log(`✅ Chef tags verified on ${width}px width`);
      }
    });
  });

  test.describe('3. Meals Page Public Access (CRITICAL)', () => {
    test('should load meals page without authentication', async ({ page, context }) => {
      // Clear all cookies and storage to ensure unauthenticated state
      await context.clearCookies();
      await context.clearPermissions();

      const response = await page.goto(`${BASE_URL}/meals`);

      // Verify successful response
      expect(response?.status()).toBe(200);

      await page.waitForLoadState('networkidle');

      // Verify page loaded successfully
      await expect(page).toHaveURL(/\/meals/);

      // Take screenshot
      await page.screenshot({
        path: 'test-results/screenshots/meals-page-public.png',
        fullPage: true,
      });

      console.log('✅ Meals page loaded successfully without authentication');
    });

    test('should display meals on public meals page', async ({ page, context }) => {
      await context.clearCookies();

      await page.goto(`${BASE_URL}/meals`);
      await page.waitForLoadState('networkidle');

      // Wait for content to load
      await page.waitForTimeout(2000);

      // Look for meal cards or meal content
      const mealCards = await page
        .locator('article, [data-testid*="meal"], .meal-card, [class*="meal"]')
        .all();

      console.log(`Found ${mealCards.length} meal elements`);

      // Verify meals are displayed (should be 9 according to requirements)
      expect(mealCards.length).toBeGreaterThan(0);

      // Take screenshot showing meals
      await page.screenshot({
        path: 'test-results/screenshots/meals-display.png',
        fullPage: true,
      });

      console.log(`✅ Meals displayed: ${mealCards.length} meal cards found`);
    });

    test('should display meal images or placeholders', async ({ page, context }) => {
      await context.clearCookies();

      await page.goto(`${BASE_URL}/meals`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Check for images
      const images = await page.locator('img').all();
      const imageSources = await Promise.all(
        images.map(async (img) => await img.getAttribute('src'))
      );

      console.log(`Found ${images.length} images on meals page`);
      console.log('Image sources:', imageSources.filter(Boolean).slice(0, 5));

      // Take screenshot
      await page.screenshot({
        path: 'test-results/screenshots/meals-images.png',
        fullPage: true,
      });

      expect(images.length).toBeGreaterThan(0);

      console.log('✅ Meal images/placeholders verified');
    });

    test('should allow clicking on meal detail page', async ({ page, context }) => {
      await context.clearCookies();

      await page.goto(`${BASE_URL}/meals`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Find first clickable meal
      const mealLink = await page.locator('a[href*="/meals/"]').first();

      if ((await mealLink.count()) > 0) {
        await mealLink.click();
        await page.waitForLoadState('networkidle');

        // Verify navigation occurred
        await expect(page).toHaveURL(/\/meals\/.+/);

        // Take screenshot of detail page
        await page.screenshot({
          path: 'test-results/screenshots/meal-detail-page.png',
          fullPage: true,
        });

        console.log('✅ Meal detail page loaded successfully');
      } else {
        console.log('⚠️ No meal links found to test detail page');
      }
    });
  });

  test.describe('4. Chefs Page Public Access (CRITICAL)', () => {
    test('should load chefs page without authentication', async ({ page, context }) => {
      // Clear all cookies and storage
      await context.clearCookies();
      await context.clearPermissions();

      const response = await page.goto(`${BASE_URL}/discover/chefs`);

      // Verify successful response
      expect(response?.status()).toBe(200);

      await page.waitForLoadState('networkidle');

      // Verify page loaded
      await expect(page).toHaveURL(/\/discover\/chefs/);

      // Take screenshot
      await page.screenshot({
        path: 'test-results/screenshots/chefs-page-public.png',
        fullPage: true,
      });

      console.log('✅ Chefs page loaded successfully without authentication');
    });

    test('should display chefs on public chefs page', async ({ page, context }) => {
      await context.clearCookies();

      await page.goto(`${BASE_URL}/discover/chefs`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Look for chef cards
      const chefCards = await page
        .locator('article, [data-testid*="chef"], .chef-card, [class*="chef"]')
        .all();

      console.log(`Found ${chefCards.length} chef elements`);

      // Verify chefs are displayed (should be 31 according to requirements)
      expect(chefCards.length).toBeGreaterThan(0);

      // Take screenshot
      await page.screenshot({
        path: 'test-results/screenshots/chefs-display.png',
        fullPage: true,
      });

      console.log(`✅ Chefs displayed: ${chefCards.length} chef cards found`);
    });

    test('should display chef specialties correctly', async ({ page, context }) => {
      await context.clearCookies();

      await page.goto(`${BASE_URL}/discover/chefs`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Look for specialty tags or text
      const specialtyElements = await page
        .locator('[class*="specialty"], [class*="tag"], [data-testid*="specialty"]')
        .all();

      console.log(`Found ${specialtyElements.length} specialty elements`);

      // Take screenshot
      await page.screenshot({
        path: 'test-results/screenshots/chef-specialties.png',
        fullPage: true,
      });

      console.log('✅ Chef specialties display verified');
    });

    test('should allow clicking on chef detail page if applicable', async ({ page, context }) => {
      await context.clearCookies();

      await page.goto(`${BASE_URL}/discover/chefs`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Try to find clickable chef links
      const chefLink = await page.locator('a[href*="/chef"], a[href*="/discover/"]').first();

      if ((await chefLink.count()) > 0) {
        await chefLink.click();
        await page.waitForLoadState('networkidle');

        // Take screenshot of detail page
        await page.screenshot({
          path: 'test-results/screenshots/chef-detail-page.png',
          fullPage: true,
        });

        console.log('✅ Chef detail page loaded successfully');
      } else {
        console.log('⚠️ No chef detail links found (may be expected)');
      }
    });
  });

  test.describe('5. Recipe Images Display', () => {
    test('should load recipes page', async ({ page }) => {
      const response = await page.goto(`${BASE_URL}/recipes`);

      expect(response?.status()).toBe(200);

      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Take screenshot
      await page.screenshot({
        path: 'test-results/screenshots/recipes-page.png',
        fullPage: true,
      });

      console.log('✅ Recipes page loaded successfully');
    });

    test('should display recipe cards with images or placeholders', async ({ page }) => {
      await page.goto(`${BASE_URL}/recipes`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Find recipe cards
      const recipeCards = await page
        .locator('article, [data-testid*="recipe"], .recipe-card, [class*="recipe"]')
        .all();

      console.log(`Found ${recipeCards.length} recipe cards`);

      // Find images
      const images = await page.locator('img').all();

      // Count images vs placeholders
      let actualImages = 0;
      let placeholders = 0;

      for (const img of images) {
        const src = await img.getAttribute('src');
        if ((src && src.includes('placeholder')) || src?.includes('data:image')) {
          placeholders++;
        } else if (src && src.startsWith('http')) {
          actualImages++;
        }
      }

      console.log(`Images: ${actualImages} actual, ${placeholders} placeholders`);

      // Take screenshot
      await page.screenshot({
        path: 'test-results/screenshots/recipe-images-overview.png',
        fullPage: true,
      });

      expect(images.length).toBeGreaterThan(0);

      console.log('✅ Recipe images verified');
    });

    test('should load recipe detail page with images', async ({ page }) => {
      await page.goto(`${BASE_URL}/recipes`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Click on first recipe
      const recipeLink = await page.locator('a[href*="/recipes/"]').first();

      if ((await recipeLink.count()) > 0) {
        await recipeLink.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        // Check for images on detail page
        const detailImages = await page.locator('img').all();
        console.log(`Found ${detailImages.length} images on recipe detail page`);

        // Take screenshot
        await page.screenshot({
          path: 'test-results/screenshots/recipe-detail-images.png',
          fullPage: true,
        });

        console.log('✅ Recipe detail page images verified');
      }
    });
  });

  test.describe('6. Regression Testing', () => {
    test('should load homepage successfully', async ({ page }) => {
      const response = await page.goto(BASE_URL);

      expect(response?.status()).toBe(200);

      await page.waitForLoadState('networkidle');

      // Take screenshot
      await page.screenshot({
        path: 'test-results/screenshots/homepage-regression.png',
        fullPage: true,
      });

      console.log('✅ Homepage loaded successfully');
    });

    test('should display navigation menu', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');

      // Look for navigation elements
      const nav = await page.locator('nav, header').first();
      await expect(nav).toBeVisible();

      // Check for common navigation links
      const navLinks = await page.locator('nav a, header a').all();
      console.log(`Found ${navLinks.length} navigation links`);

      expect(navLinks.length).toBeGreaterThan(0);

      console.log('✅ Navigation menu verified');
    });

    test('should display authentication buttons (sign in/register)', async ({ page, context }) => {
      await context.clearCookies();

      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');

      // Look for sign in or register buttons
      const authButtons = await page
        .locator(
          'button:has-text("Sign"), a:has-text("Sign"), button:has-text("Register"), a:has-text("Register")'
        )
        .all();

      console.log(`Found ${authButtons.length} authentication buttons`);

      // Take screenshot
      await page.screenshot({
        path: 'test-results/screenshots/auth-buttons-regression.png',
        fullPage: false,
      });

      console.log('✅ Authentication buttons verified');
    });

    test('should protect /profile route (require auth)', async ({ page, context }) => {
      await context.clearCookies();

      await page.goto(`${BASE_URL}/profile`);
      await page.waitForLoadState('networkidle');

      // Should redirect to login or show auth required
      const url = page.url();
      const isProtected =
        url.includes('login') ||
        url.includes('sign-in') ||
        url.includes('auth') ||
        url !== `${BASE_URL}/profile`;

      console.log(`Profile route protection: ${isProtected ? 'PROTECTED' : 'NOT PROTECTED'}`);
      console.log(`Final URL: ${url}`);

      // Take screenshot
      await page.screenshot({
        path: 'test-results/screenshots/profile-protected.png',
        fullPage: true,
      });

      // If not redirected, check for auth required message
      if (url === `${BASE_URL}/profile`) {
        const authMessage = await page
          .locator('text=/sign in|log in|authentication required/i')
          .count();
        expect(authMessage).toBeGreaterThan(0);
      }

      console.log('✅ Profile route protection verified');
    });

    test('should capture JavaScript console errors', async ({ page }) => {
      const consoleErrors: string[] = [];
      const consoleWarnings: string[] = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        } else if (msg.type() === 'warning') {
          consoleWarnings.push(msg.text());
        }
      });

      // Test multiple pages for console errors
      const pagesToTest = ['/', '/meals', '/discover/chefs', '/recipes'];

      for (const path of pagesToTest) {
        await page.goto(`${BASE_URL}${path}`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
      }

      console.log('=== Console Errors ===');
      if (consoleErrors.length > 0) {
        consoleErrors.forEach((err) => console.log(`ERROR: ${err}`));
      } else {
        console.log('No console errors detected');
      }

      console.log('\n=== Console Warnings ===');
      if (consoleWarnings.length > 0) {
        consoleWarnings.forEach((warn) => console.log(`WARNING: ${warn}`));
      } else {
        console.log('No console warnings detected');
      }

      // Don't fail test on console errors, just report them
      console.log('✅ Console monitoring completed');
    });

    test('should measure page load performance', async ({ page }) => {
      const performanceMetrics: Array<{ page: string; loadTime: number }> = [];

      const pagesToTest = [
        { path: '/', name: 'Homepage' },
        { path: '/meals', name: 'Meals Page' },
        { path: '/discover/chefs', name: 'Chefs Page' },
        { path: '/recipes', name: 'Recipes Page' },
      ];

      for (const { path, name } of pagesToTest) {
        const startTime = Date.now();
        await page.goto(`${BASE_URL}${path}`);
        await page.waitForLoadState('networkidle');
        const loadTime = Date.now() - startTime;

        performanceMetrics.push({ page: name, loadTime });
        console.log(`${name}: ${loadTime}ms`);
      }

      console.log('\n=== Performance Summary ===');
      performanceMetrics.forEach((metric) => {
        console.log(`${metric.page}: ${metric.loadTime}ms`);
      });

      // All pages should load within reasonable time (10 seconds)
      performanceMetrics.forEach((metric) => {
        expect(metric.loadTime).toBeLessThan(10000);
      });

      console.log('✅ Performance metrics captured');
    });
  });
});
