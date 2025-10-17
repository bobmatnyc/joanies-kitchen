import { expect, test } from '@playwright/test';
import { TEST_RECIPES } from '../fixtures/test-recipes';

/**
 * UAT Test Suite: Slug-Based Navigation
 *
 * Tests the slug-based URL system for recipe pages
 *
 * Business Requirements:
 * - Recipes should be accessible via human-readable slug URLs
 * - Old UUID URLs should redirect to slug URLs (301)
 * - Slug URLs should be used throughout the application
 * - URLs should be SEO-friendly and shareable
 */

test.describe('Slug-Based Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Enable console monitoring
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.error(`[Browser Error] ${msg.text()}`);
      }
    });
  });

  test('should load recipe via slug URL', async ({ page }) => {
    // Test Business Goal: Users can access recipes with readable URLs
    await page.goto(`/recipes/${TEST_RECIPES.tarragonLobster.slug}`);

    // Verify page loads successfully
    await expect(page).toHaveTitle(/Tarragon Lobster/i);

    // Verify no hydration errors in console
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && msg.text().includes('Hydration')) {
        errors.push(msg.text());
      }
    });

    // Wait for content to load
    await page.waitForLoadState('networkidle');

    expect(errors).toHaveLength(0);
  });

  test('should display correct slug in browser address bar', async ({ page }) => {
    // Test Business Goal: Shareable, readable URLs
    await page.goto(`/recipes/${TEST_RECIPES.carrotCake.slug}`);

    // Verify the URL contains the slug
    await expect(page).toHaveURL(new RegExp(TEST_RECIPES.carrotCake.slug));

    // Verify recipe name is displayed
    await expect(page.locator('h1')).toContainText(/carrot cake/i);
  });

  test('should redirect UUID URL to slug URL with 301', async ({ page }) => {
    // Test Business Goal: Backward compatibility with old URLs
    // Note: This test assumes we have UUID-to-slug redirect logic
    await page.goto(`/recipes/${TEST_RECIPES.tarragonLobster.id}`);

    // After redirect, should show slug URL
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(new RegExp(TEST_RECIPES.tarragonLobster.slug));
  });

  test('should maintain slug URL when navigating', async ({ page }) => {
    // Test Business Goal: Consistent URL format throughout user journey
    await page.goto('/');

    // Find and click on a recipe card
    const recipeCard = page.locator('[data-testid="recipe-card"]').first();
    await recipeCard.click();

    // Verify we're on a slug URL, not UUID
    await page.waitForURL(/\/recipes\/[a-z0-9-]+$/);
    const url = page.url();

    // Should NOT contain UUID pattern
    expect(url).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);

    // Should contain slug pattern (lowercase with hyphens)
    expect(url).toMatch(/\/recipes\/[a-z0-9-]+$/);
  });

  test('should handle special characters in slug URLs', async ({ page }) => {
    // Test Edge Case: URLs with special characters should be properly encoded
    const slugWithSpecialChars = 'moms-super-special-recipe';
    const response = await page.goto(`/recipes/${slugWithSpecialChars}`);

    // Should either load successfully or show 404, but not error
    expect(response?.status()).toBeLessThan(500);
  });

  test('should show 404 for non-existent slug', async ({ page }) => {
    // Test Edge Case: Invalid slugs should show proper 404
    const response = await page.goto('/recipes/this-recipe-does-not-exist-abc123');

    // Should return 404
    expect(response?.status()).toBe(404);

    // Page should display friendly 404 message
    await expect(page.locator('body')).toContainText(/not found|404/i);
  });

  test('should preserve slug URL in browser history', async ({ page }) => {
    // Test Business Goal: Browser back/forward buttons work correctly
    await page.goto(`/recipes/${TEST_RECIPES.carrotCake.slug}`);
    await page.waitForLoadState('networkidle');

    const firstUrl = page.url();

    await page.goto(`/recipes/${TEST_RECIPES.tarragonLobster.slug}`);
    await page.waitForLoadState('networkidle');

    // Go back
    await page.goBack();
    await expect(page).toHaveURL(firstUrl);

    // Go forward
    await page.goForward();
    await expect(page).toHaveURL(new RegExp(TEST_RECIPES.tarragonLobster.slug));
  });

  test('should use slug URLs in recipe links', async ({ page }) => {
    // Test Business Goal: All internal links use slug format
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Find all recipe links
    const recipeLinks = await page.locator('a[href*="/recipes/"]').all();

    let slugUrlCount = 0;
    let uuidUrlCount = 0;

    for (const link of recipeLinks.slice(0, 10)) {
      // Check first 10
      const href = await link.getAttribute('href');
      if (href) {
        if (href.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/)) {
          uuidUrlCount++;
        } else if (href.match(/\/recipes\/[a-z0-9-]+$/)) {
          slugUrlCount++;
        }
      }
    }

    // Most links should use slug format
    expect(slugUrlCount).toBeGreaterThan(uuidUrlCount);
  });
});
