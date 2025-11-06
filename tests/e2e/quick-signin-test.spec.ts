import { test, expect } from '@playwright/test';

const PRODUCTION_URL = 'https://joanies.kitchen';

test.describe('Quick Sign-In Flow Test', () => {
  test('Test sign-in page loads and shows Clerk form', async ({ page }) => {
    console.log('\n=== Testing Sign-In Page ===\n');

    // Navigate to sign-in page
    const response = await page.goto(`${PRODUCTION_URL}/sign-in`, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    console.log(`✅ Sign-in page HTTP status: ${response?.status()}`);
    expect(response?.status()).toBe(200);

    // Wait for Clerk to load
    await page.waitForTimeout(5000);

    // Take screenshot
    await page.screenshot({
      path: '/Users/masa/Projects/joanies-kitchen/tests/reports/quick-signin-page.png',
      fullPage: true
    });
    console.log('✅ Screenshot saved: quick-signin-page.png');

    // Check page title
    const title = await page.title();
    console.log(`Page title: "${title}"`);

    // Count various form elements
    const emailInputs = await page.locator('input[name="identifier"], input[type="email"], input[name="emailAddress"]').count();
    const passwordInputs = await page.locator('input[type="password"], input[name="password"]').count();
    const submitButtons = await page.locator('button[type="submit"]').count();
    const googleButtons = await page.locator('button:has-text("Google"), button:has-text("Continue with Google")').count();

    console.log(`\n=== Form Elements Found ===`);
    console.log(`Email inputs: ${emailInputs}`);
    console.log(`Password inputs: ${passwordInputs}`);
    console.log(`Submit buttons: ${submitButtons}`);
    console.log(`Google OAuth buttons: ${googleButtons}`);

    // Check if Clerk component loaded
    const clerkElements = await page.locator('[data-clerk-id], [class*="clerk"], [class*="cl-"]').count();
    console.log(`Clerk-related elements: ${clerkElements}`);

    // Get page text content to search for sign-in related text
    const pageText = await page.textContent('body');
    const hasSignInText = pageText?.toLowerCase().includes('sign in') || false;
    const hasEmailText = pageText?.toLowerCase().includes('email') || false;

    console.log(`\n=== Page Content ===`);
    console.log(`Contains "sign in": ${hasSignInText}`);
    console.log(`Contains "email": ${hasEmailText}`);

    // Final validation
    expect(clerkElements).toBeGreaterThan(0);
    console.log('\n✅ Clerk authentication component detected');
  });
});
