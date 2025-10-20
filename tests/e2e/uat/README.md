# UAT Testing Guide - Joanie's Kitchen

## Overview

This directory contains comprehensive User Acceptance Testing (UAT) scripts for Joanie's Kitchen core features.

## Test Suite: `comprehensive-core-features.spec.ts`

### Features Tested

1. **Account Creation & Authentication**
   - Sign up flow
   - Sign in functionality
   - Session persistence

2. **Recipe Creation (Manual Entry)**
   - Navigate to creation page
   - Fill detailed form with all fields
   - Form validation testing

3. **Recipe Viewing**
   - View recipe detail page
   - Verify metadata display
   - View user recipes list

4. **Recipe Sharing & Visibility**
   - Make recipe public/private
   - Verify public recipes appear in discover
   - Test sharing URLs

5. **Recipe Engagement**
   - Like/favorite recipes
   - Fork/save to collection
   - View engagement stats

6. **Recipe Editing**
   - Navigate to edit page
   - Edit recipe details
   - Verify changes persist

7. **Recipe Discovery**
   - Browse discover page
   - Search for recipes
   - Filter by cuisine/difficulty
   - View system/curated recipes

8. **Collections**
   - Navigate to collections page
   - Create collection
   - Add recipe to collection

## Running Tests

### Prerequisites

1. Ensure development server is running (for local tests):
   ```bash
   pnpm dev
   ```

2. Set up test account credentials in `.env.local`:
   ```env
   TEST_USER_EMAIL=your_email+clerk_test@example.com
   TEST_USER_PASSWORD=424242
   ```

### Running on Local Development

```bash
# Run all UAT tests on localhost:3002
npx playwright test tests/e2e/uat/comprehensive-core-features.spec.ts --project=chromium-desktop

# With UI mode
npx playwright test tests/e2e/uat/comprehensive-core-features.spec.ts --ui

# With headed mode (see the browser)
npx playwright test tests/e2e/uat/comprehensive-core-features.spec.ts --headed
```

### Running on Production

1. Edit `tests/e2e/uat/comprehensive-core-features.spec.ts`
2. Change line:
   ```typescript
   const USE_ENVIRONMENT: 'local' | 'production' = 'local';
   ```
   to:
   ```typescript
   const USE_ENVIRONMENT: 'local' | 'production' = 'production';
   ```
3. Run tests:
   ```bash
   npx playwright test tests/e2e/uat/comprehensive-core-features.spec.ts --project=chromium-desktop
   ```

## Test Outputs

### Screenshots

All test screenshots are saved to:
```
tmp/uat-comprehensive/
```

Screenshot naming convention:
```
{environment}-{test-name}-{timestamp}.png
```

Example:
```
local-2-2-recipe-form-filled-1729441234567.png
production-3-1-recipe-detail-1729441234567.png
```

### Test Report

A comprehensive markdown report is generated at:
```
tmp/uat-comprehensive-report.md
```

Report includes:
- Test execution log with timestamps
- Pass/fail/blocked status for each test
- Executive summary with statistics
- Critical issues list
- Recommendations for release readiness

## Test Account

- **Email**: `your_email+clerk_test@example.com`
- **Password**: `424242`

**Note**: You may need to create this account first on both local and production environments.

## Interpreting Results

### Test Status Codes

- **PASS** ✅: Test completed successfully, feature works as expected
- **FAIL** ❌: Test failed, critical functionality broken
- **BLOCKED** ⚠️: Test skipped, feature not yet implemented

### Release Readiness Criteria

**Ready for Public Release** if:
- All PASS tests > 80%
- Zero FAIL tests in critical features (1, 2, 3, 6)
- Acceptable number of BLOCKED tests for nice-to-have features

**NOT Ready for Public Release** if:
- Any FAIL tests in authentication, recipe creation, or viewing
- Data persistence issues
- Critical user flows broken

## Troubleshooting

### Tests Failing to Authenticate

1. Verify test account exists in the target environment
2. Check `.env.local` has correct credentials
3. Manually sign in to verify credentials work
4. Check Clerk configuration in environment

### Tests Timing Out

1. Increase timeout in test:
   ```typescript
   timeout: 60 * 1000, // Increase from 60s to 120s
   ```
2. Check network connectivity to production
3. Verify local dev server is running

### Screenshots Not Capturing

1. Check `tmp/` directory exists and is writable
2. Verify Playwright has screenshot permissions
3. Check disk space

### Element Selectors Not Found

This is common when:
- UI has changed since test was written
- Feature is not yet implemented
- Page hasn't fully loaded

Update selectors in the test file to match current UI.

## Continuous Improvement

After each test run:

1. **Review Failed Tests**: Identify root causes
2. **Update Selectors**: Adjust for UI changes
3. **Add New Tests**: Cover new features
4. **Refine Test Data**: Use realistic test scenarios
5. **Document Issues**: Create tickets for bugs found

## Contact

For questions about these tests, contact the Web QA team or refer to the main project documentation.
