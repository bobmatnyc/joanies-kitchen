import { type Page, expect } from '@playwright/test';

/**
 * UAT Test Helpers
 *
 * Reusable functions for common testing scenarios
 */

/**
 * Wait for recipe page to fully load
 */
export async function waitForRecipePageLoad(page: Page) {
  await page.waitForLoadState('networkidle');
  await expect(page.locator('h1')).toBeVisible({ timeout: 5000 });
}

/**
 * Monitor console for errors during test
 */
export function setupConsoleMonitoring(page: Page): string[] {
  const errors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  page.on('pageerror', (error) => {
    errors.push(`Page Error: ${error.message}`);
  });

  return errors;
}

/**
 * Check for hydration errors
 */
export function checkHydrationErrors(errors: string[]): string[] {
  return errors.filter(
    (err) =>
      err.toLowerCase().includes('hydration') ||
      err.includes('did not match') ||
      err.includes('cannot appear as a descendant')
  );
}

/**
 * Verify no horizontal scrolling on mobile
 */
export async function verifyNoHorizontalScroll(page: Page) {
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5); // 5px tolerance
}

/**
 * Verify image loaded successfully
 */
export async function verifyImageLoaded(page: Page, selector: string) {
  const image = page.locator(selector);
  await expect(image).toBeVisible();

  const naturalWidth = await image.evaluate((img: HTMLImageElement) => img.naturalWidth);
  expect(naturalWidth).toBeGreaterThan(0);

  const alt = await image.getAttribute('alt');
  expect(alt).toBeTruthy();
}

/**
 * Verify URL uses slug format (not UUID)
 */
export function verifySlugUrl(url: string) {
  expect(url).toMatch(/\/recipes\/[a-z0-9-]+$/);
  expect(url).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
}

/**
 * Get recipe cards on page
 */
export function getRecipeCards(page: Page) {
  return page.locator('[data-testid="recipe-card"], .recipe-card');
}

/**
 * Navigate to recipe and verify load
 */
export async function navigateToRecipe(page: Page, slug: string) {
  await page.goto(`/recipes/${slug}`);
  await waitForRecipePageLoad(page);
  verifySlugUrl(page.url());
}

/**
 * Measure page load performance
 */
export async function measurePageLoad(page: Page, url: string) {
  const startTime = Date.now();

  await page.goto(url);
  await page.waitForLoadState('domcontentloaded');

  const domLoadTime = Date.now() - startTime;

  await page.waitForLoadState('networkidle');

  const fullLoadTime = Date.now() - startTime;

  return {
    domLoadTime,
    fullLoadTime,
  };
}

/**
 * Verify accessibility basics
 */
export async function verifyAccessibility(page: Page) {
  // Verify heading hierarchy
  const h1Count = await page.locator('h1').count();
  expect(h1Count).toBeGreaterThanOrEqual(1);
  expect(h1Count).toBeLessThanOrEqual(2);

  // Verify images have alt text
  const images = await page.locator('img').all();
  for (const img of images) {
    const alt = await img.getAttribute('alt');
    expect(alt).toBeDefined();
  }
}

/**
 * Scroll to bottom of page
 */
export async function scrollToBottom(page: Page) {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
}

/**
 * Check if similar recipes section exists
 */
export async function hasSimilarRecipes(page: Page): Promise<boolean> {
  const similarSection = page.locator('text=/recipes like this|similar recipes/i');
  return await similarSection.isVisible();
}
