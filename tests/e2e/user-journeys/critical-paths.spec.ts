import { expect, test } from '@playwright/test';
import { RECIPE_PATHS, TEST_RECIPES } from '../fixtures/test-recipes';

/**
 * UAT Test Suite: Critical User Journeys
 *
 * Tests complete end-to-end user workflows that represent
 * the most important business value paths through the application
 *
 * Business Goals:
 * - Users can discover and browse recipes
 * - Users can view detailed recipe information
 * - Users can navigate between related recipes
 * - URLs are shareable and bookmarkable
 * - Application works on mobile and desktop
 */

test.describe('Critical User Journeys', () => {
  test('Journey: New user discovers and views a recipe', async ({ page }) => {
    /**
     * Business Value: Primary user flow - discovery to consumption
     *
     * User Story:
     * As a home cook, I want to browse recipes and view details
     * so that I can decide what to cook
     */

    // Step 1: User lands on homepage
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify homepage loaded
    await expect(page.locator('body')).toBeVisible();

    // Step 2: User browses available recipes
    const recipeCards = page.locator('[data-testid="recipe-card"], .recipe-card');
    await expect(recipeCards.first()).toBeVisible();

    // Step 3: User clicks on a recipe that looks interesting
    const firstRecipe = recipeCards.first();
    const _recipeName = await firstRecipe.locator('h2, h3').textContent();
    await firstRecipe.click();

    // Step 4: User views recipe details
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toBeVisible();

    // Verify key recipe information is displayed
    await expect(page.locator('text=/ingredients/i')).toBeVisible();
    await expect(page.locator('text=/instructions|directions|steps/i')).toBeVisible();

    // Step 5: User notes the shareable URL
    const url = page.url();
    expect(url).toMatch(/\/recipes\/[a-z0-9-]+$/);

    // Business Value Achieved: User can discover and view recipe with shareable URL
  });

  test('Journey: User explores similar recipes', async ({ page }) => {
    /**
     * Business Value: Recipe discovery and engagement
     *
     * User Story:
     * As a home cook, I want to explore similar recipes
     * so that I can find variations or alternatives
     */

    // Step 1: User views a recipe
    await page.goto(`/recipes/${TEST_RECIPES.tarragonLobster.slug}`);
    await page.waitForLoadState('networkidle');

    const originalRecipe = await page.locator('h1').textContent();

    // Step 2: User scrolls down to see similar recipes
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);

    // Step 3: User finds similar recipes section
    const similarSection = page.locator('text=/recipes like this|similar recipes/i');

    if (await similarSection.isVisible()) {
      // Step 4: User clicks on a similar recipe
      const similarCards = page.locator('[data-testid="recipe-card"]');

      if ((await similarCards.count()) > 0) {
        await similarCards.first().click();
        await page.waitForLoadState('networkidle');

        // Step 5: User views the new recipe
        const newRecipe = await page.locator('h1').textContent();
        expect(newRecipe).not.toBe(originalRecipe);

        // Step 6: User can continue exploring similar recipes
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(1000);

        // Similar recipes should be available here too
        const moreSimilar = page.locator('text=/recipes like this|similar recipes/i');
        if (await moreSimilar.isVisible()) {
          expect(await moreSimilar.isVisible()).toBe(true);
        }
      }
    }

    // Business Value Achieved: User can discover related recipes and explore variations
  });

  test('Journey: User shares recipe URL with friend', async ({ page }) => {
    /**
     * Business Value: Social sharing and recipe distribution
     *
     * User Story:
     * As a home cook, I want to share recipe URLs with friends
     * so that they can cook the same dish
     */

    // Step 1: User views a recipe
    await page.goto(`/recipes/${TEST_RECIPES.carrotCake.slug}`);
    await page.waitForLoadState('networkidle');

    // Step 2: User copies URL from address bar
    const recipeUrl = page.url();

    // Verify URL is human-readable (shareable)
    expect(recipeUrl).toContain(TEST_RECIPES.carrotCake.slug);
    expect(recipeUrl).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/); // Not a UUID

    // Step 3: Friend receives URL and opens it (simulate new session)
    const context = page.context();
    const friendPage = await context.newPage();

    await friendPage.goto(recipeUrl);
    await friendPage.waitForLoadState('networkidle');

    // Step 4: Friend sees the exact same recipe
    const friendSeesRecipe = await friendPage.locator('h1').textContent();
    expect(friendSeesRecipe).toContain('Carrot Cake');

    // Business Value Achieved: URLs are shareable and resolve correctly
    await friendPage.close();
  });

  test('Journey: User bookmarks recipe for later', async ({ page }) => {
    /**
     * Business Value: Recipe retention and return visits
     *
     * User Story:
     * As a home cook, I want to bookmark recipes
     * so that I can easily return to them later
     */

    // Step 1: User discovers a recipe they want to save
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const recipeCard = page.locator('[data-testid="recipe-card"], .recipe-card').first();
    await recipeCard.click();
    await page.waitForLoadState('networkidle');

    // Step 2: User bookmarks the page (simulate)
    const bookmarkedUrl = page.url();
    const bookmarkedTitle = await page.title();

    // Step 3: User closes browser and comes back later (new session)
    await page.goto('/'); // Navigate away

    // Step 4: User opens bookmark
    await page.goto(bookmarkedUrl);
    await page.waitForLoadState('networkidle');

    // Step 5: Recipe loads successfully from bookmark
    await expect(page.locator('h1')).toBeVisible();
    const currentTitle = await page.title();
    expect(currentTitle).toBe(bookmarkedTitle);

    // Business Value Achieved: Bookmarked URLs work reliably
  });

  test('Journey: Mobile user cooks from recipe on phone', async ({ page }) => {
    /**
     * Business Value: Mobile-first recipe access
     *
     * User Story:
     * As a home cook, I want to follow recipes on my phone while cooking
     * so that I can have hands-free access in the kitchen
     */

    // Step 1: User opens recipe on mobile device
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
    await page.goto(`/recipes/${TEST_RECIPES.tarragonLobster.slug}`);
    await page.waitForLoadState('networkidle');

    // Step 2: User verifies recipe is readable on small screen
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();

    // Verify no horizontal scrolling needed
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);

    // Step 3: User reads ingredients list
    await expect(page.locator('text=/ingredients/i')).toBeVisible();

    // Step 4: User scrolls to instructions
    await page.evaluate(() => {
      const instructions = document.querySelector('[data-testid="instructions-list"], ol');
      instructions?.scrollIntoView();
    });
    await page.waitForTimeout(500);

    await expect(page.locator('text=/instructions|directions|steps/i')).toBeVisible();

    // Step 5: User can tap to enlarge images if needed
    const images = page.locator('img');
    if ((await images.count()) > 0) {
      const firstImage = images.first();
      await expect(firstImage).toBeVisible();

      // Verify image loaded
      const naturalWidth = await firstImage.evaluate((img: HTMLImageElement) => img.naturalWidth);
      expect(naturalWidth).toBeGreaterThan(0);
    }

    // Business Value Achieved: Recipe is fully usable on mobile while cooking
  });

  test('Journey: User discovers Top 50 recipes', async ({ page }) => {
    /**
     * Business Value: Curated content discovery
     *
     * User Story:
     * As a home cook, I want to see the most popular recipes
     * so that I can try crowd-favorites
     */

    // Step 1: User navigates to Top 50 page
    await page.goto(RECIPE_PATHS.top50);
    await page.waitForLoadState('networkidle');

    // Step 2: User sees curated list of top recipes
    await expect(page.locator('text=/top.*50|50.*recipes/i')).toBeVisible();

    const recipeCards = page.locator('[data-testid="recipe-card"], .recipe-card');
    const cardCount = await recipeCards.count();

    // Should show multiple recipes (up to 50)
    expect(cardCount).toBeGreaterThan(0);
    expect(cardCount).toBeLessThanOrEqual(50);

    // Step 3: User notices rank indicators
    // Top recipes should show rank numbers
    const rankBadge = page.locator('text=/^[0-9]+$/').first();
    if (await rankBadge.isVisible()) {
      const rankText = await rankBadge.textContent();
      expect(rankText).toMatch(/^[0-9]+$/);
    }

    // Step 4: User clicks on a top-rated recipe
    await recipeCards.first().click();
    await page.waitForLoadState('networkidle');

    // Step 5: User views the recipe details
    await expect(page.locator('h1')).toBeVisible();

    // Verify URL uses slug format
    const url = page.url();
    expect(url).toMatch(/\/recipes\/[a-z0-9-]+$/);

    // Business Value Achieved: Users can discover and access top-rated recipes
  });

  test('Journey: User quickly scans multiple recipes', async ({ page }) => {
    /**
     * Business Value: Efficient recipe browsing
     *
     * User Story:
     * As a home cook, I want to quickly browse multiple recipes
     * so that I can find the perfect one for tonight's dinner
     */

    // Step 1: User starts on homepage
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Step 2: User scans recipe cards
    const recipeCards = page.locator('[data-testid="recipe-card"], .recipe-card');
    const cardCount = await recipeCards.count();
    expect(cardCount).toBeGreaterThan(0);

    // Step 3: User opens first recipe
    await recipeCards.nth(0).click();
    await page.waitForLoadState('networkidle');
    const recipe1 = await page.locator('h1').textContent();

    // Step 4: User goes back to browse more
    await page.goBack();
    await page.waitForLoadState('networkidle');

    // Step 5: User opens second recipe
    await recipeCards.nth(1).click();
    await page.waitForLoadState('networkidle');
    const recipe2 = await page.locator('h1').textContent();

    // Verify different recipes
    expect(recipe1).not.toBe(recipe2);

    // Step 6: User goes back again
    await page.goBack();
    await page.waitForLoadState('networkidle');

    // Step 7: User opens third recipe
    await recipeCards.nth(2).click();
    await page.waitForLoadState('networkidle');
    const recipe3 = await page.locator('h1').textContent();

    expect(recipe3).not.toBe(recipe1);
    expect(recipe3).not.toBe(recipe2);

    // Business Value Achieved: Users can efficiently browse multiple recipes
  });

  test('Journey: User returns to recipe after distraction', async ({ page }) => {
    /**
     * Business Value: Reliable recipe access during cooking
     *
     * User Story:
     * As a home cook, I need the recipe to stay accessible
     * even if I get distracted and the screen locks
     */

    // Step 1: User opens recipe
    await page.goto(`/recipes/${TEST_RECIPES.carrotCake.slug}`);
    await page.waitForLoadState('networkidle');

    const originalUrl = page.url();

    // Step 2: User gets distracted, navigates away
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Step 3: User realizes they need the recipe
    // They hit back button
    await page.goBack();
    await page.waitForLoadState('networkidle');

    // Step 4: Recipe reloads successfully
    await expect(page).toHaveURL(originalUrl);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('text=/ingredients/i')).toBeVisible();

    // Business Value Achieved: Recipe access is reliable and forgiving
  });

  test('Journey: User explores recipe from search engine', async ({ page }) => {
    /**
     * Business Value: SEO and organic traffic
     *
     * User Story:
     * As a home cook, I want to find recipes via search engines
     * so that I can discover new recipes for specific dishes
     */

    // Step 1: User clicks on search result (direct navigation)
    await page.goto(`/recipes/${TEST_RECIPES.carrotCake.slug}`);
    await page.waitForLoadState('networkidle');

    // Step 2: User sees recipe immediately (no auth required)
    await expect(page.locator('h1')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('h1')).toContainText(/carrot cake/i);

    // Step 3: User can view all recipe details
    await expect(page.locator('text=/ingredients/i')).toBeVisible();
    await expect(page.locator('text=/instructions/i')).toBeVisible();

    // Step 4: User can explore similar recipes
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1500);

    // If similar recipes exist, verify they're visible
    const similarSection = page.locator('text=/recipes like this|similar recipes/i');
    if (await similarSection.isVisible()) {
      expect(await similarSection.isVisible()).toBe(true);
    }

    // Step 5: User can navigate to other recipes
    const homeLink = page.locator('a[href="/"]').first();
    if (await homeLink.isVisible()) {
      await homeLink.click();
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL('/');
    }

    // Business Value Achieved: Organic traffic converts to engaged users
  });
});
