# Ingredients Schema Documentation

## Overview

The ingredients schema provides a **normalized database structure** for managing ingredients in the Recipe Manager application. This replaces the previous approach of storing ingredients as JSON arrays in the recipes table.

## Benefits of Normalization

### Before (JSON Array in Recipes)
```json
{
  "ingredients": [
    "2 cups chopped onions",
    "1/2 teaspoon salt",
    "3-4 cloves garlic, minced"
  ]
}
```

**Problems:**
- ❌ No standardization (same ingredient spelled different ways)
- ❌ Difficult to search recipes by ingredient
- ❌ No autocomplete support
- ❌ Can't track ingredient popularity
- ❌ No allergen detection
- ❌ Hard to generate shopping lists

### After (Normalized Schema)
```sql
-- Ingredients table (master list)
id: uuid
name: "green onion" (normalized)
display_name: "Green Onion"
category: "vegetables"
aliases: ["scallion", "spring onion"]

-- RecipeIngredients join table
recipe_id: "recipe-123"
ingredient_id: "ingredient-456"
amount: "2"
unit: "cups"
preparation: "chopped"
```

**Benefits:**
- ✅ Standardized ingredient names
- ✅ Fast ingredient-based search
- ✅ Smart autocomplete
- ✅ Ingredient popularity tracking
- ✅ Allergen detection
- ✅ Accurate shopping list aggregation
- ✅ Support for ingredient substitutions

## Database Schema

### 1. Ingredients Table

Master list of all ingredients with metadata.

```typescript
{
  id: uuid                    // Primary key
  name: text                  // Normalized lowercase name (unique)
  display_name: text          // Properly capitalized display name
  category: varchar(50)       // Category (vegetables, proteins, etc.)
  common_units: text          // JSON array of common measurement units
  aliases: text               // JSON array of alternative names
  is_common: boolean          // Frequently used ingredient flag
  is_allergen: boolean        // Common allergen flag
  typical_unit: varchar(20)   // Most commonly used unit
  created_at: timestamp
  updated_at: timestamp
}
```

