# Technical Debt

**Last Updated**: October 27, 2025
**Version**: 0.7.4
**Purpose**: Track known issues, technical limitations, and improvement opportunities for future development work.

---

## Overview

This document tracks technical debt items discovered during development, QA, and releases. Each item includes priority, effort estimate, context, and recommended solution. Items are organized by category for easy reference.

**Priority Levels**:
- **High**: Blocks features or significantly impacts users
- **Medium**: Degrades experience or maintainability
- **Low**: Nice-to-have improvements

**Effort Estimates**:
- **Small**: 1-2 hours
- **Medium**: 1 day
- **Large**: 1+ weeks

---

## 📊 Summary

| Priority | Count | Category |
|----------|-------|----------|
| High | 2 | Testing Infrastructure, Build & Performance |
| Medium | 4 | Code Quality, Testing, Documentation |
| Low | 3 | Code Quality, Performance |

**Total Items**: 9

---

## Testing Infrastructure

### [High] RecipeCard Test Failures - Router Mocking

- **Status**: To Do
- **Effort**: Medium (1 day)
- **Context**: All 13 RecipeCard component tests fail with error `invariant expected app router to be mounted`. This is caused by Next.js App Router context not being available in the test environment. Tests were written using React Testing Library without proper Next.js routing mocks.
- **Impact**:
  - Zero test coverage for RecipeCard component (critical UI component)
  - Cannot verify recipe display functionality
  - Blocks CI/CD test gates
  - May hide regressions in recipe rendering
- **Solution**:
  1. Install `next-router-mock` package for App Router support
  2. Configure Vitest to use Next.js router mock in test setup
  3. Update RecipeCard.test.tsx to wrap component with proper routing context
  4. Example mock setup:
     ```typescript
     import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';

     const mockRouter = {
       push: vi.fn(),
       replace: vi.fn(),
       prefetch: vi.fn(),
       // ... other router methods
     };

     const wrapper = ({ children }) => (
       <AppRouterContext.Provider value={mockRouter}>
         {children}
       </AppRouterContext.Provider>
     );
     ```
  5. Re-run tests and verify all 13 tests pass
- **Related**:
  - File: `src/components/recipe/__tests__/RecipeCard.test.tsx`
  - Test run output: `pnpm test:run` shows 13 failed tests
  - Similar issue may affect other component tests using Next.js routing

---

### [Medium] Playwright Tests Mixed with Vitest

- **Status**: To Do
- **Effort**: Medium (1 day)
- **Context**: Playwright test files (`.spec.ts`) are being picked up by Vitest runner, causing errors like "Playwright Test did not expect test.describe() to be called here". This occurs because:
  - E2E tests in `tmp/meals-e2e-test.spec.ts`
  - UAT tests in `tests/uat/recipe-forms-uat.spec.ts`
  - E2E tests in `tests/e2e/meals/error-handling.spec.ts`

  These files use Playwright's `test.describe()` API but are being imported by Vitest.
- **Impact**:
  - Test suite fails with 15 failed suites
  - Cannot run `pnpm test:run` cleanly
  - Confusing test reports mixing unit and E2E results
  - Slows down developer workflow
- **Solution**:
  1. Update `vitest.config.ts` to exclude Playwright test files:
     ```typescript
     export default defineConfig({
       test: {
         exclude: [
           '**/node_modules/**',
           '**/dist/**',
           '**/*.spec.ts',  // Exclude Playwright specs
           'tests/e2e/**',   // Exclude E2E directory
           'tests/uat/**',   // Exclude UAT directory
         ],
       },
     });
     ```
  2. Separate npm scripts:
     - `pnpm test` → Vitest unit tests only
     - `pnpm test:e2e` → Playwright E2E tests only
     - `pnpm test:all` → Both test suites
  3. Update CI/CD to run both test suites separately
  4. Document testing strategy in `docs/testing/TESTING_STRATEGY.md`
- **Related**:
  - Files: `tmp/meals-e2e-test.spec.ts`, `tests/uat/recipe-forms-uat.spec.ts`, `tests/e2e/meals/*.spec.ts`
  - Config: `vitest.config.ts`, `playwright.config.ts`

---

### [Medium] TypeScript Strict Mode in Test Files

- **Status**: To Do
- **Effort**: Small (2 hours)
- **Context**: Test files use `@ts-expect-error` and `@ts-ignore` directives to bypass TypeScript errors. Found 3 total occurrences across 2 files:
  - `src/lib/mobile-utils.ts`: 2 occurrences
  - `src/hooks/useMobileDetect.ts`: 1 occurrence

  These are likely related to accessing window/navigator objects in SSR environment or mocking browser APIs.
