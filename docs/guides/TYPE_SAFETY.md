# Type Safety Guide

**Last Updated**: 2025-10-16
**Status**: Active

## Overview

This guide explains how to maintain type safety throughout the Recipe Manager application, particularly when working with database types and JSON fields.

## Problem Statement

### Database vs Frontend Type Mismatch

The PostgreSQL database stores certain fields as JSON strings or text:

```typescript
// Database schema (Drizzle)
export const recipes = pgTable('recipes', {
  tags: text('tags'),           // Stored as: '["italian", "pasta"]'
  images: text('images'),        // Stored as: '["url1.jpg", "url2.jpg"]'
  ingredients: text('ingredients'), // Stored as JSON array
  instructions: text('instructions'), // Stored as JSON array
});

// Drizzle-inferred type
type Recipe = {
  tags: string | null;
  images: string | null;
  ingredients: string | null;
  instructions: string | null;
};
```

But frontend components expect arrays:

```typescript
// ❌ Type Error!
function RecipeCard({ recipe }: { recipe: Recipe }) {
  return (
    <div>
      {recipe.tags.map(tag => <Badge>{tag}</Badge>)}
      {/* Error: recipe.tags is string | null, not string[] */}
    </div>
  );
}
```

## Solution: Centralized Type Utilities

We've created centralized type utilities in `src/lib/types/` to handle this safely.

### 1. Use Parsed Types in Frontend

```typescript
import { parseRecipe, type ParsedRecipe } from '@/lib/types';

// ✅ Correct - Use ParsedRecipe in components
function RecipeCard({ recipe }: { recipe: ParsedRecipe }) {
  return (
    <div>
      {recipe.tags.map(tag => <Badge key={tag}>{tag}</Badge>)}
      {/* Works! recipe.tags is string[] */}
    </div>
  );
}
```

### 2. Parse at the Boundary

**Server Actions** should parse recipes before returning to client:

```typescript
// src/app/actions/recipes.ts
import { parseRecipe, parseRecipes } from '@/lib/types';

export async function getRecipeById(id: string) {
  const recipe = await db.query.recipes.findFirst({
    where: eq(recipes.id, id),
  });

  if (!recipe) return null;

  // Parse before returning
  return parseRecipe(recipe);
}

export async function getUserRecipes(userId: string) {
  const recipeList = await db.query.recipes.findMany({
    where: eq(recipes.user_id, userId),
  });

  // Parse all recipes
  return parseRecipes(recipeList);
}
```

## Type Utilities Reference

### Core Parsing Functions

Located in `src/lib/types/index.ts`:

```typescript
import {
  parseRecipe,      // Parse single recipe
  parseRecipes,     // Parse recipe array
  parseChef,        // Parse single chef
  parseChefs,       // Parse chef array
  type ParsedRecipe,
  type ParsedChef,
} from '@/lib/types';
```

### Helper Parsing Functions

Located in `src/lib/types/parsers.ts`:

```typescript
import {
  parseRecipeTags,          // Parse tags JSON
  parseRecipeImages,        // Parse images JSON
  parseRecipeIngredients,   // Parse ingredients JSON
  parseRecipeInstructions,  // Parse instructions JSON
  parseNutritionInfo,       // Parse nutrition info
  parseSocialLinks,         // Parse social links
  getRecipeDisplayImage,    // Get first image or fallback
  getRecipeTotalTime,       // Calculate total time
  isTopRatedRecipe,         // Check if 4.5+ stars
} from '@/lib/types/parsers';
```

## Usage Patterns

### Pattern 1: Component Props

```typescript
import type { ParsedRecipe } from '@/lib/types';

interface RecipeCardProps {
  recipe: ParsedRecipe;  // ✅ Always use ParsedRecipe
  showSimilarity?: boolean;
}

export function RecipeCard({ recipe }: RecipeCardProps) {
  // All JSON fields are already parsed as arrays/objects
  const totalTime = recipe.prep_time + recipe.cook_time;

  return (
    <div>
      {recipe.images.map(img => <img src={img} />)}
      {recipe.tags.map(tag => <Badge>{tag}</Badge>)}
    </div>
  );
}
```

### Pattern 2: Server Actions

```typescript
import { parseRecipe, serializeRecipe } from '@/lib/types';
import type { Recipe } from '@/lib/db/schema';

export async function updateRecipe(id: string, data: Partial<ParsedRecipe>) {
  // Serialize before database write
  const serialized = serializeRecipe(data);

  const updated = await db
    .update(recipes)
    .set(serialized)
    .where(eq(recipes.id, id))
    .returning();

  // Parse before returning
  return parseRecipe(updated[0]);
}
```

### Pattern 3: Form Handling

```typescript
import { serializeArray } from '@/lib/types/parsers';

export async function createRecipe(formData: FormData) {
  const tags = formData.getAll('tags'); // string[]

  await db.insert(recipes).values({
    name: formData.get('name'),
    tags: serializeArray(tags),  // Convert to JSON string
    images: serializeArray(formData.getAll('images')),
  });
}
```

