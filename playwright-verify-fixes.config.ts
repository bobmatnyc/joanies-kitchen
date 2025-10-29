import { defineConfig, devices } from '@playwright/test';

/**
 * Standalone Playwright config for fix verification
 * Does not require authentication setup
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/verify-4-fixes-no-auth.spec.ts',

  timeout: 120 * 1000,
  fullyParallel: false,
  workers: 1,

  reporter: [['list']],

  use: {
    baseURL: 'http://localhost:3002',
    trace: 'retain-on-failure',
    screenshot: 'on',
    video: 'retain-on-failure',
    viewport: { width: 1920, height: 1080 },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Reuse existing server
  webServer: {
    command: 'echo "Using existing server"',
    url: 'http://localhost:3002',
    reuseExistingServer: true,
    timeout: 5 * 1000,
  },
});
