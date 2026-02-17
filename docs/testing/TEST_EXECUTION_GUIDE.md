# API Integration Tests - Quick Start Guide

## Prerequisites

The integration tests require a PostgreSQL database connection. Follow these steps to set up and run the tests.

## Step 1: Set Up Environment Variables

### Option A: Use Existing Database (Recommended for Development)

If you already have a local development database:

```bash
# Copy your existing .env.local DATABASE_URL
export DATABASE_URL="postgresql://user:password@localhost:5432/joanies_kitchen"  # pragma: allowlist secret

# Or add to .env.test.local
echo 'DATABASE_URL="postgresql://user:password@localhost:5432/joanies_kitchen"  # pragma: allowlist secret' > .env.test.local
```

### Option B: Create Test Database

For isolated testing:

```bash
# Create test database
createdb joanies_kitchen_test

# Set environment variable
export DATABASE_URL="postgresql://user:password@localhost:5432/joanies_kitchen_test"  # pragma: allowlist secret
```

## Step 2: Verify Database Connection

```bash
# Test connection using psql
psql "$DATABASE_URL" -c "SELECT 1"

# Should output:
# ?column?
# ----------
#        1
```

## Step 3: Run Integration Tests

### Run All Tests

```bash
# Standard run
npm run test:integration

# With CI mode (prevents watch mode, recommended)
CI=true npm run test:integration

# With coverage report
npm run test:integration -- --coverage
```

### Run Specific Test Suite

```bash
# Test Chefs API only
npm run test:integration -- test/tests/integration/api/chefs.test.ts

# Test Collections API only
npm run test:integration -- test/tests/integration/api/collections.test.ts

# Test Inventory API only
npm run test:integration -- test/tests/integration/api/inventory.test.ts

# Test Ingredients API only
npm run test:integration -- test/tests/integration/api/ingredients.test.ts

# Test Favorites API only
npm run test:integration -- test/tests/integration/api/favorites.test.ts
```

### Run with Filters

```bash
# Run only tests matching pattern
npm run test:integration -- -t "should create"

# Run only tests in a specific describe block
npm run test:integration -- -t "POST /api/v1/chefs"
```

## Expected Output

### Successful Test Run

```
✓ test/tests/integration/api/chefs.test.ts (24) 5234ms
  ✓ Chefs API Endpoints (24) 5232ms
    ✓ GET /api/v1/chefs (6) 1234ms
      ✓ should return paginated list of chefs
      ✓ should search chefs by name
      ✓ should sort chefs by different fields
      ✓ should reject request without authentication
      ✓ should reject request with invalid page parameter
      ✓ should enforce max limit parameter
    ✓ POST /api/v1/chefs (5) 987ms
    ✓ GET /api/v1/chefs/:slug (3) 456ms
    ✓ PATCH /api/v1/chefs/:slug (4) 789ms
    ✓ DELETE /api/v1/chefs/:slug (4) 654ms

Test Files  8 passed (8)
     Tests  186 passed (186)
  Start at  22:41:23
  Duration  45.67s
```

## Test Suite Breakdown

| Suite | Tests | Avg Time | Description |
|-------|-------|----------|-------------|
| auth.test.ts | 17 | ~3s | API key authentication |
| chefs.test.ts | 24 | ~5s | Chefs CRUD operations |
| collections.test.ts | 26 | ~6s | Collections management |
| inventory.test.ts | 30 | ~7s | Inventory tracking |
| ingredients.test.ts | 27 | ~5s | Ingredients catalog |
| favorites.test.ts | 28 | ~6s | Favorites & likes |
| meals.test.ts | 17 | ~4s | Meal planning |
| recipes.test.ts | 17 | ~4s | Recipe management |

**Total**: 186 tests, ~40-50 seconds

## Troubleshooting

### Issue: "DATABASE_URL must be a valid PostgreSQL connection string"

**Solution**:
```bash
# Check if DATABASE_URL is set
echo $DATABASE_URL

# If empty, export it
export DATABASE_URL="postgresql://user:password@localhost:5432/dbname"  # pragma: allowlist secret

# Or add to .env.test.local
echo 'DATABASE_URL="your-connection-string"' > .env.test.local
```

### Issue: "Cannot find module '@/lib/...'

**Solution**:
```bash
# Rebuild the project
npm run build

# Clear cache and retry
rm -rf .next node_modules/.cache
npm run test:integration
```

### Issue: Tests hang or timeout

**Solution**:
```bash
# Increase timeout in test config
# Or run with increased timeout
npm run test:integration -- --timeout=60000

# Check for orphaned processes
ps aux | grep vitest
pkill -f vitest
```

### Issue: Port 3000 already in use

**Solution**:
```bash
# Stop development server if running
npm run dev:pm2:stop

# Or kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

### Issue: Database connection refused

**Solution**:
```bash
# Check PostgreSQL is running
pg_isready

# If not running, start it
# macOS: brew services start postgresql@14
# Linux: sudo systemctl start postgresql
```

### Issue: API keys table missing

**Solution**:
```bash
# Run database migrations
npm run db:migrate

# Or push schema
npm run db:push
```

## Test Data Cleanup

Tests automatically clean up after themselves, but if manual cleanup is needed:

```bash
# Connect to database
psql "$DATABASE_URL"

# View test data
SELECT * FROM api_keys WHERE user_id LIKE 'test-user-%';

# Delete test data (if tests failed to clean up)
DELETE FROM api_keys WHERE user_id LIKE 'test-user-%';
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Integration Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run migrations
        run: npm run db:push
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db  # pragma: allowlist secret

      - name: Run integration tests
        run: CI=true npm run test:integration
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db  # pragma: allowlist secret

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        if: always()
```

## Performance Tips

### Speed Up Test Execution

1. **Use Test Database**: Separate test DB avoids conflicts
2. **Run in Parallel**: Tests are designed for sequential execution (safer)
3. **Skip Unnecessary Tests**: Use `-t` filter for specific tests
4. **Clean Database**: Start with clean database for faster tests

### Optimize Database

```sql
-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_chefs_slug ON chefs(slug);
CREATE INDEX IF NOT EXISTS idx_recipes_slug ON recipes(slug);
```

## Additional Resources

- [Test Architecture Documentation](test/tests/integration/api/README.md)
- [API Authentication Guide](src/lib/api-auth/README.md)
- [Vitest Documentation](https://vitest.dev/)

## Support

If you encounter issues not covered here:

1. Check the main test README: `test/tests/integration/api/README.md`
2. Review test logs for specific error messages
3. Verify database connectivity and schema
4. Ensure all environment variables are set correctly

---

**Last Updated**: 2026-02-16
**Status**: ✅ Ready to use
