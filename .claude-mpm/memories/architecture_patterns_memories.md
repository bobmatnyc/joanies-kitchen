# Architecture Patterns - Joanie's Kitchen

**Last Updated**: 2025-11-20

---

## Database Patterns

### Multi-Schema Organization
```typescript
// drizzle.config.ts always includes all schemas
schema: [
  './src/lib/db/schema.ts',              // Core tables
  './src/lib/db/ingredients-schema.ts',  // Ingredients system
  './src/lib/db/chef-schema.ts',         // Chef profiles
  './src/lib/db/user-discovery-schema.ts' // Social features
]
```

### Vector Search Pattern (pgvector)
```typescript
// Always use HNSW index for performance
CREATE INDEX recipes_embedding_idx ON recipes
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

// Query pattern
const results = await db.execute(sql`
  SELECT *, 1 - (embedding <=> ${queryEmbedding}::vector) as similarity
  FROM recipes
  WHERE is_searchable = true
  ORDER BY embedding <=> ${queryEmbedding}::vector
  LIMIT 10
`);
```

---

## Authentication Patterns

### Dual Environment Keys (Clerk)
```typescript
// src/config/auth.config.ts
const isProduction = process.env.NODE_ENV === 'production';

export const authConfig = {
  publishableKey: isProduction
    ? process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY_PROD
    : process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY_DEV,

  secretKey: isProduction
    ? process.env.CLERK_SECRET_KEY_PROD
    : process.env.CLERK_SECRET_KEY_DEV,
};
```

### Server Action Auth Pattern
```typescript
'use server';

export async function createResource(data: FormData) {
  // 1. Validate input (Zod)
  const validated = schema.parse(data);

  // 2. Check authentication
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  // 3. Perform mutation
  const result = await db.insert(table).values({...validated, userId});

  // 4. Revalidate cache
  revalidatePath('/resources');

  return result;
}
```

---

## Image Upload Patterns

### Vercel Blob Pattern (Correct)
```typescript
'use server';

import { put } from '@vercel/blob';

export async function uploadImage(formData: FormData) {
  const file = formData.get('file') as File;

  // Validate
  if (!validTypes.includes(file.type)) throw new Error('Invalid type');
  if (file.size > maxSize) throw new Error('Too large');

  // Upload
  const blob = await put(`recipes/${userId}/${timestamp}-${file.name}`, file, {
    access: 'public',
    contentType: file.type,
  });

  return blob.url; // Save this to database
}
```

### Image Display Pattern
```typescript
import Image from 'next/image';

// Always use Next.js Image component
<Image
  src={recipe.imageUrl}
  alt={recipe.title}
  width={600}
  height={400}
  className="object-cover"
  loading="lazy"
  priority={false}
/>
```

---

## Component Patterns

### Server Component (Default)
```typescript
// No "use client" directive
// Can use async/await
// Can access database directly

export default async function RecipesPage() {
  const recipes = await db.select().from(recipesTable);

  return (
    <div>
      {recipes.map(recipe => <RecipeCard key={recipe.id} recipe={recipe} />)}
    </div>
  );
}
```

### Client Component (When Necessary)
```typescript
'use client';

import { useState } from 'react';

// Only use when you need:
// - Hooks (useState, useEffect, etc.)
// - Event handlers
// - Browser APIs

export function RecipeForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Event handler requires client component
  async function handleSubmit(formData: FormData) {
    setIsSubmitting(true);
    await createRecipe(formData);
    setIsSubmitting(false);
  }

  return <form action={handleSubmit}>...</form>;
}
```

---

## Data Fetching Patterns

### Direct Database Access (Server Components)
```typescript
import { db } from '@/lib/db';

export default async function RecipePage({ params }: { params: { id: string } }) {
  const recipe = await db.select()
    .from(recipesTable)
    .where(eq(recipesTable.id, params.id))
    .limit(1);

  return <RecipeDetail recipe={recipe[0]} />;
}
```

### With Caching (React cache)
```typescript
import { cache } from 'react';

export const getRecipe = cache(async (id: string) => {
  return await db.select()
    .from(recipesTable)
    .where(eq(recipesTable.id, id))
    .limit(1);
});

// Use in multiple components - only fetches once
```

---

## Error Handling Patterns

### Typed Results Pattern
```typescript
type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function createRecipe(data: unknown): Promise<Result<Recipe>> {
  try {
    const validated = recipeSchema.parse(data);
    const recipe = await db.insert(recipes).values(validated).returning();
    return { success: true, data: recipe[0] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: 'Invalid input' };
    }
    console.error('Recipe creation failed:', error);
    return { success: false, error: 'Failed to create recipe' };
  }
}
```

### Client Usage
```typescript
const result = await createRecipe(data);

if (result.success) {
  router.push(`/recipes/${result.data.id}`);
} else {
  toast.error(result.error);
}
```

---

## Validation Patterns

