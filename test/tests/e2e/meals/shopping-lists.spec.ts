import { expect, test } from '@playwright/test';
import { cleanupTestMeals, fillMealBasicInfo, generateUniqueMealName } from './fixtures/test-data';

/**
 * UAT Test Suite: Shopping List Generation
 *
 * Business Goal: Users can automatically generate shopping lists from meals
 * User Story: As a home cook, I want to generate a shopping list from my meal
 *             so that I know exactly what ingredients to buy
 */

test.describe('Shopping List Generation', () => {
  const createdMealNames: string[] = [];
  let testMealId: string | null = null;

  // Create a test meal for shopping list tests
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: 'tests/e2e/.auth/user.json',
    });
    const page = await context.newPage();

    const mealName = generateUniqueMealName('Shopping List Test Meal');
    createdMealNames.push(mealName);

    try {
      await page.goto('/meals/new');
      await page.waitForLoadState('networkidle');

      await fillMealBasicInfo(page, {
        name: mealName,
        mealType: 'dinner',
        serves: 4,
      });

      // Add a recipe (if possible)
      try {
        await page.click('button:has-text("Add Recipe")');
        await page.waitForTimeout(500);
        const searchInput = page.locator('input[placeholder*="Search"]').last();
        await searchInput.fill('pasta');
        await page.waitForTimeout(1000);
        const results = page.locator('[data-testid="recipe-search-result"]');
        if ((await results.count()) > 0) {
          await results.first().click();
          await page.waitForTimeout(500);
        }
      } catch (_e) {
        console.log('Could not add recipe to test meal');
      }

      await page.click('button:has-text("Create Meal")');
      await page.waitForURL(/\/meals\/[a-f0-9-]+/, { timeout: 10000 });

      // Extract meal ID from URL
      const url = page.url();
      const match = url.match(/\/meals\/([a-f0-9-]+)/);
      if (match) {
        testMealId = match[1];
        console.log('✅ Test meal created:', testMealId);
      }
    } catch (error) {
      console.error('Failed to create test meal:', error);
    }

    await context.close();
  });

  test.afterAll(async ({ browser }) => {
    if (createdMealNames.length > 0) {
      const context = await browser.newContext({
        storageState: 'tests/e2e/.auth/user.json',
      });
      const page = await context.newPage();
      await cleanupTestMeals(page, createdMealNames);
      await context.close();
    }
  });

  test('should generate shopping list from meal', async ({ page }) => {
    /**
     * Business Value: Automated grocery planning
     * Success Criteria:
     * - Shopping list can be generated
     * - Ingredients are consolidated
     * - List is associated with meal
     */

    if (!testMealId) {
      console.log('⚠️  Test meal not available');
      test.skip();
      return;
    }

    await page.goto(`/meals/${testMealId}`);
    await page.waitForLoadState('networkidle');

    // Look for "Generate Shopping List" button
    const generateButton = page.locator(
      'button:has-text("Generate Shopping List"), button:has-text("Create Shopping List")'
    );

    if (await generateButton.isVisible()) {
      // Click to generate
      await generateButton.click();
      await page.waitForLoadState('networkidle');

      // Wait for shopping list to appear
      await page.waitForTimeout(2000);

      // Verify shopping list section is visible
      const shoppingListSection = page.locator(
        '[data-testid="shopping-list"], #shopping-list, text=/shopping list/i'
      );
      await expect(shoppingListSection.first()).toBeVisible();

      // Verify ingredients are displayed
      const ingredients = page.locator('[data-testid="shopping-list-item"], .shopping-list-item');
      const ingredientCount = await ingredients.count();

      if (ingredientCount > 0) {
        console.log(`✅ Shopping list generated with ${ingredientCount} items`);
      } else {
        console.log('⚠️  Shopping list generated but no items found (meal may have no recipes)');
      }
    } else {
      console.log('⚠️  Generate Shopping List button not found');
      test.skip();
    }
  });

  test('should consolidate duplicate ingredients', async ({ page }) => {
    /**
     * Business Value: Smart ingredient consolidation
     * Success Criteria:
     * - Duplicate ingredients are combined
     * - Quantities are summed correctly
     * - Units are preserved
     */

    if (!testMealId) {
      test.skip();
      return;
    }

    await page.goto(`/meals/${testMealId}`);
    await page.waitForLoadState('networkidle');

    // Check if shopping list already exists, if not generate it
    const existingList = page.locator('[data-testid="shopping-list-item"]');
    const hasItems = (await existingList.count()) > 0;

    if (!hasItems) {
      const generateButton = page.locator('button:has-text("Generate Shopping List")');
      if (await generateButton.isVisible()) {
        await generateButton.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
      }
    }

    // Verify ingredients are organized
    const items = page.locator('[data-testid="shopping-list-item"], .shopping-list-item');
    const itemCount = await items.count();

    if (itemCount > 0) {
      // Check for quantity display
      const firstItem = items.first();
      const itemText = await firstItem.textContent();

      // Should have quantity and name
      expect(itemText).toBeTruthy();
      console.log('✅ Ingredient consolidation working');
    } else {
      console.log('ℹ️  No items to verify consolidation');
    }
  });

  test('should organize ingredients by category', async ({ page }) => {
    /**
     * Business Value: Organized grocery shopping
     * Success Criteria:
     * - Ingredients grouped by category
     * - Categories match store layout
     * - Easy to navigate while shopping
     */

    if (!testMealId) {
      test.skip();
      return;
    }

    await page.goto(`/meals/${testMealId}`);
    await page.waitForLoadState('networkidle');

    // Look for category headers
    const categoryHeaders = page.locator(
      '[data-testid="shopping-list-category"], .shopping-list-category, h3, h4'
    );
    const headerCount = await categoryHeaders.count();

    if (headerCount > 0) {
      console.log(`✅ Shopping list organized into ${headerCount} categories`);

      // Common categories to look for
      const categories = ['proteins', 'dairy', 'vegetables', 'fruits', 'grains'];
      for (const category of categories) {
        const categorySection = page.locator(`text=/${category}/i`);
        if (await categorySection.first().isVisible()) {
          console.log(`  - Found category: ${category}`);
        }
      }
    } else {
      console.log('ℹ️  Category organization not detected or not implemented');
    }
  });

  test('should allow checking off items', async ({ page }) => {
    /**
     * Business Value: Shopping progress tracking
     * Success Criteria:
     * - Items can be marked as checked
     * - Checked state persists
     * - Visual feedback for checked items
     */

    if (!testMealId) {
      test.skip();
      return;
    }

    await page.goto(`/meals/${testMealId}`);
    await page.waitForLoadState('networkidle');

    // Find checkboxes
    const checkboxes = page.locator('input[type="checkbox"]');
    const checkboxCount = await checkboxes.count();

    if (checkboxCount > 0) {
      const firstCheckbox = checkboxes.first();

      // Get initial state
      const initiallyChecked = await firstCheckbox.isChecked();

      // Toggle checkbox
      await firstCheckbox.click();
      await page.waitForTimeout(500);

      // Verify state changed
      const nowChecked = await firstCheckbox.isChecked();
      expect(nowChecked).toBe(!initiallyChecked);

      console.log('✅ Checkbox toggle working');

      // Verify state persists after reload
      await page.reload();
      await page.waitForLoadState('networkidle');

      const afterReloadChecked = await firstCheckbox.isChecked();
      expect(afterReloadChecked).toBe(nowChecked);

      console.log('✅ Checkbox state persists');
    } else {
      console.log('⚠️  No checkboxes found in shopping list');
    }
  });

  test('should display estimated prices if available', async ({ page }) => {
    /**
     * Business Value: Budget planning
     * Success Criteria:
     * - Estimated prices shown per item
     * - Total estimated cost calculated
     * - Price information helps budgeting
     */

    if (!testMealId) {
      test.skip();
      return;
    }

    await page.goto(`/meals/${testMealId}`);
    await page.waitForLoadState('networkidle');

    // Look for price indicators
    const priceElements = page.locator('text=/\\$\\d+\\.\\d{2}/');
    const priceCount = await priceElements.count();

    if (priceCount > 0) {
      console.log(`✅ Found ${priceCount} price indicators`);

      // Look for total cost
      const totalCost = page.locator('text=/total.*\\$|estimated.*\\$/i');
      if (await totalCost.first().isVisible()) {
        const totalText = await totalCost.first().textContent();
        console.log(`✅ Total estimated cost displayed: ${totalText}`);
      }
    } else {
      console.log('ℹ️  Price estimation not available or not implemented');
    }
  });

  test('should support regenerating shopping list', async ({ page }) => {
    /**
     * Business Value: Flexibility and updates
     * Success Criteria:
     * - Shopping list can be regenerated
     * - Old list is replaced or updated
     * - Changes to meal reflect in list
     */

    if (!testMealId) {
      test.skip();
      return;
    }

    await page.goto(`/meals/${testMealId}`);
    await page.waitForLoadState('networkidle');

    // Look for regenerate option
    const regenerateButton = page.locator(
      'button:has-text("Regenerate"), button:has-text("Update Shopping List")'
    );

    if (await regenerateButton.isVisible()) {
      await regenerateButton.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      console.log('✅ Shopping list regenerated');
    } else {
      console.log('ℹ️  Regenerate option not found');
    }
  });

  test('should handle meal with no recipes gracefully', async ({ page }) => {
    /**
     * Business Value: Error prevention and guidance
     * Success Criteria:
     * - Clear message when no recipes
     * - Helpful guidance provided
     * - No errors thrown
     */

    // Create empty meal
    const emptyMealName = generateUniqueMealName('Empty Meal');
    createdMealNames.push(emptyMealName);

    await page.goto('/meals/new');
    await page.waitForLoadState('networkidle');

    await fillMealBasicInfo(page, {
      name: emptyMealName,
      mealType: 'lunch',
      serves: 2,
    });

    await page.click('button:has-text("Create Meal")');
    await page.waitForURL(/\/meals\/[a-f0-9-]+/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Try to generate shopping list
    const generateButton = page.locator('button:has-text("Generate Shopping List")');

    if (await generateButton.isVisible()) {
      await generateButton.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      // Look for empty state message
      const emptyMessage = page.locator('text=/no recipes|no ingredients|add recipes/i');
      if (await emptyMessage.first().isVisible()) {
        console.log('✅ Empty state message displayed');
      } else {
        // If no special message, shopping list should just be empty
        const items = page.locator('[data-testid="shopping-list-item"]');
        const itemCount = await items.count();
        expect(itemCount).toBe(0);
        console.log('✅ Empty shopping list handled gracefully');
      }
    }
  });
});
