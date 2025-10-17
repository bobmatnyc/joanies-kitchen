# Meals Feature - E2E Test Suite

Comprehensive Playwright integration tests for the meals feature, covering end-to-end user journeys.

## Overview

This test suite validates the complete meals workflow from creation to deletion, ensuring all features work correctly and meet business requirements.

### Test Coverage

| Test Suite | File | Test Count | Coverage |
|------------|------|------------|----------|
| Meal Creation | `meal-creation.spec.ts` | 6 tests | Create flow, validation, multi-recipe, form persistence |
| Meal Templates | `meal-templates.spec.ts` | 6 tests | Template display, usage, customization, cancellation |
| Shopping Lists | `shopping-lists.spec.ts` | 8 tests | Generation, consolidation, categories, checkboxes, pricing |
| Meal Editing | `meal-editing.spec.ts` | 9 tests | Navigation, pre-fill, updates, recipe management, cancellation |
| Meal Deletion | `meal-deletion.spec.ts` | 6 tests | Delete with confirmation, cancellation, cleanup, cascade |
| Error Handling | `error-handling.spec.ts` | 10 tests | 404s, loading states, validation, offline mode, edge cases |

**Total Tests**: 45+ integration tests

## Running Tests

### Quick Start

```bash
# Run all meals tests
pnpm test:e2e:meals

# Run with UI (interactive mode)
pnpm test:e2e:meals:ui

# Run in debug mode
pnpm test:e2e:meals:debug

# Run with browser visible (headed mode)
pnpm test:e2e:meals:headed

# Run UAT tests for meals (chromium only)
pnpm test:uat:meals
```

### Run Specific Test Files

```bash
# Meal creation tests only
pnpm test:e2e:meals -- meal-creation

# Shopping list tests only
pnpm test:e2e:meals -- shopping-lists

# Error handling tests only
pnpm test:e2e:meals -- error-handling
```

### Run Specific Tests

```bash
# Run a single test by name
pnpm test:e2e:meals -- -g "should create a new meal successfully"

# Run tests matching pattern
pnpm test:e2e:meals -- -g "delete"
```

## Setup Requirements

### 1. Environment Variables

Add test user credentials to `.env.local`:

```env
# Test User Authentication
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=yourSecurePassword123
```

⚠️ **Important**: Create a dedicated test user in Clerk. Do not use your personal account.

### 2. Database State

Tests require:
- ✅ Recipes in database (for searching and adding to meals)
- ✅ Test user authenticated via Clerk
- ✅ Clean database or isolated test data

### 3. Application Running

Tests will automatically start the dev server on `http://localhost:3002` (configured in `playwright.config.ts`).

Alternatively, start the server manually:

```bash
pnpm dev
```

Then run tests with existing server:

```bash
pnpm test:e2e:meals
```

## Test Architecture

### Authentication Flow

1. **Setup Phase** (`tests/e2e/setup/auth.setup.ts`)
   - Runs before all tests
   - Authenticates test user via Clerk
   - Saves auth state to `tests/e2e/.auth/user.json`
   - Reused across all tests (fast)

2. **Test Execution**
   - Each test uses saved auth state
   - No repeated sign-ins
   - Tests run in parallel

### Test Data Management

**Fixtures** (`fixtures/test-data.ts`):
- Reusable test data objects
- Helper functions for common operations
- Test meal generators with unique names

**Cleanup Strategy**:
- Tests track created meals
- `afterAll` hook cleans up test data
- Prevents database pollution

### Test Patterns

**UAT-Style Testing**:
```typescript
test('should create a new meal successfully', async ({ page }) => {
  /**
   * Business Value: Core meal creation functionality
   * Success Criteria:
   * - User can navigate to create meal page
   * - Form accepts valid meal data
   * - Meal is created and appears in meals list
   */

  // Step 1: Navigate to meals page
  await page.goto('/meals');

  // Step 2: Click create button
  await page.click('button:has-text("Create New Meal")');

  // ... more steps ...

  // Verification
  await expect(page.locator('h1')).toContainText(mealName);
});
```

## Test Organization

### By User Journey

1. **Creation Flow**
   - Navigate to create page
   - Fill form with valid data
   - Add recipes
   - Submit and verify

2. **Template Flow**
   - Browse templates
   - Select template
   - Customize
   - Create meal

3. **Shopping List Flow**
   - Navigate to meal detail
   - Generate shopping list
   - Verify consolidation
   - Toggle checkboxes

4. **Editing Flow**
   - Navigate to edit page
   - Modify meal data
   - Add/remove recipes
   - Save changes

5. **Deletion Flow**
   - Navigate to meal
   - Click delete
   - Confirm deletion
   - Verify removal

## Business Value Validation

Each test includes:

