# Quality Tooling Setup Guide

This document outlines the code quality tooling strategy for the Recipe Manager project.

---

## Current Status

### ✅ Implemented
- **TypeScript**: Strict mode enabled (`tsconfig.json`)
- **Type Checking**: `pnpm tsc --noEmit` or `make typecheck`
- **Zod Validation**: Input validation on server actions and forms

### 🟡 To Be Implemented
- **ESLint**: Code linting with Next.js recommended rules
- **Prettier**: Code formatting with consistent style
- **Husky**: Git hooks for pre-commit checks
- **Vitest**: Unit testing framework
- **React Testing Library**: Component testing
- **Playwright**: End-to-end testing

---

## Planned Setup

### ESLint Configuration

#### Installation
```bash
pnpm add -D eslint eslint-config-next @typescript-eslint/eslint-plugin @typescript-eslint/parser
```

#### Configuration (.eslintrc.json)
```json
{
  "extends": [
    "next/core-web-vitals",
    "plugin:@typescript-eslint/recommended"
  ],
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "project": "./tsconfig.json"
  },
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/no-explicit-any": "warn",
    "prefer-const": "error",
    "no-console": ["warn", { "allow": ["warn", "error"] }]
  }
}
```

#### Usage
```bash
# Add to package.json scripts
"lint": "next lint",
"lint:fix": "next lint --fix"

# Run via Makefile
make lint
make lint-fix
```

---

### Prettier Configuration

#### Installation
```bash
pnpm add -D prettier eslint-config-prettier
```

#### Configuration (.prettierrc)
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

#### Ignore File (.prettierignore)
```
.next
node_modules
pnpm-lock.yaml
*.md
```

#### Usage
```bash
# Add to package.json scripts
"format": "prettier --write \"src/**/*.{ts,tsx,js,jsx,json,css}\"",
"format:check": "prettier --check \"src/**/*.{ts,tsx,js,jsx,json,css}\""

# Run via Makefile
make format
```

---

### Husky & lint-staged

#### Installation
```bash
pnpm add -D husky lint-staged
pnpm exec husky init
```

#### Configuration (.husky/pre-commit)
```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

pnpm exec lint-staged
```

#### lint-staged Config (package.json)
```json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,css,md}": [
      "prettier --write"
    ]
  }
}
```

---

### Vitest (Unit Testing)

#### Installation
```bash
pnpm add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```

#### Configuration (vitest.config.ts)
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

#### Setup File (vitest.setup.ts)
```typescript
import '@testing-library/jest-dom';
```

#### Usage
```bash
# Add to package.json scripts
"test": "vitest",
"test:ui": "vitest --ui",
"test:coverage": "vitest --coverage"

# Run via Makefile
make test
make test-unit
```

#### Example Test (src/lib/utils.test.ts)
```typescript
import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn utility', () => {
  it('merges class names correctly', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });
});
```

---

### React Testing Library

#### Component Test Example
```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Button } from '@/components/ui/button';

describe('Button Component', () => {
  it('renders button with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });
});
```

---

### Playwright (E2E Testing)

#### Installation
```bash
pnpm add -D @playwright/test
pnpm exec playwright install
```

#### Configuration (playwright.config.ts)
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3004',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3004',
    reuseExistingServer: !process.env.CI,
  },
});
```

#### Usage
```bash
# Add to package.json scripts
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui",
"test:e2e:report": "playwright show-report"

# Run via Makefile
make test-e2e
```

#### Example E2E Test (tests/e2e/auth.spec.ts)
```typescript
import { test, expect } from '@playwright/test';

test('user can sign in', async ({ page }) => {
  await page.goto('/sign-in');
  await expect(page.locator('h1')).toContainText('Sign In');
});
```

---

## Quality Commands (Single-Path)

Once implemented, use these commands:

```bash
# Type checking
make typecheck

# Linting
make lint           # Check for issues
make lint-fix       # Auto-fix issues

# Formatting
make format         # Format all files

# Testing
make test           # Run all tests
make test-unit      # Run unit tests only
make test-integration  # Run integration tests
make test-e2e       # Run E2E tests

# All quality checks
make quality        # Run typecheck, lint, format, test
```

---

## CI/CD Integration

### GitHub Actions (.github/workflows/quality.yml)
```yaml
name: Quality Checks

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Type check
        run: pnpm typecheck

      - name: Lint
        run: pnpm lint

      - name: Format check
        run: pnpm format:check

      - name: Build
        run: pnpm build

      - name: Test
        run: pnpm test
```

---

## Pre-commit Checklist

Before committing code, ensure:

- [ ] Code compiles without TypeScript errors (`make typecheck`)
- [ ] No linting errors (`make lint`)
- [ ] Code is formatted (`make format`)
- [ ] All tests pass (`make test`)
- [ ] No console.log statements (except console.warn/error)
- [ ] Environment variables not hardcoded
- [ ] userId validation in server actions

---

## Best Practices

### TypeScript
- Enable strict mode (already configured)
- Avoid `any` type (use `unknown` if needed)
- Use type inference from Drizzle schemas
- Prefer interfaces over types for objects

### Testing
- Write tests for utility functions
- Test server actions with mocked database
- Test components with React Testing Library
- Use E2E tests for critical user flows

### Code Style
- Follow existing patterns in codebase
- Use path aliases (`@/`) for imports
- Organize imports (external → internal → relative)
- Use meaningful variable names
- Add comments for complex logic

---

## Migration Plan

### Phase 1: Linting & Formatting (Week 1)
1. Install ESLint and Prettier
2. Configure rules
3. Run initial format on codebase
4. Set up pre-commit hooks

### Phase 2: Unit Testing (Week 2-3)
1. Install Vitest and Testing Library
2. Write tests for utilities and helpers
3. Test critical server actions
4. Achieve 60%+ code coverage

### Phase 3: E2E Testing (Week 4)
1. Install Playwright
2. Write E2E tests for authentication
3. Test recipe CRUD operations
4. Test meal planning workflow

### Phase 4: CI/CD (Week 5)
1. Set up GitHub Actions
2. Configure quality checks on PR
3. Automate deployment after merge
4. Set up test coverage reporting

---

## Monitoring Quality

### Metrics to Track
- **Type Coverage**: 100% (strict mode)
- **Lint Errors**: 0
- **Test Coverage**: Target 80%
- **Build Time**: Monitor for regressions
- **Bundle Size**: Monitor with Next.js analyzer

### Tools
- **TypeScript**: Built-in type checking
- **ESLint**: Code quality analysis
- **Vitest**: Test coverage reports
- **Lighthouse**: Performance auditing
- **Next.js Bundle Analyzer**: Bundle size analysis

---

## Resources

- [ESLint Docs](https://eslint.org/docs/latest/)
- [Prettier Docs](https://prettier.io/docs/en/)
- [Vitest Guide](https://vitest.dev/guide/)
- [Playwright Docs](https://playwright.dev/docs/intro)
- [Testing Library](https://testing-library.com/docs/react-testing-library/intro/)

---

**Status**: Quality tooling setup is planned but not yet implemented.
**Priority**: 🟢 Medium - Should be implemented before production release.
**Owner**: Development team
**Last Updated**: 2025-10-14