**Example:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "green onion",
  "display_name": "Green Onion",
  "category": "vegetables",
  "common_units": "[\"bunch\", \"cup\", \"tablespoon\", \"piece\"]",
  "aliases": "[\"scallion\", \"spring onion\"]",
  "is_common": true,
  "is_allergen": false,
  "typical_unit": "bunch"
}
```

### 2. Recipe Ingredients Join Table

Many-to-many relationship between recipes and ingredients with rich metadata.

```typescript
{
  id: uuid                      // Primary key
  recipe_id: text               // Foreign key to recipes.id (cascade delete)
  ingredient_id: uuid           // Foreign key to ingredients.id (cascade delete)
  amount: varchar(50)           // Quantity (e.g., "2", "1/2", "1-2")
  unit: varchar(50)             // Measurement unit (e.g., "cups", "tablespoons")
  preparation: varchar(200)     // Preparation method (e.g., "chopped", "minced")
  is_optional: boolean          // Optional ingredient flag
  position: integer             // Order in recipe (0-based)
  ingredient_group: varchar(100) // Section name (e.g., "For the sauce")
  created_at: timestamp
}
```

**Example:**
```json
{
  "id": "660e8400-e29b-41d4-a716-446655440111",
  "recipe_id": "recipe-123",
  "ingredient_id": "550e8400-e29b-41d4-a716-446655440000",
  "amount": "2",
  "unit": "bunches",
  "preparation": "chopped",
  "is_optional": false,
  "position": 3,
  "ingredient_group": null
}
```

### 3. Ingredient Statistics Table

Denormalized statistics for performance optimization (optional, populated asynchronously).

```typescript
{
  id: uuid                    // Primary key
  ingredient_id: uuid         // Foreign key to ingredients.id (unique)
  total_recipes: integer      // Total recipes using this ingredient
  public_recipes: integer     // Public recipes count
  system_recipes: integer     // System/curated recipes count
  popularity_score: integer   // Calculated popularity score
  trending_score: integer     // Recent usage trend score
  last_calculated: timestamp  // When statistics were last updated
  updated_at: timestamp
}
```

## Categories

Standard ingredient categories:

- `vegetables` - Onions, carrots, peppers, etc.
- `fruits` - Apples, berries, citrus, etc.
- `proteins` - Chicken, beef, tofu, etc.
- `seafood` - Fish, shellfish, etc.
- `dairy` - Milk, cheese, butter, etc.
- `grains` - Rice, quinoa, oats, etc.
- `pasta` - Spaghetti, noodles, etc.
- `legumes` - Beans, lentils, chickpeas, etc.
- `nuts` - Almonds, walnuts, etc.
- `herbs` - Basil, cilantro, parsley, etc.
- `spices` - Pepper, cumin, paprika, etc.
- `condiments` - Soy sauce, ketchup, vinegar, etc.
- `oils` - Olive oil, vegetable oil, etc.
- `sweeteners` - Sugar, honey, maple syrup, etc.
- `baking` - Flour, baking powder, yeast, etc.
- `beverages` - Water, stock, wine, etc.
- `meat` - Beef, pork, lamb, etc.
- `poultry` - Chicken, turkey, duck, etc.
- `other` - Miscellaneous items

## Indexes

### Performance Indexes

1. **Name Indexes**
   - `ingredients_name_idx` - Exact name lookup (B-tree)
   - `ingredients_name_lower_idx` - Case-insensitive search (B-tree on LOWER(name))
   - `ingredients_name_trgm_idx` - Fuzzy search (GIN trigram)
   - `ingredients_display_name_trgm_idx` - Fuzzy display name search (GIN trigram)

2. **Category and Filter Indexes**
   - `ingredients_category_idx` - Filter by category
   - `ingredients_common_idx` - Common ingredients (composite on is_common, name)
   - `ingredients_allergen_idx` - Allergen filtering

3. **Recipe Ingredients Indexes**
   - `recipe_ingredients_recipe_id_idx` - Get all ingredients for a recipe
   - `recipe_ingredients_ingredient_id_idx` - Find recipes using an ingredient
   - `recipe_ingredients_position_idx` - Ordered ingredient list
   - `recipe_ingredients_optional_idx` - Filter optional ingredients
   - `recipe_ingredients_group_idx` - Group by section

### Fuzzy Search (Trigram Indexes)

The schema includes **trigram indexes** for fuzzy ingredient search using PostgreSQL's `pg_trgm` extension.

**Required PostgreSQL Extension:**
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

**Usage Example:**
```sql
-- Find ingredients similar to "onin" (typo for "onion")
SELECT * FROM ingredients
WHERE name % 'onin'
ORDER BY similarity(name, 'onin') DESC
LIMIT 10;
```

## Migration

### Applying the Migration

```bash
# Generate migration
pnpm db:generate

# Apply migration
pnpm db:push

# Or manually run the migration
psql $DATABASE_URL -f drizzle/0008_common_oracle.sql
```

### Enable Trigram Extension

**Important:** You must enable the `pg_trgm` extension in your PostgreSQL database:

```sql
-- Run this in your PostgreSQL database
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

For Neon PostgreSQL, this can be done via:
- Neon Console → Database → Extensions
- Or via SQL query in the SQL Editor

## Usage Examples

### 1. Creating an Ingredient

```typescript
import { db } from '@/lib/db';
import { ingredients } from '@/lib/db/ingredients-schema';
import { normalizeIngredientName, createDisplayName, suggestCategory } from '@/lib/utils/ingredient-parser';

const name = "Green Onion";
const normalized = normalizeIngredientName(name); // "green onion"
const displayName = createDisplayName(normalized); // "Green Onion"
const category = suggestCategory(normalized); // "vegetables"

const newIngredient = await db.insert(ingredients).values({
  name: normalized,
  display_name: displayName,
  category: category,
  common_units: JSON.stringify(['bunch', 'cup', 'tablespoon']),
  aliases: JSON.stringify(['scallion', 'spring onion']),
  is_common: true,
  is_allergen: false
}).returning();
```

