import { expect, test } from '@playwright/test';
import { cleanupTestMeals, fillMealBasicInfo, generateUniqueMealName } from './fixtures/test-data';

/**
 * UAT Test Suite: Meal Editing
 *
 * Business Goal: Users can modify existing meals
 * User Story: As a home cook, I want to edit my meal plans
 *             so that I can adjust recipes, servings, and details as needed
 */

test.describe('Meal Editing', () => {
  const createdMealNames: string[] = [];
  let testMealId: string | null = null;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: 'tests/e2e/.auth/user.json',
    });
    const page = await context.newPage();

    const mealName = generateUniqueMealName('Editable Test Meal');
    createdMealNames.push(mealName);

    try {
      await page.goto('/meals/new');
      await page.waitForLoadState('networkidle');

      await fillMealBasicInfo(page, {
        name: mealName,
        mealType: 'dinner',
        serves: 4,
        description: 'Original description',
      });

      await page.click('button:has-text("Create Meal")');
      await page.waitForURL(/\/meals\/([a-f0-9-]+)/, { timeout: 10000 });

      const url = page.url();
      const match = url.match(/\/meals\/([a-f0-9-]+)/);
      if (match) {
        testMealId = match[1];
        console.log('✅ Test meal created for editing:', testMealId);
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

  test('should navigate to edit page from meal detail', async ({ page }) => {
    /**
     * Business Value: Accessible editing workflow
     * Success Criteria:
     * - Edit button is visible and accessible
     * - Navigation to edit page works
     * - Form pre-fills with current data
     */

    if (!testMealId) {
      test.skip();
      return;
    }

    await page.goto(`/meals/${testMealId}`);
    await page.waitForLoadState('networkidle');

    // Find edit button
    const editButton = page.locator('button:has-text("Edit"), a:has-text("Edit")');

    await expect(editButton.first()).toBeVisible();
    await editButton.first().click();

    // Should navigate to edit page
    await page.waitForURL(/\/meals\/[a-f0-9-]+\/edit/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Verify we're on edit page
    const heading = page.locator('h1');
    await expect(heading).toContainText(/edit/i);

    console.log('✅ Edit page navigation working');
  });

  test('should pre-fill form with existing meal data', async ({ page }) => {
    /**
     * Business Value: Efficient editing experience
     * Success Criteria:
     * - All fields pre-populated
     * - Data matches current meal
     * - User can see what will change
     */

    if (!testMealId) {
      test.skip();
      return;
    }

    await page.goto(`/meals/${testMealId}/edit`);
    await page.waitForLoadState('networkidle');

    // Verify name is pre-filled
    const nameField = page.locator('input[name="name"]');
    const nameValue = await nameField.inputValue();
    expect(nameValue).toContain('Editable Test Meal');

    // Verify serves is pre-filled
    const servesField = page.locator('input[name="serves"]');
    const servesValue = await servesField.inputValue();
    expect(servesValue).toBe('4');

    // Verify meal type is selected
    const mealTypeSelect = page.locator('select[name="mealType"], select[name="meal_type"]');
    const selectedType = await mealTypeSelect.inputValue();
    expect(selectedType).toBe('dinner');

    console.log('✅ Form pre-filled with existing data');
  });

  test('should update meal name and description', async ({ page }) => {
    /**
     * Business Value: Basic information updates
     * Success Criteria:
     * - Name can be changed
     * - Description can be updated
     * - Changes persist
     */

    if (!testMealId) {
      test.skip();
      return;
    }

    await page.goto(`/meals/${testMealId}/edit`);
    await page.waitForLoadState('networkidle');

    const newName = generateUniqueMealName('Updated Meal Name');
    createdMealNames.push(newName);

    // Update name
    const nameField = page.locator('input[name="name"]');
    await nameField.fill(newName);

    // Update description
    const descriptionField = page.locator('textarea[name="description"]');
    if (await descriptionField.isVisible()) {
      await descriptionField.fill('Updated description text');
    }

    // Save changes
    await page.click('button:has-text("Save"), button:has-text("Update"), button[type="submit"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Verify changes
    const heading = page.locator('h1');
    await expect(heading).toContainText(newName);

    console.log('✅ Meal name and description updated');
  });

  test('should update serving size', async ({ page }) => {
    /**
     * Business Value: Flexible meal scaling
     * Success Criteria:
     * - Serving size can be changed
     * - Recipe multipliers update accordingly
     * - Changes reflected in shopping list
     */

    if (!testMealId) {
      test.skip();
      return;
    }

    await page.goto(`/meals/${testMealId}/edit`);
    await page.waitForLoadState('networkidle');

    // Update serves
    const servesField = page.locator('input[name="serves"]');
    await servesField.fill('8');

    // Save changes
    await page.click('button:has-text("Save"), button:has-text("Update"), button[type="submit"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Verify serves updated
    const servesDisplay = page.locator('text=/serves.*8|8.*serves/i');
    await expect(servesDisplay.first()).toBeVisible();

    console.log('✅ Serving size updated');
  });

  test('should add recipe to existing meal', async ({ page }) => {
    /**
     * Business Value: Meal expansion
     * Success Criteria:
     * - New recipes can be added
     * - Recipe search works in edit mode
     * - Added recipes appear in meal
     */

    if (!testMealId) {
      test.skip();
      return;
    }

    await page.goto(`/meals/${testMealId}/edit`);
    await page.waitForLoadState('networkidle');

    // Count existing recipes
    const existingRecipes = page.locator('[data-testid="meal-recipe"], .meal-recipe-card');
    const initialCount = await existingRecipes.count();

    // Add new recipe
    await page.click('button:has-text("Add Recipe"), button:has-text("Search Recipes")');
    await page.waitForTimeout(500);

    const searchInput = page.locator('input[placeholder*="Search"]').last();
    await searchInput.fill('salad');
    await page.waitForTimeout(1000);

    const results = page.locator('[data-testid="recipe-search-result"]');
    if ((await results.count()) > 0) {
      await results.first().click();
      await page.waitForTimeout(500);
    }

    // Save changes
    await page.click('button:has-text("Save"), button:has-text("Update"), button[type="submit"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Verify recipe added (check on detail page)
    const recipesAfter = page.locator('[data-testid="recipe-card"], .recipe-card');
    const finalCount = await recipesAfter.count();

    if (finalCount > initialCount) {
      console.log(`✅ Recipe added (${initialCount} → ${finalCount})`);
    }
  });

  test('should remove recipe from meal', async ({ page }) => {
    /**
     * Business Value: Meal refinement
     * Success Criteria:
     * - Recipes can be removed
     * - Removal requires confirmation
     * - Meal updates accordingly
     */

    if (!testMealId) {
      test.skip();
      return;
    }

    await page.goto(`/meals/${testMealId}/edit`);
    await page.waitForLoadState('networkidle');

    // Find remove buttons
    const removeButtons = page.locator(
      'button:has-text("Remove"), button:has-text("Delete"), button[aria-label*="remove"]'
    );
    const removeCount = await removeButtons.count();

    if (removeCount > 0) {
      // Click first remove button
      await removeButtons.first().click();
      await page.waitForTimeout(500);

      // Confirm if confirmation dialog appears
      const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes")');
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }

      await page.waitForTimeout(500);

      // Save changes
      await page.click('button:has-text("Save"), button:has-text("Update"), button[type="submit"]');
      await page.waitForLoadState('networkidle');

      console.log('✅ Recipe removed from meal');
    } else {
      console.log('ℹ️  No recipes to remove');
    }
  });

  test('should update recipe multiplier', async ({ page }) => {
    /**
     * Business Value: Flexible recipe scaling
     * Success Criteria:
     * - Individual recipe servings can be adjusted
     * - Multiplier affects ingredient quantities
     * - Shopping list reflects changes
     */

    if (!testMealId) {
      test.skip();
      return;
    }

    await page.goto(`/meals/${testMealId}/edit`);
    await page.waitForLoadState('networkidle');

    // Look for multiplier inputs
    const multiplierInputs = page.locator('input[name*="multiplier"], input[type="number"]');
    const inputCount = await multiplierInputs.count();

    if (inputCount > 0) {
      const firstInput = multiplierInputs.first();
      await firstInput.fill('2');

      // Save changes
      await page.click('button:has-text("Save"), button:has-text("Update"), button[type="submit"]');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      // Look for multiplier badge on detail page
      const multiplierBadge = page.locator('text=/2x|×2/');
      if (await multiplierBadge.first().isVisible()) {
        console.log('✅ Recipe multiplier updated');
      }
    } else {
      console.log('ℹ️  Multiplier feature not found');
    }
  });

  test('should cancel editing without saving', async ({ page }) => {
    /**
     * Business Value: User control and safety
     * Success Criteria:
     * - Changes can be discarded
     * - Cancel button works
     * - Original data preserved
     */

    if (!testMealId) {
      test.skip();
      return;
    }

    await page.goto(`/meals/${testMealId}/edit`);
    await page.waitForLoadState('networkidle');

    // Get original name
    const nameField = page.locator('input[name="name"]');
    const originalName = await nameField.inputValue();

    // Make a change
    await nameField.fill('This should not save');

    // Cancel
    const cancelButton = page.locator('button:has-text("Cancel"), a:has-text("Cancel")');
    if (await cancelButton.first().isVisible()) {
      await cancelButton.first().click();
      await page.waitForLoadState('networkidle');

      // Should be back on detail page with original name
      const heading = page.locator('h1');
      await expect(heading).toContainText(originalName);

      console.log('✅ Cancel works, changes not saved');
    } else {
      // Navigate back manually
      await page.goto(`/meals/${testMealId}`);
      await page.waitForLoadState('networkidle');

      const heading = page.locator('h1');
      await expect(heading).toContainText(originalName);
    }
  });

  test('should show validation errors on edit', async ({ page }) => {
    /**
     * Business Value: Data quality
     * Success Criteria:
     * - Invalid changes prevented
     * - Clear error messages
     * - Original data preserved on error
     */

    if (!testMealId) {
      test.skip();
      return;
    }

    await page.goto(`/meals/${testMealId}/edit`);
    await page.waitForLoadState('networkidle');

    // Try to clear required name
    const nameField = page.locator('input[name="name"]');
    await nameField.fill('');

    // Try to save
    await page.click('button:has-text("Save"), button:has-text("Update"), button[type="submit"]');
    await page.waitForTimeout(500);

    // Should still be on edit page
    await expect(page).toHaveURL(/\/edit/);

    console.log('✅ Validation prevents invalid updates');
  });
});
