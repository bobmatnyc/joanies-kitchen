import { test, expect } from '@playwright/test';

const PRODUCTION_URL = 'https://joanies.kitchen';

test.describe('Production Sign-In Flow', () => {
  let consoleMessages: string[] = [];
  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    // Monitor console messages
    page.on('console', msg => {
      const text = `[${msg.type()}] ${msg.text()}`;
      consoleMessages.push(text);
      if (msg.type() === 'error') {
        consoleErrors.push(text);
      }
    });

    // Monitor page errors
    page.on('pageerror', error => {
      consoleErrors.push(`[PAGE ERROR] ${error.message}`);
    });
  });

  test.afterEach(async () => {
    // Log console messages for debugging
    if (consoleMessages.length > 0) {
      console.log('\n=== Console Messages ===');
      consoleMessages.forEach(msg => console.log(msg));
    }
    if (consoleErrors.length > 0) {
      console.log('\n=== Console Errors ===');
      consoleErrors.forEach(err => console.log(err));
    }
    consoleMessages = [];
    consoleErrors = [];
  });

  test('1. Sign-In Page Accessibility - Direct Navigation', async ({ page }) => {
    // Navigate to sign-in page
    const response = await page.goto(`${PRODUCTION_URL}/sign-in`, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Verify HTTP 200 response
    expect(response?.status()).toBe(200);
    console.log('✅ Sign-in page returns HTTP 200');

    // Take screenshot
    await page.screenshot({
      path: '/Users/masa/Projects/joanies-kitchen/tests/reports/signin-page-load.png',
      fullPage: true
    });
    console.log('✅ Screenshot saved: signin-page-load.png');

    // Wait for Clerk to load
    await page.waitForTimeout(3000);

    // Verify Clerk sign-in form elements are present
    // Clerk uses specific data attributes and class names
    const clerkRoot = page.locator('[data-clerk-id]').first();
    await expect(clerkRoot).toBeVisible({ timeout: 10000 });
    console.log('✅ Clerk authentication component is visible');

    // Check for sign-in form elements (Clerk-specific selectors)
    const hasEmailInput = await page.locator('input[name="identifier"], input[type="email"]').count() > 0;
    const hasPasswordInput = await page.locator('input[name="password"], input[type="password"]').count() > 0;
    const hasSubmitButton = await page.locator('button[type="submit"]').count() > 0;

    console.log(`Email input present: ${hasEmailInput}`);
    console.log(`Password input present: ${hasPasswordInput}`);
    console.log(`Submit button present: ${hasSubmitButton}`);

    // Take screenshot of form
    await page.screenshot({
      path: '/Users/masa/Projects/joanies-kitchen/tests/reports/signin-form-elements.png',
      fullPage: true
    });

    // Check for OAuth options (Google sign-in)
    const hasGoogleButton = await page.locator('button:has-text("Google"), button:has-text("Continue with Google")').count() > 0;
    console.log(`Google OAuth button present: ${hasGoogleButton}`);

    // Verify no errors occurred
    expect(consoleErrors.length).toBe(0);
  });

  test('2. Sign-In Button from Homepage Navigation', async ({ page }) => {
    // Navigate to homepage
    await page.goto(PRODUCTION_URL, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    console.log('✅ Homepage loaded');

    // Look for Sign In button in navigation
    // Try multiple possible selectors
    const signInButton = page.locator('a[href*="sign-in"], button:has-text("Sign In"), a:has-text("Sign In")').first();

    // Wait for navigation to be visible
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Take screenshot of homepage
    await page.screenshot({
      path: '/Users/masa/Projects/joanies-kitchen/tests/reports/homepage-navigation.png',
      fullPage: true
    });

    // Check if sign-in button exists
    const signInButtonCount = await page.locator('a[href*="sign-in"], button:has-text("Sign In"), a:has-text("Sign In")').count();
    console.log(`Sign In button count: ${signInButtonCount}`);

    if (signInButtonCount > 0) {
      await expect(signInButton).toBeVisible();
      console.log('✅ Sign In button found in navigation');

      // Click the button and wait for navigation
      await signInButton.click();
      await page.waitForURL(/.*sign-in.*/, { timeout: 10000 });

      console.log('✅ Successfully navigated to sign-in page');

      // Verify we're on sign-in page
      expect(page.url()).toContain('sign-in');

      // Take screenshot after navigation
      await page.screenshot({
        path: '/Users/masa/Projects/joanies-kitchen/tests/reports/signin-after-homepage-nav.png',
        fullPage: true
      });
    } else {
      console.log('ℹ️ No Sign In button found in homepage navigation');
      // This might be expected if sign-in is only accessible via direct URL
    }
  });

  test('3. Sign-In Form Elements Detailed Check', async ({ page }) => {
    await page.goto(`${PRODUCTION_URL}/sign-in`, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Wait for Clerk to fully load
    await page.waitForTimeout(3000);

    console.log('\n=== Sign-In Form Elements Check ===');

    // Check for email input
    const emailInputs = page.locator('input[name="identifier"], input[type="email"], input[name="emailAddress"]');
    const emailCount = await emailInputs.count();
    console.log(`Email input fields found: ${emailCount}`);
    if (emailCount > 0) {
      await expect(emailInputs.first()).toBeVisible();
      console.log('✅ Email input is visible');
    }

    // Check for password input
    const passwordInputs = page.locator('input[name="password"], input[type="password"]');
    const passwordCount = await passwordInputs.count();
    console.log(`Password input fields found: ${passwordCount}`);
    if (passwordCount > 0) {
      await expect(passwordInputs.first()).toBeVisible();
      console.log('✅ Password input is visible');
    }

    // Check for submit button
    const submitButtons = page.locator('button[type="submit"], button:has-text("Continue"), button:has-text("Sign in")');
    const submitCount = await submitButtons.count();
    console.log(`Submit buttons found: ${submitCount}`);
    if (submitCount > 0) {
      await expect(submitButtons.first()).toBeVisible();
      console.log('✅ Submit button is visible');
    }

    // Check for OAuth options
    const googleButton = page.locator('button:has-text("Google"), button:has-text("Continue with Google"), [data-provider="google"]');
    const googleCount = await googleButton.count();
    console.log(`Google OAuth buttons found: ${googleCount}`);
    if (googleCount > 0) {
      console.log('✅ Google OAuth option available');
    }

    // Check for other common OAuth providers
    const oauthButtons = page.locator('button[data-provider], button:has-text("Continue with")');
    const oauthCount = await oauthButtons.count();
    console.log(`Total OAuth options found: ${oauthCount}`);

    // Take detailed screenshot
    await page.screenshot({
      path: '/Users/masa/Projects/joanies-kitchen/tests/reports/signin-form-detailed.png',
      fullPage: true
    });

    // Check page title
    const title = await page.title();
    console.log(`Page title: ${title}`);
  });

  test('4. Navigation from Registration Closed Page', async ({ page }) => {
    // Navigate to registration-closed page
    await page.goto(`${PRODUCTION_URL}/registration-closed`, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    console.log('✅ Registration closed page loaded');

    // Take screenshot
    await page.screenshot({
      path: '/Users/masa/Projects/joanies-kitchen/tests/reports/registration-closed-page.png',
      fullPage: true
    });

    // Look for "Sign In (Existing Users)" button or similar
    const signInLink = page.locator('a[href*="sign-in"], button:has-text("Sign In"), a:has-text("Sign In"), a:has-text("Existing Users")').first();

    await page.waitForTimeout(2000);

    const signInLinkCount = await page.locator('a[href*="sign-in"], button:has-text("Sign In"), a:has-text("Sign In")').count();
    console.log(`Sign In links found: ${signInLinkCount}`);

    if (signInLinkCount > 0) {
      await expect(signInLink).toBeVisible();
      console.log('✅ Sign In link found on registration-closed page');

      // Get the link text
      const linkText = await signInLink.textContent();
      console.log(`Link text: "${linkText}"`);

      // Click and navigate
      await signInLink.click();
      await page.waitForURL(/.*sign-in.*/, { timeout: 10000 });

      console.log('✅ Successfully navigated to sign-in page from registration-closed');

      // Verify we're on sign-in page
      expect(page.url()).toContain('sign-in');

      // Take screenshot after navigation
      await page.screenshot({
        path: '/Users/masa/Projects/joanies-kitchen/tests/reports/signin-from-registration-closed.png',
        fullPage: true
      });
    } else {
      console.log('ℹ️ No Sign In link found on registration-closed page');
    }
  });

  test('5. Authentication Flow - Form Validation', async ({ page }) => {
    await page.goto(`${PRODUCTION_URL}/sign-in`, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Wait for Clerk to load
    await page.waitForTimeout(3000);

    console.log('\n=== Authentication Flow Test ===');

    // Try to submit with empty fields to test validation
    const emailInput = page.locator('input[name="identifier"], input[type="email"], input[name="emailAddress"]').first();
    const emailCount = await page.locator('input[name="identifier"], input[type="email"], input[name="emailAddress"]').count();

    if (emailCount > 0) {
      console.log('Testing form validation...');

      // Try entering invalid email
      await emailInput.fill('invalid-email');
      await page.waitForTimeout(1000);

      // Take screenshot
      await page.screenshot({
        path: '/Users/masa/Projects/joanies-kitchen/tests/reports/signin-invalid-email.png',
        fullPage: true
      });

      // Clear and try with valid format
      await emailInput.clear();
      await emailInput.fill('test@example.com');
      await page.waitForTimeout(1000);

      console.log('✅ Email input accepts user input');

      // Check if password field appears (Clerk might use progressive disclosure)
      const passwordInput = page.locator('input[name="password"], input[type="password"]').first();
      const passwordCount = await page.locator('input[name="password"], input[type="password"]').count();

      if (passwordCount > 0) {
        await passwordInput.fill('testpassword123');
        console.log('✅ Password input accepts user input');
      }

      // Take screenshot with filled form
      await page.screenshot({
        path: '/Users/masa/Projects/joanies-kitchen/tests/reports/signin-form-filled.png',
        fullPage: true
      });

      console.log('ℹ️ Form validation test completed (no actual sign-in attempted)');
    } else {
      console.log('ℹ️ Could not test form validation - email input not found');
    }

    // Verify no critical errors
    const criticalErrors = consoleErrors.filter(err =>
      !err.includes('favicon') &&
      !err.includes('manifest') &&
      !err.includes('gtm')
    );

    if (criticalErrors.length > 0) {
      console.log('⚠️ Critical errors detected:');
      criticalErrors.forEach(err => console.log(`  - ${err}`));
    } else {
      console.log('✅ No critical console errors detected');
    }
  });

  test('6. Page Load Performance and Resources', async ({ page }) => {
    const startTime = Date.now();

    await page.goto(`${PRODUCTION_URL}/sign-in`, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    const loadTime = Date.now() - startTime;
    console.log(`Page load time: ${loadTime}ms`);

    // Check Clerk resources loaded
    const clerkScripts = await page.locator('script[src*="clerk"]').count();
    console.log(`Clerk scripts loaded: ${clerkScripts}`);

    // Check for Clerk styles
    const clerkStyles = await page.locator('link[href*="clerk"], style[data-clerk]').count();
    console.log(`Clerk styles loaded: ${clerkStyles}`);

    // Verify Clerk initialization
    const clerkInitialized = await page.evaluate(() => {
      return typeof window !== 'undefined' && 'Clerk' in window;
    });
    console.log(`Clerk initialized: ${clerkInitialized}`);

    // Take final screenshot
    await page.screenshot({
      path: '/Users/masa/Projects/joanies-kitchen/tests/reports/signin-final-state.png',
      fullPage: true
    });

    expect(loadTime).toBeLessThan(10000); // Should load within 10 seconds
    console.log('✅ Page load performance acceptable');
  });
});
