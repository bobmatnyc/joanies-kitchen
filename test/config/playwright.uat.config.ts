import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for UAT Testing
 *
 * Uses existing dev server on port 3002
 * Runs comprehensive user acceptance tests
 */
export default defineConfig({
  testDir: '../tests/uat',

  // Timeout for each test
  timeout: 90 * 1000, // 90 seconds for AI operations

  // Fail fast on first failure
  fullyParallel: false, // Run sequentially for UAT
  forbidOnly: !!process.env.CI,

  // No retries for UAT - we want to see real failures
  retries: 0,

  // Single worker for UAT
  workers: 1,

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: '../artifacts/uat-report' }],
    ['json', { outputFile: '../artifacts/test-results/uat-results.json' }],
    ['list'],
  ],

  use: {
    // Base URL for tests
    baseURL: 'http://localhost:3002',

    // Always collect trace for UAT
    trace: 'on',

    // Screenshot on failure and success
    screenshot: 'on',

    // Always record video
    video: 'on',

    // Browser context options
    viewport: { width: 1280, height: 720 },

    // Ignore HTTPS errors
    ignoreHTTPSErrors: true,

    // Capture console logs
    contextOptions: {
      reducedMotion: 'reduce',
    },
  },

  // Single project for UAT
  projects: [
    {
      name: 'UAT-Chrome',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
    },
  ],

  // No web server - use existing dev server
  // Make sure to start dev server before running tests:
  // pnpm dev
});
