# Database Type Transformation Layer

## Overview

This layer provides type-safe transformations between PostgreSQL/Drizzle database types and frontend-ready TypeScript types.

### The Problem

PostgreSQL returns certain types differently than what TypeScript components expect:

| Database Type | Drizzle Returns | Frontend Expects | Issue |
|---------------|----------------|------------------|-------|
| `NUMERIC/DECIMAL` | `string` | `number` | Type mismatch causes runtime errors |
| `TEXT` (JSON) | `string` | `object[]` or `string[]` | Need JSON parsing |
| `JSONB` | `any` | Typed objects | Need type safety |

### The Solution

Type transformers that convert database types to frontend types:

```typescript
// ❌ Before (Type Errors)
const recipe = await db.query.recipes.findFirst({ where: eq(recipes.id, id) });
const rating = recipe.system_rating * 2;  // Error: can't multiply string
recipe.images.map(img => ...)              // Error: string is not an array

// ✅ After (Type Safe)
import { parseRecipe } from '@/lib/db';
const rawRecipe = await db.query.recipes.findFirst({ where: eq(recipes.id, id) });
const recipe = parseRecipe(rawRecipe);
const rating = recipe.system_rating * 2;  // ✓ number * number
recipe.images.map(img => ...)              // ✓ string[] is iterable
```

## Files

### `transformers.ts`
Core transformation functions and parsed type definitions.

**Exported Functions:**
- `parseDecimal(value)` - Convert NUMERIC/DECIMAL string → number
- `parseInteger(value)` - Convert integer string → number
- `parseJsonField<T>(value, default)` - Parse JSON text → typed value
- `parseJsonArray(value)` - Parse JSON text → string[]
- `parseRecipe(recipe)` - Transform Recipe → ParsedRecipe
- `parseMeal(meal)` - Transform Meal → ParsedMeal
- `parseChef(chef)` - Transform Chef → ParsedChef
- `parseIngredient(ingredient)` - Transform Ingredient → ParsedIngredient
- `parseTool(tool)` - Transform Tool → ParsedTool
- `parseInventoryItem(item)` - Transform InventoryItem → ParsedInventoryItem
- `parseRecipes(recipes[])` - Batch transform recipes
- `parseMeals(meals[])` - Batch transform meals
- `parseChefs(chefs[])` - Batch transform chefs
- `parseIngredients(ingredients[])` - Batch transform ingredients
- `parseTools(tools[])` - Batch transform tools
- `parseInventoryItems(items[])` - Batch transform inventory items

**Exported Types:**
- `ParsedRecipe` - Frontend-ready recipe type
- `ParsedMeal` - Frontend-ready meal type
- `ParsedChef` - Frontend-ready chef type
- `ParsedIngredient` - Frontend-ready ingredient type
- `ParsedTool` - Frontend-ready tool type
- `ParsedInventoryItem` - Frontend-ready inventory item type
- `ParsedIngredientEntry` - Recipe ingredient structure
- `ParsedNutrition` - Recipe nutrition structure

### `transformed-types.ts`
Re-exports transformers with type guards and usage examples.

**Type Guards:**
- `isParsedRecipe(value)` - Runtime check if recipe is parsed
- `isParsedMeal(value)` - Runtime check if meal is parsed
- `isParsedChef(value)` - Runtime check if chef is parsed
- `isParsedIngredient(value)` - Runtime check if ingredient is parsed

### `index.ts`
Barrel export for convenient imports.

## Usage Examples

### API Routes (Backend)

```typescript
import { parseRecipe, parseRecipes, type ParsedRecipe } from '@/lib/db';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Single recipe
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const rawRecipe = await db.query.recipes.findFirst({
    where: eq(recipes.id, params.id)
  });

  if (!rawRecipe) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const recipe = parseRecipe(rawRecipe);
  return NextResponse.json({ recipe });
}

// Multiple recipes
export async function GET(request: Request) {
  const rawRecipes = await db.query.recipes.findMany({
    where: eq(recipes.is_public, true),
    limit: 20
  });

  const recipes = parseRecipes(rawRecipes);
  return NextResponse.json({ recipes });
}
```

### Service Layer