### Zod Schema Pattern
```typescript
// src/lib/validations/recipe-schema.ts
import { z } from 'zod';

export const recipeSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  servings: z.number().int().positive(),
  prepTimeMinutes: z.number().int().positive().optional(),
  cookTimeMinutes: z.number().int().positive().optional(),
});

export type RecipeInput = z.infer<typeof recipeSchema>;
```

### Server Action with Validation
```typescript
'use server';

import { recipeSchema } from '@/lib/validations/recipe-schema';

export async function createRecipe(formData: FormData) {
  const data = recipeSchema.parse({
    title: formData.get('title'),
    description: formData.get('description'),
    servings: Number(formData.get('servings')),
  });

  // data is now typed and validated
  await db.insert(recipes).values(data);
}
```

---

## Type Safety Patterns

### Derive Types from Schema
```typescript
import { recipes } from '@/lib/db/schema';
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';

// Type for SELECT queries
export type Recipe = InferSelectModel<typeof recipes>;

// Type for INSERT queries
export type NewRecipe = InferInsertModel<typeof recipes>;

// Use in components
function RecipeCard({ recipe }: { recipe: Recipe }) { ... }
```

### Avoid `any` - Use `unknown`
```typescript
// ❌ BAD
function parseData(data: any) { ... }

// ✅ GOOD
function parseData(data: unknown) {
  // Must validate before using
  const validated = schema.parse(data);
  return validated;
}
```

---

## Performance Patterns

### Database Query Optimization
```typescript
// ❌ BAD: N+1 query
const recipes = await db.select().from(recipesTable);
for (const recipe of recipes) {
  recipe.ingredients = await db.select()
    .from(ingredientsTable)
    .where(eq(ingredientsTable.recipeId, recipe.id));
}

// ✅ GOOD: Single query with join
const recipes = await db.select()
  .from(recipesTable)
  .leftJoin(ingredientsTable, eq(recipesTable.id, ingredientsTable.recipeId));
```

### Dynamic Imports for Heavy Components
```typescript
import dynamic from 'next/dynamic';

// Lazy load editor (only loaded when needed)
const RecipeEditor = dynamic(
  () => import('@/components/recipe/RecipeEditor'),
  {
    loading: () => <div>Loading editor...</div>,
    ssr: false, // Client-side only
  }
);
```

---

## Search Patterns

### Semantic Search with Filters
```typescript
export async function searchRecipes(
  query: string,
  filters?: { difficulty?: string; maxTime?: number }
) {
  // Generate embedding
  const embedding = await generateEmbedding(query);

  // Build query with filters
  let baseQuery = db.select()
    .from(recipesTable)
    .where(eq(recipesTable.isSearchable, true));

  if (filters?.difficulty) {
    baseQuery = baseQuery.where(eq(recipesTable.difficulty, filters.difficulty));
  }

  if (filters?.maxTime) {
    baseQuery = baseQuery.where(lte(recipesTable.totalTimeMinutes, filters.maxTime));
  }

  // Add vector similarity
  return await baseQuery
    .orderBy(sql`embedding <=> ${embedding}::vector`)
    .limit(20);
}
```

---

## Testing Patterns

### Unit Test Pattern
```typescript
import { describe, it, expect } from 'vitest';
import { parseIngredient } from './parse-ingredient';

describe('parseIngredient', () => {
  it('should parse simple ingredient', () => {
    const result = parseIngredient('2 cups flour');
    expect(result).toEqual({
      amount: '2',
      unit: 'cups',
      name: 'flour',
    });
  });
});
```

### E2E Test Pattern
```typescript
import { test, expect } from '@playwright/test';

test('should create recipe', async ({ page }) => {
  await page.goto('/recipes/new');
  await page.fill('[name=title]', 'Test Recipe');
  await page.click('[type=submit]');
  await expect(page).toHaveURL(/\/recipes\/[a-z0-9-]+/);
});
```

---

## File Organization Patterns

### Component File Structure
```typescript
// RecipeCard.tsx

// 1. Imports
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { Recipe } from '@/types';

// 2. Types
interface RecipeCardProps {
  recipe: Recipe;
  onSelect?: (id: string) => void;
}

// 3. Main Component
export function RecipeCard({ recipe, onSelect }: RecipeCardProps) {
  return <div>...</div>;
}

// 4. Sub-components (if needed)
function RecipeActions({ recipeId }: { recipeId: string }) {
  return <div>...</div>;
}
```

### Server Action File Structure
```typescript
// src/app/actions/recipes.ts
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';

// Export all related actions from one file
export async function createRecipe(data: FormData) { ... }
export async function updateRecipe(id: string, data: FormData) { ... }
export async function deleteRecipe(id: string) { ... }
```

---

## Migration Patterns

### Database Migration Pattern
```bash
# 1. Generate migration
pnpm db:generate

# 2. Review generated SQL in drizzle/ folder

# 3. Test on branch database
DATABASE_URL=<branch-url> pnpm db:migrate

# 4. If successful, merge to main
git add drizzle/
git commit -m "feat: add new schema"
git push

# 5. Vercel auto-deploys and runs migrations
```

---

**These patterns should be followed consistently throughout the codebase.**
