import { expect, test as setup } from '@playwright/test';
import { AUTH_FILE, mintTestSessionCookie, TEST_USER } from './test-session';

/**
 * E2E authentication setup (NextAuth).
 *
 * Why: dependent projects reuse one signed-in storageState; the app's only
 * provider is Google OAuth, which cannot be scripted.
 * What: mints a signed Auth.js session cookie for TEST_USER (gated by
 * `assertTestAuthAllowed`), confirms `/api/auth/session` returns that user,
 * and saves the storageState. Requires E2E_TEST_AUTH=1 and the dev server's
 * AUTH_SECRET in this process's environment.
 * Test: `test/tests/unit/e2e-test-session.test.ts`
 */

setup('authenticate', async ({ context, page, baseURL }) => {
  if (!baseURL) throw new Error('Playwright baseURL must be set for the auth setup.');

  await context.addCookies([await mintTestSessionCookie(process.env, baseURL)]);

  const response = await page.request.get('/api/auth/session');
  expect(response.ok()).toBe(true);
  const session = await response.json();
  expect(session?.user?.id, 'dev server rejected the minted session').toBe(TEST_USER.id);

  await context.storageState({ path: AUTH_FILE });
});