```typescript
import { parseRecipe, type ParsedRecipe } from '@/lib/db';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export class RecipeService {
  /**
   * Get recipe by ID with frontend-ready types
   */
  async findById(id: string): Promise<ParsedRecipe | null> {
    const rawRecipe = await db.query.recipes.findFirst({
      where: eq(recipes.id, id)
    });

    return rawRecipe ? parseRecipe(rawRecipe) : null;
  }

  /**
   * Get all public recipes
   */
  async findPublic(): Promise<ParsedRecipe[]> {
    const rawRecipes = await db.query.recipes.findMany({
      where: eq(recipes.is_public, true)
    });

    return parseRecipes(rawRecipes);
  }
}
```

### React Components (Frontend)

```typescript
import type { ParsedRecipe } from '@/lib/db';

interface RecipeCardProps {
  recipe: ParsedRecipe;  // Use ParsedRecipe, not Recipe
}

export function RecipeCard({ recipe }: RecipeCardProps) {
  return (
    <div className="recipe-card">
      <h2>{recipe.name}</h2>

      {/* Images - now string[] instead of string */}
      <div className="images">
        {recipe.images.map((img, i) => (
          <img key={i} src={img} alt={`${recipe.name} ${i + 1}`} />
        ))}
      </div>

      {/* Rating - now number instead of string */}
      {recipe.system_rating && (
        <div className="rating">
          {recipe.system_rating.toFixed(1)} ⭐
        </div>
      )}

      {/* Tags - now string[] instead of string */}
      <div className="tags">
        {recipe.tags.map(tag => (
          <span key={tag} className="tag">{tag}</span>
        ))}
      </div>

      {/* Nutrition - now ParsedNutrition instead of string */}
      {recipe.nutrition_info && (
        <div className="nutrition">
          <p>Calories: {recipe.nutrition_info.calories}</p>
          <p>Protein: {recipe.nutrition_info.protein}g</p>
        </div>
      )}
    </div>
  );
}
```

### Server Actions

```typescript
'use server';

import { parseRecipe, type ParsedRecipe } from '@/lib/db';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@clerk/nextjs/server';

export async function getRecipeById(id: string): Promise<ParsedRecipe | null> {
  const { userId } = await auth();

  if (!userId) {
    throw new Error('Unauthorized');
  }

  const rawRecipe = await db.query.recipes.findFirst({
    where: eq(recipes.id, id)
  });

  return rawRecipe ? parseRecipe(rawRecipe) : null;
}
```

## Type Conversion Reference

### Recipe Fields

| Field | DB Type | Raw Type | Parsed Type |
|-------|---------|----------|-------------|
| `confidence_score` | NUMERIC | `string \| null` | `number \| null` |
| `system_rating` | NUMERIC | `string \| null` | `number \| null` |
| `avg_user_rating` | NUMERIC | `string \| null` | `number \| null` |
| `images` | TEXT (JSON) | `string \| null` | `string[]` |
| `ingredients` | TEXT (JSON) | `string` | `ParsedIngredientEntry[]` |
| `nutrition_info` | TEXT (JSON) | `string \| null` | `ParsedNutrition \| null` |
| `tags` | TEXT (JSON) | `string \| null` | `string[]` |
| `dominant_textures` | TEXT (JSON) | `string \| null` | `string[]` |
| `dominant_flavors` | TEXT (JSON) | `string \| null` | `string[]` |
| `waste_reduction_tags` | TEXT (JSON) | `string \| null` | `string[]` |

### Meal Fields

| Field | DB Type | Raw Type | Parsed Type |
|-------|---------|----------|-------------|
| `estimated_total_cost` | NUMERIC | `string \| null` | `number \| null` |
| `estimated_cost_per_serving` | NUMERIC | `string \| null` | `number \| null` |
| `price_estimation_confidence` | NUMERIC | `string \| null` | `number \| null` |
| `tags` | TEXT (JSON) | `string \| null` | `string[]` |

### Chef Fields

| Field | DB Type | Raw Type | Parsed Type |
|-------|---------|----------|-------------|
| `latitude` | NUMERIC | `string \| null` | `number \| null` |
| `longitude` | NUMERIC | `string \| null` | `number \| null` |
| `social_links` | JSONB | `any` | `unknown \| null` |

### Ingredient Fields

