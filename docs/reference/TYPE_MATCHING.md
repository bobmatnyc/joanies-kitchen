# Type Matching Quick Reference

**Last Updated**: 2025-10-16

## Quick Lookup: Database vs Frontend Types

### Recipe Fields

| Database Field | Database Type | Frontend Type | Parser |
|---------------|---------------|---------------|--------|
| `tags` | `string \| null` | `string[]` | `parseRecipeTags()` |
| `images` | `string \| null` | `string[]` | `parseRecipeImages()` |
| `ingredients` | `string \| null` | `string[]` | `parseRecipeIngredients()` |
| `instructions` | `string \| null` | `string[]` | `parseRecipeInstructions()` |
| `nutrition_info` | `string \| null` | `NutritionInfo \| null` | `parseNutritionInfo()` |
| `prep_time` | `number \| null` | `number \| null` | *(no parsing needed)* |
| `cook_time` | `number \| null` | `number \| null` | *(no parsing needed)* |
| `system_rating` | `string \| null` | `number` | `parseDecimal()` |
| `avg_user_rating` | `string \| null` | `number` | `parseDecimal()` |

### Chef Fields

| Database Field | Database Type | Frontend Type | Parser |
|---------------|---------------|---------------|--------|
| `social_links` | `jsonb \| null` | `SocialLinks` | `parseSocialLinks()` |
| `specialties` | `text[]` | `string[]` | *(already array)* |

## Common Patterns

### Pattern: Component Props

```typescript
// ✅ CORRECT
import type { ParsedRecipe } from '@/lib/types';
function RecipeCard({ recipe }: { recipe: ParsedRecipe }) { }

// ❌ WRONG
import type { Recipe } from '@/lib/db/schema';
function RecipeCard({ recipe }: { recipe: Recipe }) { }
```

### Pattern: Server Actions

```typescript
// ✅ CORRECT
import { parseRecipe } from '@/lib/types';
export async function getRecipe(id: string) {
  const recipe = await db.query.recipes.findFirst({ where: eq(recipes.id, id) });
  return recipe ? parseRecipe(recipe) : null;
}

// ❌ WRONG
export async function getRecipe(id: string) {
  return await db.query.recipes.findFirst({ where: eq(recipes.id, id) });
}
```

### Pattern: Individual Field Parsing

```typescript
// ✅ CORRECT
import { parseRecipeTags } from '@/lib/types/parsers';
const tags = parseRecipeTags(recipe.tags); // string[]

// ❌ WRONG
const tags = recipe.tags ? JSON.parse(recipe.tags) : []; // Unsafe!
```

## Import Cheatsheet

```typescript
// Main types and parsers
import {
  parseRecipe,
  parseRecipes,
  parseChef,
  parseChefs,
  serializeRecipe,
  serializeChef,
  type ParsedRecipe,
  type ParsedChef,
  type Recipe,
  type Chef,
} from '@/lib/types';

// Utility parsers
import {
  parseRecipeTags,
  parseRecipeImages,
  parseRecipeIngredients,
  parseRecipeInstructions,
  parseNutritionInfo,
  parseSocialLinks,
  getRecipeDisplayImage,
  getRecipeTotalTime,
  isTopRatedRecipe,
  parseDecimal,
  serializeArray,
  serializeObject,
} from '@/lib/types/parsers';
```

## Quick Fixes

### Fix 1: Type Error in Component

```typescript
// ERROR: Property 'map' does not exist on type 'string | null'
{recipe.tags.map(tag => <Badge>{tag}</Badge>)}

// FIX: Change prop type to ParsedRecipe
import type { ParsedRecipe } from '@/lib/types';
function RecipeCard({ recipe }: { recipe: ParsedRecipe }) {
  return <div>{recipe.tags.map(tag => <Badge key={tag}>{tag}</Badge>)}</div>;
}
```

### Fix 2: Server Action Not Parsing

```typescript
// PROBLEM: Components receive Recipe (string fields) instead of ParsedRecipe
export async function getRecipes() {
  return await db.query.recipes.findMany();
}

// FIX: Parse before returning
import { parseRecipes } from '@/lib/types';
export async function getRecipes() {
  const recipes = await db.query.recipes.findMany();
  return parseRecipes(recipes);
}
```

### Fix 3: Manual JSON Parsing

```typescript
// BEFORE: Unsafe manual parsing
const tags = recipe.tags ? JSON.parse(recipe.tags) : [];
const images = recipe.images ? JSON.parse(recipe.images) : [];

// AFTER: Use safe parsers
import { parseRecipeTags, parseRecipeImages } from '@/lib/types/parsers';
const tags = parseRecipeTags(recipe.tags);
const images = parseRecipeImages(recipe.images);
```

## Type Validation

### Check Types

```bash
# Check all TypeScript types
pnpm tsc --noEmit

# Check specific file
pnpm tsc --noEmit src/components/recipe/RecipeCard.tsx
```

### Find Manual Parsing

```bash
# Find all JSON.parse calls on recipe fields
grep -r "JSON.parse.*recipe" src/

# Find all JSON.parse calls on chef fields
grep -r "JSON.parse.*chef" src/
```

## Zero-Config Usage

Most components should just work with `ParsedRecipe`:

```typescript
import type { ParsedRecipe } from '@/lib/types';

export function RecipeCard({ recipe }: { recipe: ParsedRecipe }) {
  // All fields are correctly typed, no parsing needed!
  const totalTime = (recipe.prep_time || 0) + (recipe.cook_time || 0);
  const firstImage = recipe.images[0] || recipe.image_url;
  const tagList = recipe.tags.slice(0, 5);

  return (
    <Card>
      <img src={firstImage} alt={recipe.name} />
      <h3>{recipe.name}</h3>
      <p>Time: {totalTime} min</p>
      {tagList.map(tag => <Badge key={tag}>{tag}</Badge>)}
    </Card>
  );
}
```

No `JSON.parse()`, no type assertions, no null checks - just clean, type-safe code.

## Related Docs

- [Full Type Safety Guide](../guides/TYPE_SAFETY.md)
- [Database Schema](../../src/lib/db/schema.ts)
- [Type Utilities Source](../../src/lib/types/index.ts)
