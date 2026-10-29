import { test as teardown } from '@playwright/test';
import { neonTestUserStore, removeTestUser } from './test-session';

/** Deletes the TEST_USER row that auth.setup.ts seeded, behind the same gates. */
teardown('remove e2e test user', async ({ baseURL }) => {
  if (!baseURL) throw new Error('Playwright baseURL must be set for the auth teardown.');
  await removeTestUser(process.env, baseURL, () => neonTestUserStore(process.env));
});
