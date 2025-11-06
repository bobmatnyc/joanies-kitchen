import { test, expect } from '@playwright/test';

const PRODUCTION_URL = 'https://joanies.kitchen';

test.describe('User Registration Flow - Production', () => {
  test.use({ baseURL: PRODUCTION_URL });

  test('should redirect /sign-up to /registration-closed', async ({ page }) => {
    const response = await page.goto('/sign-up');

    // Verify redirect occurred
    expect(page.url()).toBe(`${PRODUCTION_URL}/registration-closed`);

    // Verify response status (should be 200 after redirect)
    expect(response?.status()).toBe(200);

    // Wait for page to fully load
    await page.waitForLoadState('networkidle');
  });

  test('should display correct content on registration-closed page', async ({ page }) => {
    await page.goto('/registration-closed');
    await page.waitForLoadState('networkidle');

    // Verify ALPHA badge is present
    const alphaBadge = page.locator('text=ALPHA').first();
    await expect(alphaBadge).toBeVisible();

    // Verify beta launch date
    const betaLaunchDate = page.locator('text=/December 1, 2024/i');
    await expect(betaLaunchDate).toBeVisible();

    // Verify "Registration Closed" heading
    await expect(page.locator('h1:has-text("Registration Closed")')).toBeVisible();

    // Verify private alpha message
    await expect(page.locator('text=/private alpha testing/i')).toBeVisible();

    // Verify "Sign In (Existing Users)" button
    const signInButton = page.locator('a:has-text("Sign In (Existing Users)")');
    await expect(signInButton).toBeVisible();
    await expect(signInButton).toHaveAttribute('href', '/sign-in');

    // Verify "Back to Home" button
    const backHomeButton = page.locator('a:has-text("Back to Home")');
    await expect(backHomeButton).toBeVisible();
    await expect(backHomeButton).toHaveAttribute('href', '/');

    // Take screenshot for evidence
    await page.screenshot({
      path: 'tests/reports/registration-closed-page.png',
      fullPage: true
    });
  });

  test('should have functional buttons on registration-closed page', async ({ page }) => {
    await page.goto('/registration-closed');
    await page.waitForLoadState('networkidle');

    // Test "Back to Home" button
    const backHomeButton = page.locator('a:has-text("Back to Home")');
    await backHomeButton.click();
    await page.waitForLoadState('networkidle');
    expect(page.url()).toBe(`${PRODUCTION_URL}/`);

    // Navigate back to registration-closed
    await page.goto('/registration-closed');
    await page.waitForLoadState('networkidle');

    // Test "Sign In (Existing Users)" button
    const signInButton = page.locator('a:has-text("Sign In (Existing Users)")');
    await signInButton.click();
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/sign-in');
  });

  test('should display Alpha stamp on homepage', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check for Alpha stamp visibility (desktop only - hidden on mobile)
    const alphaStamp = page.locator('text=ALPHA').first();

    // Get viewport size to determine if we're on desktop
    const viewportSize = page.viewportSize();
    const isDesktop = viewportSize && viewportSize.width >= 640; // sm breakpoint

    if (isDesktop) {
      // On desktop, alpha stamp should be visible
      await expect(alphaStamp).toBeVisible();

      // Verify beta launch date on stamp
      const betaDate = page.locator('text=/BETA LAUNCH 12\\/1/i');
      await expect(betaDate).toBeVisible();

      // Verify stamp styling and position (should be in top-right corner)
      const stampContainer = page.locator('.pointer-events-none.fixed.inset-0.z-50').first();
      await expect(stampContainer).toBeVisible();

      // Take screenshot showing alpha stamp
      await page.screenshot({
        path: 'tests/reports/homepage-with-alpha-stamp.png',
        fullPage: false
      });
    }
  });

  test('should check if Register button exists on homepage', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Look for any register-related buttons or links
    const registerButton = page.locator('a[href*="sign-up"], button:has-text("Register"), a:has-text("Register")');
    const count = await registerButton.count();

    if (count > 0) {
      // If register button exists, test its behavior
      await registerButton.first().click();
      await page.waitForLoadState('networkidle');

      // Should redirect to registration-closed page
      expect(page.url()).toContain('/registration-closed');
    } else {
      // No register button found (expected during alpha)
      console.log('No Register button found on homepage - as expected during alpha phase');
    }

    // Take screenshot of homepage navigation area
    await page.screenshot({
      path: 'tests/reports/homepage-navigation.png',
      clip: { x: 0, y: 0, width: 1280, height: 200 }
    });
  });

  test('should verify alpha status messaging consistency', async ({ page }) => {
    // Check homepage for alpha indicators
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const alphaIndicators = page.locator('text=/ALPHA|Beta Launch|December 1, 2024/i');
    const countHome = await alphaIndicators.count();
    console.log(`Found ${countHome} alpha indicators on homepage`);

    // Check registration-closed page
    await page.goto('/registration-closed');
    await page.waitForLoadState('networkidle');

    const alphaIndicatorsClosed = page.locator('text=/ALPHA|Beta Launch|December 1, 2024/i');
    const countClosed = await alphaIndicatorsClosed.count();
    console.log(`Found ${countClosed} alpha indicators on registration-closed page`);

    // Both pages should have alpha status indicators
    expect(countHome).toBeGreaterThan(0);
    expect(countClosed).toBeGreaterThan(0);
  });

  test('should verify HTTP headers on registration-closed page', async ({ page }) => {
    const response = await page.goto('/registration-closed');

    // Check important headers
    const headers = response?.headers();

    // Should have security headers
    expect(headers?.['strict-transport-security']).toBeDefined();

    // Should indicate signed-out status
    expect(headers?.['x-clerk-auth-status']).toBe('signed-out');

    // Should be HTML content
    expect(headers?.['content-type']).toContain('text/html');
  });
});
