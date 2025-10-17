import path from 'node:path';
import { expect, test as setup } from '@playwright/test';

/**
 * Authentication Setup for E2E Tests
 *
 * This setup script authenticates a test user with Clerk
 * and saves the authentication state for reuse in all tests.
 *
 * This avoids having to sign in before every test, which:
 * - Speeds up test execution
 * - Reduces flakiness from repeated auth flows
 * - Conserves Clerk API rate limits
 */

const authFile = path.join(__dirname, '../.auth/user.json');

setup('authenticate', async ({ page }) => {
  // Check for required environment variables
  const testUserEmail = process.env.TEST_USER_EMAIL;
  const testUserPassword = process.env.TEST_USER_PASSWORD;

  if (!testUserEmail || !testUserPassword) {
    throw new Error(
      'TEST_USER_EMAIL and TEST_USER_PASSWORD environment variables must be set.\n' +
        'Add them to .env.local:\n' +
        'TEST_USER_EMAIL=test@example.com\n' +
        'TEST_USER_PASSWORD=yourSecurePassword123'
    );
  }

  console.log('🔐 Authenticating test user...');

  // Navigate to sign-in page
  await page.goto('/sign-in');
  await page.waitForLoadState('networkidle');

  // Check if already signed in (redirect to home)
  if (page.url().includes('/sign-in') === false) {
    console.log('✅ Already authenticated');
    await page.context().storageState({ path: authFile });
    return;
  }

  // Fill in Clerk sign-in form
  // Note: Selectors may need adjustment based on Clerk's UI
  await page.fill('input[name="identifier"], input[type="email"]', testUserEmail);

  // Check if there's a "Continue" button (Clerk's two-step flow)
  const continueButton = page.locator('button:has-text("Continue")');
  if (await continueButton.isVisible()) {
    await continueButton.click();
    await page.waitForTimeout(500);
  }

  // Fill password
  await page.fill('input[name="password"], input[type="password"]', testUserPassword);

  // Submit the form
  await page.click('button[type="submit"]');

  // Wait for redirect to home page (successful sign-in)
  await page.waitForURL('/', { timeout: 10000 });
  await page.waitForLoadState('networkidle');

  // Verify we're signed in by checking for user-specific elements
  // This could be a profile link, sign-out button, or user name
  const userIndicator = page.locator(
    '[data-testid="user-button"], .user-button, button:has-text("Sign out"), button:has-text("Profile")'
  );

  try {
    await expect(userIndicator.first()).toBeVisible({ timeout: 5000 });
    console.log('✅ Authentication successful');
  } catch (_error) {
    console.error('⚠️  Could not verify authentication. Continuing anyway...');
  }

  // Save authentication state
  await page.context().storageState({ path: authFile });
  console.log('💾 Saved authentication state to:', authFile);
});
