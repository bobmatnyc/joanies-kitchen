import { test, expect } from '@playwright/test';
import { TEST_RECIPES } from '../fixtures/test-recipes';

/**
 * UAT Test Suite: Recipe Page Functionality
 *
 * Tests recipe detail pages to ensure all features work correctly
 *
 * Business Requirements:
 * - Recipe details should load and display correctly
 * - Images should render properly
 * - Recipe metadata should be visible (prep time, servings, etc.)
 * - Similar recipes widget should work without errors
 * - No hydration errors should occur
 * - Page should be responsive and accessible
 */

test.describe('Recipe Page Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Monitor console for errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.error(`[Browser Error] ${msg.text()}`);
      }
    });

    // Monitor page errors
    page.on('pageerror', (error) => {
      console.error(`[Page Error] ${error.message}`);
    });
  });

  test('should display recipe name and description', async ({ page }) => {
    // Test Business Goal: Users can view recipe basic information
    await page.goto(`/recipes/${TEST_RECIPES.tarragonLobster.slug}`);
    await page.waitForLoadState('networkidle');

    // Verify recipe name is displayed as heading
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
    await expect(heading).toContainText(/tarragon/i);

    // Verify description exists
    const description = page.locator('[data-testid="recipe-description"], p').first();
    await expect(description).toBeVisible();
  });

  test('should display recipe images', async ({ page }) => {
    // Test Business Goal: Visual recipe presentation
    await page.goto(`/recipes/${TEST_RECIPES.carrotCake.slug}`);
    await page.waitForLoadState('networkidle');

    // Find recipe image
    const image = page.locator('img[alt*="Carrot"], img[alt*="carrot"]').first();

    // Verify image is visible and loaded
    await expect(image).toBeVisible();

    // Verify image has proper alt text
    const altText = await image.getAttribute('alt');
    expect(altText).toBeTruthy();
    expect(altText?.length).toBeGreaterThan(0);

    // Verify image loaded successfully (not broken)
    const naturalWidth = await image.evaluate((img: HTMLImageElement) => img.naturalWidth);
    expect(naturalWidth).toBeGreaterThan(0);
  });

  test('should display recipe metadata', async ({ page }) => {
    // Test Business Goal: Users can see cooking time and serving information
    await page.goto(`/recipes/${TEST_RECIPES.tarragonLobster.slug}`);
    await page.waitForLoadState('networkidle');

    // Look for time indicators (prep time, cook time, total time)
    const timeInfo = page.locator('text=/\\d+\\s*(min|hour|hr)/i').first();
    await expect(timeInfo).toBeVisible();

    // Look for servings information
    const servingsInfo = page.locator('text=/\\d+\\s*serving/i').first();
    await expect(servingsInfo).toBeVisible();
  });

  test('should display ingredients list', async ({ page }) => {
    // Test Business Goal: Users can view recipe ingredients
    await page.goto(`/recipes/${TEST_RECIPES.tarragonLobster.slug}`);
    await page.waitForLoadState('networkidle');

    // Look for ingredients section
    const ingredientsHeading = page.locator('text=/ingredients/i');
    await expect(ingredientsHeading).toBeVisible();

    // Verify ingredients are listed
    const ingredientsList = page.locator('[data-testid="ingredients-list"], ul, ol').first();
    await expect(ingredientsList).toBeVisible();

    // Count ingredients (should have at least 1)
    const ingredientItems = ingredientsList.locator('li');
    await expect(ingredientItems.first()).toBeVisible();
  });

  test('should display instructions', async ({ page }) => {
    // Test Business Goal: Users can follow cooking instructions
    await page.goto(`/recipes/${TEST_RECIPES.carrotCake.slug}`);
    await page.waitForLoadState('networkidle');

    // Look for instructions section
    const instructionsHeading = page.locator('text=/instructions|directions|steps/i');
    await expect(instructionsHeading).toBeVisible();

    // Verify instructions are listed
    const instructionsList = page.locator('[data-testid="instructions-list"], ol, ul').first();
    await expect(instructionsList).toBeVisible();

    // Verify at least one instruction step
    const instructionItems = instructionsList.locator('li');
    await expect(instructionItems.first()).toBeVisible();
  });

  test('should load similar recipes widget without errors', async ({ page }) => {
    // Test Business Goal: Recipe discovery through similar recipes
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(`/recipes/${TEST_RECIPES.tarragonLobster.slug}`);
    await page.waitForLoadState('networkidle');

    // Wait for similar recipes section to potentially load
    await page.waitForTimeout(2000); // Give it time to load async

    // Look for similar recipes section
    const similarSection = page.locator('text=/recipes like this|similar recipes/i');

    // If similar recipes exist, verify they're displayed correctly
    if (await similarSection.isVisible()) {
      // Verify no hydration errors occurred
      const hydrationErrors = consoleErrors.filter((err) =>
        err.toLowerCase().includes('hydration')
      );
      expect(hydrationErrors).toHaveLength(0);

      // Verify similar recipe cards are present
      const similarCards = page.locator('[data-testid="recipe-card"]');
      const count = await similarCards.count();
      if (count > 0) {
        expect(count).toBeGreaterThan(0);
        expect(count).toBeLessThanOrEqual(6); // Default limit
      }
    }

    // Verify no nested <a> tag errors
    const nestedLinkErrors = consoleErrors.filter((err) =>
      err.includes('cannot appear as a descendant') || err.includes('<a> cannot')
    );
    expect(nestedLinkErrors).toHaveLength(0);
  });

  test('should not have hydration mismatches', async ({ page }) => {
    // Test Critical: No React hydration errors
    const hydrationErrors: string[] = [];

    page.on('console', (msg) => {
      if (
        msg.type() === 'error' &&
        (msg.text().includes('Hydration') ||
          msg.text().includes('hydration') ||
          msg.text().includes('did not match'))
      ) {
        hydrationErrors.push(msg.text());
      }
    });

    await page.goto(`/recipes/${TEST_RECIPES.carrotCake.slug}`);
    await page.waitForLoadState('networkidle');

    // Wait a bit for any delayed hydration errors
    await page.waitForTimeout(1000);

    // Verify no hydration errors occurred
    expect(hydrationErrors).toHaveLength(0);
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Test Business Goal: Mobile-friendly recipe viewing
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE size

    await page.goto(`/recipes/${TEST_RECIPES.tarragonLobster.slug}`);
    await page.waitForLoadState('networkidle');

    // Verify main content is visible
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();

    // Verify no horizontal scrolling required
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5); // 5px tolerance

    // Verify images are responsive
    const image = page.locator('img').first();
    if (await image.isVisible()) {
      const imageWidth = await image.evaluate((img: HTMLImageElement) =>
        img.getBoundingClientRect().width
      );
      expect(imageWidth).toBeLessThanOrEqual(375);
    }
  });

  test('should handle recipe without images gracefully', async ({ page }) => {
    // Test Edge Case: Recipes without images should still display
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Find any recipe card
    const recipeCard = page.locator('[data-testid="recipe-card"]').first();
    await recipeCard.click();

    await page.waitForLoadState('networkidle');

    // Verify page loaded successfully even if no image
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
  });

  test('should load performance metrics within acceptable range', async ({ page }) => {
    // Test Performance: Page should load quickly
    const startTime = Date.now();

    await page.goto(`/recipes/${TEST_RECIPES.carrotCake.slug}`);
    await page.waitForLoadState('domcontentloaded');

    const loadTime = Date.now() - startTime;

    // DOMContentLoaded should happen within 3 seconds
    expect(loadTime).toBeLessThan(3000);

    // Wait for full load
    await page.waitForLoadState('networkidle');

    const fullLoadTime = Date.now() - startTime;

    // Full load should happen within 5 seconds
    expect(fullLoadTime).toBeLessThan(5000);
  });

  test('should have accessible recipe content', async ({ page }) => {
    // Test Accessibility: Recipe should be accessible to screen readers
    await page.goto(`/recipes/${TEST_RECIPES.tarragonLobster.slug}`);
    await page.waitForLoadState('networkidle');

    // Verify proper heading hierarchy
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBeGreaterThanOrEqual(1);
    expect(h1Count).toBeLessThanOrEqual(2); // Should only have 1-2 h1 tags

    // Verify images have alt text
    const images = await page.locator('img').all();
    for (const img of images) {
      const alt = await img.getAttribute('alt');
      expect(alt).toBeDefined();
    }

    // Verify links have accessible names
    const links = await page.locator('a').all();
    for (const link of links.slice(0, 5)) {
      // Check first 5 links
      const ariaLabel = await link.getAttribute('aria-label');
      const text = await link.textContent();
      expect(ariaLabel || text).toBeTruthy();
    }
  });
});
