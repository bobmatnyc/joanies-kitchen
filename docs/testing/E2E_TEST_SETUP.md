# E2E Testing Setup Guide

## Overview

This guide explains how to set up end-to-end (E2E) testing with Playwright for the Recipe Manager application. E2E tests require **real Clerk authentication accounts** to test the full user experience.

---

## Quick Start

### Prerequisites
- Clerk account access (development or production instance)
- Access to `.env.local` file (gitignored)
- pnpm installed

### 1. Create Test Users in Clerk

**Via Clerk Dashboard:**

1. Log in to [Clerk Dashboard](https://dashboard.clerk.com)
2. Select your application (Recipe Manager)
3. Navigate to **Users** → **Create User**
4. Create test users with these details:

   **Primary Test User:**
   - Email: `test-user-1@recipe-manager.test`
   - Password: Choose a secure password (min 8 chars, letters + numbers + symbols)
   - First Name: `Test`
   - Last Name: `User One`

   **Optional Additional Users:**
   - `test-user-2@recipe-manager.test` (for parallel testing)
   - `test-admin@recipe-manager.test` (for admin feature testing)

5. **Important**: Verify the email addresses in Clerk (or disable email verification for test users)

### 2. Add Credentials to `.env.local`

Open `.env.local` and add the test credentials:

```env
# E2E Testing Credentials
TEST_USER_EMAIL=test-user-1@recipe-manager.test
TEST_USER_PASSWORD=YourSecurePassword123!

# Optional additional users
TEST_USER_2_EMAIL=test-user-2@recipe-manager.test
TEST_USER_2_PASSWORD=YourSecurePassword123!

TEST_ADMIN_EMAIL=test-admin@recipe-manager.test
TEST_ADMIN_PASSWORD=YourSecurePassword123!
```

**Security Note**: `.env.local` is gitignored and never committed to version control.

### 3. Create User Profiles in Database

After creating Clerk accounts, create corresponding user profiles:

```bash
# Run the test user profile setup script
pnpm tsx scripts/testing/setup-test-user-profiles.ts
```

This script will:
- Connect to your database
- Create `user_profiles` records for test users
- Link them to their Clerk user IDs
- Set up initial test data (favorites, collections, etc.)

### 4. Verify Setup

```bash
# Verify test users exist and can authenticate
pnpm test:verify-auth

# Run a single E2E test to confirm setup
pnpm test:e2e --headed tests/e2e/auth/sign-in.spec.ts
```

### 5. Run E2E Tests

```bash
# Run all E2E tests
pnpm test:e2e

# Run tests with UI
pnpm test:e2e:ui

# Run tests in headed mode (see browser)
pnpm test:e2e:headed

# Run specific test file
pnpm test:e2e tests/e2e/recipes/recipe-creation.spec.ts

# Run meals-specific tests
pnpm test:e2e:meals
```

---

## Architecture

### Why Separate Test Users?

The Recipe Manager has **two different user systems** that serve different purposes:

1. **Synthetic Users** (`scripts/seed-users/`)
   - **Purpose**: Populate database with realistic user data for development
   - **Scope**: 2000 user profiles with activity (favorites, ratings, etc.)
   - **Authentication**: None - database records only (no Clerk accounts)
   - **Use Case**: Data seeding, UI development, performance testing

2. **E2E Test Users** (this guide)
   - **Purpose**: Test actual authentication flows and user features
   - **Scope**: 1-5 dedicated test accounts
   - **Authentication**: Full Clerk accounts with email/password
   - **Use Case**: Automated E2E testing, manual QA testing

**Key Difference**: Synthetic users cannot log in (no Clerk accounts), while E2E test users are real accounts that can authenticate.

### Authentication Flow

```
E2E Test Run
    ↓
1. auth.setup.ts runs (Playwright global setup)
    ↓
2. Reads TEST_USER_EMAIL and TEST_USER_PASSWORD from .env.local
    ↓
3. Navigates to /sign-in
    ↓
4. Fills in email/password via Clerk sign-in form
    ↓
5. Saves authenticated session to tests/e2e/.auth/user.json
    ↓
6. All subsequent tests reuse this session (performance optimization)
    ↓
7. Tests run with authenticated context
```

### Files Structure

```
recipe-manager/
├── .env.local                          # Test credentials (gitignored)
├── tests/
│   └── e2e/
│       ├── setup/
│       │   └── auth.setup.ts          # Authentication setup
│       ├── .auth/
│       │   └── user.json              # Saved auth state (gitignored)
│       ├── fixtures/
│       │   └── test-helpers.ts        # Test utilities
│       └── [test files]
├── scripts/
│   └── testing/
│       ├── setup-test-user-profiles.ts    # Create user_profiles
│       └── verify-test-auth.ts            # Verify auth setup
└── docs/
    └── testing/
        └── E2E_TEST_SETUP.md          # This file
```

---

## Detailed Setup Instructions

### Creating Test Users via Clerk Backend API (Advanced)

For automated test user creation or CI/CD pipelines:

```bash
# Create test user creation script
pnpm tsx scripts/testing/create-clerk-test-users.ts
```

**Script example:**
```typescript
import { Clerk } from '@clerk/backend';

async function createTestUsers() {
  const clerk = Clerk({ secretKey: process.env.CLERK_SECRET_KEY });

  const testUsers = [
    {
      emailAddress: 'test-user-1@recipe-manager.test',
      password: process.env.TEST_USER_PASSWORD!,
      firstName: 'Test',
      lastName: 'User One',
    },
  ];

  for (const user of testUsers) {
    try {
      const createdUser = await clerk.users.createUser(user);
      console.log(`✓ Created test user: ${user.emailAddress}`);
      console.log(`  Clerk User ID: ${createdUser.id}`);
    } catch (error) {
      console.error(`✗ Failed to create ${user.emailAddress}:`, error);
    }
  }
}

createTestUsers();
```

**Pros**: Fully automated, can delete/recreate users
**Cons**: Requires Clerk Backend SDK, may hit rate limits

### Test User Profile Setup

The `setup-test-user-profiles.ts` script creates database records for test users:

```typescript
// Pseudo-code for what the script does:
for each TEST_USER_EMAIL in .env.local:
  1. Get Clerk user ID from Clerk API
  2. Check if user_profile already exists
  3. If not, create user_profile with:
     - user_id: Clerk user ID
     - username: auto-generated (e.g., "testuser1")
     - display_name: from Clerk user
     - is_public: true
  4. Optionally seed with test data:
     - Create 2-3 collections
     - Add 5-10 favorites
     - Create 1-2 meal plans
```

---

## Testing Best Practices

### 1. Test User Naming Convention

- **Primary user**: `test-user-1@recipe-manager.test`
- **Secondary user**: `test-user-2@recipe-manager.test`
- **Admin user**: `test-admin@recipe-manager.test`
- **Domain**: Always use `@recipe-manager.test` (not a real domain)

### 2. Password Management

- **Strength**: Minimum 8 characters, mix of letters, numbers, symbols
- **Storage**: Only in `.env.local` (gitignored)
- **Sharing**: Use team password manager for shared test credentials
- **Rotation**: Rotate passwords quarterly or when team members leave

### 3. Test Data Management

**Isolation**: Each test should:
- Create its own test data (recipes, meal plans, etc.)
- Clean up after itself (or use database transactions)
- Not depend on data from other tests

**Reset**: Periodically reset test user data:
```bash
pnpm test:reset-test-data
```

### 4. CI/CD Integration

**GitHub Actions**:
```yaml
# .github/workflows/e2e-tests.yml
env:
  TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
  TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}
```

**Store credentials in**: Repository Settings → Secrets → Actions

---

## Troubleshooting

### Issue: "TEST_USER_EMAIL and TEST_USER_PASSWORD environment variables must be set"

**Cause**: Missing credentials in `.env.local`

**Solution**:
1. Check `.env.local` file exists
2. Verify credentials are uncommented
3. Restart development server: `pnpm dev`
4. Run tests again

### Issue: "Authentication failed" in tests

**Cause**: Invalid credentials or user doesn't exist in Clerk

**Solution**:
1. Verify user exists in Clerk Dashboard
2. Test login manually at http://localhost:3002/sign-in
3. Check if email is verified in Clerk
4. Verify password matches `.env.local`

### Issue: "User profile not found" errors

**Cause**: Clerk account exists but no `user_profiles` database record

**Solution**:
```bash
# Create user profile for test user
pnpm tsx scripts/testing/setup-test-user-profiles.ts
```

### Issue: Tests fail intermittently

**Cause**: Auth state file corrupted or expired

**Solution**:
```bash
# Delete cached auth state
rm -rf tests/e2e/.auth/

# Re-run tests (will re-authenticate)
pnpm test:e2e
```

### Issue: "Cannot read properties of undefined (reading 'id')"

**Cause**: Test user not properly authenticated

**Solution**:
1. Check `tests/e2e/.auth/user.json` exists
2. Verify auth.setup.ts runs before tests
3. Check Playwright config has `setup` project configured

---

## Security Considerations

### What's Protected

✅ **Gitignored files**:
- `.env.local` (contains credentials)
- `tests/e2e/.auth/` (auth state files)
- `pnpm-lock.yaml` secrets

✅ **Access control**:
- Test users have same permissions as regular users
- No elevated privileges unless specifically needed

### What to Avoid

❌ **Never**:
- Commit `.env.local` to version control
- Use production user credentials for testing
- Share test credentials publicly
- Store credentials in test files directly
- Use the same password for all test users

❌ **Don't**:
- Create test users with production-level access
- Use test users in production environment
- Share test user accounts across multiple developers (create separate users)

### Recommended Practices

✅ **Do**:
- Rotate test passwords quarterly
- Use unique passwords per test user
- Document which test users exist and their purposes
- Clean up test data regularly
- Use environment-specific test users (dev vs. staging vs. CI)

---

## CI/CD Configuration

### GitHub Actions

**Setup**:
1. Add secrets to repository:
   - Settings → Secrets and variables → Actions
   - Add `TEST_USER_EMAIL`
   - Add `TEST_USER_PASSWORD`
   - Add `DATABASE_URL` (test database)
   - Add `CLERK_SECRET_KEY` (dev or test instance)

2. Configure workflow:
```yaml
name: E2E Tests
on: [push, pull_request]

jobs:
  e2e-tests:
    runs-on: ubuntu-latest

    env:
      TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
      TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}
      DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
      CLERK_SECRET_KEY: ${{ secrets.CLERK_SECRET_KEY }}

    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Setup test user profiles
        run: pnpm tsx scripts/testing/setup-test-user-profiles.ts

      - name: Run E2E tests
        run: pnpm test:e2e

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
```

---

## Maintenance

### Regular Tasks

**Weekly**:
- Verify test users can still authenticate
- Check test data hasn't accumulated excessively

**Monthly**:
- Review and clean up test data
- Verify all E2E tests still pass
- Update test user profiles if schema changed

**Quarterly**:
- Rotate test user passwords
- Review test user permissions
- Update documentation if process changed

### Cleanup Commands

```bash
# Reset all test user data
pnpm test:reset-test-data

# Delete test user profiles (keep Clerk accounts)
pnpm tsx scripts/testing/cleanup-test-profiles.ts

# Delete test users completely (Clerk + database)
pnpm tsx scripts/testing/delete-test-users.ts
```

---

## Related Documentation

- **Main README**: `/README.md`
- **Authentication Guide**: `/docs/guides/AUTHENTICATION_GUIDE.md`
- **Environment Setup**: `/docs/guides/ENVIRONMENT_SETUP.md`
- **Playwright Config**: `/playwright.config.ts`
- **Test Helpers**: `/tests/e2e/fixtures/test-helpers.ts`

---

## FAQ

### Q: Can I use synthetic users for E2E testing?
**A**: No. Synthetic users (from `scripts/seed-users/`) are database records only with no Clerk authentication. E2E tests require real Clerk accounts that can log in.

### Q: How many test users do I need?
**A**: Start with 1-2 users. Add more only if you need:
- Parallel test execution (multiple users running tests simultaneously)
- Role-specific testing (admin vs. regular user)
- Social feature testing (follows, sharing between users)

### Q: Should test users be in dev or production Clerk instance?
**A**: Use **development instance** for local testing and CI/CD. Only use production instance test users if you have a dedicated staging environment.

### Q: What if I forget the test user password?
**A**: Reset it in Clerk Dashboard:
1. Go to Users → find test user
2. Click "..." → "Reset password"
3. Update `.env.local` with new password
4. Update team password manager
5. Update CI/CD secrets if applicable

### Q: Can I automate test user creation?
**A**: Yes, using Clerk Backend API (see "Advanced" section above). However, manual creation via Clerk Dashboard is simpler for 1-5 users.

---

**Last Updated**: 2025-10-18
**Version**: 1.0.0
**Maintained By**: Recipe Manager Team
