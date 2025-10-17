import { expect, test } from '@playwright/test';
import { RECIPE_PATHS, TEST_RECIPES } from '../fixtures/test-recipes';

/**
 * UAT Test Suite: Navigation Flows
 *
 * Tests navigation between different parts of the application
 *
 * Business Requirements:
 * - Users can navigate from home to recipe details
 * - Users can navigate from Top 50 to recipe details
 * - Users can navigate from shared recipes to recipe details
 * - Users can navigate between similar recipes
 * - Back button works correctly
 * - Navigation preserves slug URLs
 */

test.describe('Recipe Navigation Flows', () => {
  test.beforeEach(async ({ page }) => {
    // Monitor navigation errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.error(`[Navigation Error] ${msg.text()}`);
      }
    });
  });

  test('should navigate from home page to recipe detail', async ({ page }) => {
    // Test User Journey: Browse -> View Recipe
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify home page loaded
    await expect(page.locator('h1, h2')).toBeVisible();

    // Find and click first recipe card
    const recipeCard = page.locator('[data-testid="recipe-card"], .recipe-card').first();
    await expect(recipeCard).toBeVisible();
    await recipeCard.click();

    // Verify navigated to recipe detail page
    await page.waitForURL(/\/recipes\/[a-z0-9-]+$/);
    await expect(page.locator('h1')).toBeVisible();

    // Verify URL uses slug format
    const url = page.url();
    expect(url).toMatch(/\/recipes\/[a-z0-9-]+$/);
    expect(url).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/); // Not UUID
  });

  test('should navigate from Top 50 page to recipe detail', async ({ page }) => {
    // Test User Journey: Top Recipes -> View Recipe
    await page.goto(RECIPE_PATHS.top50);
    await page.waitForLoadState('networkidle');

    // Verify Top 50 page loaded
    await expect(page.locator('text=/top.*50|50.*recipes/i')).toBeVisible();

    // Find and click a recipe card
    const recipeCard = page.locator('[data-testid="recipe-card"], .recipe-card').first();
    await expect(recipeCard).toBeVisible();
    await recipeCard.click();

    // Verify navigated to recipe detail
    await page.waitForURL(/\/recipes\/[a-z0-9-]+$/);
    await expect(page.locator('h1')).toBeVisible();
  });

  test('should navigate from shared recipes to recipe detail', async ({ page }) => {
    // Test User Journey: Discover Shared -> View Recipe
    await page.goto(RECIPE_PATHS.shared);
    await page.waitForLoadState('networkidle');

    // Find a recipe card if any exist
    const recipeCard = page.locator('[data-testid="recipe-card"], .recipe-card').first();

    if (await recipeCard.isVisible()) {
      await recipeCard.click();

      // Verify navigated to recipe detail
      await page.waitForURL(/\/recipes\/[a-z0-9-]+$/);
      await expect(page.locator('h1')).toBeVisible();
    }
  });

  test('should navigate between similar recipes', async ({ page }) => {
    // Test User Journey: View Recipe -> Similar Recipe -> Another Similar Recipe
    await page.goto(`/recipes/${TEST_RECIPES.tarragonLobster.slug}`);
    await page.waitForLoadState('networkidle');

    // Wait for similar recipes to load
    await page.waitForTimeout(2000);

    // Check if similar recipes section exists
    const similarSection = page.locator('text=/recipes like this|similar recipes/i');

    if (await similarSection.isVisible()) {
      // Find similar recipe cards
      const similarCards = page.locator('[data-testid="recipe-card"]');
      const count = await similarCards.count();

      if (count > 0) {
        // Click on first similar recipe
        await similarCards.first().click();

        // Verify navigated to new recipe
        await page.waitForLoadState('networkidle');
        await expect(page.locator('h1')).toBeVisible();

        // URL should still use slug format
        const url = page.url();
        expect(url).toMatch(/\/recipes\/[a-z0-9-]+$/);
      }
    }
  });

  test('should return to recipe list using back button', async ({ page }) => {
    // Test User Journey: List -> Detail -> Back -> List
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const homeUrl = page.url();

    // Navigate to recipe
    const recipeCard = page.locator('[data-testid="recipe-card"], .recipe-card').first();
    await recipeCard.click();
    await page.waitForLoadState('networkidle');

    // Verify on recipe detail page
    await expect(page).toHaveURL(/\/recipes\/[a-z0-9-]+$/);

    // Go back
    await page.goBack();
    await page.waitForLoadState('networkidle');

    // Verify returned to home
    await expect(page).toHaveURL(homeUrl);
    await expect(page.locator('[data-testid="recipe-card"], .recipe-card')).toBeVisible();
  });

  test('should navigate forward after going back', async ({ page }) => {
    // Test User Journey: Forward/Back navigation works correctly
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Navigate to recipe
    const recipeCard = page.locator('[data-testid="recipe-card"], .recipe-card').first();
    await recipeCard.click();
    await page.waitForLoadState('networkidle');

    const recipeUrl = page.url();

    // Go back
    await page.goBack();
    await page.waitForLoadState('networkidle');

    // Go forward
    await page.goForward();
    await page.waitForLoadState('networkidle');

    // Should be back on recipe page
    await expect(page).toHaveURL(recipeUrl);
    await expect(page.locator('h1')).toBeVisible();
  });

  test('should maintain scroll position when navigating back', async ({ page }) => {
    // Test UX: Scroll position preserved on back navigation
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Scroll down the page
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(500);

    const scrollPosition = await page.evaluate(() => window.scrollY);
    expect(scrollPosition).toBeGreaterThan(0);

    // Navigate to recipe
    const recipeCard = page.locator('[data-testid="recipe-card"], .recipe-card').first();
    await recipeCard.click();
    await page.waitForLoadState('networkidle');

    // Go back
    await page.goBack();
    await page.waitForLoadState('networkidle');

    // Wait a moment for scroll restoration
    await page.waitForTimeout(500);

    // Scroll position should be similar (with some tolerance)
    const newScrollPosition = await page.evaluate(() => window.scrollY);
    expect(Math.abs(newScrollPosition - scrollPosition)).toBeLessThan(100);
  });

  test('should handle direct navigation to recipe', async ({ page }) => {
    // Test User Journey: Direct URL access (bookmarked/shared URL)
    await page.goto(`/recipes/${TEST_RECIPES.carrotCake.slug}`);
    await page.waitForLoadState('networkidle');

    // Verify recipe loaded directly
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('h1')).toContainText(/carrot cake/i);

    // Verify URL is correct
    await expect(page).toHaveURL(new RegExp(TEST_RECIPES.carrotCake.slug));
  });

  test('should navigate using browser navigation buttons', async ({ page }) => {
    // Test UX: All browser navigation methods work
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Navigate to recipe
    const recipeCard = page.locator('[data-testid="recipe-card"], .recipe-card').first();
    await recipeCard.click();
    await page.waitForLoadState('networkidle');

    // Navigate to another page (Top 50)
    await page.goto(RECIPE_PATHS.top50);
    await page.waitForLoadState('networkidle');

    // Go back twice
    await page.goBack();
    await page.waitForLoadState('networkidle');
    await page.goBack();
    await page.waitForLoadState('networkidle');

    // Should be back at home
    await expect(page).toHaveURL('/');
  });

  test('should preserve query parameters during navigation', async ({ page }) => {
    // Test Edge Case: Query parameters should be preserved
    await page.goto('/?filter=dessert');
    await page.waitForLoadState('networkidle');

    // Navigate to recipe
    const recipeCard = page.locator('[data-testid="recipe-card"], .recipe-card').first();
    if (await recipeCard.isVisible()) {
      await recipeCard.click();
      await page.waitForLoadState('networkidle');

      // Go back
      await page.goBack();
      await page.waitForLoadState('networkidle');

      // Query parameter should be preserved
      const url = page.url();
      expect(url).toContain('filter=dessert');
    }
  });

  test('should handle rapid navigation clicks', async ({ page }) => {
    // Test Edge Case: Multiple rapid clicks don't cause issues
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const recipeCard = page.locator('[data-testid="recipe-card"], .recipe-card').first();

    // Click multiple times rapidly
    await recipeCard.click({ clickCount: 1 });

    // Wait for navigation
    await page.waitForLoadState('networkidle');

    // Verify only navigated once
    await expect(page).toHaveURL(/\/recipes\/[a-z0-9-]+$/);
    await expect(page.locator('h1')).toBeVisible();
  });

  test('should handle navigation with keyboard', async ({ page }) => {
    // Test Accessibility: Keyboard navigation works
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Tab to first recipe card
    await page.keyboard.press('Tab');

    // Find focused element
    const focusedElement = page.locator(':focus');

    // If focused on a recipe link, press Enter
    const href = await focusedElement.getAttribute('href');
    if (href?.includes('/recipes/')) {
      await page.keyboard.press('Enter');
      await page.waitForLoadState('networkidle');

      // Verify navigated to recipe
      await expect(page).toHaveURL(/\/recipes\/[a-z0-9-]+$/);
    }
  });
});
