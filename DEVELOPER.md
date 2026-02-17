# Joanie's Kitchen - Developer Guide

**Technical Architecture & Development Reference**

Last Updated: 2025-11-20
Version: 0.7.9

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Tech Stack Details](#tech-stack-details)
- [Database Architecture](#database-architecture)
- [Authentication System](#authentication-system)
- [AI Integration](#ai-integration)
- [Search & Embeddings](#search--embeddings)
- [File Storage](#file-storage)
- [API Design](#api-design)
- [Performance Optimization](#performance-optimization)
- [Testing Strategy](#testing-strategy)
- [Deployment Architecture](#deployment-architecture)

---

## Architecture Overview

### System Architecture

```
┌─────────────────┐
│  Next.js 15     │
│  App Router     │
│  (Port 3002)    │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼──┐  ┌──▼───────┐
│ RSC  │  │  Server  │
│Pages │  │ Actions  │
└──┬───┘  └────┬─────┘
   │           │
   └─────┬─────┘
         │
    ┌────▼─────────┐
    │              │
┌───▼───┐  ┌──────▼────────┐  ┌──────────┐
│Drizzle│  │  External     │  │  Vercel  │
│  ORM  │  │  APIs         │  │   Blob   │
└───┬───┘  │  - OpenRouter │  └──────────┘
    │      │  - HuggingFace│
┌───▼──────▼──┐  - Brave    │
│   Neon      │  │- Firecrawl│
│ PostgreSQL  │  └───────────┘
│  + pgvector │
└─────────────┘
```

### Request Flow

```
1. User Request
   ↓
2. Next.js Middleware (auth, headers)
   ↓
3. Server Component / Server Action
   ↓
4. Business Logic Layer
   ↓
5. Database Layer (Drizzle ORM)
   ↓
6. Neon PostgreSQL
   ↓
7. Response with React Server Components
```

### Design Principles

1. **Server-First**: Use Server Components by default
2. **Progressive Enhancement**: Core features work without JavaScript
3. **Type Safety**: End-to-end TypeScript with strict mode
4. **Data Validation**: Zod schemas at all boundaries
5. **Security by Default**: Auth checks in middleware and server actions

---

## Tech Stack Details

### Frontend

**Next.js 15.5.3** (App Router)
- React Server Components (RSC) by default
- Turbopack for development (fallback to webpack for stability)
- Automatic code splitting and lazy loading
- Built-in image optimization

**React 19.1.0**
- Server Components
- Server Actions (form handling)
- Suspense for streaming
- Concurrent rendering

**TypeScript 5.x** (Strict Mode)
```json
{
  "strict": true,
  "noImplicitAny": true,
  "strictNullChecks": true,
  "strictFunctionTypes": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true
}
```

**UI Framework**
- Tailwind CSS 4 (utility-first)
- shadcn/ui (Radix UI primitives)
- Lucide React (icons)
- next-themes (dark mode)

### Backend

**Database: Neon PostgreSQL**
```yaml
Features:
  - Serverless PostgreSQL
  - Auto-scaling
  - Branching (git-like)
  - Connection pooling
  - pgvector extension
```

**ORM: Drizzle 0.44.5**
```typescript
// Type-safe queries
const recipes = await db.select()
  .from(recipesTable)
  .where(eq(recipesTable.userId, userId))
  .limit(10);

// Transactions
await db.transaction(async (tx) => {
  await tx.insert(recipes).values(data);
  await tx.insert(recipeIngredients).values(ingredients);
});
```

**Authentication: Clerk 6.33.7**
```typescript
// Server-side auth
import { auth } from '@clerk/nextjs/server';

const { userId } = await auth();
if (!userId) throw new Error('Unauthorized');

// Client-side auth
import { useUser } from '@clerk/nextjs';

const { user, isLoaded } = useUser();
```

### AI/ML Stack

**OpenRouter API**
- Multi-model access (Claude, GPT, Gemini)
- Recipe generation
- Ingredient extraction
- Content analysis

**Hugging Face**
- Embeddings: sentence-transformers/all-MiniLM-L6-v2
- 384-dimensional vectors
- Semantic search

**Ollama** (Optional, Local)
- Local LLM inference
- Privacy-focused processing
- Reduced API costs

**Stable Diffusion XL** (Local)
- Recipe image generation
- Ingredient visualization
- Custom training possible

### Package Manager

**pnpm** (REQUIRED)
```bash
# Why pnpm?
- Faster than npm/yarn
- Disk space efficient (content-addressable storage)
- Strict dependency resolution
- Workspace support
- Better monorepo handling

# Never use npm or yarn in this project
```

---

## Database Architecture

### Schema Organization

```typescript
// Multi-file schema approach
drizzle.config.ts references:
  - schema.ts              // Core tables
  - ingredients-schema.ts  // Ingredient system
  - chef-schema.ts         // Chef profiles
  - user-discovery-schema.ts // Social features
```

### Core Tables

**recipes**
```sql
CREATE TABLE recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255),          -- Clerk user ID
  title VARCHAR(200) NOT NULL,
  description TEXT,
  image_url TEXT,
  prep_time_minutes INTEGER,
  cook_time_minutes INTEGER,
  total_time_minutes INTEGER,
  servings INTEGER,
  difficulty VARCHAR(20),
  source VARCHAR(50),            -- 'user', 'ai', 'import'
  source_url TEXT,
  chef_id UUID REFERENCES chefs(id),
  is_public BOOLEAN DEFAULT true,
  is_searchable BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  embedding VECTOR(384)          -- pgvector for semantic search
);

CREATE INDEX idx_recipes_user_id ON recipes(user_id);
CREATE INDEX idx_recipes_is_public ON recipes(is_public);
CREATE INDEX idx_recipes_created_at ON recipes(created_at DESC);
```

**recipe_ingredients**
```sql
CREATE TABLE recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
  ingredient_id UUID REFERENCES ingredients(id),
  ingredient_order INTEGER,
  amount VARCHAR(50),            -- '2', '1/2', '1 1/2'
  unit VARCHAR(50),              -- 'cup', 'tablespoon', 'oz'
  preparation VARCHAR(100),      -- 'chopped', 'minced', 'diced'
  notes TEXT,
  is_optional BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);
CREATE INDEX idx_recipe_ingredients_ingredient ON recipe_ingredients(ingredient_id);
```

**ingredients**
```sql
CREATE TABLE ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  normalized_name VARCHAR(100),  -- Lowercase, singular form
  category VARCHAR(50),          -- 'produce', 'dairy', 'spice', etc.
  image_url TEXT,
  description TEXT,
  is_allergen BOOLEAN DEFAULT false,
  allergen_type VARCHAR(50),     -- 'dairy', 'gluten', 'nuts', etc.
  substitutions JSONB,           -- Array of substitute ingredient IDs
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ingredients_category ON ingredients(category);
CREATE INDEX idx_ingredients_normalized ON ingredients(normalized_name);
```

**meal_plans**
```sql
CREATE TABLE meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  title VARCHAR(200),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE meal_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_plan_id UUID REFERENCES meal_plans(id) ON DELETE CASCADE,
  recipe_id UUID REFERENCES recipes(id),
  meal_type VARCHAR(20),         -- 'breakfast', 'lunch', 'dinner', 'snack'
  scheduled_date DATE NOT NULL,
  servings INTEGER DEFAULT 1,
  notes TEXT
);
```

### Vector Search Setup

**pgvector Extension**
```sql
-- Enable extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create HNSW index for fast similarity search
CREATE INDEX ON recipes USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Similarity search query
SELECT
  id,
  title,
  1 - (embedding <=> query_embedding) as similarity
FROM recipes
WHERE is_searchable = true
ORDER BY embedding <=> query_embedding
LIMIT 10;
```

### Data Relationships

```
User (Clerk)
  ├── Recipes (owned)
  │   ├── RecipeIngredients
  │   │   └── Ingredients
  │   ├── RecipeSteps
  │   ├── RecipeTags
  │   │   └── Tags
  │   └── Chef (optional)
  ├── MealPlans
  │   └── MealAssignments
  │       └── Recipes
  ├── Collections
  │   └── CollectionRecipes
  │       └── Recipes
  ├── ShoppingLists
  │   └── ShoppingListItems
  │       └── Ingredients
  └── InventoryItems
      └── Ingredients
```

---

## Authentication System

### Clerk Integration

**Configuration** (`src/config/auth.config.ts`)
```typescript
export const authConfig = {
  // Auto-select keys based on environment
  publishableKey: isProduction
    ? process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY_PROD
    : process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY_DEV,

  secretKey: isProduction
    ? process.env.CLERK_SECRET_KEY_PROD
    : process.env.CLERK_SECRET_KEY_DEV,
};
```

**Middleware** (`src/middleware.ts`)
```typescript
import { authMiddleware } from '@clerk/nextjs/server';

export default authMiddleware({
  publicRoutes: [
    '/',
    '/recipes',
    '/recipes/(.*)',
    '/discover',
    '/chef/(.*)',
    '/tools',
    '/learn',
  ],
  ignoredRoutes: [
    '/api/webhooks/(.*)',
    '/api/public/(.*)',
  ],
});

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
};
```

**Server-Side Auth**
```typescript
import { auth, currentUser } from '@clerk/nextjs/server';

// Get user ID
export async function getAuthUserId() {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');
  return userId;
}

// Get full user object
export async function getAuthUser() {
  const user = await currentUser();
  if (!user) throw new Error('Unauthorized');
  return user;
}

// Check admin access
export async function requireAdmin() {
  const user = await currentUser();
  const isAdmin = user?.publicMetadata?.isAdmin === 'true';
  if (!isAdmin) throw new Error('Admin access required');
  return user;
}
```

**Client-Side Auth**
```typescript
'use client';

import { useUser, useAuth } from '@clerk/nextjs';

export function ProfileButton() {
  const { user, isLoaded } = useUser();
  const { signOut } = useAuth();

  if (!isLoaded) return <div>Loading...</div>;
  if (!user) return <SignInButton />;

  return (
    <div>
      <p>Welcome, {user.firstName}</p>
      <button onClick={() => signOut()}>Sign Out</button>
    </div>
  );
}
```

### Protected Routes Pattern

```typescript
// src/app/recipes/new/page.tsx
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function NewRecipePage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in?redirect=/recipes/new');
  }

  return <RecipeForm userId={userId} />;
}
```

### Admin Authorization

```typescript
// src/app/admin/layout.tsx
import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function AdminLayout({ children }) {
  const user = await currentUser();
  const isAdmin = user?.publicMetadata?.isAdmin === 'true';

  if (!isAdmin) {
    redirect('/');
  }

  return <div>{children}</div>;
}
```

---

## AI Integration

### OpenRouter API

**Configuration**
```typescript
// src/lib/ai/openrouter.ts
import { OpenAI } from 'openai';

export const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL,
    'X-Title': 'Joanies Kitchen',
  },
});
```

**Recipe Generation**
```typescript
export async function generateRecipe(prompt: string) {
  const completion = await openrouter.chat.completions.create({
    model: 'anthropic/claude-3.5-sonnet',
    messages: [
      {
        role: 'system',
        content: 'You are a professional chef and recipe developer...',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.7,
    max_tokens: 2000,
  });

  return completion.choices[0].message.content;
}
```

**Ingredient Extraction**
```typescript
export async function extractIngredients(recipeText: string) {
  const schema = z.object({
    ingredients: z.array(z.object({
      name: z.string(),
      amount: z.string().optional(),
      unit: z.string().optional(),
      preparation: z.string().optional(),
    })),
  });

  const completion = await openrouter.chat.completions.create({
    model: 'openai/gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'Extract ingredients from recipe text. Return JSON...',
      },
      {
        role: 'user',
        content: recipeText,
      },
    ],
    response_format: { type: 'json_object' },
  });

  const parsed = JSON.parse(completion.choices[0].message.content);
  return schema.parse(parsed);
}
```

### Hugging Face Embeddings

**Generate Embeddings**
```typescript
// src/lib/ai/embeddings.ts
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch(
    'https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: text }),
    }
  );

  const embedding = await response.json();
  return embedding;
}
```

**Batch Processing**
```typescript
export async function generateRecipeEmbeddings() {
  const recipes = await db.select().from(recipesTable)
    .where(isNull(recipesTable.embedding));

  for (const recipe of recipes) {
    const text = `${recipe.title} ${recipe.description} ${recipe.tags.join(' ')}`;
    const embedding = await generateEmbedding(text);

    await db.update(recipesTable)
      .set({ embedding })
      .where(eq(recipesTable.id, recipe.id));

    await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
  }
}
```

---

## Search & Embeddings

### Semantic Search

**Query Flow**
```typescript
export async function searchRecipes(query: string, limit = 10) {
  // 1. Generate query embedding
  const queryEmbedding = await generateEmbedding(query);

  // 2. Vector similarity search
  const results = await db.execute(sql`
    SELECT
      r.*,
      1 - (r.embedding <=> ${queryEmbedding}::vector) as similarity
    FROM recipes r
    WHERE r.is_searchable = true
      AND r.embedding IS NOT NULL
    ORDER BY r.embedding <=> ${queryEmbedding}::vector
    LIMIT ${limit}
  `);

  return results.rows;
}
```

**Hybrid Search** (Keyword + Semantic)
```typescript
export async function hybridSearch(query: string, filters?: Filters) {
  const queryEmbedding = await generateEmbedding(query);

  let baseQuery = db.select()
    .from(recipesTable)
    .where(eq(recipesTable.isSearchable, true));

  // Apply filters
  if (filters?.difficulty) {
    baseQuery = baseQuery.where(eq(recipesTable.difficulty, filters.difficulty));
  }

  if (filters?.maxTime) {
    baseQuery = baseQuery.where(lte(recipesTable.totalTimeMinutes, filters.maxTime));
  }

  // Add vector similarity
  const results = await baseQuery
    .orderBy(sql`embedding <=> ${queryEmbedding}::vector`)
    .limit(20);

  return results;
}
```

### HNSW Index Optimization

**Index Configuration**
```sql
-- Create HNSW index
CREATE INDEX recipes_embedding_hnsw_idx ON recipes
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Parameters:
-- m = max connections per layer (16 is good default)
-- ef_construction = size of dynamic candidate list (higher = better recall, slower build)
```

**Query Performance**
```sql
-- Fast similarity search with HNSW
EXPLAIN ANALYZE
SELECT id, title,
  1 - (embedding <=> '[0.1, 0.2, ...]'::vector) as similarity
FROM recipes
ORDER BY embedding <=> '[0.1, 0.2, ...]'::vector
LIMIT 10;

-- Expected: ~10-50ms for 100K+ recipes with HNSW index
```

---

## File Storage

### Vercel Blob Storage

**Upload Implementation**
```typescript
// src/app/actions/upload-image.ts
'use server';

import { put } from '@vercel/blob';
import { auth } from '@clerk/nextjs/server';

export async function uploadRecipeImage(formData: FormData) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const file = formData.get('file') as File;
  if (!file) throw new Error('No file provided');

  // Validate file
  const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    throw new Error('Invalid file type');
  }

  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    throw new Error('File too large');
  }

  // Upload to Vercel Blob
  const filename = `recipes/${userId}/${Date.now()}-${file.name}`;
  const blob = await put(filename, file, {
    access: 'public',
    contentType: file.type,
  });

  return {
    url: blob.url,
    filename: blob.pathname,
    size: file.size,
  };
}
```

**Image Display**
```typescript
import Image from 'next/image';

export function RecipeImage({ url, alt }: { url: string; alt: string }) {
  return (
    <Image
      src={url}
      alt={alt}
      width={600}
      height={400}
      className="object-cover rounded-lg"
      priority={false}
      loading="lazy"
    />
  );
}
```

**Image Optimization** (next.config.ts)
```typescript
export default {
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    qualities: [75, 85, 90, 95, 100],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
    ],
  },
};
```

---

## API Design

### Server Actions Pattern

**Form Handling**
```typescript
// src/app/actions/create-recipe.ts
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';

const schema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  servings: z.number().int().positive(),
});

export async function createRecipe(formData: FormData) {
  // 1. Authentication
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  // 2. Validation
  const data = schema.parse({
    title: formData.get('title'),
    description: formData.get('description'),
    servings: Number(formData.get('servings')),
  });

  // 3. Database mutation
  const [recipe] = await db.insert(recipes)
    .values({
      ...data,
      userId,
      createdAt: new Date(),
    })
    .returning();

  // 4. Revalidate cache
  revalidatePath('/recipes');

  // 5. Return result
  return { success: true, recipe };
}
```

**Client Usage**
```typescript
'use client';

import { useFormStatus } from 'react-dom';
import { createRecipe } from '@/app/actions/create-recipe';

export function RecipeForm() {
  async function handleSubmit(formData: FormData) {
    const result = await createRecipe(formData);
    if (result.success) {
      // Handle success
    }
  }

  return (
    <form action={handleSubmit}>
      <input name="title" required />
      <input name="description" />
      <input name="servings" type="number" required />
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? 'Creating...' : 'Create Recipe'}
    </button>
  );
}
```

### API Routes (Legacy)

**Route Handler** (route.ts)
```typescript
// src/app/api/recipes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = Number(searchParams.get('limit')) || 10;

    const recipes = await db.select()
      .from(recipesTable)
      .where(eq(recipesTable.userId, userId))
      .limit(limit);

    return NextResponse.json({ recipes });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Similar pattern for POST
}
```

---

## Performance Optimization

### Bundle Analysis

```bash
# Analyze bundle size
ANALYZE=true pnpm build

# Opens interactive bundle analyzer
# Identify large dependencies
# Look for duplicate packages
```

### Code Splitting

**Dynamic Imports**
```typescript
import dynamic from 'next/dynamic';

// Lazy load heavy components
const RecipeEditor = dynamic(() => import('@/components/recipe/RecipeEditor'), {
  loading: () => <div>Loading editor...</div>,
  ssr: false, // Client-side only
});
```

**Route Segments**
```typescript
// app/recipes/[id]/page.tsx
export const dynamic = 'force-dynamic'; // Disable static generation
export const revalidate = 60; // Revalidate every 60 seconds

export default async function RecipePage({ params }) {
  const recipe = await fetchRecipe(params.id);
  return <RecipeDetail recipe={recipe} />;
}
```

### Database Optimization

**Indexes**
```sql
-- Add indexes for common queries
CREATE INDEX idx_recipes_user_public ON recipes(user_id, is_public);
CREATE INDEX idx_recipes_created_desc ON recipes(created_at DESC);
CREATE INDEX idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);
```

**Query Optimization**
```typescript
// BAD: N+1 query
const recipes = await db.select().from(recipesTable);
for (const recipe of recipes) {
  recipe.ingredients = await db.select()
    .from(recipeIngredientsTable)
    .where(eq(recipeIngredientsTable.recipeId, recipe.id));
}

// GOOD: Single query with join
const recipes = await db.select()
  .from(recipesTable)
  .leftJoin(recipeIngredientsTable,
    eq(recipesTable.id, recipeIngredientsTable.recipeId));
```

### Caching Strategy

**React Cache**
```typescript
import { cache } from 'react';

export const getRecipe = cache(async (id: string) => {
  return await db.select()
    .from(recipesTable)
    .where(eq(recipesTable.id, id))
    .limit(1);
});
```

**Next.js Cache**
```typescript
import { unstable_cache } from 'next/cache';

export const getCachedRecipes = unstable_cache(
  async () => {
    return await db.select().from(recipesTable).limit(100);
  },
  ['recipes-list'],
  { revalidate: 3600 } // 1 hour
);
```

---

## Testing Strategy

### Unit Tests (Vitest)

**Example Test**
```typescript
// src/lib/utils/parse-ingredients.test.ts
import { describe, it, expect } from 'vitest';
import { parseIngredient } from './parse-ingredients';

describe('parseIngredient', () => {
  it('should parse simple ingredient', () => {
    const result = parseIngredient('2 cups flour');
    expect(result).toEqual({
      amount: '2',
      unit: 'cups',
      name: 'flour',
    });
  });

  it('should handle fractions', () => {
    const result = parseIngredient('1/2 teaspoon salt');
    expect(result).toEqual({
      amount: '1/2',
      unit: 'teaspoon',
      name: 'salt',
    });
  });
});
```

### Integration Tests

**Database Tests**
```typescript
// src/lib/db/recipes.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './index';
import { recipes } from './schema';

describe('Recipe Database Operations', () => {
  beforeEach(async () => {
    // Clean up test data
    await db.delete(recipes).where(eq(recipes.userId, 'test-user'));
  });

  it('should create recipe', async () => {
    const [recipe] = await db.insert(recipes)
      .values({
        userId: 'test-user',
        title: 'Test Recipe',
      })
      .returning();

    expect(recipe.id).toBeDefined();
    expect(recipe.title).toBe('Test Recipe');
  });
});
```

### E2E Tests (Playwright)

**Example Test**
```typescript
// tests/e2e/recipes.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Recipe Management', () => {
  test('should create new recipe', async ({ page }) => {
    // Login
    await page.goto('/sign-in');
    await page.fill('[name=email]', 'test@example.com');
    await page.fill('[name=password]', 'password123');
    await page.click('[type=submit]');

    // Navigate to new recipe
    await page.goto('/recipes/new');

    // Fill form
    await page.fill('[name=title]', 'Test Recipe');
    await page.fill('[name=description]', 'Test description');
    await page.fill('[name=servings]', '4');

    // Submit
    await page.click('[type=submit]');

    // Verify creation
    await expect(page).toHaveURL(/\/recipes\/[a-z0-9-]+/);
    await expect(page.locator('h1')).toContainText('Test Recipe');
  });
});
```

---

## Deployment Architecture

### Vercel Deployment

**Environment Variables**
```bash
# Production
DATABASE_URL=postgresql://...
OPENROUTER_API_KEY=sk-or-v1-...
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY_PROD=pk_live_...
CLERK_SECRET_KEY_PROD=sk_live_...

# Auto-set by Vercel
VERCEL_URL=joanies-kitchen.vercel.app
VERCEL_ENV=production
```

**Build Configuration**
```json
{
  "buildCommand": "pnpm build",
  "outputDirectory": ".next",
  "installCommand": "pnpm install",
  "framework": "nextjs"
}
```

### Database Migrations

**Production Migration Flow**
```bash
# 1. Generate migration locally
pnpm db:generate

# 2. Review generated SQL in drizzle/ folder

# 3. Test migration on branch database (Neon)
DATABASE_URL=<branch-url> pnpm db:migrate

# 4. If successful, merge to main

# 5. Vercel auto-deploys, runs build
# (Migrations run via build script if configured)
```

### Monitoring

**Key Metrics**
- Page load time (LCP < 2s)
- Time to Interactive (TTI < 3s)
- Error rate (< 1%)
- API response time (< 500ms)
- Database query time (< 100ms)

**Tools**
- Vercel Analytics (built-in)
- Vercel Speed Insights (Web Vitals)
- Database insights (Neon dashboard)
- Custom logging (console.error, structured logs)

---

## Development Best Practices

### Code Organization

```typescript
// GOOD: Clear separation of concerns
src/
  app/
    recipes/
      page.tsx              // UI + data fetching
    actions/
      recipes.ts            // Business logic
  lib/
    db/
      queries/
        recipes.ts          // Database queries
    validations/
      recipe-schema.ts      // Zod schemas

// BAD: Mixed concerns
src/
  app/
    recipes/
      page.tsx              // Everything in one file
```

### Error Handling

```typescript
// GOOD: Typed errors, user-friendly messages
type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function createRecipe(data: unknown): Promise<Result<Recipe>> {
  try {
    const validated = recipeSchema.parse(data);
    const recipe = await db.insert(recipes).values(validated);
    return { success: true, data: recipe };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: 'Invalid input data' };
    }
    console.error('Recipe creation failed:', error);
    return { success: false, error: 'Failed to create recipe' };
  }
}

// BAD: Throwing errors to client
export async function createRecipe(data: any) {
  const recipe = await db.insert(recipes).values(data); // Throws on error
  return recipe;
}
```

### Type Safety

```typescript
// GOOD: Derive types from schema
import { recipes } from '@/lib/db/schema';
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';

export type Recipe = InferSelectModel<typeof recipes>;
export type NewRecipe = InferInsertModel<typeof recipes>;

// GOOD: Use Zod for runtime validation
import { z } from 'zod';

export const recipeSchema = z.object({
  title: z.string().min(1).max(200),
  servings: z.number().int().positive(),
});

export type RecipeInput = z.infer<typeof recipeSchema>;
```

---

**For more information, see:**
- [CLAUDE.md](./CLAUDE.md) - AI agent instructions
- [CODE_STRUCTURE.md](./CODE_STRUCTURE.md) - Project organization
- [README.md](./README.md) - Project overview
- [docs/](./docs/) - Additional documentation
