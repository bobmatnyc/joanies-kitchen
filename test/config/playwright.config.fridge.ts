import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '../../.env.local' });

/**
 * Playwright Configuration for Fridge Feature Testing
 * Tests against running server on port 3005
 */
export default defineConfig({
  testDir: '../tests/e2e',

  // Timeout for each test
  timeout: 90 * 1000, // 90 seconds

  // Fail fast on first failure
  fullyParallel: false,
  forbidOnly: !!process.env.CI,

  // Retry failed tests
  retries: 0,

  // Number of workers
  workers: 1,

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: '../artifacts/playwright-report-fridge' }],
    ['json', { outputFile: '../artifacts/test-results/fridge-results.json' }],
    ['list'],
  ],

  use: {
    // Base URL for tests - USING PORT 3005
    baseURL: 'http://localhost:3005',

    // Collect trace on first retry
    trace: 'on',

    // Screenshot on failure
    screenshot: 'on',

    // Video on retry
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

  // Configure projects for different browsers and viewports
  projects: [
    // Desktop Chromium only for this test
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
    },
  ],

  // NO WEB SERVER - app is already running on 3005
});
