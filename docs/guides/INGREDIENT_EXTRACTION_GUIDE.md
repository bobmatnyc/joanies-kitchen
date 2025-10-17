# Ingredient Extraction & Normalization Guide

## Overview

The Ingredient Extraction script (`scripts/extract-ingredients.ts`) processes all recipes in the database to extract and normalize ingredient data into structured database tables. It uses LLM-based parsing (Claude Sonnet 4.5 via OpenRouter) to intelligently extract ingredient names, amounts, units, and preparation methods.

## Purpose

Transforms unstructured ingredient strings like:
```
"2 cups all-purpose flour, sifted"
"1 lb boneless skinless chicken breast, cut into 1-inch pieces"
"3 cloves garlic, minced"
```

Into structured database records:
```sql
-- ingredients table
{ name: "flour", display_name: "All-Purpose Flour", category: "grains", ... }
{ name: "chicken breast", display_name: "Chicken Breast", category: "proteins", ... }
{ name: "garlic", display_name: "Garlic", category: "vegetables", ... }

-- recipe_ingredients table
{ recipe_id: "...", ingredient_id: "...", amount: "2", unit: "cup", preparation: "sifted", position: 0 }
{ recipe_id: "...", ingredient_id: "...", amount: "1", unit: "lb", preparation: "boneless skinless, cut into 1-inch pieces", position: 1 }
{ recipe_id: "...", ingredient_id: "...", amount: "3", unit: "clove", preparation: "minced", position: 2 }
```

## Database Schema

### Tables Created

The script automatically creates two tables if they don't exist:

#### 1. `ingredients` (Master Ingredient List)
```sql
CREATE TABLE ingredients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,              -- Normalized name (lowercase, singular)
  display_name TEXT NOT NULL,             -- Properly capitalized name
  category TEXT NOT NULL,                 -- Category classification
  is_common BOOLEAN DEFAULT false,        -- Used in >50 recipes
  usage_count INTEGER DEFAULT 0,          -- How many recipes use this
  aliases TEXT,                           -- JSON array of alternative names
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Indexes:**
- `idx_ingredients_name` on `name`
- `idx_ingredients_category` on `category`
- `idx_ingredients_is_common` on `is_common`

#### 2. `recipe_ingredients` (Many-to-Many Relationship)
```sql
CREATE TABLE recipe_ingredients (
  id TEXT PRIMARY KEY,
  recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  ingredient_id TEXT NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  amount TEXT,                            -- Quantity (e.g., "2", "1/2", "1-2")
  unit TEXT,                              -- Measurement unit (e.g., "cup", "lb")
  preparation TEXT,                       -- Preparation method (e.g., "chopped")
  position INTEGER,                       -- Order in recipe
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(recipe_id, ingredient_id, position)
);
```

**Indexes:**
- `idx_recipe_ingredients_recipe` on `recipe_id`
- `idx_recipe_ingredients_ingredient` on `ingredient_id`

## Usage

### Basic Usage

```bash
# Dry run (default) - shows what would be extracted without saving
npx tsx scripts/extract-ingredients.ts

# Test on 10 recipes
npx tsx scripts/extract-ingredients.ts --limit=10

# Execute and save to database
npx tsx scripts/extract-ingredients.ts --execute

