# Code Quality Guide

This guide covers linting, formatting, and testing for the Recipe Manager project.

## Table of Contents

- [Linting & Formatting](#linting--formatting)
  - [Biome Setup](#biome-setup)
  - [Running Biome](#running-biome)
  - [Editor Integration](#editor-integration)
- [Testing](#testing)
  - [Vitest Setup](#vitest-setup)
  - [Running Tests](#running-tests)
  - [Writing Tests](#writing-tests)
  - [Test Coverage](#test-coverage)
- [CI/CD Integration](#cicd-integration)
- [Pre-commit Hooks](#pre-commit-hooks)

---

## Linting & Formatting

### Biome Setup

This project uses [Biome](https://biomejs.dev/) for both linting and formatting. Biome is a modern, fast alternative to ESLint and Prettier that's built for performance.

**Configuration**: `biome.json`

Key features:
- Fast linting and formatting (written in Rust)
- Single tool for both concerns
- Automatic import organization
- TypeScript-first design
- Git-aware (respects .gitignore)

### Running Biome

#### Check Code Quality
```bash
# Check for linting and formatting issues
pnpm lint

# Check formatting only
pnpm format:check
```

#### Fix Issues
```bash
# Auto-fix linting and formatting issues
pnpm lint:fix

# Format all files
pnpm format
```

#### Output Example
```bash
$ pnpm lint

Checked 245 files in 123ms
Found 12 issues:
  - 8 fixable
  - 4 require manual fixes
```

### Editor Integration

#### VS Code
1. Install the [Biome extension](https://marketplace.visualstudio.com/items?itemName=biomejs.biome)
2. Add to `.vscode/settings.json`:
```json
{
  "editor.defaultFormatter": "biomejs.biome",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "quickfix.biome": "explicit",
    "source.organizeImports.biome": "explicit"
  }
}
```

#### Other Editors
- **JetBrains IDEs**: Built-in support in recent versions
- **Neovim**: Use LSP integration
- **Sublime Text**: Use LSP package

### Biome Configuration

The project uses these formatting rules:
- **Indentation**: 2 spaces
- **Line width**: 100 characters
- **Quote style**: Single quotes
- **JSX quotes**: Double quotes
- **Semicolons**: Always
- **Trailing commas**: ES5 style
- **Arrow parentheses**: Always

Linting rules:
- TypeScript strict mode
- No unused variables (error)
- No explicit any (warning)
- No debugger statements
- Recommended rule set enabled

---

## Testing

### Vitest Setup

This project uses [Vitest](https://vitest.dev/) for testing. Vitest is a fast, modern test framework built on Vite.

**Configuration**: `vitest.config.ts`

Key features:
- Fast test execution
- Native TypeScript support
- Compatible with Jest API
- Built-in code coverage
- Watch mode with UI
- Component testing with Testing Library

### Running Tests

#### Development
```bash
# Run tests in watch mode
pnpm test

# Run tests in watch mode (explicit)
pnpm test:watch

# Run tests once and exit
pnpm test:run
```

#### UI Mode
```bash
# Open Vitest UI in browser
pnpm test:ui
```

This opens an interactive UI at `http://localhost:51204` where you can:
- View test results in real-time
- Filter and search tests
- See coverage reports
- Debug failing tests

#### Coverage
```bash
# Generate coverage report
pnpm test:coverage
```

Coverage reports are generated in:
- **Terminal**: Summary output
- **HTML**: `coverage/index.html` (open in browser)
- **JSON**: `coverage/coverage-final.json`

### Writing Tests

#### Directory Structure
```
src/
├── components/
│   ├── recipe/
│   │   ├── RecipeCard.tsx
│   │   └── __tests__/
│   │       └── RecipeCard.test.tsx
├── app/
│   ├── actions/
│   │   ├── recipes.ts
│   │   └── __tests__/
│   │       └── recipes.test.ts
```

Tests should be colocated with the code they test in a `__tests__` directory.

#### Component Test Example
```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RecipeCard } from '../RecipeCard';

describe('RecipeCard', () => {
  it('renders recipe name', () => {
    const recipe = {
      id: '1',
      name: 'Chocolate Chip Cookies',
      // ... other required fields
    };

    render(<RecipeCard recipe={recipe} />);
    expect(screen.getByText('Chocolate Chip Cookies')).toBeInTheDocument();
  });
});
```

#### Server Action Test Example
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRecipe } from '../recipes';

vi.mock('@/lib/db', () => ({
  db: {
    insert: vi.fn(),
  },
}));

describe('createRecipe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a recipe with valid data', async () => {
    const recipeData = {
      name: 'Test Recipe',
      ingredients: ['flour', 'sugar'],
      // ... other fields
    };

    const result = await createRecipe(recipeData);
    expect(result.success).toBe(true);
  });
});
```

#### Testing Best Practices

1. **Test Behavior, Not Implementation**
   - Focus on what users see and do
   - Avoid testing internal state
   - Use accessible queries (getByRole, getByLabelText)

2. **Organize Tests with describe/it**
   ```typescript
   describe('RecipeCard', () => {
     describe('rendering', () => {
       it('displays recipe name', () => { /* ... */ });
       it('displays recipe image', () => { /* ... */ });
     });

     describe('interactions', () => {
       it('navigates to recipe page on click', () => { /* ... */ });
     });
   });
   ```

3. **Use Mocks Appropriately**
   - Mock external dependencies (API calls, database)
   - Mock Next.js components (Link, Image)
   - Don't over-mock (test real code when possible)

4. **Keep Tests Fast**
   - Avoid unnecessary delays
   - Mock slow operations
   - Use parallel execution

5. **Write Descriptive Test Names**
   ✅ `it('displays error message when recipe creation fails')`
   ❌ `it('test error')`

### Test Coverage

#### Coverage Goals
- **Statements**: 80%+
- **Branches**: 70%+
- **Functions**: 80%+
- **Lines**: 80%+

#### Viewing Coverage
```bash
# Generate and view coverage report
pnpm test:coverage
open coverage/index.html  # macOS
xdg-open coverage/index.html  # Linux
start coverage/index.html  # Windows
```

#### Coverage Configuration
Coverage is configured in `vitest.config.ts`:
```typescript
coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'html'],
  exclude: [
    'node_modules/',
    '.next/',
    '*.config.*',
    '**/*.d.ts',
    '**/*.test.{ts,tsx}',
    'scripts/',
  ],
}
```

---

## CI/CD Integration

### GitHub Actions Example

Create `.github/workflows/quality.yml`:

```yaml
name: Code Quality

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main, develop]

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
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Run linter
        run: pnpm lint

      - name: Check formatting
        run: pnpm format:check

      - name: Run tests
        run: pnpm test:run

      - name: Generate coverage
        run: pnpm test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

### Vercel Integration

Add to `vercel.json`:

```json
{
  "buildCommand": "pnpm lint && pnpm test:run && pnpm build",
  "devCommand": "pnpm dev",
  "installCommand": "pnpm install"
}
```

### Pre-deployment Checks

Before deploying, run:
```bash
# Full quality check
pnpm lint && pnpm test:run && pnpm build
```

---

## Pre-commit Hooks

### Using Husky

1. **Install Husky**:
```bash
pnpm add -D husky lint-staged
```

2. **Initialize Husky**:
```bash
pnpm exec husky init
```

3. **Configure lint-staged** in `package.json`:
```json
{
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": [
      "biome check --write",
      "vitest related --run"
    ]
  }
}
```

4. **Create pre-commit hook** (`.husky/pre-commit`):
```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

pnpm lint-staged
```

### Manual Pre-commit Workflow

If you prefer not to use hooks:

```bash
# Before committing
pnpm lint:fix
pnpm test:run
git add -A
git commit -m "feat: your commit message"
```

---

## Troubleshooting

### Common Issues

#### Biome Not Running
```bash
# Clear Biome cache
rm -rf .biome
pnpm lint
```

#### Vitest Tests Failing
```bash
# Clear Vitest cache
rm -rf .vitest
pnpm test:run
```

#### Coverage Not Generated
```bash
# Install coverage provider
pnpm add -D @vitest/coverage-v8
pnpm test:coverage
```

#### Module Resolution Errors
```bash
# Verify tsconfig paths
cat tsconfig.json | grep paths

# Check Vitest config alias
cat vitest.config.ts | grep alias
```

---

## IDE Configuration

### VS Code (Recommended)

Create `.vscode/settings.json`:

```json
{
  // Biome
  "editor.defaultFormatter": "biomejs.biome",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "quickfix.biome": "explicit",
    "source.organizeImports.biome": "explicit"
  },

  // Testing
  "vitest.enable": true,
  "vitest.commandLine": "pnpm test",

  // TypeScript
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true
}
```

Create `.vscode/extensions.json`:

```json
{
  "recommendations": [
    "biomejs.biome",
    "vitest.explorer"
  ]
}
```

---

## Quality Checklist

Before submitting a PR:

- [ ] `pnpm lint:fix` passes with no errors
- [ ] `pnpm format` has been run
- [ ] `pnpm test:run` passes all tests
- [ ] New code has accompanying tests
- [ ] Coverage has not decreased
- [ ] No TypeScript errors (`pnpm build`)
- [ ] Manual testing completed
- [ ] Documentation updated if needed

---

## Resources

### Documentation
- **Biome**: https://biomejs.dev/
- **Vitest**: https://vitest.dev/
- **Testing Library**: https://testing-library.com/
- **Vitest UI**: https://vitest.dev/guide/ui.html

### Migration Guides
- **From ESLint**: https://biomejs.dev/guides/migrate-eslint-prettier/
- **From Jest**: https://vitest.dev/guide/migration.html

---

**Last Updated**: 2025-10-16
**Maintained By**: Recipe Manager Team
