# REST API v1 Integration Tests

Comprehensive integration test suite for all REST API v1 endpoints.

## Overview

This test suite provides end-to-end testing for the type-safe REST API backend, covering authentication, authorization, validation, and error handling across all API domains.

**Total Test Coverage**: 186 test cases across 8 test suites

## Test Suites

### 1. Authentication Tests (`auth.test.ts`)
- **Tests**: 17
- **Coverage**: API key authentication, token validation, scope verification
- **Endpoints**: `/api/v1/auth/*`

### 2. Chefs API Tests (`chefs.test.ts`)
- **Tests**: 24
- **Coverage**:
  - ✅ GET /api/v1/chefs (list, search, sort, pagination)
  - ✅ POST /api/v1/chefs (create with admin scope)
  - ✅ GET /api/v1/chefs/:slug (get by slug)
  - ✅ PATCH /api/v1/chefs/:slug (update)
  - ✅ DELETE /api/v1/chefs/:slug (delete)
  - ✅ GET /api/v1/chefs/:slug/recipes (chef's recipes)

**Test Categories**:
- Success cases (200/201)
- Authentication required (401)
- Permission denied (403)
- Validation errors (400)
- Not found (404)

### 3. Collections API Tests (`collections.test.ts`)
- **Tests**: 26
- **Coverage**:
  - ✅ GET /api/v1/collections (list user's collections)
  - ✅ POST /api/v1/collections (create collection)
  - ✅ GET /api/v1/collections/:id (get collection details)
  - ✅ PATCH /api/v1/collections/:id (update collection)
  - ✅ DELETE /api/v1/collections/:id (delete collection)
  - ✅ POST /api/v1/collections/:id/recipes (add recipe to collection)
  - ✅ DELETE /api/v1/collections/:id/recipes/:recipeId (remove recipe)

**Test Categories**:
- CRUD operations
- Recipe association management
- Public/private visibility
- Pagination and sorting
- Authorization checks

### 4. Inventory API Tests (`inventory.test.ts`)
- **Tests**: 30
- **Coverage**:
  - ✅ GET /api/v1/inventory (list user's inventory)
  - ✅ POST /api/v1/inventory (add to inventory)
  - ✅ GET /api/v1/inventory/:id (get inventory item)
  - ✅ PATCH /api/v1/inventory/:id (update inventory item)
  - ✅ DELETE /api/v1/inventory/:id (remove from inventory)
  - ✅ POST /api/v1/inventory/:id/use (mark item as used)
  - ✅ GET /api/v1/inventory/matches (get recipe matches)

**Test Categories**:
- Inventory management
- Quantity tracking
- Expiration date handling
- Location filtering
- Recipe matching algorithm
- Usage tracking

### 5. Ingredients API Tests (`ingredients.test.ts`)
- **Tests**: 27
- **Coverage**:
  - ✅ GET /api/v1/ingredients (list ingredients with pagination)
  - ✅ GET /api/v1/ingredients/search (search ingredients)
  - ✅ GET /api/v1/ingredients/categories (get categories)
  - ✅ GET /api/v1/ingredients/:slug (get ingredient by slug)
  - ✅ GET /api/v1/ingredients/:slug/recipes (recipes using ingredient)

**Test Categories**:
- Search functionality
- Category filtering
- Sorting and pagination
- Recipe relationships
- Special character handling

### 6. Favorites/Social API Tests (`favorites.test.ts`)
- **Tests**: 28
- **Coverage**:
  - ✅ GET /api/v1/favorites (list user's favorites)
  - ✅ GET /api/v1/favorites/:recipeId (check if favorited)
  - ✅ POST /api/v1/favorites/:recipeId (add favorite)
  - ✅ DELETE /api/v1/favorites/:recipeId (remove favorite)
  - ✅ POST /api/v1/recipes/:id/like (like recipe)
  - ✅ DELETE /api/v1/recipes/:id/like (unlike recipe)

**Test Categories**:
- Favorites management
- Like/unlike functionality
- Like count tracking
- Duplicate handling
- Social interactions

### 7. Meals API Tests (`meals.test.ts`)
- **Tests**: 17 (pre-existing)
- **Coverage**:
  - ✅ GET /api/v1/meals (list meals)
  - ✅ POST /api/v1/meals (create meal)
  - ✅ GET /api/v1/meals/:id (get meal details)
  - ✅ PATCH /api/v1/meals/:id (update meal)
  - ✅ DELETE /api/v1/meals/:id (delete meal)

### 8. Recipes API Tests (`recipes.test.ts`)
- **Tests**: 17 (pre-existing)
- **Coverage**:
  - ✅ GET /api/v1/recipes (list recipes)
  - ✅ POST /api/v1/recipes (create recipe)
  - ✅ GET /api/v1/recipes/:id (get recipe details)
  - ✅ PATCH /api/v1/recipes/:id (update recipe)
  - ✅ DELETE /api/v1/recipes/:id (delete recipe)

## Running Tests

### Prerequisites

1. **Database Connection**: Set `DATABASE_URL` environment variable
   ```bash
   export DATABASE_URL="postgresql://user:password@localhost:5432/dbname"  # pragma: allowlist secret
   ```

2. **Environment Setup**: Tests will create temporary API keys and test data

### Commands

```bash
# Run all integration tests
npm run test:integration

# Run with CI mode (prevents watch mode)
CI=true npm run test:integration

# Run with coverage
npm run test:integration -- --coverage

# Run specific test file
npm run test:integration -- test/tests/integration/api/chefs.test.ts

# Run in watch mode (development)
npm run test:integration -- --watch
```

## Test Architecture

### Setup & Teardown
- **Global Setup**: Cleans test data, initializes test environment
- **Test API Keys**: Temporary keys with specific scopes for each test suite
- **Cleanup**: Automatic cleanup after tests complete

### Authentication Strategy
Tests use three types of API key contexts:
1. **Read Context**: Read-only scopes (e.g., `read:chefs`)
2. **Write Context**: Read + Write scopes (e.g., `read:chefs`, `write:chefs`)
3. **Admin Context**: Full scopes including delete (e.g., `delete:chefs`)

### Test Patterns

Each endpoint test suite covers:

1. **Success Cases** (200/201)
   - Valid requests with proper authentication
   - Expected response structure
   - Data validation

2. **Authentication Tests** (401)
   - Missing API key
   - Invalid API key
   - Expired API key

3. **Authorization Tests** (403)
   - Missing required scopes
   - Insufficient permissions

4. **Validation Tests** (400)
   - Missing required fields
   - Invalid field formats
   - Type validation
   - Range validation

5. **Not Found Tests** (404)
   - Non-existent resources
   - Invalid IDs/slugs

6. **Edge Cases**
   - Duplicate operations
   - Empty results
   - Special characters
   - Boundary values

## Test Data Management

### Isolation
- Each test suite creates isolated test data
- Tests use unique identifiers (timestamp-based)
- No shared state between test suites

### Cleanup
- Automatic cleanup in `afterAll()` hooks
- Global cleanup removes all test users and API keys
- Database transactions prevent data pollution

## Coverage Goals

✅ **Endpoint Coverage**: 100% (all v1 endpoints)
✅ **HTTP Methods**: GET, POST, PATCH, DELETE
✅ **Status Codes**: 200, 201, 400, 401, 403, 404, 500
✅ **Authentication**: API key validation
✅ **Authorization**: Scope-based permissions
✅ **Validation**: Zod schema validation
✅ **Pagination**: Page, limit, total, hasMore
✅ **Sorting**: sortBy, order
✅ **Filtering**: Category, status, search
✅ **Relationships**: Nested resources

## Test Statistics

| Suite | Tests | Lines | Endpoints |
|-------|-------|-------|-----------|
| auth.test.ts | 17 | 420 | 5 |
| chefs.test.ts | 24 | 410 | 6 |
| collections.test.ts | 26 | 525 | 7 |
| inventory.test.ts | 30 | 580 | 7 |
| ingredients.test.ts | 27 | 490 | 5 |
| favorites.test.ts | 28 | 520 | 6 |
| meals.test.ts | 17 | 390 | 5 |
| recipes.test.ts | 17 | 343 | 5 |
| **TOTAL** | **186** | **3,678** | **46** |

## Next Steps

### To Enable Tests

1. **Set Environment Variables**:
   ```bash
   cp .env.local.example .env.test.local
   # Edit DATABASE_URL in .env.test.local
   ```

2. **Run Tests**:
   ```bash
   CI=true npm run test:integration
   ```

3. **View Results**:
   - Tests will run sequentially to avoid database conflicts
   - Each suite creates and cleans up its own test data
   - Failed tests show detailed error messages and context

### Continuous Integration

Add to CI/CD pipeline:
```yaml
- name: Run Integration Tests
  run: CI=true npm run test:integration
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

## Troubleshooting

### Common Issues

1. **DATABASE_URL not set**
   - Solution: Export DATABASE_URL or add to .env.test.local

2. **API key generation fails**
   - Solution: Verify database connection and api_keys table exists

3. **Tests timeout**
   - Solution: Increase timeout in vitest.integration.config.ts
   - Default: 30 seconds per test

4. **Port conflicts**
   - Solution: Tests use localhost:3000, ensure dev server is NOT running

5. **Database connection errors**
   - Solution: Verify PostgreSQL is running and DATABASE_URL is correct

## Best Practices

### When Adding New Tests

1. **Follow existing patterns** in test files
2. **Use descriptive test names** (should format)
3. **Test all status codes** (success, error, edge cases)
4. **Clean up test data** in afterAll()
5. **Use proper scopes** for authentication
6. **Assert response structure** completely
7. **Test pagination** when applicable
8. **Test validation** thoroughly

### Code Quality

- ✅ TypeScript strict mode
- ✅ Consistent formatting (Biome)
- ✅ Descriptive variable names
- ✅ Clear error messages
- ✅ DRY principle (use setup helpers)
- ✅ Test isolation (no dependencies)

## Related Documentation

- [API Authentication Guide](/src/lib/api-auth/README.md)
- [API Route Handlers](/src/app/api/v1/README.md)
- [Validation Schemas](/src/lib/validations/README.md)
- [Service Layer](/src/lib/services/README.md)

---

**Generated**: 2026-02-16
**Last Updated**: 2026-02-16
**Status**: ✅ Complete - Ready for execution