# Resume from last checkpoint
npx tsx scripts/extract-ingredients.ts --execute --resume
```

### Command-Line Options

| Option | Description |
|--------|-------------|
| `--execute` | Apply changes to database (default is dry-run) |
| `--limit=N` | Process only N recipes (for testing) |
| `--resume` | Resume from last checkpoint |

### Recommended Workflow

1. **Test on sample** (verify extraction quality):
   ```bash
   npx tsx scripts/extract-ingredients.ts --limit=10
   ```

2. **Run larger test** (verify performance):
   ```bash
   npx tsx scripts/extract-ingredients.ts --limit=100
   ```

3. **Full execution** (process all recipes):
   ```bash
   npx tsx scripts/extract-ingredients.ts --execute
   ```

4. **Resume if interrupted**:
   ```bash
   npx tsx scripts/extract-ingredients.ts --execute --resume
   ```

## Features

### 1. LLM-Powered Extraction

Uses Claude Sonnet 4.5 for intelligent ingredient parsing:
- Extracts ingredient name (normalized)
- Identifies amount and unit
- Detects preparation methods
- Classifies into categories
- Handles complex formats (fractions, ranges, descriptive amounts)

### 2. Deduplication & Normalization

- Normalizes ingredient names to singular, lowercase form
- Handles common aliases (e.g., "green onion" = "scallion" = "spring onion")
- Prevents duplicate entries
- Tracks usage count across recipes

### 3. Category Classification

Ingredients are classified into 12 categories:
- `vegetables`
- `fruits`
- `proteins`
- `dairy`
- `grains`
- `spices`
- `herbs`
- `condiments`
- `oils`
- `sweeteners`
- `nuts`
- `other`

### 4. Batch Processing

- Processes 10 recipes at a time
- 1-second delay between batches (rate limiting)
- Progress tracking with ETA estimation
- Automatic checkpoint saving every 50 recipes

### 5. Error Handling & Recovery

- Retry logic with exponential backoff
- Comprehensive error logging
- Checkpoint system for resume capability
- Graceful handling of malformed data

### 6. Progress Tracking

Console output shows:
- Current recipe being processed
- Extraction progress
- Success/failure status
- Performance metrics (recipes/min, ETA)
- Final statistics

### 7. Dry-Run Mode

Default mode that simulates extraction without database writes:
- Test extraction quality
- Verify LLM prompts
- Check for errors
- Estimate runtime and cost

## Performance

### Expected Runtime

For 3,276 recipes:
- **Dry run**: ~1-2 hours (no DB writes)
- **Execute**: ~2-3 hours (with DB writes)

Factors affecting runtime:
- LLM response time (~2-5 seconds per recipe)
- Batch delay (1 second between batches)
- Database write speed
- Network latency

### Cost Estimation

Using Claude Sonnet 4.5 via OpenRouter:
- **Estimated total cost**: $5-10
- **Per recipe**: ~$0.002-0.003
- **Total tokens**: ~10-15M tokens

### Batch Configuration

Can be adjusted in script:
```typescript
const BATCH_SIZE = 10;        // Recipes per batch
const DELAY_MS = 1000;        // Delay between batches (ms)
const CHECKPOINT_INTERVAL = 50; // Save progress every N recipes
```

## Output

### Console Output

```
🧪 Ingredient Extraction & Normalization Script
================================================================================

Mode: EXECUTE (will update database)
Model: anthropic/claude-sonnet-4.5

📊 Checking database schema...
✅ Database schema ready

Recipes to process: 3,276

⚠️  LIVE MODE: Changes will be saved to database!
Starting in 5 seconds... (Ctrl+C to cancel)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Batch 1/328:

[1/3276] Coconut-Clam Stock
  ID: 00130fe9-0155-4885-a3e6-01bb0ba1363c
  📋 Extracting 9 ingredients...
  ✅ Extracted 9 ingredients
  💾 Saved to database

[2/3276] Roasted Strawberry Trifles
  ID: 00149c34-3ef8-4cb7-944e-ab2eff20b7f0
  📋 Extracting 13 ingredients...
  ✅ Extracted 14 ingredients
  💾 Saved to database

...

⏱️  Progress: 100/3276 (3.1%)
   Rate: 0.8 recipes/min | ETA: 66h 10m
   Waiting 1 seconds...

...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Processing complete!

📊 Summary:
========
  Total processed: 3,276
  Ingredients extracted: 42,588
  Unique ingredients: 1,247
  Recipe-ingredient links: 42,588
  Skipped: 0
  Failed: 12

