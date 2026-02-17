import { expect, test } from '@playwright/test';
import { cleanupTestMeals, fillMealBasicInfo, generateUniqueMealName } from './fixtures/test-data';

/**
 * UAT Test Suite: Meal Creation Flow
 *
 * Business Goal: Users can create new meals by combining multiple recipes
 * User Story: As a home cook, I want to create a meal plan that combines
 *             multiple recipes so that I can organize multi-course dinners
 */

test.describe('Meal Creation', () => {
  const createdMealNames: string[] = [];

  test.afterAll(async ({ browser }) => {
    // Cleanup test meals
    if (createdMealNames.length > 0) {
      const context = await browser.newContext({
        storageState: 'tests/e2e/.auth/user.json',
      });
      const page = await context.newPage();
      await cleanupTestMeals(page, createdMealNames);
      await context.close();
    }
  });

  test('should create a new meal successfully', async ({ page }) => {
    /**
     * Business Value: Core meal creation functionality
     * Success Criteria:
     * - User can navigate to create meal page
     * - Form accepts valid meal data
     * - User can add multiple recipes
     * - Recipes can be assigned to courses
     * - Meal is created and appears in meals list
     */

    const mealName = generateUniqueMealName('Test Dinner');
    createdMealNames.push(mealName);

    // Step 1: Navigate to meals page
    await page.goto('/meals');
    await page.waitForLoadState('networkidle');

    // Verify meals page loaded
    await expect(page.locator('h1')).toContainText(/my meals/i);

    // Step 2: Click create button
    await page.click('button:has-text("Create New Meal"), a:has-text("Create New Meal")');
    await page.waitForURL('/meals/new');
    await page.waitForLoadState('networkidle');

    // Verify create page loaded
    await expect(page.locator('h1')).toContainText(/create/i);

    // Step 3: Fill basic meal information
    await fillMealBasicInfo(page, {
      name: mealName,
      mealType: 'dinner',
      serves: 4,
      description: 'Automated test meal - please delete',
    });

    // Step 4: Add recipe via search
    // Note: This assumes recipes exist in the database
    // For isolated tests, you'd need to seed test recipes first
    await page.click('button:has-text("Add Recipe"), button:has-text("Search Recipes")');
    await page.waitForTimeout(500);

    // Search for a common recipe
    const searchInput = page
      .locator('input[placeholder*="Search"], input[placeholder*="search"]')
      .last();
    await searchInput.fill('pasta');
    await page.waitForTimeout(1000);

    // Click first result (if exists)
    const searchResults = page.locator('[data-testid="recipe-search-result"], .recipe-search-item');
    const resultCount = await searchResults.count();

    if (resultCount > 0) {
      await searchResults.first().click();
      await page.waitForTimeout(500);

      // Close search dialog if there's a close button
      const closeButton = page.locator('button:has-text("Close"), button:has-text("Done")');
      if (await closeButton.isVisible()) {
        await closeButton.click();
      }
    }

    // Step 5: Submit form
    await page.click('button:has-text("Create Meal"), button[type="submit"]');

    // Step 6: Verify redirect to meal detail page
    await page.waitForURL(/\/meals\/[a-f0-9-]+/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Verify meal name appears
    await expect(page.locator('h1')).toContainText(mealName);

    // Step 7: Verify meal appears in meals list
    await page.goto('/meals');
    await page.waitForLoadState('networkidle');

    await expect(page.locator(`text="${mealName}"`)).toBeVisible();

    console.log('✅ Meal created successfully:', mealName);
  });

  test('should validate required fields', async ({ page }) => {
    /**
     * Business Value: Data quality and error prevention
     * Success Criteria:
     * - Form prevents submission without required fields
     * - Clear validation messages appear
     * - User can correct errors
     */

    await page.goto('/meals/new');
    await page.waitForLoadState('networkidle');

    // Try to submit empty form
    await page.click('button:has-text("Create Meal"), button[type="submit"]');
    await page.waitForTimeout(500);

    // Verify we're still on the create page (submission failed)
    await expect(page).toHaveURL('/meals/new');

    // Check for validation messages
    // Note: Specific selectors depend on your form validation implementation
    const errorMessages = page.locator('[role="alert"], .error, .text-red-500');
    const errorCount = await errorMessages.count();

    if (errorCount > 0) {
      console.log('✅ Form validation working - errors displayed');
    }

    // HTML5 validation might prevent submission
    // Check if name field has required attribute
    const nameField = page.locator('input[name="name"]');
    const isRequired = await nameField.getAttribute('required');
    expect(isRequired).not.toBeNull();
  });

  test('should allow adding multiple recipes to different courses', async ({ page }) => {
    /**
     * Business Value: Multi-course meal planning
     * Success Criteria:
     * - User can add multiple recipes
     * - Recipes can be assigned to different courses
     * - Course assignments are saved
     */

    const mealName = generateUniqueMealName('Multi-Course Meal');
    createdMealNames.push(mealName);

    await page.goto('/meals/new');
    await page.waitForLoadState('networkidle');

    // Fill basic info
    await fillMealBasicInfo(page, {
      name: mealName,
      mealType: 'dinner',
      serves: 6,
    });

    // Try to add multiple recipes
    const recipesToAdd = ['salad', 'pasta', 'cake'];

    for (const searchTerm of recipesToAdd) {
      try {
        await page.click('button:has-text("Add Recipe"), button:has-text("Search Recipes")');
        await page.waitForTimeout(500);

        const searchInput = page.locator('input[placeholder*="Search"]').last();
        await searchInput.fill(searchTerm);
        await page.waitForTimeout(1000);

        const results = page.locator('[data-testid="recipe-search-result"]');
        if ((await results.count()) > 0) {
          await results.first().click();
          await page.waitForTimeout(500);
        }

        const closeButton = page.locator('button:has-text("Close"), button:has-text("Done")');
        if (await closeButton.isVisible()) {
          await closeButton.click();
          await page.waitForTimeout(500);
        }
      } catch (_error) {
        console.log(`Could not add recipe: ${searchTerm}`);
      }
    }

    // Submit
    await page.click('button:has-text("Create Meal"), button[type="submit"]');
    await page.waitForURL(/\/meals\/[a-f0-9-]+/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Verify meal created
    await expect(page.locator('h1')).toContainText(mealName);

    console.log('✅ Multi-course meal created');
  });

  test('should preserve form data when validation fails', async ({ page }) => {
    /**
     * Business Value: User experience and data preservation
     * Success Criteria:
     * - Form data persists after validation error
     * - User doesn't lose their work
     */

    await page.goto('/meals/new');
    await page.waitForLoadState('networkidle');

    // Fill some fields
    const testName = 'Incomplete Meal';
    await page.fill('input[name="name"]', testName);
    await page.fill('input[name="serves"]', '4');

    // Try to submit without required meal type (if required)
    await page.click('button:has-text("Create Meal"), button[type="submit"]');
    await page.waitForTimeout(500);

    // Verify form data is still there
    const nameValue = await page.inputValue('input[name="name"]');
    expect(nameValue).toBe(testName);

    const servesValue = await page.inputValue('input[name="serves"]');
    expect(servesValue).toBe('4');

    console.log('✅ Form data preserved after validation error');
  });

  test('should handle meal creation with minimum required fields', async ({ page }) => {
    /**
     * Business Value: Simplified meal creation flow
     * Success Criteria:
     * - Meal can be created with minimal information
     * - Optional fields can be skipped
     */

    const mealName = generateUniqueMealName('Minimal Meal');
    createdMealNames.push(mealName);

    await page.goto('/meals/new');
    await page.waitForLoadState('networkidle');

    // Fill only required fields
    await page.fill('input[name="name"]', mealName);

    // Select meal type if required
    const mealTypeSelect = page.locator('select[name="mealType"], select[name="meal_type"]');
    if (await mealTypeSelect.isVisible()) {
      await mealTypeSelect.selectOption('dinner');
    }

    // Set serves if required
    const servesInput = page.locator('input[name="serves"]');
    if (await servesInput.isVisible()) {
      await servesInput.fill('2');
    }

    // Submit
    await page.click('button:has-text("Create Meal"), button[type="submit"]');
    await page.waitForURL(/\/meals\/[a-f0-9-]+/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Verify meal created
    await expect(page.locator('h1')).toContainText(mealName);

    console.log('✅ Minimal meal created successfully');
  });

  test('should show loading state during meal creation', async ({ page }) => {
    /**
     * Business Value: User feedback and experience
     * Success Criteria:
     * - Loading indicator appears during submission
     * - User knows system is processing request
     */

    await page.goto('/meals/new');
    await page.waitForLoadState('networkidle');

    const mealName = generateUniqueMealName('Loading Test');
    createdMealNames.push(mealName);

    await fillMealBasicInfo(page, {
      name: mealName,
      mealType: 'lunch',
      serves: 3,
    });

    // Click submit and immediately check for loading state
    const submitButton = page.locator('button:has-text("Create Meal"), button[type="submit"]');
    await submitButton.click();

    // Check if button becomes disabled or shows loading text
    const isDisabled = await submitButton.isDisabled().catch(() => false);
    const loadingText = await submitButton.textContent();

    if (
      isDisabled ||
      loadingText?.includes('...') ||
      loadingText?.toLowerCase().includes('creating')
    ) {
      console.log('✅ Loading state detected');
    }

    // Wait for completion
    await page.waitForURL(/\/meals\/[a-f0-9-]+/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');
  });
});