- **Impact**:
  - Reduced type safety in test utilities
  - May hide actual type errors
  - Harder to maintain as TypeScript version updates
- **Solution**:
  1. Audit each `@ts-expect-error` / `@ts-ignore` usage
  2. Add proper type guards for browser APIs:
     ```typescript
     if (typeof window !== 'undefined') {
       // Safe to access window
     }
     ```
  3. Create type-safe test helpers for mobile detection
  4. Remove all `@ts-ignore` directives
  5. Document patterns in testing guide
- **Related**:
  - Files: `src/lib/mobile-utils.ts`, `src/hooks/useMobileDetect.ts`
  - Reference: TypeScript strict mode enabled in `tsconfig.json`

---

## Code Quality

### [Medium] Biome Linting Issues

- **Status**: Partially Fixed
- **Effort**: Small (1-2 hours)
- **Context**: Biome linter reports 3 style violations in utility scripts:
  1. `scripts/apply-qa-migration.ts:84` - String concatenation instead of template literal
  2. `scripts/comprehensive-image-audit.ts:105` - String concatenation instead of template literal
  3. `docs/archive/pre-pivot-2025-10/implementations/meal-pairing-helpers.ts:311` - Use of `any` type

  These are minor style inconsistencies but should be fixed for code quality consistency.
- **Impact**:
  - Inconsistent code style across project
  - `pnpm lint` reports failures (breaks CI if enforced)
  - Slightly harder to maintain
- **Solution**:
  1. Run `pnpm lint:fix` to auto-fix template literal issues
  2. Manually fix the `any` type in archived file (or exclude archive from linting)
  3. Consider adding lint-staged pre-commit hook to prevent new violations
  4. Update `.biomeignore` to exclude `docs/archive/**` from linting
- **Related**:
  - Files: `scripts/apply-qa-migration.ts`, `scripts/comprehensive-image-audit.ts`
  - Config: `biome.json`
  - Command: `pnpm lint:fix`

---

### [Low] Console.log Statements in Scripts

- **Status**: Acceptable (CLI tools)
- **Effort**: N/A
- **Context**: Found 3,994 console.log/error/warn occurrences across 168 script files in `scripts/` directory. However, these are CLI utility scripts intended for developer/admin use, not production code.
- **Impact**:
  - No impact on production bundle (scripts not included)
  - Useful for debugging and monitoring script execution
  - Standard practice for CLI tools
- **Solution**:
  - **No action needed** - console logging is appropriate for CLI scripts
  - Ensure `src/` directory code doesn't use console.log (use proper logging library)
  - Consider adding eslint rule to warn on console.log in `src/` only:
    ```json
    {
      "overrides": [
        {
          "files": ["src/**/*.ts", "src/**/*.tsx"],
          "rules": {
            "no-console": "warn"
          }
        }
      ]
    }
    ```
- **Related**:
  - Directory: `scripts/` (168 files)
  - Reference: Quality standards in `docs/reference/quality.md` (line 307)

---

### [Low] Type Safety Improvements - Drizzle ORM Patterns

- **Status**: To Do
- **Effort**: Medium (1 day)
- **Context**: Recent bugfixes revealed developers using raw SQL `ANY()` syntax instead of Drizzle's type-safe `inArray()` helper. This pattern was discovered in QA scripts during Phase 3 execution (see `docs/qa/QA_BUGFIX_SUMMARY.md`).
- **Impact**:
  - Potential SQL injection risks with raw SQL
  - Loss of TypeScript type safety
  - Harder to maintain and refactor
  - May break on Drizzle version updates
- **Solution**:
  1. Audit all database query files for raw SQL usage:
     ```bash
     grep -r "sql\`.*ANY" src/
     grep -r "sql\`.*ALL" src/
     ```
  2. Replace with Drizzle helpers: `inArray()`, `notInArray()`, `arrayContains()`
  3. Add documentation to developer guide with patterns:
     - ✅ Use: `inArray(recipes.id, recipeIds)`
     - ❌ Avoid: `sql\`${recipes.id} = ANY(${recipeIds})\``
  4. Add ESLint rule to discourage raw SQL (with exceptions for complex queries)
  5. Create code review checklist item for database queries
- **Related**:
  - Reference: `docs/qa/QA_BUGFIX_SUMMARY.md` (lines 12-74)
  - Files: All files using Drizzle queries
  - Documentation: Drizzle best practices section needed

---

## Build & Performance

### [High] Build Optimization Opportunities

