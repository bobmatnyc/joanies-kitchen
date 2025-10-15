# Recipe Manager - Project Organization Standard

**Version**: 1.0.0
**Last Updated**: 2025-10-14
**Maintained By**: Project Organizer Agent

---

## Table of Contents

1. [Overview](#overview)
2. [Directory Structure](#directory-structure)
3. [File Placement Rules](#file-placement-rules)
4. [Naming Conventions](#naming-conventions)
5. [Framework-Specific Rules](#framework-specific-rules)
6. [Migration Procedures](#migration-procedures)

---

## Overview

This document defines the organizational standard for the Recipe Manager project. It ensures consistent file placement, naming conventions, and structure across the codebase.

### Organization Philosophy

- **Feature-Based Organization**: Group related files by feature within Next.js conventions
- **Framework Compliance**: Respect Next.js App Router structure and requirements
- **Clear Separation**: Separate source code, documentation, tests, scripts, and temporary files
- **Single Source of Truth**: Each file type has ONE designated location

---

## Directory Structure

```
recipe-manager/
├── .claude/                    # Claude MPM configuration
│   ├── agents/                # Agent definitions
│   ├── commands/              # Custom slash commands
│   └── mcp-servers.json       # MCP server configuration
├── .claude-mpm/               # Claude MPM runtime data
│   └── logs/                  # MPM operational logs
├── docs/                      # All project documentation
│   ├── reference/             # Reference documentation
│   │   └── PROJECT_ORGANIZATION.md  # This file
│   ├── guides/                # User and developer guides
│   ├── api/                   # API documentation
│   └── archive/               # Archived/old documentation
├── drizzle/                   # Database migrations (Drizzle Kit)
├── public/                    # Static assets (Next.js)
│   ├── images/                # Public images
│   └── fonts/                 # Web fonts
├── scripts/                   # Utility and setup scripts
│   ├── *.ts                   # TypeScript scripts
│   ├── *.js                   # JavaScript scripts
│   └── *.sh                   # Shell scripts
├── src/                       # Source code (Next.js convention)
│   ├── app/                   # Next.js App Router
│   │   ├── api/              # API routes
│   │   ├── actions/          # Server actions
│   │   ├── [feature]/        # Feature pages
│   │   ├── layout.tsx        # Root layout
│   │   ├── page.tsx          # Home page
│   │   └── globals.css       # Global styles
│   ├── components/           # React components
│   │   ├── ui/              # Base UI components (shadcn/ui)
│   │   ├── auth/            # Authentication components
│   │   ├── recipe/          # Recipe-specific components
│   │   ├── meal-plan/       # Meal planning components
│   │   ├── shopping-list/   # Shopping list components
│   │   └── providers/       # React context providers
│   ├── lib/                  # Core utilities and business logic
│   │   ├── ai/              # AI/LLM integration
│   │   ├── db/              # Database connection and schema
│   │   ├── security/        # Security utilities
│   │   ├── utils/           # Utility functions
│   │   └── *.ts             # Standalone utilities
│   ├── config/              # Configuration files
│   ├── types/               # TypeScript type definitions
│   └── middleware.ts        # Next.js middleware
├── tests/                     # Test files (future use)
│   ├── unit/                 # Unit tests
│   ├── integration/          # Integration tests
│   └── e2e/                  # End-to-end tests
├── tmp/                       # Temporary and ephemeral files
│   ├── logs/                 # Application logs
│   ├── cache/                # Temporary cache files
│   └── scratch/              # Development scratch files
├── .env.local                 # Local environment variables (gitignored)
├── .gitignore                 # Git ignore rules
├── CLAUDE.md                  # Agentic coder instructions
├── QUALITY.md                 # Code quality standards
├── README.md                  # Project overview and setup
├── Makefile                   # Build and task automation
├── package.json               # Node.js dependencies and scripts
├── tsconfig.json              # TypeScript configuration
├── drizzle.config.ts          # Drizzle ORM configuration
└── next.config.ts             # Next.js configuration
```

---

## File Placement Rules

### Documentation Files (*.md)

| File Type | Location | Examples |
|-----------|----------|----------|
| Project README | Root | `README.md` |
| Agentic Instructions | Root | `CLAUDE.md`, `QUALITY.md` |
| Setup Guides | `docs/guides/` | `AUTHENTICATION_GUIDE.md`, `ENVIRONMENT_SETUP.md` |
| Reference Docs | `docs/reference/` | `PROJECT_ORGANIZATION.md`, `API_REFERENCE.md` |
| Archived Docs | `docs/archive/` | Old or deprecated documentation |
| API Documentation | `docs/api/` | API endpoint documentation |

**Rules:**
- Only README.md, CLAUDE.md, and QUALITY.md stay at root
- All other documentation goes in `docs/` subdirectories
- Guides that help users/developers set up → `docs/guides/`
- Technical reference material → `docs/reference/`
- Old/deprecated documentation → `docs/archive/`

### Source Code Files (*.ts, *.tsx)

| File Type | Location | Notes |
|-----------|----------|-------|
| Pages | `src/app/[feature]/page.tsx` | Next.js App Router pages |
| Layouts | `src/app/[feature]/layout.tsx` | Next.js layouts |
| API Routes | `src/app/api/[endpoint]/route.ts` | Next.js API routes |
| Server Actions | `src/app/actions/*.ts` | Next.js server actions |
| Components | `src/components/[feature]/` | Feature-based grouping |
| Base UI | `src/components/ui/` | shadcn/ui components |
| Utilities | `src/lib/utils/` | Reusable utility functions |
| Database | `src/lib/db/` | Database connection and schema |
| Types | `src/types/` | Shared TypeScript types |
| Middleware | `src/middleware.ts` | Next.js middleware (root of src/) |

**Rules:**
- Follow Next.js App Router conventions strictly
- Group components by feature, not by type
- Keep base UI components (shadcn/ui) in `src/components/ui/`
- Shared utilities in `src/lib/utils/`
- Feature-specific utilities in `src/lib/[feature]/`

### Script Files (*.sh, *.js, *.ts, *.py)

| Script Type | Location | Examples |
|-------------|----------|----------|
| Database Scripts | `scripts/` | `init-db.ts`, `populate-system-recipes.ts` |
| Setup Scripts | `scripts/` | `setup-google-oauth.sh` |
| Test Scripts | `scripts/` | `validate-auth.js`, `test-production-keys.js` |
| Utility Scripts | `scripts/` | `cleanup-unused-tables.ts` |

**Rules:**
- All scripts go in `scripts/` directory
- Use descriptive names: `verb-noun.extension`
- Make scripts executable: `chmod +x scripts/*.sh`
- Document script purpose in header comment

### Temporary Files (*.log, *.tmp, cache files)

| File Type | Location | Examples |
|-----------|----------|----------|
| Application Logs | `tmp/logs/` | `server.log`, `auth_test.log` |
| Cache Files | `tmp/cache/` | Temporary cache data |
| Scratch Files | `tmp/scratch/` | Development scratch work |
| MPM Logs | `.claude-mpm/logs/` | Claude MPM operational logs |

**Rules:**
- NO log files at project root
- Application logs → `tmp/logs/`
- Claude MPM logs stay in `.claude-mpm/logs/` (managed by MPM)
- Add `tmp/` to .gitignore
- Clean up old logs periodically

### Test Files (*.test.ts, *.spec.ts)

| Test Type | Location | Notes |
|-----------|----------|-------|
| Unit Tests | `tests/unit/` | Component and function tests |
| Integration Tests | `tests/integration/` | Feature integration tests |
| E2E Tests | `tests/e2e/` | End-to-end tests |

**Rules:**
- Separate `tests/` directory at project root
- Mirror source structure in test directory
- Alternative: Colocate tests with source (Next.js pattern)
  - `src/components/recipe/__tests__/RecipeCard.test.tsx`

### Configuration Files

| File | Location | Purpose |
|------|----------|---------|
| `package.json` | Root | Node.js dependencies and scripts |
| `tsconfig.json` | Root | TypeScript configuration |
| `next.config.ts` | Root | Next.js configuration |
| `drizzle.config.ts` | Root | Drizzle ORM configuration |
| `tailwind.config.ts` | Root | Tailwind CSS configuration |
| `.env.local` | Root (gitignored) | Local environment variables |
| `Makefile` | Root | Build automation |

**Rules:**
- Configuration files stay at project root
- Never commit `.env.local` or `.env.production`
- Provide `.env.local.example` as template

---

## Naming Conventions

### Files

| File Type | Convention | Examples |
|-----------|------------|----------|
| React Components | PascalCase | `RecipeCard.tsx`, `MealPlanCalendar.tsx` |
| Utilities | camelCase | `formatDate.ts`, `parseIngredients.ts` |
| Server Actions | kebab-case | `ai-recipes.ts`, `recipe-export.ts` |
| API Routes | kebab-case | `route.ts` in `api/recipes/[id]/` |
| Scripts | kebab-case | `init-db.ts`, `validate-auth.js` |
| Documentation | UPPER_SNAKE_CASE | `AUTHENTICATION_GUIDE.md`, `ENVIRONMENT_SETUP.md` |
| Root Docs | UPPER.md | `README.md`, `CLAUDE.md`, `QUALITY.md` |

### Directories

| Directory Type | Convention | Examples |
|----------------|------------|----------|
| Features | kebab-case | `meal-plans/`, `shopping-lists/` |
| Components | kebab-case | `recipe/`, `auth/`, `ui/` |
| Next.js Pages | kebab-case | `sign-in/`, `user-profile/` |
| Utilities | kebab-case | `utils/`, `db/`, `ai/` |

### Variables and Functions

| Element | Convention | Examples |
|---------|------------|----------|
| Variables | camelCase | `userId`, `recipeData`, `isPublic` |
| Functions | camelCase | `createRecipe()`, `generateAiRecipe()` |
| Components | PascalCase | `<RecipeCard />`, `<MealPlanCalendar />` |
| Constants | UPPER_SNAKE_CASE | `MAX_IMAGES`, `DEFAULT_SERVINGS` |
| Types/Interfaces | PascalCase | `Recipe`, `MealPlan`, `AuthConfig` |

---

## Framework-Specific Rules

### Next.js App Router

**Page Structure:**
```
src/app/
├── layout.tsx              # Root layout (REQUIRED)
├── page.tsx                # Home page
├── error.tsx               # Error boundary
├── not-found.tsx           # 404 page
├── global-error.tsx        # Global error handler
└── [feature]/
    ├── page.tsx            # Feature page
    ├── layout.tsx          # Feature layout (optional)
    └── [dynamic]/
        └── page.tsx        # Dynamic route
```

**API Routes:**
```
src/app/api/
└── [endpoint]/
    └── route.ts            # API route handler
```

**Server Actions:**
```
src/app/actions/
├── recipes.ts              # Recipe-related actions
├── ai-recipes.ts           # AI recipe actions
└── meal-plans.ts           # Meal plan actions
```

**Rules:**
1. Every route folder must have a `page.tsx` or `route.ts`
2. `layout.tsx` is optional except at root
3. Server actions go in `src/app/actions/`
4. API routes use `route.ts` (not `index.ts`)

### React Components

**Component Organization:**
```
src/components/
├── ui/                     # Base UI (shadcn/ui)
│   ├── button.tsx
│   ├── input.tsx
│   └── dialog.tsx
├── recipe/                 # Feature components
│   ├── RecipeCard.tsx
│   ├── RecipeForm.tsx
│   └── RecipeList.tsx
└── providers/              # Context providers
    └── ThemeProvider.tsx
```

**Rules:**
1. Base UI components (shadcn/ui) stay in `ui/`
2. Feature components grouped by feature
3. Shared components in appropriate feature folder
4. Providers in dedicated `providers/` directory

### Database (Drizzle ORM)

**Database Organization:**
```
src/lib/db/
├── index.ts                # Database connection
├── schema.ts               # Schema definitions
└── queries/                # Reusable queries
    ├── recipes.ts
    └── meal-plans.ts
```

**Migrations:**
```
drizzle/
├── 0001_initial.sql
└── 0002_add_column.sql
```

**Rules:**
1. Schema definitions in single `schema.ts` file
2. Connection logic in `index.ts`
3. Complex queries in `queries/` subdirectory
4. Migrations auto-generated in `drizzle/`

---

## Migration Procedures

### Moving Files Safely

#### 1. Create Backup
```bash
# Create timestamped backup
tar -czf backup_$(date +%Y%m%d_%H%M%S).tar.gz .
```

#### 2. Use Git for Tracked Files
```bash
# Preserve git history
git mv old/path/file.ts new/path/file.ts
```

#### 3. Update Import Paths
```typescript
// Before
import { Recipe } from '@/lib/types'

// After (if file moved)
import { Recipe } from '@/types/recipe'
```

#### 4. Verify Build
```bash
# Check for broken imports
pnpm build

# Run type checking
pnpm typecheck  # (when implemented)
```

### Reorganization Checklist

- [ ] Create backup before major changes
- [ ] Use `git mv` for version-controlled files
- [ ] Update all import statements
- [ ] Update path aliases in `tsconfig.json` if needed
- [ ] Test build: `pnpm build`
- [ ] Run tests: `pnpm test` (when implemented)
- [ ] Update documentation references
- [ ] Commit changes with descriptive message

---

## Common Violations and Fixes

### Violation: Documentation at Root

**Problem:**
```
recipe-manager/
├── AUTHENTICATION_GUIDE.md      # ❌ Should be in docs/guides/
├── CLERK_SETUP_GUIDE.md         # ❌ Should be in docs/guides/
└── ENVIRONMENT_SETUP.md         # ❌ Should be in docs/guides/
```

**Solution:**
```bash
mkdir -p docs/guides
git mv AUTHENTICATION_GUIDE.md docs/guides/
git mv CLERK_SETUP_GUIDE.md docs/guides/
git mv ENVIRONMENT_SETUP.md docs/guides/
```

### Violation: Log Files at Root

**Problem:**
```
recipe-manager/
├── server.log                   # ❌ Should be in tmp/logs/
├── auth_test.log                # ❌ Should be in tmp/logs/
└── no_turbo_test.log            # ❌ Should be in tmp/logs/
```

**Solution:**
```bash
mkdir -p tmp/logs
mv *.log tmp/logs/
echo "tmp/" >> .gitignore
```

### Violation: Mixed Component Types

**Problem:**
```
src/components/
├── RecipeCard.tsx               # ❌ Should be in recipe/
├── Button.tsx                   # ❌ Should be in ui/
└── MealPlanCalendar.tsx         # ❌ Should be in meal-plan/
```

**Solution:**
```bash
git mv src/components/RecipeCard.tsx src/components/recipe/
git mv src/components/Button.tsx src/components/ui/
git mv src/components/MealPlanCalendar.tsx src/components/meal-plan/
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-10-14 | Initial organization standard created |

---

## References

- [Next.js Project Structure](https://nextjs.org/docs/app/getting-started/project-structure)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Drizzle ORM File Structure](https://orm.drizzle.team/docs/overview)
- [shadcn/ui Component Structure](https://ui.shadcn.com)

---

**Maintained By**: Project Organizer Agent
**For Questions**: Refer to CLAUDE.md or project maintainers