✨ Success rate: 99.6%

💾 Database updated!
   - 1,247 ingredients in master list
   - 42,588 recipe-ingredient links created

📈 Top 20 Most Common Ingredients:
   1. Salt (2,842 recipes) - spices
   2. Olive Oil (2,134 recipes) - oils
   3. Garlic (1,987 recipes) - vegetables
   4. Onion (1,756 recipes) - vegetables
   5. Black Pepper (1,623 recipes) - spices
   ...

📊 Category Breakdown:
   vegetables: 287
   proteins: 145
   spices: 134
   herbs: 98
   grains: 76
   dairy: 65
   condiments: 52
   oils: 45
   fruits: 38
   sweeteners: 24
   nuts: 18
   other: 265

✅ Marked 47 ingredients as common (>50 uses)
```

### Files Created

#### 1. Checkpoint File
**Location**: `tmp/ingredient-extraction-checkpoint.json`

Saved every 50 recipes for resume capability:
```json
{
  "timestamp": "2025-10-16T10:30:00Z",
  "lastProcessedId": "abc123...",
  "stats": {
    "total": 3276,
    "processed": 150,
    "ingredientsExtracted": 1950,
    ...
  }
}
```

#### 2. Error Log
**Location**: `tmp/ingredient-extraction-errors-{timestamp}.json`

Only created if errors occur:
```json
[
  {
    "recipeId": "xyz789...",
    "recipeName": "Failed Recipe",
    "error": "Invalid ingredients format"
  }
]
```

## Extraction Logic

### LLM Prompt Strategy

The script uses a carefully crafted prompt to extract structured data:

```
Extract structured ingredient data from this recipe's ingredient list.

RECIPE: {recipe_name}
INGREDIENTS:
1. {ingredient_string_1}
2. {ingredient_string_2}
...

Extract each ingredient with:
- name: Normalized ingredient name (lowercase, singular)
- display_name: Properly capitalized
- amount: Numeric quantity
- unit: Measurement unit
- preparation: Preparation method
- category: Classification

IMPORTANT RULES:
1. Normalize to base form (e.g., "red onion" → "onion")
2. Keep brand names if important
3. Extract ALL preparation methods
4. Preserve amounts exactly (including fractions)
5. Use singular form
6. Extract units accurately
7. Categorize correctly

Return ONLY valid JSON array.
```

### Normalization Rules

1. **Ingredient Names**:
   - Lowercase
   - Singular form
   - Base ingredient (e.g., "red onion" → "onion")
   - Preserve specific types if important (e.g., "parmesan cheese")

2. **Amounts**:
   - Preserve exact format ("2", "1/2", "1-2", "")
   - Handle fractions (1/2, ½, ¼, ¾)
   - Handle ranges (1-2, 2-3)
   - Empty string if no amount

3. **Units**:
   - Standardize to common units
   - Preserve abbreviations (cup, tbsp, tsp, lb, oz)
   - Empty string if no unit

4. **Preparation**:
   - Extract all methods (chopped, minced, diced, etc.)
   - Include qualifiers (to taste, optional, etc.)
   - Empty string if no preparation

### Deduplication Algorithm

1. **Check exact match**: Lowercase name match
2. **Check aliases**: Look up in alias dictionary
3. **Create if new**: Insert into ingredients table
4. **Update usage count**: Increment on each use

### Alias Dictionary

Common ingredient aliases are pre-defined:

```typescript
const INGREDIENT_ALIASES = {
  'green onion': ['scallion', 'spring onion'],
  'cilantro': ['coriander leaves', 'chinese parsley'],
  'bell pepper': ['sweet pepper', 'capsicum'],
  'eggplant': ['aubergine'],
  'zucchini': ['courgette'],
  'chickpea': ['garbanzo bean'],
  'shrimp': ['prawn'],
  'soy sauce': ['shoyu'],
  // ... add more as needed
};
```

## Common Use Cases

### 1. Query Recipes by Ingredient

```sql
-- Find all recipes using garlic
SELECT r.*
FROM recipes r
JOIN recipe_ingredients ri ON r.id = ri.recipe_id
JOIN ingredients i ON ri.ingredient_id = i.id
WHERE i.name = 'garlic';
```

### 2. Get Ingredient List for Recipe

```sql
-- Get structured ingredients for a recipe
SELECT
  i.display_name,
  ri.amount,
  ri.unit,
  ri.preparation,
  i.category