- **Status**: To Do
- **Effort**: Large (1+ weeks)
- **Context**: Production build completes successfully but shows several large route bundles. Some routes exceed 200KB first load JS target (see README.md line 71). Largest routes:
  - `/meals/builder` - 182KB
  - `/recipes/new` - 182KB
  - `/search` - 191KB
  - `/search/semantic` - 176KB
  - `/admin/recipes` - 177KB

  These exceed the project's 200KB bundle size target for initial JavaScript.
- **Impact**:
  - Slower initial page loads on mobile
  - Reduced Lighthouse scores
  - Poor experience on slow connections
  - May impact SEO rankings
- **Solution**:
  1. **Analyze bundle composition**:
     ```bash
     ANALYZE=true pnpm build
     ```
  2. **Implement code splitting**:
     - Lazy load heavy components (forms, editors)
     - Split vendor chunks more aggressively
     - Use dynamic imports for modals/dialogs
  3. **Optimize dependencies**:
     - Check for duplicate dependencies in bundle
     - Replace heavy libraries (moment.js → date-fns, lodash → specific imports)
     - Use barrel exports carefully (shadcn/ui components)
  4. **Route-specific optimizations**:
     - `/meals/builder` - Lazy load meal builder components
     - `/recipes/new` - Split form components
     - `/search/*` - Defer loading filter components
  5. **Measure impact**:
     - Run Lighthouse before/after
     - Test on 3G network throttling
     - Monitor Core Web Vitals
- **Related**:
  - Config: `next.config.ts`
  - Reference: Performance benchmarks in `docs/performance/` (to be created)
  - Target: <200KB initial JS (README.md line 71)

---

### [Low] Bundle Size Analysis

- **Status**: To Do
- **Effort**: Small (2 hours)
- **Context**: Project lacks regular bundle size analysis and monitoring. No baseline metrics exist for tracking bundle size growth over time.
- **Impact**:
  - Cannot detect bundle size regressions
  - No visibility into what's making bundles large
  - Harder to optimize without data
- **Solution**:
  1. Add bundle analyzer to package.json:
     ```json
     {
       "scripts": {
         "analyze": "ANALYZE=true pnpm build"
       }
     }
     ```
  2. Install `@next/bundle-analyzer`:
     ```bash
     pnpm add -D @next/bundle-analyzer
     ```
  3. Configure in `next.config.ts`:
     ```typescript
     const withBundleAnalyzer = require('@next/bundle-analyzer')({
       enabled: process.env.ANALYZE === 'true',
     });
     module.exports = withBundleAnalyzer(nextConfig);
     ```
  4. Run analysis and document findings
  5. Add bundle size budget to CI/CD
  6. Create baseline metrics document
- **Related**:
  - Config: `next.config.ts`
  - Documentation: Create `docs/performance/BUNDLE_ANALYSIS.md`

---

### [Low] Image Optimization Improvements

- **Status**: To Do
- **Effort**: Medium (1 day)
- **Context**: Project recently migrated 3,185 images to Vercel Blob Storage (see CHANGELOG.md). However, no image optimization strategy exists for:
  - Responsive image sizes
  - WebP/AVIF format conversion
  - Lazy loading strategy
  - Blur placeholder generation
- **Impact**:
  - Slower page loads with many recipe images
  - Higher bandwidth costs
  - Poor mobile experience
- **Solution**:
  1. Implement Next.js Image component everywhere
  2. Configure image domains and loaders in `next.config.ts`
  3. Generate responsive image sizes (thumbnail, small, medium, large)
  4. Add blur placeholders for better perceived performance
  5. Implement lazy loading for images below fold
  6. Consider using Sharp for build-time optimization
  7. Add image loading performance metrics to monitoring
- **Related**:
  - Config: `next.config.ts`
  - Component: Next.js Image component usage audit
  - Migration: See commit "chore: Migrate 3,185 images to Vercel Blob Storage"

---

## Documentation

### [Medium] API Documentation Gaps

- **Status**: To Do
- **Effort**: Large (1+ weeks)
- **Context**: Developer documentation exists (see `docs/developer/README.md`) but lacks comprehensive API reference. Current gaps:
  - Server Actions documentation incomplete
  - API route request/response schemas not documented
  - No examples for common API usage patterns
  - Missing error response documentation
- **Impact**:
  - Harder for new developers to onboard
  - Increased support questions
  - Risk of API misuse
  - Difficult to maintain consistency
- **Solution**:
  1. Create API documentation template
  2. Document all Server Actions in `src/app/actions/`:
     - Parameters (with Zod schemas)
     - Return types
     - Error responses
     - Usage examples
  3. Document API routes in `src/app/api/`:
     - Endpoint URLs
     - HTTP methods
     - Request/response schemas
     - Authentication requirements
  4. Add OpenAPI/Swagger spec generation (optional)
  5. Create interactive API playground