1. **Business Goal**: What business objective does this test validate?
2. **User Story**: What user need is being tested?
3. **Success Criteria**: What must work for test to pass?

Example:
```typescript
/**
 * Business Value: Automated grocery planning
 *
 * User Story: As a home cook, I want to generate a shopping list
 *             so that I know exactly what ingredients to buy
 *
 * Success Criteria:
 * - Shopping list can be generated
 * - Ingredients are consolidated
 * - List is associated with meal
 */
```

## Debugging Tests

### Visual Debugging

```bash
# Open Playwright UI
pnpm test:e2e:meals:ui

# Select a test to run
# View step-by-step execution
# Inspect DOM and network requests
```

### Debug Mode

```bash
# Pause execution at breakpoints
pnpm test:e2e:meals:debug
```

### Screenshots and Videos

Tests automatically capture:
- 📸 Screenshots on failure
- 🎥 Videos on retry
- 📊 Traces on first retry

View reports:
```bash
pnpm test:e2e:report
```

### Console Logs

Tests include helpful console logs:
```
✅ Meal created successfully: Test Dinner - 1234567890
✅ Shopping list generated with 5 items
⚠️  No templates available for testing
ℹ️  Multiplier feature not found
```

## Common Issues

### Authentication Failures

**Problem**: Tests can't sign in

**Solution**:
1. Verify `TEST_USER_EMAIL` and `TEST_USER_PASSWORD` in `.env.local`
2. Check test user exists in Clerk dashboard
3. Verify Clerk environment variables are correct
4. Delete `tests/e2e/.auth/user.json` and re-run

```bash
rm tests/e2e/.auth/user.json
pnpm test:e2e:meals
```

### Database State Issues

**Problem**: Tests fail due to missing data

**Solution**:
1. Ensure recipes exist in database
2. Run database seeders if available
3. Check test user has appropriate permissions

### Port Conflicts

**Problem**: Port 3002 already in use

**Solution**:
1. Stop other Next.js instances
2. Kill process on port 3002:
```bash
lsof -ti:3002 | xargs kill -9
```

### Flaky Tests

**Problem**: Tests pass sometimes, fail others

**Solution**:
1. Increase timeouts for slow operations
2. Add `waitForLoadState('networkidle')`
3. Use more specific selectors
4. Check for race conditions

## Test Maintenance

### Adding New Tests

1. Create test file in `tests/e2e/meals/`
2. Follow UAT pattern (Business Value → User Story → Success Criteria)
3. Use fixtures from `fixtures/test-data.ts`
4. Add cleanup in `afterAll` hook
5. Document test in this README

### Updating Selectors

When UI changes:
1. Update selectors in test files
2. Consider adding `data-testid` attributes to components
3. Prefer semantic selectors (`button:has-text("Create")`)
4. Avoid brittle CSS selectors (`.btn-primary-123`)

### Continuous Integration

For CI/CD pipelines:

```bash
# Run headless with specific workers
pnpm test:e2e:meals -- --workers=1

# Generate CI-friendly reports
pnpm test:uat:meals
```

## Success Metrics

### Coverage Goals

- ✅ All major user journeys covered
- ✅ Happy path + error cases tested
- ✅ Mobile and desktop viewports
- ✅ Cross-browser compatibility

### Performance Targets

- ⚡ Full suite < 5 minutes
- ⚡ Individual test < 30 seconds
- ⚡ Parallel execution enabled

### Quality Indicators

- 🎯 Tests pass consistently (< 1% flake rate)
- 🎯 Clear failure messages
- 🎯 Easy to debug failures
- 🎯 Self-documenting code

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Project CLAUDE.md](/CLAUDE.md) - Project guidelines
- [Meals Feature Guide](/docs/guides/MEALS_GUIDE.md) - Feature documentation
- [API Reference](/docs/reference/MEALS_API.md) - Meals API

## Contributing

When adding new meal features:

1. ✅ Write tests first (TDD approach)
2. ✅ Include UAT-style documentation
3. ✅ Add cleanup for test data
4. ✅ Update this README
5. ✅ Verify tests pass in CI

## Test Results

After running tests, view the HTML report:

```bash
pnpm test:e2e:report
```

Example output:
```
Running 45 tests using 4 workers

  ✓ [chromium-desktop] › meals/meal-creation.spec.ts:18:3 › should create a new meal successfully
  ✓ [chromium-desktop] › meals/meal-creation.spec.ts:95:3 › should validate required fields
  ✓ [chromium-desktop] › meals/meal-templates.spec.ts:23:3 › should display available templates
  ...

  45 passed (2m 34s)
```

## Questions?

Contact the development team or check:
- Project documentation in `/docs`
- Existing tests for patterns
- Playwright best practices guide

---

**Last Updated**: 2025-10-17
**Test Suite Version**: 1.0.0
**Maintainer**: Recipe Manager Team