FROM recipe_ingredients ri
JOIN ingredients i ON ri.ingredient_id = i.id
WHERE ri.recipe_id = 'recipe-id-here'
ORDER BY ri.position;
```

### 3. Find Recipes with Multiple Ingredients

```sql
-- Find recipes with both garlic AND onion
SELECT r.*
FROM recipes r
WHERE EXISTS (
  SELECT 1 FROM recipe_ingredients ri
  JOIN ingredients i ON ri.ingredient_id = i.id
  WHERE ri.recipe_id = r.id AND i.name = 'garlic'
)
AND EXISTS (
  SELECT 1 FROM recipe_ingredients ri
  JOIN ingredients i ON ri.ingredient_id = i.id
  WHERE ri.recipe_id = r.id AND i.name = 'onion'
);
```

### 4. Most Popular Ingredients

```sql
-- Get most commonly used ingredients
SELECT
  display_name,
  usage_count,
  category,
  is_common
FROM ingredients
ORDER BY usage_count DESC
LIMIT 50;
```

### 5. Recipes by Category

```sql
-- Find recipes with proteins
SELECT DISTINCT r.*
FROM recipes r
JOIN recipe_ingredients ri ON r.id = ri.recipe_id
JOIN ingredients i ON ri.ingredient_id = i.id
WHERE i.category = 'proteins';
```

### 6. Shopping List Generation

```sql
-- Generate shopping list for multiple recipes
SELECT
  i.display_name,
  i.category,
  ARRAY_AGG(ri.amount || ' ' || ri.unit) as amounts,
  COUNT(*) as recipe_count
FROM recipe_ingredients ri
JOIN ingredients i ON ri.ingredient_id = i.id
WHERE ri.recipe_id IN ('recipe-1', 'recipe-2', 'recipe-3')
GROUP BY i.id, i.display_name, i.category
ORDER BY i.category, i.display_name;
```

## Troubleshooting

### Script Fails to Start

**Problem**: `OPENROUTER_API_KEY environment variable is not set`

**Solution**: Add key to `.env.local`:
```env
OPENROUTER_API_KEY=sk-or-v1-...
```

### Rate Limit Errors

**Problem**: `429 Too Many Requests`

**Solution**: Script has built-in retry logic with exponential backoff. If persistent:
1. Increase `DELAY_MS` in script
2. Reduce `BATCH_SIZE`
3. Check OpenRouter account limits

### LLM Extraction Errors

**Problem**: Invalid JSON response from LLM

**Solution**: Script automatically:
1. Strips markdown code blocks
2. Retries up to 3 times
3. Logs errors for manual review

### Database Connection Errors

**Problem**: Cannot connect to database

**Solution**:
1. Verify `DATABASE_URL` in `.env.local`
2. Check Neon PostgreSQL is accessible
3. Test with: `pnpm db:studio`

### Memory Issues

**Problem**: Script crashes with out-of-memory error

**Solution**:
1. Reduce `BATCH_SIZE` (default: 10)
2. Process in smaller chunks with `--limit`
3. Use `--resume` to continue after crashes

### Resume from Checkpoint

**Problem**: Script was interrupted

**Solution**:
```bash
# Resume from last saved checkpoint
npx tsx scripts/extract-ingredients.ts --execute --resume
```

Checkpoint is saved every 50 recipes automatically.

### Verify Extraction Quality

**Problem**: Want to check extraction before full run

**Solution**:
```bash
# Test on 10 recipes (dry run)
npx tsx scripts/extract-ingredients.ts --limit=10

