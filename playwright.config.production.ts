import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for Production Fixes Testing on localhost:3005
 * No webServer - assumes server is already running
 */
export default defineConfig({
  testDir: './tests/e2e',

  // Timeout for each test
  timeout: 60 * 1000, // 60 seconds

  // Fail fast on first failure
  fullyParallel: false,
  forbidOnly: !!process.env.CI,

  // Retry failed tests
  retries: process.env.CI ? 1 : 0,

  // Number of workers
  workers: 1, // Run tests serially for consistent screenshots

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['list'],
  ],

  use: {
    // Base URL for tests - localhost:3005
    baseURL: 'http://localhost:3005',

    // Collect trace on failure
    trace: 'retain-on-failure',

    // Screenshot on failure
    screenshot: 'on',

    // Video on failure
    video: 'retain-on-failure',

    // Browser context options
    viewport: { width: 1920, height: 1080 },

    // Ignore HTTPS errors
    ignoreHTTPSErrors: true,

    // Capture console logs
    contextOptions: {
      reducedMotion: 'reduce',
    },
  },

  // Configure projects for different browsers and viewports
  projects: [
    // Desktop Chrome only for production testing
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
    },
  ],

  // NO webServer - use existing server on localhost:3005
});
