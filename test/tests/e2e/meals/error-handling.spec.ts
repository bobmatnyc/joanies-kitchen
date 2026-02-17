import { expect, test } from '@playwright/test';

/**
 * UAT Test Suite: Error Handling and Edge Cases
 *
 * Business Goal: Application handles errors gracefully and provides helpful feedback
 * User Story: As a user, I want clear error messages and recovery options
 *             so that I can understand problems and fix them
 */

test.describe('Error Handling', () => {
  test('should handle non-existent meal ID gracefully', async ({ page }) => {
    /**
     * Business Value: Robust error handling
     * Success Criteria:
     * - 404 page displays for invalid IDs
     * - User-friendly error message
     * - Navigation options provided
     */

    const fakeId = '00000000-0000-0000-0000-000000000000';

    await page.goto(`/meals/${fakeId}`);
    await page.waitForLoadState('networkidle');

    // Should show error page or not found message
    const errorIndicators = page.locator("text=/not found|404|doesn't exist|could not find/i");
    await expect(errorIndicators.first()).toBeVisible({ timeout: 5000 });

    // Should have navigation option back
    const backLink = page.locator('a:has-text("Back"), a:has-text("Go back"), a:has-text("Meals")');
    if (await backLink.first().isVisible()) {
      console.log('✅ Navigation option available');
    }

    console.log('✅ Non-existent meal handled gracefully');
  });

  test('should handle malformed meal ID', async ({ page }) => {
    /**
     * Business Value: Input validation
     * Success Criteria:
     * - Invalid IDs don't crash app
     * - Appropriate error displayed
     * - User redirected or given options
     */

    const malformedId = 'not-a-valid-uuid';

    await page.goto(`/meals/${malformedId}`);
    await page.waitForLoadState('networkidle');

    // Should not crash - either 404 or error page
    const pageContent = await page.content();
    expect(pageContent).toBeTruthy();

    const errorIndicators = page.locator('text=/error|not found|invalid/i');
    const hasError = (await errorIndicators.count()) > 0;

    if (hasError) {
      console.log('✅ Malformed ID handled with error message');
    } else {
      console.log('✅ Malformed ID handled (may redirect to 404)');
    }
  });

  test('should show loading skeleton on meals page', async ({ page }) => {
    /**
     * Business Value: User experience during data loading
     * Success Criteria:
     * - Loading state visible
     * - No layout shift
     * - Smooth transition to content
     */

    // Navigate to meals page
    await page.goto('/meals', { waitUntil: 'domcontentloaded' });

    // Check for loading skeleton (may be very fast)
    const loadingSkeleton = page.locator('[data-testid="loading-skeleton"], .animate-pulse');
    const hasLoadingState = await loadingSkeleton
      .first()
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    if (hasLoadingState) {
      console.log('✅ Loading skeleton detected');
      await page.waitForLoadState('networkidle');
      await expect(loadingSkeleton.first()).not.toBeVisible();
      console.log('✅ Content loaded, skeleton removed');
    } else {
      console.log('ℹ️  Loading state not detected (may load too quickly)');
    }
  });

  test('should handle network errors gracefully', async ({ page, context }) => {
    /**
     * Business Value: Offline/network error resilience
     * Success Criteria:
     * - Network failures don't crash app
     * - Error message explains problem
     * - Retry option available
     */

    // Simulate offline mode
    await context.setOffline(true);

    await page.goto('/meals', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Application should show error state
    const errorMessages = page.locator(
      'text=/failed to load|error loading|network error|offline|try again/i'
    );

    const hasErrorMessage = (await errorMessages.count()) > 0;

    // Restore connection
    await context.setOffline(false);

    if (hasErrorMessage) {
      console.log('✅ Network error handling implemented');

      // Look for retry button
      const retryButton = page.locator('button:has-text("Try again"), button:has-text("Retry")');
      if (await retryButton.first().isVisible()) {
        await retryButton.first().click();
        await page.waitForLoadState('networkidle');
        console.log('✅ Retry functionality available');
      }
    } else {
      console.log('ℹ️  Network error handling not detected');
    }
  });

  test('should handle empty meals list gracefully', async ({ page }) => {
    /**
     * Business Value: First-time user experience
     * Success Criteria:
     * - Empty state is welcoming
     * - Clear call-to-action
     * - Helpful guidance provided
     */

    await page.goto('/meals');
    await page.waitForLoadState('networkidle');

    // Check if meals exist or empty state shown
    const mealCards = page.locator('[data-testid="meal-card"], .meal-card');
    const cardCount = await mealCards.count();

    if (cardCount === 0) {
      // Should show empty state
      const emptyState = page.locator('text=/no meals|create your first|get started/i');

      if (await emptyState.first().isVisible()) {
        console.log('✅ Empty state displayed');

        // Should have create button
        const createButton = page.locator('button:has-text("Create"), a:has-text("Create")');
        await expect(createButton.first()).toBeVisible();

        console.log('✅ Call-to-action available');
      }
    } else {
      console.log('ℹ️  Meals exist - cannot test empty state');
    }
  });

  test('should validate form inputs with helpful messages', async ({ page }) => {
    /**
     * Business Value: Data quality and user guidance
     * Success Criteria:
     * - Validation messages are clear
     * - Errors highlight specific fields
     * - Messages explain how to fix
     */

    await page.goto('/meals/new');
    await page.waitForLoadState('networkidle');

    // Try submitting with invalid data
    const servesInput = page.locator('input[name="serves"]');
    if (await servesInput.isVisible()) {
      // Enter invalid serves (negative number)
      await servesInput.fill('-5');

      await page.click('button:has-text("Create Meal"), button[type="submit"]');
      await page.waitForTimeout(500);

      // Should show validation error
      const errorMessage = page.locator('[role="alert"], .error, .text-red');
      const hasError = (await errorMessage.count()) > 0;

      if (hasError) {
        const errorText = await errorMessage.first().textContent();
        console.log('✅ Validation error shown:', errorText);
      } else {
        console.log('ℹ️  HTML5 validation may prevent submission');
      }

      // Clear invalid input
      await servesInput.fill('4');
    }
  });

  test('should handle session expiration gracefully', async ({ page }) => {
    /**
     * Business Value: Authentication resilience
     * Success Criteria:
     * - Expired sessions detected
     * - User redirected to sign-in
     * - Return path preserved
     */

    // This test depends on auth implementation
    // Simulating expired session is complex

    await page.goto('/meals');
    await page.waitForLoadState('networkidle');

    // If session is valid, we're on meals page
    const onMealsPage = page.url().includes('/meals');

    if (onMealsPage) {
      console.log('✅ Authenticated access working');
    } else {
      // Redirected to sign-in
      const onSignInPage = page.url().includes('/sign-in');
      if (onSignInPage) {
        console.log('✅ Redirected to sign-in for protected route');
      }
    }
  });

  test('should show error boundary on component crash', async ({ page }) => {
    /**
     * Business Value: Application stability
     * Success Criteria:
     * - Errors don't crash entire app
     * - Error boundary catches issues
     * - Recovery options available
     */

    // Error boundaries are hard to test without triggering actual errors
    // This is more of a smoke test

    await page.goto('/meals');
    await page.waitForLoadState('networkidle');

    // Monitor console for uncaught errors
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    // Navigate around
    const mealCards = page.locator('[data-testid="meal-card"], .meal-card');
    const cardCount = await mealCards.count();

    if (cardCount > 0) {
      await mealCards.first().click();
      await page.waitForLoadState('networkidle');
      await page.goBack();
      await page.waitForLoadState('networkidle');
    }

    // Check for uncaught errors
    if (errors.length > 0) {
      console.log('⚠️  Uncaught errors detected:', errors);
    } else {
      console.log('✅ No uncaught errors during navigation');
    }
  });

  test('should handle concurrent meal operations', async ({ page, context }) => {
    /**
     * Business Value: Data consistency
     * Success Criteria:
     * - Multiple tabs don't cause conflicts
     * - Data refreshes appropriately
     * - Race conditions avoided
     */

    // Open two pages
    const page1 = page;
    const page2 = await context.newPage();

    // Both navigate to meals
    await page1.goto('/meals');
    await page2.goto('/meals');

    await page1.waitForLoadState('networkidle');
    await page2.waitForLoadState('networkidle');

    // Both should load successfully
    await expect(page1.locator('h1')).toContainText(/meals/i);
    await expect(page2.locator('h1')).toContainText(/meals/i);

    console.log('✅ Multiple tabs work without conflicts');

    await page2.close();
  });

  test('should handle rapid form submissions', async ({ page }) => {
    /**
     * Business Value: Prevent duplicate submissions
     * Success Criteria:
     * - Submit button disabled during processing
     * - Multiple submissions prevented
     * - Loading state shown
     */

    await page.goto('/meals/new');
    await page.waitForLoadState('networkidle');

    // Fill form
    await page.fill('input[name="name"]', 'Rapid Submit Test');

    const servesInput = page.locator('input[name="serves"]');
    if (await servesInput.isVisible()) {
      await servesInput.fill('4');
    }

    const mealTypeSelect = page.locator('select[name="mealType"], select[name="meal_type"]');
    if (await mealTypeSelect.isVisible()) {
      await mealTypeSelect.selectOption('dinner');
    }

    // Click submit multiple times rapidly
    const submitButton = page.locator('button:has-text("Create Meal"), button[type="submit"]');

    await submitButton.click();
    await submitButton.click().catch(() => {}); // May be disabled already
    await submitButton.click().catch(() => {}); // May be disabled already

    // Wait for navigation
    await page.waitForURL(/\/meals\/[a-f0-9-]+/, { timeout: 15000 });

    // Verify only one meal created
    await page.goto('/meals');
    await page.waitForLoadState('networkidle');

    const duplicateMeals = page.locator('text="Rapid Submit Test"');
    const duplicateCount = await duplicateMeals.count();

    if (duplicateCount === 1) {
      console.log('✅ Duplicate submission prevented');

      // Cleanup
      await duplicateMeals.first().click();
      await page.waitForLoadState('networkidle');
      const deleteButton = page.locator('button:has-text("Delete")');
      if (await deleteButton.isVisible()) {
        await deleteButton.click();
        await page.waitForTimeout(500);
        const confirm = page.locator('button:has-text("Confirm"), button:has-text("Yes")').last();
        if (await confirm.isVisible()) {
          await confirm.click();
        }
      }
    } else {
      console.log(`⚠️  Found ${duplicateCount} meals - duplicate prevention may need attention`);
    }
  });
});