# Review console output for accuracy
# Adjust prompt or aliases if needed
```

## Future Enhancements

### Potential Improvements

1. **Nutrition Database Integration**
   - Link ingredients to USDA nutrition database
   - Calculate nutritional values per ingredient

2. **Unit Conversion**
   - Automatic metric ↔ imperial conversion
   - Store both in database

3. **Substitution Suggestions**
   - AI-powered ingredient substitution
   - Dietary restriction alternatives

4. **Price Tracking**
   - Integrate with grocery store APIs
   - Estimate recipe cost

5. **Seasonal Availability**
   - Flag seasonal ingredients
   - Suggest seasonal alternatives

6. **Allergen Detection**
   - Auto-flag common allergens
   - Cross-contamination warnings

7. **Recipe Scaling**
   - Automatic amount adjustment for servings
   - Preserve correct ratios

8. **Smart Shopping**
   - Group by store aisle
   - Optimize shopping route

## Maintenance

### Adding New Aliases

Edit the `INGREDIENT_ALIASES` dictionary in the script:

```typescript
const INGREDIENT_ALIASES: Record<string, string[]> = {
  // Add new alias mapping
  'your-ingredient': ['alias1', 'alias2'],
  ...
};
```

### Adjusting Categories

Modify the `IngredientCategory` type:

```typescript
type IngredientCategory =
  | 'vegetables'
  | 'your-new-category'
  | ...;
```

Update the LLM prompt to include the new category.

### Re-running Extraction

To re-extract all ingredients (e.g., after improving prompt):

```sql
-- Clear existing data
TRUNCATE TABLE recipe_ingredients CASCADE;
TRUNCATE TABLE ingredients CASCADE;
```

Then run:
```bash
npx tsx scripts/extract-ingredients.ts --execute
```

### Updating Existing Ingredients

To update specific ingredient properties:

```sql
-- Fix incorrect category
UPDATE ingredients
SET category = 'correct-category'
WHERE name = 'ingredient-name';

-- Merge duplicates
UPDATE recipe_ingredients
SET ingredient_id = 'canonical-id'
WHERE ingredient_id = 'duplicate-id';

DELETE FROM ingredients WHERE id = 'duplicate-id';
```

## Best Practices

1. **Always test first**: Use `--limit=10` before full execution
2. **Monitor costs**: Check OpenRouter usage regularly
3. **Save checkpoints**: Let script run uninterrupted for checkpoint saves
4. **Review extraction**: Check sample output for quality
5. **Update aliases**: Add common variants as you discover them
6. **Regular re-indexing**: Periodically rebuild for improved prompts
7. **Backup first**: Take database backup before major runs

## Related Files

- **Script**: `scripts/extract-ingredients.ts`
- **Parser Component**: `src/components/recipe/IngredientsList.tsx`
- **Database Schema**: `src/lib/db/schema.ts`
- **Checkpoint**: `tmp/ingredient-extraction-checkpoint.json`
- **Error Logs**: `tmp/ingredient-extraction-errors-*.json`

## References

- [OpenRouter API Documentation](https://openrouter.ai/docs)
- [Claude Sonnet 4.5 Model Card](https://openrouter.ai/models/anthropic/claude-sonnet-4.5)
- [Drizzle ORM Documentation](https://orm.drizzle.team/docs)
- [USDA Food Database](https://fdc.nal.usda.gov/)
- [Schema.org Recipe](https://schema.org/Recipe)

---

**Last Updated**: 2025-10-16
**Script Version**: 1.0.0
**Status**: Production Ready
**Estimated Cost**: $5-10 for 3,276 recipes
**Estimated Runtime**: 2-3 hours