- **Related**:
  - Directory: `docs/api/` (partially complete)
  - Reference: `docs/developer/README.md` (lines 281-297)
  - Files: `src/app/actions/*.ts`, `src/app/api/**/*.ts`

---

### [Medium] Testing Strategy Documentation

- **Status**: To Do
- **Effort**: Small (2 hours)
- **Context**: Project has tests (Vitest for unit, Playwright for E2E) but lacks unified testing strategy documentation. Existing docs:
  - `docs/testing/E2E_TEST_SETUP.md` - E2E setup only
  - `docs/testing/MEALS_TEST_SUMMARY.md` - Feature-specific
  - No guide explaining when to use unit vs integration vs E2E tests
  - No testing conventions or patterns documented
- **Impact**:
  - Inconsistent test quality
  - Developers unsure what/how to test
  - Duplicate test coverage or gaps
  - Hard to maintain test suite
- **Solution**:
  1. Create `docs/testing/TESTING_STRATEGY.md` covering:
     - When to write unit vs integration vs E2E tests
     - Test coverage requirements (80% for new code)
     - Naming conventions
     - Test organization patterns
     - Mocking strategies
     - CI/CD test pipeline
  2. Document common testing patterns:
     - Testing Server Actions
     - Testing API routes
     - Testing React components
     - Testing database queries
  3. Add test examples to developer docs
  4. Create test templates for common scenarios
- **Related**:
  - Directory: `docs/testing/`
  - Reference: `docs/developer/README.md` (lines 300-315)
  - Config: `vitest.config.ts`, `playwright.config.ts`

---

## Contributing Guidelines

### [Low] Contributing Guide Missing

- **Status**: To Do (mentioned in README)
- **Effort**: Medium (1 day)
- **Context**: README.md references `docs/CONTRIBUTING.md` (line 247) but file doesn't exist. This makes it unclear how external contributors should:
  - Set up development environment
  - Understand code review process
  - Follow project conventions
  - Submit pull requests
- **Impact**:
  - Harder to accept external contributions
  - Inconsistent contribution quality
  - More maintainer time reviewing PRs
- **Solution**:
  1. Create `docs/CONTRIBUTING.md` with sections:
     - Getting started (fork, clone, setup)
     - Development workflow
     - Code style guidelines (reference Biome config)
     - Testing requirements
     - Commit message conventions
     - Pull request process
     - Code review expectations
  2. Link from README.md
  3. Add GitHub PR template
  4. Add GitHub issue templates
- **Related**:
  - Reference: README.md line 247
  - Template: Use standard CONTRIBUTING.md format

---

## Security Guide

### [Low] Security Documentation Incomplete

- **Status**: To Do (mentioned in README)
- **Effort**: Large (1+ weeks)
- **Context**: README.md mentions security best practices (lines 233-241) and references `docs/reference/security.md` (line 241) but file marked as "coming soon". Security considerations are scattered across multiple docs.
- **Impact**:
  - Risk of security vulnerabilities
  - Inconsistent security practices
  - Harder to pass security audits
  - No central security reference
- **Solution**:
  1. Create `docs/reference/security.md` covering:
     - Authentication & authorization patterns
     - Input validation (Zod schemas)
     - SQL injection prevention (Drizzle ORM)
     - XSS prevention
     - CSRF protection
     - API key management
     - Rate limiting strategy
     - Security headers configuration
     - Dependency vulnerability scanning
     - Security audit checklist
  2. Document security review process
  3. Add security testing to CI/CD
  4. Create incident response plan
  5. Add security considerations to PR template
- **Related**:
  - Reference: README.md lines 233-241
  - Code: `src/lib/security/` utilities
  - API: `/api/security-audit/` endpoint

---

## Maintenance Notes

### How to Use This Document

1. **Prioritize**: High priority items should be addressed before new features
2. **Estimate**: Use effort estimates for sprint planning
3. **Track**: Update status as items are worked on
4. **Archive**: Move completed items to `TECHNICAL_DEBT_RESOLVED.md`
5. **Review**: Revisit quarterly to reprioritize and add new items

### Adding New Items

When adding technical debt:

1. Use the template format above
2. Provide specific context and impact
3. Link to related files/commits/issues
4. Suggest concrete solutions
5. Update the summary table

### Integration with Development

- Reference technical debt items in commit messages: `fix: resolve technical debt item - RecipeCard tests`
- Link PRs to this document when addressing items
- Discuss in sprint planning and retrospectives
- Consider impact when estimating new features

---

**Maintained by**: Joanie's Kitchen Development Team
**Next Review**: January 2026
**Related**: `CHANGELOG.md`, `ROADMAP.md`, `docs/reference/quality.md`
