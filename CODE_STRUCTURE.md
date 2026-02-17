# Joanie's Kitchen - Code Structure

**Project Organization & File Placement Guide**

Last Updated: 2025-11-20
Version: 0.7.9

---

## Table of Contents

- [Directory Overview](#directory-overview)
- [Source Code Structure](#source-code-structure)
- [File Naming Conventions](#file-naming-conventions)
- [Where to Put Files](#where-to-put-files)
- [Import Patterns](#import-patterns)
- [Component Organization](#component-organization)
- [Configuration Files](#configuration-files)

---

## Directory Overview

```
joanies-kitchen/
├── .claude/                    # Claude Code agent configurations
│   └── agents/                 # Agent definition files
├── .claude-mpm/                # Claude MPM configuration
│   ├── config/                 # MPM project config
│   └── memories/               # Agent memory files
├── docs/                       # Documentation
│   ├── api/                    # API documentation
│   ├── guides/                 # How-to guides
│   ├── reference/              # Reference documentation
│   ├── features/               # Feature specifications
│   ├── testing/                # Test documentation
│   ├── deployment/             # Deployment guides
│   └── troubleshooting/        # Common issues
├── drizzle/                    # Database migrations
│   └── meta/                   # Migration metadata
├── public/                     # Static assets
│   ├── backgrounds/            # Background images
│   ├── chef-images/            # Chef profile images
│   ├── chefs/                  # Chef avatars
│   └── manifest.json           # PWA manifest
├── scripts/                    # Utility scripts
│   ├── data-acquisition/       # Recipe import scripts
│   ├── image-gen/              # Image generation
│   ├── migrations/             # Database migration scripts
│   └── seed-users/             # User seeding scripts
├── src/                        # Source code (see below)
├── tests/                      # Test files
│   ├── e2e/                    # End-to-end tests (Playwright)
│   ├── integration/            # Integration tests
│   └── reports/                # Test reports
├── tmp/                        # Temporary files (gitignored)
└── [config files]              # Root configuration files
```

---

## Source Code Structure

```
src/
├── app/                        # Next.js App Router
│   ├── (routes)/               # Route groups
│   │   ├── recipes/           # Recipe pages
│   │   ├── meals/             # Meal planning
│   │   ├── fridge/            # Inventory management
│   │   ├── discover/          # Discovery pages
│   │   ├── admin/             # Admin dashboard
│   │   └── [feature]/         # Other features
│   ├── actions/                # Server actions
│   │   ├── recipes.ts         # Recipe mutations
│   │   ├── meals.ts           # Meal planning mutations
│   │   ├── ingredients.ts     # Ingredient mutations
│   │   └── upload.ts          # File uploads
│   ├── api/                    # API routes
│   │   ├── recipes/           # Recipe API
│   │   ├── webhooks/          # Webhook handlers
│   │   └── public/            # Public APIs
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Homepage
│   ├── globals.css             # Global styles
│   └── error.tsx               # Error boundary
├── components/                 # React components
│   ├── ui/                     # Base UI components (shadcn/ui)
│   │   ├── button.tsx         # Button component
│   │   ├── input.tsx          # Input component
│   │   ├── dialog.tsx         # Dialog component
│   │   └── [primitive].tsx    # Other primitives
│   ├── recipe/                 # Recipe components
│   │   ├── RecipeCard.tsx
│   │   ├── RecipeForm.tsx
│   │   ├── RecipeDetail.tsx
│   │   └── IngredientList.tsx
│   ├── meal-plan/              # Meal planning components
│   │   ├── MealCalendar.tsx
│   │   ├── MealCard.tsx
│   │   └── DragDropContext.tsx
│   ├── inventory/              # Inventory components
│   │   ├── InventoryList.tsx
│   │   ├── AddInventoryItemForm.tsx
│   │   └── ExpiringItemsAlert.tsx
│   ├── navigation/             # Navigation components
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx
│   │   └── MobileMenu.tsx
│   ├── search/                 # Search components
│   │   ├── SearchBar.tsx
│   │   ├── SearchFilters.tsx
│   │   └── SearchResults.tsx
│   ├── admin/                  # Admin components
│   ├── chef/                   # Chef profile components
│   ├── collections/            # Collection components
│   ├── discover/               # Discovery components
│   ├── favorites/              # Favorites components
│   ├── hero/                   # Hero/landing components
│   ├── ingredient/             # Ingredient components
│   ├── mobile/                 # Mobile-specific components
│   ├── profile/                # User profile components
│   ├── providers/              # Context providers
│   ├── shared/                 # Shared utility components
│   ├── shopping-list/          # Shopping list components
│   └── tool/                   # Tool components
├── lib/                        # Core utilities and business logic
│   ├── ai/                     # AI/ML integration
│   │   ├── openrouter.ts      # OpenRouter client
│   │   ├── embeddings.ts      # Embedding generation
│   │   ├── recipe-generator.ts # Recipe generation
│   │   └── ingredient-parser.ts # Ingredient parsing
│   ├── db/                     # Database layer
│   │   ├── schema.ts          # Main schema
│   │   ├── ingredients-schema.ts # Ingredients schema
│   │   ├── chef-schema.ts     # Chef schema
│   │   ├── user-discovery-schema.ts # Social schema
│   │   ├── index.ts           # DB client
│   │   ├── types.ts           # DB types
│   │   └── queries/           # Query helpers
│   ├── api/                    # API utilities
│   ├── api-auth/               # API authentication
│   ├── cache/                  # Caching utilities
│   ├── ingredients/            # Ingredient utilities
│   ├── meal-planning/          # Meal planning logic
│   ├── meals/                  # Meal utilities
│   ├── search/                 # Search utilities
│   ├── security/               # Security utilities
│   ├── substitutions/          # Ingredient substitutions
│   ├── tags/                   # Tag utilities
│   ├── types/                  # Type definitions
│   ├── utils/                  # General utilities
│   │   ├── cn.ts              # Class name utility
│   │   ├── format.ts          # Formatting helpers
│   │   ├── validation.ts      # Validation helpers
│   │   └── performance.ts     # Performance utilities
│   └── validations/            # Zod schemas
│       ├── recipe-schema.ts
│       ├── meal-schema.ts
│       └── ingredient-schema.ts
├── hooks/                      # Custom React hooks
│   ├── use-toast.ts
│   ├── use-recipe.ts
│   ├── use-meal-plan.ts
│   └── use-auth.ts
├── types/                      # TypeScript type definitions
│   ├── index.ts               # Main types export
│   ├── ingredient-search.ts   # Ingredient search types
│   └── instruction-metadata.ts # Instruction types
├── config/                     # Configuration
│   ├── auth.config.ts         # Clerk configuration
│   └── data-sources.json      # Data source config
└── middleware.ts               # Next.js middleware
```

---

## File Naming Conventions

### React Components

```
PascalCase for components:
✅ RecipeCard.tsx
✅ MealPlanCalendar.tsx
✅ IngredientList.tsx
❌ recipeCard.tsx
❌ recipe-card.tsx
```

### Utilities & Libraries

```
kebab-case for utilities:
✅ parse-ingredients.ts
✅ generate-meal-slug.ts
✅ format-date.ts
❌ parseIngredients.ts
❌ ParseIngredients.ts
```

### Server Actions

```
kebab-case for server actions:
✅ create-recipe.ts
✅ update-meal-plan.ts
✅ upload-image.ts
❌ createRecipe.ts
❌ CreateRecipe.ts
```

### Pages (Next.js)

```
Next.js conventions:
✅ page.tsx          (route page)
✅ layout.tsx        (route layout)
✅ loading.tsx       (loading state)
✅ error.tsx         (error boundary)
✅ not-found.tsx     (404 page)
❌ Page.tsx
❌ index.tsx
```

### API Routes

```
Next.js API conventions:
✅ route.ts          (API endpoint)
✅ [id]/route.ts     (dynamic route)
❌ api.ts
❌ handler.ts
```

---

## Where to Put Files

### New React Component

**Question**: Where do I put a new component?

**Answer**: Depends on the component's purpose:

```typescript
// Base UI component (reusable primitive)
src/components/ui/[component-name].tsx

// Feature-specific component (recipes)
src/components/recipe/[ComponentName].tsx

// Feature-specific component (meals)
src/components/meal-plan/[ComponentName].tsx

// Shared utility component
src/components/shared/[ComponentName].tsx
```

**Example**:
```typescript
// New button variant → src/components/ui/button.tsx (extend existing)
// Recipe rating stars → src/components/recipe/RecipeRating.tsx
// Meal drag-drop card → src/components/meal-plan/MealCard.tsx
// Loading spinner → src/components/shared/LoadingSpinner.tsx
```

### New Server Action

**Location**: `src/app/actions/[domain].ts`

```typescript
// Recipe-related actions
src/app/actions/recipes.ts

// Meal planning actions
src/app/actions/meals.ts

// Ingredient management
src/app/actions/ingredients.ts

// File uploads
src/app/actions/upload.ts
```

**Example**:
```typescript
// src/app/actions/recipes.ts
'use server';

export async function createRecipe(data: FormData) { ... }
export async function updateRecipe(id: string, data: FormData) { ... }
export async function deleteRecipe(id: string) { ... }
```

### New API Route

**Location**: `src/app/api/[endpoint]/route.ts`

```typescript
// Recipe API
src/app/api/recipes/route.ts           // GET /api/recipes, POST /api/recipes
src/app/api/recipes/[id]/route.ts      // GET/PUT/DELETE /api/recipes/:id

// Webhook
src/app/api/webhooks/clerk/route.ts    // POST /api/webhooks/clerk

// Public API (no auth)
src/app/api/public/stats/route.ts      // GET /api/public/stats
```

### New Page

**Location**: `src/app/[route]/page.tsx`

```typescript
// Recipe browse page
src/app/recipes/page.tsx               // /recipes

// Recipe detail page
src/app/recipes/[id]/page.tsx          // /recipes/:id

// New recipe page
src/app/recipes/new/page.tsx           // /recipes/new

// Edit recipe page
src/app/recipes/[id]/edit/page.tsx     // /recipes/:id/edit
```

### New Utility Function

**Location**: `src/lib/utils/[category].ts` or `src/lib/[domain]/[function].ts`

```typescript
// General utility
src/lib/utils/format-date.ts

// Domain-specific utility
src/lib/ingredients/parse-ingredient.ts
src/lib/meals/generate-meal-slug.ts
src/lib/search/build-search-query.ts
```

### New TypeScript Type

**Location**: `src/types/[category].ts`

```typescript
// Domain types
src/types/index.ts                     // Main exports
src/types/ingredient-search.ts         // Ingredient-specific
src/types/instruction-metadata.ts      // Instruction-specific

// Or derive from schema
src/lib/db/schema.ts                   // Use InferSelectModel
```

### New Zod Schema

**Location**: `src/lib/validations/[domain]-schema.ts`

```typescript
// Recipe validation
src/lib/validations/recipe-schema.ts

// Meal planning validation
src/lib/validations/meal-schema.ts

// Ingredient validation
src/lib/validations/ingredient-schema.ts
```

### New Database Schema

**Location**: `src/lib/db/[domain]-schema.ts`

```typescript
// Core tables
src/lib/db/schema.ts

// Ingredients system
src/lib/db/ingredients-schema.ts

// Chef profiles
src/lib/db/chef-schema.ts

// Social features
src/lib/db/user-discovery-schema.ts
```

### New Script

**Location**: `scripts/[category]/[script-name].ts`

```typescript
// Data import
scripts/data-acquisition/import-themealdb.ts

// Database maintenance
scripts/migrations/apply-shared-recipes-migration.ts

// Image generation
scripts/image-gen/generate-recipe-images.ts

// QA/testing
scripts/qa-recipe-structure.ts
```

### New Test

**Location**: Adjacent to file or in tests/

```typescript
// Unit test (adjacent)
src/lib/utils/format-date.test.ts
src/lib/ingredients/parse-ingredient.test.ts

// Integration test
tests/integration/recipes-api.test.ts

// E2E test
tests/e2e/recipe-creation.spec.ts
```

### New Documentation

**Location**: `docs/[category]/[doc-name].md`

```typescript
// API docs
docs/api/recipe-api.md

// Guide
docs/guides/semantic-search.md

// Feature spec
docs/features/fridge-feature.md

// Reference
docs/reference/database-schema.md
```

---

## Import Patterns

### Absolute Imports (Preferred)

```typescript
// Use @ alias for src/
import { Button } from '@/components/ui/button';
import { db } from '@/lib/db';
import { recipeSchema } from '@/lib/validations/recipe-schema';
import type { Recipe } from '@/types';
```

**Configuration** (tsconfig.json):
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### Relative Imports

```typescript
// Same directory or parent/child only
import { RecipeCard } from './RecipeCard';
import { parseIngredient } from '../utils/parse-ingredient';
```

### Import Order (Enforced by Biome)

```typescript
// 1. External dependencies
import { useState } from 'react';
import { z } from 'zod';

// 2. Absolute imports
import { Button } from '@/components/ui/button';
import { db } from '@/lib/db';

// 3. Relative imports
import { RecipeCard } from './RecipeCard';

// 4. Types
import type { Recipe } from '@/types';
```

---

## Component Organization

### Component File Structure

```typescript
// RecipeCard.tsx - Full example

// 1. Imports
import { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils/format-date';
import type { Recipe } from '@/types';

// 2. Types
interface RecipeCardProps {
  recipe: Recipe;
  onSelect?: (id: string) => void;
  variant?: 'default' | 'compact';
}

// 3. Component
export function RecipeCard({ recipe, onSelect, variant = 'default' }: RecipeCardProps) {
  // Hooks
  const [isHovered, setIsHovered] = useState(false);

  // Handlers
  const handleClick = () => {
    onSelect?.(recipe.id);
  };

  // Render
  return (
    <div
      className="recipe-card"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
    >
      <Image src={recipe.imageUrl} alt={recipe.title} width={400} height={300} />
      <h3>{recipe.title}</h3>
      <p>{recipe.description}</p>
      <span>{formatDate(recipe.createdAt)}</span>
    </div>
  );
}

// 4. Sub-components (if any)
function RecipeCardActions({ recipeId }: { recipeId: string }) {
  return (
    <div className="actions">
      <Button size="sm">Save</Button>
      <Button size="sm">Share</Button>
    </div>
  );
}
```

### Server Component Pattern

```typescript
// src/app/recipes/page.tsx

import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { RecipeCard } from '@/components/recipe/RecipeCard';

export default async function RecipesPage() {
  // Server-side data fetching
  const { userId } = await auth();

  const recipes = await db.select()
    .from(recipesTable)
    .where(eq(recipesTable.userId, userId))
    .limit(20);

  return (
    <div className="recipes-grid">
      {recipes.map((recipe) => (
        <RecipeCard key={recipe.id} recipe={recipe} />
      ))}
    </div>
  );
}
```

### Client Component Pattern

```typescript
// src/components/recipe/RecipeForm.tsx

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { createRecipe } from '@/app/actions/recipes';

export function RecipeForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(formData: FormData) {
    setIsSubmitting(true);
    try {
      const result = await createRecipe(formData);
      if (result.success) {
        router.push(`/recipes/${result.recipe.id}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form action={handleSubmit}>
      {/* Form fields */}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Creating...' : 'Create Recipe'}
      </Button>
    </form>
  );
}
```

---

## Configuration Files

### Root Configuration Files

```
joanies-kitchen/
├── .editorconfig           # Editor settings
├── .env.example            # Environment variables template
├── .env.local              # Local environment (gitignored)
├── .gitignore              # Git ignore rules
├── .mcp.json               # MCP server configuration
├── biome.json              # Biome linter/formatter config
├── components.json         # shadcn/ui config
├── drizzle.config.ts       # Drizzle ORM config
├── ecosystem.config.js     # PM2 config (production)
├── ecosystem-3005.config.js # PM2 config (port 3005)
├── Makefile                # Make commands
├── next.config.ts          # Next.js config
├── package.json            # npm scripts & dependencies
├── playwright.config.ts    # Playwright config
├── postcss.config.mjs      # PostCSS config
├── tailwind.config.ts      # Tailwind CSS config (implied by CSS 4)
├── tsconfig.json           # TypeScript config
└── vitest.config.ts        # Vitest config
```

### Key Configuration Details

**package.json**
- Uses `pnpm` (never npm or yarn)
- Scripts organized by category
- Strict dependency versions

**next.config.ts**
- Turbopack for development
- Image optimization settings
- Vercel Blob remote patterns
- Cache control headers

**biome.json**
- Linting rules
- Formatting rules
- Line width: 100
- Single quotes for JS, double for JSX

**drizzle.config.ts**
- Multi-schema configuration
- Points to all schema files
- Database connection string

**tsconfig.json**
- Strict mode enabled
- Path aliases (@/ → src/)
- Module resolution: bundler

---

## Examples: Adding Common Features

### Example 1: Add a New Recipe Filter

**Step 1**: Define schema
```typescript
// src/lib/validations/recipe-schema.ts
export const recipeFilterSchema = z.object({
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  maxTime: z.number().optional(),
  tags: z.array(z.string()).optional(),
});
```

**Step 2**: Create component
```typescript
// src/components/recipe/RecipeFilters.tsx
'use client';

import { useSearchParams, useRouter } from 'next/navigation';

export function RecipeFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams);
    params.set(key, value);
    router.push(`/recipes?${params.toString()}`);
  }

  return (
    <div>
      <select onChange={(e) => updateFilter('difficulty', e.target.value)}>
        <option value="">All Difficulties</option>
        <option value="easy">Easy</option>
        <option value="medium">Medium</option>
        <option value="hard">Hard</option>
      </select>
    </div>
  );
}
```

**Step 3**: Use in page
```typescript
// src/app/recipes/page.tsx
import { RecipeFilters } from '@/components/recipe/RecipeFilters';

export default async function RecipesPage({ searchParams }) {
  const filters = recipeFilterSchema.parse(searchParams);
  const recipes = await getRecipesWithFilters(filters);

  return (
    <div>
      <RecipeFilters />
      <RecipeGrid recipes={recipes} />
    </div>
  );
}
```

### Example 2: Add a New Server Action

**Step 1**: Define in actions file
```typescript
// src/app/actions/recipes.ts
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';

const deleteRecipeSchema = z.object({
  recipeId: z.string().uuid(),
});

export async function deleteRecipe(recipeId: string) {
  // 1. Validate input
  const { recipeId: validId } = deleteRecipeSchema.parse({ recipeId });

  // 2. Check authorization
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  // 3. Verify ownership
  const recipe = await db.select()
    .from(recipes)
    .where(eq(recipes.id, validId))
    .limit(1);

  if (!recipe || recipe.userId !== userId) {
    throw new Error('Recipe not found or unauthorized');
  }

  // 4. Delete
  await db.delete(recipes).where(eq(recipes.id, validId));

  // 5. Revalidate
  revalidatePath('/recipes');

  return { success: true };
}
```

**Step 2**: Use in component
```typescript
// src/components/recipe/DeleteRecipeButton.tsx
'use client';

import { deleteRecipe } from '@/app/actions/recipes';
import { Button } from '@/components/ui/button';

export function DeleteRecipeButton({ recipeId }: { recipeId: string }) {
  async function handleDelete() {
    if (confirm('Delete this recipe?')) {
      await deleteRecipe(recipeId);
    }
  }

  return (
    <Button variant="destructive" onClick={handleDelete}>
      Delete
    </Button>
  );
}
```

---

## Quick Reference

### Where Does This Go?

| File Type | Location |
|-----------|----------|
| React component | `src/components/[domain]/[ComponentName].tsx` |
| UI primitive | `src/components/ui/[component].tsx` |
| Page | `src/app/[route]/page.tsx` |
| Server action | `src/app/actions/[domain].ts` |
| API route | `src/app/api/[endpoint]/route.ts` |
| Utility function | `src/lib/utils/[function].ts` or `src/lib/[domain]/[function].ts` |
| Database schema | `src/lib/db/[domain]-schema.ts` |
| Zod schema | `src/lib/validations/[domain]-schema.ts` |
| TypeScript type | `src/types/[category].ts` |
| Custom hook | `src/hooks/use-[feature].ts` |
| Script | `scripts/[category]/[script].ts` |
| Test (unit) | Adjacent: `[file].test.ts` |
| Test (e2e) | `tests/e2e/[feature].spec.ts` |
| Documentation | `docs/[category]/[doc].md` |

---

**For more information, see:**
- [CLAUDE.md](./CLAUDE.md) - AI agent instructions
- [DEVELOPER.md](./DEVELOPER.md) - Technical architecture
- [README.md](./README.md) - Project overview
