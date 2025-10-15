# Recipe Manager - Code Style Patterns

## Import Organization
```typescript
// 1. External packages
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';

// 2. Internal libraries/utilities
import { db } from '@/lib/db';
import { cn } from '@/lib/utils';

// 3. Components
import { Button } from '@/components/ui/button';
import { RecipeCard } from '@/components/recipe/RecipeCard';

// 4. Types
import type { Recipe } from '@/lib/db/schema';

// 5. Relative imports
import { helper } from './helper';
```

## TypeScript Patterns

### Prefer Type Inference
```typescript
// Good - inferred from Drizzle schema
export type Recipe = typeof recipes.$inferSelect;
export type NewRecipe = typeof recipes.$inferInsert;

// Avoid - manual type definition that can drift
type Recipe = {
  id: string;
  name: string;
  // ...
};
```

### Zod Schemas from Drizzle
```typescript
// Generated from Drizzle schema
export const insertRecipeSchema = createInsertSchema(recipes);
export const selectRecipeSchema = createSelectSchema(recipes);

// Extend with custom validation
export const recipeFormSchema = insertRecipeSchema.extend({
  ingredients: z.array(z.string()).min(1, 'At least one ingredient required'),
});
```

## Server Action Pattern
```typescript
'use server';

import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function createRecipe(data: NewRecipe) {
  // 1. Authenticate
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  // 2. Validate input
  const validated = insertRecipeSchema.parse(data);

  // 3. Execute database operation
  const [recipe] = await db.insert(recipes).values({
    ...validated,
    userId,
  }).returning();

  // 4. Revalidate cache
  revalidatePath('/recipes');

  // 5. Return result
  return recipe;
}
```

## Component Patterns

### shadcn/ui Component Usage
```typescript
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// Consistent with shadcn patterns
<Button variant="default" size="lg">
  Generate Recipe
</Button>
```

### Form with React Hook Form + Zod
```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const form = useForm({
  resolver: zodResolver(recipeFormSchema),
  defaultValues: {
    name: '',
    ingredients: [],
  },
});
```

## Database Query Patterns

### User-Scoped Queries
```typescript
// Always filter by userId
const recipes = await db.query.recipes.findMany({
  where: eq(recipes.userId, userId),
});
```

### Transactions
```typescript
await db.transaction(async (tx) => {
  await tx.insert(recipes).values(newRecipe);
  await tx.insert(mealPlanRecipes).values(mealPlanLink);
});
```

## Error Handling Pattern
```typescript
try {
  const result = await serverAction();
  toast.success('Recipe created successfully');
  return result;
} catch (error) {
  console.error('Failed to create recipe:', error);
  toast.error('Failed to create recipe. Please try again.');
  throw error;
}
```

## Naming Conventions
- **Variables/Functions**: camelCase (`getUserRecipes`)
- **Components**: PascalCase (`RecipeCard`)
- **Types/Interfaces**: PascalCase (`Recipe`, `NewRecipe`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_IMAGES`)
- **Files**: kebab-case (`recipe-card.tsx`, `user-profile.tsx`)

## Async/Await Best Practices
```typescript
// Prefer async/await over Promise chains
const recipe = await getRecipe(id);
const ingredients = await getIngredients(recipe.id);

// Use Promise.all for parallel operations
const [recipe, mealPlans, shoppingLists] = await Promise.all([
  getRecipe(id),
  getMealPlans(userId),
  getShoppingLists(userId),
]);
```
