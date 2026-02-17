# API Integration Tests

Comprehensive end-to-end integration tests for Joanie's Kitchen API v1.

## Overview

These tests validate the complete API flow including:
- Authentication and authorization
- API key management
- Recipe CRUD operations
- Meal planning functionality
- Shopping list generation
- Rate limiting and security

## Prerequisites

1. **Database**: Tests require a working PostgreSQL database
2. **Environment**: Set `DATABASE_URL` in `.env.local`
3. **Dependencies**: `pnpm install`

## Running Tests

### Run All Integration Tests
```bash
pnpm test:integration
```

### Run Specific Test Suite
```bash
# Authentication tests only
pnpm vitest tests/integration/api/auth.test.ts

# Recipe tests only
pnpm vitest tests/integration/api/recipes.test.ts

# Meals tests only
pnpm vitest tests/integration/api/meals.test.ts
```

### Run with Coverage
```bash
pnpm test:integration --coverage
```

### Watch Mode (for development)
```bash
pnpm test:integration --watch
```

## Test Structure

```
tests/integration/api/
├── setup.ts           # Test utilities and helpers
├── auth.test.ts       # Authentication endpoint tests
├── recipes.test.ts    # Recipe endpoint tests
└── meals.test.ts      # Meals & shopping lists tests
```

## Test Data

### Automatic Cleanup
- Tests create temporary data with `test-user-*` prefixes
- All test data is cleaned up automatically after tests complete
- Failed tests may leave orphaned data (manually clean with SQL)

### Manual Cleanup (if needed)
```sql
DELETE FROM api_keys WHERE user_id LIKE 'test-user-%';
DELETE FROM recipes WHERE created_by LIKE 'test-user-%';
DELETE FROM meals WHERE user_id LIKE 'test-user-%';
```

## Key Test Scenarios

### Authentication Tests (`auth.test.ts`)
- ✅ API key creation with admin scope
- ✅ Unauthorized key creation (403)
- ✅ Invalid scope rejection (400)
- ✅ API key listing and filtering
- ✅ API key retrieval, update, revocation
- ✅ API key deletion
- ✅ Usage statistics tracking
- ✅ Rate limiting enforcement
- ✅ Expired key rejection
- ✅ Revoked key rejection
- ✅ Key hash security (not exposed)

### Recipe Tests (`recipes.test.ts`)
- ✅ Recipe listing with pagination
- ✅ Recipe filtering (query, tags)
- ✅ Recipe retrieval by ID
- ✅ Similar recipe recommendations
- ✅ Recipe creation with write scope
- ✅ Recipe updates (PATCH)
- ✅ Recipe deletion
- ✅ Unauthorized write attempts (403)
- ✅ Field validation (400)
- ✅ Rate limiting
- ✅ Consistent response schema

### Meals Tests (`meals.test.ts`)
- ✅ Meal creation and listing
- ✅ Meal filtering by date range
- ✅ Meal retrieval with recipe details
- ✅ Meal updates and deletion
- ✅ Recipe association with meals
- ✅ Shopping list generation from meals
- ✅ Shopping list CRUD operations
- ✅ Item check/uncheck functionality
- ✅ Authorization enforcement

## Configuration

Tests use `vitest.integration.config.ts`:
- 30-second timeout for slow operations
- Sequential execution (avoids database conflicts)
- Coverage reporting for API code only
- Node environment (not browser)

## Best Practices

### Writing New Tests
1. **Use setup utilities**: `createTestApiKey()`, `makeAuthenticatedRequest()`
2. **Clean up**: Always call `context.cleanup()` in `afterAll`
3. **Isolation**: Tests should not depend on each other
4. **Assertions**: Use `assertStatus()` and `assertJsonResponse()`
5. **Edge cases**: Test both success and failure scenarios

### Example Test
```typescript
describe('My Feature', () => {
  let testContext: TestContext;

  beforeAll(async () => {
    await globalSetup();
    testContext = await createTestApiKey({
      scopes: ['read:recipes'],
    });
  });

  afterAll(async () => {
    await testContext.cleanup();
    await globalTeardown();
  });

  it('should work correctly', async () => {
    const response = await makeAuthenticatedRequest('/api/v1/my-endpoint', {
      method: 'GET',
      apiKey: testContext.testApiKey,
    });

    assertStatus(response, 200);
    const data = await assertJsonResponse(response);
    expect(data).toHaveProperty('expectedField');
  });
});
```

## Troubleshooting

### Tests Hang
- Check database connection in `.env.local`
- Ensure no other process is using test database
- Try running tests with `--no-coverage`

### Authentication Failures
- Verify API keys schema exists: `pnpm tsx scripts/apply-api-keys-migration.ts`
- Check that test user IDs start with `test-user-`

### Rate Limiting Issues
- Rate limit tests may be flaky in CI
- Use `--retry 2` flag if needed
- Consider skipping rate limit tests in CI

### Database Conflicts
- Tests run sequentially to avoid conflicts
- If tests fail, orphaned data may remain
- Run manual cleanup SQL (see above)

## CI/CD Integration

### GitHub Actions Example
```yaml
- name: Run Integration Tests
  env:
    DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
  run: pnpm test:integration
```

### Local Development
```bash
# Use separate test database
export DATABASE_URL="postgresql://user:pass@localhost:5432/joanies_test"

# Run tests
pnpm test:integration
```

## Performance

### Test Execution Time
- Full suite: ~2-3 minutes
- Auth tests: ~30-45 seconds
- Recipe tests: ~45-60 seconds
- Meals tests: ~45-60 seconds

### Optimization Tips
- Use `--bail` to stop on first failure
- Run specific suites during development
- Use watch mode for TDD workflow

## Coverage Goals

Target: **80%+ coverage** for API code

```bash
# Generate coverage report
pnpm test:integration --coverage

# View HTML report
open coverage/index.html
```

## Next Steps

- [ ] Add WebSocket endpoint tests (when implemented)
- [ ] Add file upload tests (recipe images)
- [ ] Add batch operation tests
- [ ] Add performance benchmarks
- [ ] Add load testing scenarios