### 2. Parsing Ingredient Strings

```typescript
import { parseIngredientString } from '@/lib/utils/ingredient-parser';

const parsed = parseIngredientString("2 cups chopped onions");
// Result:
// {
//   amount: "2",
//   unit: "cups",
//   ingredient: "onions",
//   preparation: "chopped",
//   isOptional: false
// }
```

### 3. Adding Ingredients to a Recipe

```typescript
import { db } from '@/lib/db';
import { recipeIngredients, ingredients } from '@/lib/db/ingredients-schema';

// Find or create ingredient
const [ingredient] = await db
  .select()
  .from(ingredients)
  .where(eq(ingredients.name, 'onion'))
  .limit(1);

// Add to recipe
await db.insert(recipeIngredients).values({
  recipe_id: 'recipe-123',
  ingredient_id: ingredient.id,
  amount: '2',
  unit: 'cups',
  preparation: 'chopped',
  is_optional: false,
  position: 0
});
```

### 4. Fetching Recipe Ingredients with Details

```typescript
import { db } from '@/lib/db';
import { recipeIngredients, ingredients } from '@/lib/db/ingredients-schema';
import { eq } from 'drizzle-orm';

const recipeIngredientsWithDetails = await db
  .select()
  .from(recipeIngredients)
  .leftJoin(ingredients, eq(recipeIngredients.ingredient_id, ingredients.id))
  .where(eq(recipeIngredients.recipe_id, 'recipe-123'))
  .orderBy(recipeIngredients.position);
```

### 5. Fuzzy Ingredient Search

```typescript
import { db } from '@/lib/db';
import { ingredients } from '@/lib/db/ingredients-schema';
import { sql } from 'drizzle-orm';

// Search for ingredients similar to user input
const searchTerm = 'onin'; // User typo

const results = await db
  .select()
  .from(ingredients)
  .where(sql`${ingredients.name} % ${searchTerm}`)
  .orderBy(sql`similarity(${ingredients.name}, ${searchTerm}) DESC`)
  .limit(10);
```

### 6. Finding Recipes by Ingredient

```typescript
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { recipeIngredients, ingredients } from '@/lib/db/ingredients-schema';
import { eq } from 'drizzle-orm';

// Find all recipes that use garlic
const recipesWithGarlic = await db
  .select()
  .from(recipes)
  .innerJoin(recipeIngredients, eq(recipes.id, recipeIngredients.recipe_id))
  .innerJoin(ingredients, eq(recipeIngredients.ingredient_id, ingredients.id))
  .where(eq(ingredients.name, 'garlic'));
```

## Migration Strategy

### Phase 1: Add New Schema (✅ Completed)
- Create ingredients tables
- Add indexes
- Deploy schema changes

### Phase 2: Migrate Existing Data (Next Step)
1. Extract ingredients from existing recipes JSON field
2. Normalize ingredient names
3. Populate ingredients table (deduplicated)
4. Create recipe_ingredients records
5. Validate data integrity

### Phase 3: Update Application Code
1. Update recipe creation to use normalized ingredients
2. Add ingredient autocomplete
3. Update recipe display to fetch from join table
4. Add ingredient-based search
5. Implement allergen detection

### Phase 4: Deprecate JSON Field
1. Mark `recipes.ingredients` as deprecated
2. Maintain both for transition period
3. Eventually drop JSON column (Phase 5)

## Data Migration Script Template