## Type Safety Checklist

When working with recipes or chefs:

- [ ] Use `ParsedRecipe` or `ParsedChef` types in component props
- [ ] Parse at the data boundary (server actions, API routes)
- [ ] Never manually call `JSON.parse()` on database fields
- [ ] Use type utilities from `src/lib/types/`
- [ ] Serialize before writing to database
- [ ] Handle null/undefined gracefully (parsers do this automatically)

## Common Mistakes

### ❌ Mistake 1: Using Raw Database Type

```typescript
import type { Recipe } from '@/lib/db/schema';

function RecipeCard({ recipe }: { recipe: Recipe }) {
  // ❌ Type error! recipe.tags is string | null
  return <div>{recipe.tags.map(tag => <Badge>{tag}</Badge>)}</div>;
}
```

**Fix**: Use `ParsedRecipe`

```typescript
import type { ParsedRecipe } from '@/lib/types';

function RecipeCard({ recipe }: { recipe: ParsedRecipe }) {
  // ✅ Works! recipe.tags is string[]
  return <div>{recipe.tags.map(tag => <Badge>{tag}</Badge>)}</div>;
}
```

### ❌ Mistake 2: Manual JSON Parsing

```typescript
function RecipeCard({ recipe }: { recipe: Recipe }) {
  // ❌ Unsafe! What if tags is null? What if it's malformed JSON?
  const tags = JSON.parse(recipe.tags);
  return <div>{tags.map(tag => <Badge>{tag}</Badge>)}</div>;
}
```

**Fix**: Use parsing utilities

```typescript
import { parseRecipeTags } from '@/lib/types/parsers';

function RecipeCard({ recipe }: { recipe: Recipe }) {
  // ✅ Safe! Handles null/undefined, returns [] on error
  const tags = parseRecipeTags(recipe.tags);
  return <div>{tags.map(tag => <Badge>{tag}</Badge>)}</div>;
}
```

### ❌ Mistake 3: Forgetting to Parse in Server Actions

```typescript
export async function getRecipe(id: string) {
  const recipe = await db.query.recipes.findFirst({
    where: eq(recipes.id, id),
  });

  // ❌ Returns Recipe (string fields), not ParsedRecipe
  return recipe;
}
```

**Fix**: Parse before returning

```typescript
import { parseRecipe } from '@/lib/types';

export async function getRecipe(id: string) {
  const recipe = await db.query.recipes.findFirst({
    where: eq(recipes.id, id),
  });

  // ✅ Returns ParsedRecipe (array fields)
  return recipe ? parseRecipe(recipe) : null;
}
```

## Type Testing

Run TypeScript type checking:

```bash
pnpm tsc --noEmit
```

Expected: No type errors.

## Migration Guide

If you have existing code using manual JSON parsing:

### Step 1: Update Server Actions

```typescript
// Before
export async function getRecipes() {
  return await db.query.recipes.findMany();
}

// After
import { parseRecipes } from '@/lib/types';

export async function getRecipes() {
  const recipes = await db.query.recipes.findMany();
  return parseRecipes(recipes);
}
```

### Step 2: Update Component Props

```typescript
// Before
import type { Recipe } from '@/lib/db/schema';
function RecipeCard({ recipe }: { recipe: Recipe }) {
  const tags = recipe.tags ? JSON.parse(recipe.tags) : [];
  // ...
}

// After
import type { ParsedRecipe } from '@/lib/types';
function RecipeCard({ recipe }: { recipe: ParsedRecipe }) {
  const tags = recipe.tags; // Already parsed!
  // ...
}
```

### Step 3: Remove Manual Parsing

Search for manual JSON.parse calls:

```bash
grep -r "JSON.parse.*recipe" src/
```

Replace with type utilities or `ParsedRecipe` types.

## Best Practices

1. **Parse at the Boundary**: Parse as soon as data leaves the database
2. **Type at the Interface**: Use `ParsedRecipe` in all component props
3. **Serialize on Write**: Use `serializeRecipe()` before database writes
4. **Never Trust JSON**: Always use safe parsers (never raw `JSON.parse()`)
5. **Single Source of Truth**: Import types from `src/lib/types/`

## Related Documentation

- [Database Schema](../../src/lib/db/schema.ts)
- [Type Utilities](../../src/lib/types/index.ts)
- [Parser Utilities](../../src/lib/types/parsers.ts)
- [Type Matching Quick Reference](../reference/TYPE_MATCHING.md)

## Support

If you encounter type errors:

1. Check if you're using `ParsedRecipe` vs `Recipe`
2. Verify parsing happens in server actions
3. Run `pnpm tsc --noEmit` to see full error details
4. Consult this guide's "Common Mistakes" section