| Field | DB Type | Raw Type | Parsed Type |
|-------|---------|----------|-------------|
| `aliases` | TEXT (JSON) | `string \| null` | `string[]` |
| `common_units` | TEXT (JSON) | `string \| null` | `string[]` |
| `substitutions` | TEXT (JSON) | `string \| null` | `string[]` |

### Tool Fields

| Field | DB Type | Raw Type | Parsed Type |
|-------|---------|----------|-------------|
| `typical_price_usd` | NUMERIC | `string \| null` | `number \| null` |
| `alternatives` | TEXT (JSON) | `string \| null` | `string[]` |

### Inventory Item Fields

| Field | DB Type | Raw Type | Parsed Type |
|-------|---------|----------|-------------|
| `quantity` | NUMERIC | `string` | `number` (defaults to 0 if null) |
| `cost_usd` | NUMERIC | `string \| null` | `number \| null` |

## Error Handling

All transformers handle invalid data gracefully:

```typescript
// Decimal parsing
parseDecimal('invalid')  // → null
parseDecimal(null)       // → null
parseDecimal('3.14')     // → 3.14

// JSON parsing
parseJsonArray('invalid')         // → []
parseJsonArray(null)              // → []
parseJsonArray('["a","b"]')       // → ['a', 'b']

// JSON objects with defaults
parseJsonField('invalid', {})     // → {}
parseJsonField(null, { key: 1 })  // → { key: 1 }
parseJsonField('{"a":1}', {})     // → { a: 1 }
```

## Testing

Tests are located in `__tests__/transformers.test.ts`.

Run tests:
```bash
npm test src/lib/db/__tests__/transformers.test.ts
```

Test coverage includes:
- ✓ Decimal parsing (valid and invalid inputs)
- ✓ Integer parsing (strings and numbers)
- ✓ JSON field parsing (objects, arrays, primitives)
- ✓ JSON array parsing (valid and malformed)
- ✓ Recipe transformation (all field types)
- ✓ Meal transformation
- ✓ Chef transformation
- ✓ Ingredient transformation
- ✓ Tool transformation
- ✓ Inventory item transformation
- ✓ Null/undefined handling
- ✓ Default value fallbacks

## When to Use

### ✅ Always Use Transformers

- **API Responses**: Before returning data to frontend
- **Server Actions**: Before returning data to React components
- **Service Layer**: When returning data to calling code
- **Components**: Accept parsed types in props

### ❌ Don't Use Transformers

- **Database Writes**: Use raw types when inserting/updating
- **Internal DB Queries**: Transform only at API boundaries
- **Migrations**: Work with raw schema types

## Migration Guide

### Before (Type Errors)

```typescript
// ❌ Component expects number, gets string
interface Props {
  rating: number;  // Type says number
}

const recipe = await db.query.recipes.findFirst(...);
<Component rating={recipe.system_rating} />  // Runtime: string passed to number
```

### After (Type Safe)

```typescript
// ✅ Transform at API boundary
interface Props {
  rating: number;
}

const rawRecipe = await db.query.recipes.findFirst(...);
const recipe = parseRecipe(rawRecipe);
<Component rating={recipe.system_rating} />  // ✓ number passed to number
```

## Performance Considerations

- **Lazy Parsing**: Only transform data when needed
- **Batch Operations**: Use `parseRecipes()` for multiple records
- **Caching**: Consider caching parsed results for frequently accessed data
- **JSON Parsing**: Parse once at API boundary, not per-component

## Future Enhancements

- [ ] Zod schema integration for runtime validation
- [ ] Automatic transformation at ORM query level
- [ ] Performance profiling and optimization
- [ ] Additional entity transformers (collections, social, etc.)
- [ ] Transformer middleware for API routes

## Contributing

When adding new database fields:

1. Check if field type needs transformation (NUMERIC → number, TEXT → JSON)
2. Add transformation in appropriate transformer function
3. Update `ParsedX` type interface
4. Add test cases in `__tests__/transformers.test.ts`
5. Update this README with new field mappings

## Related Documentation

- [Database Schema](./schema.ts) - Raw database schema definitions
- [API Documentation](../../app/api/v1/README.md) - API endpoint specifications
- [Service Layer](../services/README.md) - Business logic layer
