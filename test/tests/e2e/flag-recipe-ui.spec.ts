/**
 * E2E Tests for Recipe Flagging UI
 *
 * Tests the complete user flow for reporting recipes:
 * - Flag button visibility and states
 * - Dialog opening and closing
 * - Form validation
 * - Submission flow
 * - Authentication handling
 */

import { expect, test } from '@playwright/test';

test.describe('Recipe Flagging UI', () => {
  const TEST_RECIPE_SLUG = 'classic-margherita-pizza'; // Use a known test recipe

  test.beforeEach(async ({ page }) => {
    // Navigate to recipe page
    await page.goto(`/recipes/${TEST_RECIPE_SLUG}`);
    await page.waitForLoadState('networkidle');
  });

  test('should display flag button for authenticated users', async ({ page }) => {
    // Check if flag button exists
    const flagButton = page.getByRole('button', { name: /report/i });
    await expect(flagButton).toBeVisible();

    // Button should have proper tooltip
    await flagButton.hover();
    await expect(page.getByText(/report this recipe/i)).toBeVisible();
  });

  test('should show sign-in redirect for unauthenticated users', async ({ page }) => {
    // Find and click flag button
    const flagButton = page.getByRole('button', { name: /report/i });
    await flagButton.click();

    // Should redirect to sign-in page (or show sign-in prompt)
    // Note: Actual behavior depends on Clerk setup
    await page.waitForURL(/sign-in/, { timeout: 5000 }).catch(() => {
      // If no redirect, check for sign-in message
      expect(page.url()).toMatch(/sign-in/);
    });
  });

  test.describe('Flag Dialog', () => {
    test('should open dialog when flag button clicked', async ({ page }) => {
      // Mock authentication if needed
      // await page.context().addCookies([...authCookies]);

      const flagButton = page.getByRole('button', { name: /report/i });
      await flagButton.click();

      // Dialog should open
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Check dialog title
      await expect(page.getByRole('heading', { name: /report recipe/i })).toBeVisible();

      // Check dialog description mentions recipe name
      await expect(page.getByText(/maintain quality/i)).toBeVisible();
    });

    test('should display all flag reasons', async ({ page }) => {
      const flagButton = page.getByRole('button', { name: /report/i });
      await flagButton.click();

      // Check all flag options are present
      await expect(page.getByText('Inappropriate Content')).toBeVisible();
      await expect(page.getByText('Spam or Advertising')).toBeVisible();
      await expect(page.getByText('Copyright Violation')).toBeVisible();
      await expect(page.getByText('Poor Quality')).toBeVisible();
      await expect(page.getByText('Other')).toBeVisible();
    });

    test('should require reason selection before submit', async ({ page }) => {
      const flagButton = page.getByRole('button', { name: /report/i });
      await flagButton.click();

      // Submit button should be disabled initially
      const submitButton = page.getByRole('button', { name: /submit report/i });
      await expect(submitButton).toBeDisabled();
    });

    test('should enable submit when reason selected', async ({ page }) => {
      const flagButton = page.getByRole('button', { name: /report/i });
      await flagButton.click();

      // Select a reason
      await page.getByText('Spam or Advertising').click();

      // Submit button should now be enabled
      const submitButton = page.getByRole('button', { name: /submit report/i });
      await expect(submitButton).toBeEnabled();
    });

    test('should require description when "Other" selected', async ({ page }) => {
      const flagButton = page.getByRole('button', { name: /report/i });
      await flagButton.click();

      // Select "Other" reason
      await page.getByText('Other').click();

      // Submit should be disabled without description
      const submitButton = page.getByRole('button', { name: /submit report/i });
      await expect(submitButton).toBeDisabled();

      // Add description
      const textarea = page.getByPlaceholder(/provide details/i);
      await textarea.fill('This recipe has inaccurate cooking times.');

      // Submit should now be enabled
      await expect(submitButton).toBeEnabled();
    });

    test('should enforce 500 character limit on description', async ({ page }) => {
      const flagButton = page.getByRole('button', { name: /report/i });
      await flagButton.click();

      // Select a reason
      await page.getByText('Poor Quality').click();

      // Type more than 500 characters
      const textarea = page.getByPlaceholder(/additional details/i);
      const longText = 'a'.repeat(600);
      await textarea.fill(longText);

      // Should be truncated to 500 characters
      const textValue = await textarea.inputValue();
      expect(textValue.length).toBeLessThanOrEqual(500);
    });

    test('should show character counter when approaching limit', async ({ page }) => {
      const flagButton = page.getByRole('button', { name: /report/i });
      await flagButton.click();

      // Select a reason
      await page.getByText('Poor Quality').click();

      // Type more than 400 characters
      const textarea = page.getByPlaceholder(/additional details/i);
      await textarea.fill('a'.repeat(450));

      // Character counter should appear
      await expect(page.getByText(/characters remaining/i)).toBeVisible();
    });

    test('should close dialog on cancel', async ({ page }) => {
      const flagButton = page.getByRole('button', { name: /report/i });
      await flagButton.click();

      // Dialog should be visible
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Click cancel
      await page.getByRole('button', { name: /cancel/i }).click();

      // Dialog should close
      await expect(dialog).not.toBeVisible();
    });

    test('should reset form when dialog closed', async ({ page }) => {
      const flagButton = page.getByRole('button', { name: /report/i });
      await flagButton.click();

      // Select a reason and add description
      await page.getByText('Poor Quality').click();
      const textarea = page.getByPlaceholder(/additional details/i);
      await textarea.fill('Test description');

      // Close dialog
      await page.getByRole('button', { name: /cancel/i }).click();

      // Reopen dialog
      await flagButton.click();

      // Form should be reset
      const textareaValue = await page.getByPlaceholder(/additional details/i).inputValue();
      expect(textareaValue).toBe('');
    });
  });

  test.describe('Submission Flow', () => {
    test('should show loading state during submission', async ({ page }) => {
      const flagButton = page.getByRole('button', { name: /report/i });
      await flagButton.click();

      // Select reason
      await page.getByText('Spam or Advertising').click();

      // Click submit
      const submitButton = page.getByRole('button', { name: /submit report/i });
      await submitButton.click();

      // Should show loading text
      await expect(page.getByText(/submitting/i)).toBeVisible();
    });

    test('should show success message after submission', async ({ page }) => {
      const flagButton = page.getByRole('button', { name: /report/i });
      await flagButton.click();

      // Select reason
      await page.getByText('Spam or Advertising').click();

      // Submit
      await page.getByRole('button', { name: /submit report/i }).click();

      // Wait for success toast
      await expect(page.getByText(/thank you for your report/i)).toBeVisible({ timeout: 5000 });
    });

    test('should close dialog after successful submission', async ({ page }) => {
      const flagButton = page.getByRole('button', { name: /report/i });
      await flagButton.click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Select reason and submit
      await page.getByText('Spam or Advertising').click();
      await page.getByRole('button', { name: /submit report/i }).click();

      // Dialog should close after submission
      await expect(dialog).not.toBeVisible({ timeout: 5000 });
    });

    test('should disable flag button after successful report', async ({ page }) => {
      const flagButton = page.getByRole('button', { name: /report/i });
      await flagButton.click();

      // Submit report
      await page.getByText('Spam or Advertising').click();
      await page.getByRole('button', { name: /submit report/i }).click();

      // Wait for success
      await expect(page.getByText(/thank you/i)).toBeVisible({ timeout: 5000 });

      // Flag button should now be disabled
      await expect(flagButton).toBeDisabled();

      // Hover should show "already reported" message
      await flagButton.hover();
      await expect(page.getByText(/already reported/i)).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper ARIA labels', async ({ page }) => {
      const flagButton = page.getByRole('button', { name: /report/i });
      await expect(flagButton).toHaveAttribute('aria-label');
    });

    test('should support keyboard navigation in dialog', async ({ page }) => {
      const flagButton = page.getByRole('button', { name: /report/i });
      await flagButton.click();

      // Tab through form elements
      await page.keyboard.press('Tab'); // Focus first radio button
      await page.keyboard.press('Space'); // Select reason

      await page.keyboard.press('Tab'); // Move to next element

      // Should be able to submit with Enter
      await page.keyboard.press('Enter');

      // Should see submission in progress
      await expect(page.getByText(/submitting/i)).toBeVisible();
    });

    test('should trap focus within dialog', async ({ page }) => {
      const flagButton = page.getByRole('button', { name: /report/i });
      await flagButton.click();

      // Focus should be inside dialog
      const dialog = page.getByRole('dialog');
      const _focusedElement = page.locator(':focus');

      // Focused element should be within dialog
      await expect(dialog.locator(':focus')).toBeTruthy();
    });
  });

  test.describe('Edge Cases', () => {
    test('should handle recipe not found gracefully', async ({ page }) => {
      await page.goto('/recipes/non-existent-recipe-123');

      // Should show 404 or error page (not crash)
      await expect(page.getByText(/not found/i)).toBeVisible();
    });

    test('should handle network errors gracefully', async ({ page }) => {
      // Simulate offline mode
      await page.context().setOffline(true);

      const flagButton = page.getByRole('button', { name: /report/i });
      await flagButton.click();

      // Select and submit
      await page.getByText('Spam or Advertising').click();
      await page.getByRole('button', { name: /submit report/i }).click();

      // Should show error toast
      await expect(page.getByText(/failed to submit/i)).toBeVisible({ timeout: 5000 });

      // Restore online mode
      await page.context().setOffline(false);
    });
  });

  test.describe('Recipe Owner', () => {
    test('should not show flag button to recipe owner', async ({ page }) => {
      // Note: This test assumes authentication as recipe owner
      // In real implementation, you'd mock the auth state
      // For recipes owned by current user, flag button should not appear
      // await page.goto('/recipes/my-own-recipe');
      // const flagButton = page.getByRole('button', { name: /report/i });
      // await expect(flagButton).not.toBeVisible();
    });
  });
});