```typescript
// scripts/migrate-ingredients.ts
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { ingredients, recipeIngredients } from '@/lib/db/ingredients-schema';
import { parseIngredientString, normalizeIngredientName, createDisplayName } from '@/lib/utils/ingredient-parser';

async function migrateRecipeIngredients() {
  const allRecipes = await db.select().from(recipes);

  for (const recipe of allRecipes) {
    const ingredientStrings = JSON.parse(recipe.ingredients);

    for (let i = 0; i < ingredientStrings.length; i++) {
      const ingredientString = ingredientStrings[i];
      const parsed = parseIngredientString(ingredientString);

      // Find or create ingredient
      const normalized = normalizeIngredientName(parsed.ingredient);
      let [ingredient] = await db
        .select()
        .from(ingredients)
        .where(eq(ingredients.name, normalized))
        .limit(1);

      if (!ingredient) {
        [ingredient] = await db.insert(ingredients).values({
          name: normalized,
          display_name: createDisplayName(normalized),
          category: suggestCategory(normalized),
          is_common: false
        }).returning();
      }

      // Create recipe ingredient link
      await db.insert(recipeIngredients).values({
        recipe_id: recipe.id,
        ingredient_id: ingredient.id,
        amount: parsed.amount,
        unit: parsed.unit,
        preparation: parsed.preparation,
        is_optional: parsed.isOptional || false,
        position: i
      });
    }
  }
}
```

## Best Practices

### 1. Always Normalize Names
```typescript
// ✅ GOOD
const name = normalizeIngredientName(userInput);

// ❌ BAD
const name = userInput; // May cause duplicates
```

### 2. Use Autocomplete
Provide ingredient suggestions from the master list to avoid duplicates:
```typescript
// Fetch common ingredients for autocomplete
const suggestions = await db
  .select()
  .from(ingredients)
  .where(eq(ingredients.is_common, true))
  .orderBy(ingredients.name)
  .limit(50);
```

### 3. Handle Aliases
When searching, check both name and aliases:
```typescript
const searchResults = await db
  .select()
  .from(ingredients)
  .where(
    or(
      sql`${ingredients.name} % ${searchTerm}`,
      sql`${ingredients.aliases} ILIKE ${`%${searchTerm}%`}`
    )
  );
```

### 4. Group Ingredients in Recipes
Use the `ingredient_group` field for sectioned ingredient lists:
```typescript
await db.insert(recipeIngredients).values([
  { recipe_id, ingredient_id: '...', ingredient_group: 'For the dough', position: 0 },
  { recipe_id, ingredient_id: '...', ingredient_group: 'For the dough', position: 1 },
  { recipe_id, ingredient_id: '...', ingredient_group: 'For the topping', position: 2 },
]);
```

## Future Enhancements

### 1. Ingredient Substitutions
Add a substitutions table:
```sql
CREATE TABLE ingredient_substitutions (
  ingredient_id uuid REFERENCES ingredients(id),
  substitute_id uuid REFERENCES ingredients(id),
  ratio decimal, -- e.g., 1.0 for 1:1 substitution
  notes text
);
```

### 2. Nutritional Data
Extend ingredients with nutritional information:
```sql
ALTER TABLE ingredients
ADD COLUMN calories_per_100g integer,
ADD COLUMN protein_per_100g decimal,
ADD COLUMN fat_per_100g decimal;
```

### 3. Seasonal Availability
Track when ingredients are in season:
```sql
CREATE TABLE ingredient_seasonality (
  ingredient_id uuid REFERENCES ingredients(id),
  region varchar(100),
  months integer[] -- Array of month numbers (1-12)
);
```

## References

- **Schema File**: `src/lib/db/ingredients-schema.ts`
- **Parser Utilities**: `src/lib/utils/ingredient-parser.ts`
- **Migration**: `drizzle/0008_common_oracle.sql`
- **Drizzle Config**: `drizzle.config.ts`

---

**Last Updated**: 2025-10-16
**Schema Version**: 0.8 (Migration 0008)
