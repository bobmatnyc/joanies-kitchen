# Ingredient Extraction Script - Quick Reference

## Purpose
Extract and normalize ingredients from 3,276 recipes into structured database tables using LLM-based parsing.

## Quick Start

```bash
# Test on 10 recipes (dry run)
npx tsx scripts/extract-ingredients.ts --limit=10

# Run full extraction
npx tsx scripts/extract-ingredients.ts --execute

# Resume from checkpoint
npx tsx scripts/extract-ingredients.ts --execute --resume
```

## Options

| Flag | Description |
|------|-------------|
| `--execute` | Save to database (default is dry-run) |
| `--limit=N` | Process only N recipes |
| `--resume` | Continue from last checkpoint |

## What It Does

1. **Reads** all recipes from database (3,276 recipes)
2. **Extracts** structured ingredient data using Claude Sonnet 4.5:
   - Ingredient name (normalized)
   - Amount and unit
   - Preparation method
   - Category classification
3. **Deduplicates** ingredient names (handles aliases)
4. **Creates** two database tables:
   - `ingredients` - Master list of unique ingredients
   - `recipe_ingredients` - Many-to-many relationships with amounts
5. **Tracks** usage statistics and common ingredients

## Expected Output

- **Runtime**: 2-3 hours for 3,276 recipes
- **Cost**: ~$5-10 (Claude Sonnet 4.5 via OpenRouter)
- **Unique Ingredients**: ~1,200-1,500 (estimated)
- **Total Links**: ~40,000-50,000 recipe-ingredient relationships

## Database Tables Created

### `ingredients`
```sql
- id: TEXT PRIMARY KEY
- name: TEXT UNIQUE          -- Normalized (e.g., "garlic")
- display_name: TEXT         -- Capitalized (e.g., "Garlic")
- category: TEXT             -- vegetables, proteins, etc.
- is_common: BOOLEAN         -- Used in >50 recipes
- usage_count: INTEGER       -- Number of recipes using this
- aliases: TEXT              -- JSON array of alternative names
```

### `recipe_ingredients`
```sql
- id: TEXT PRIMARY KEY
- recipe_id: TEXT → recipes(id)
- ingredient_id: TEXT → ingredients(id)
- amount: TEXT               -- e.g., "2", "1/2"
- unit: TEXT                 -- e.g., "cup", "tablespoon"
- preparation: TEXT          -- e.g., "chopped", "minced"
- position: INTEGER          -- Order in recipe
```

## Example Transformation

**Input (recipe.ingredients JSON)**:
```json
[
  "2 cups all-purpose flour, sifted",
  "1/2 teaspoon salt",
  "3 cloves garlic, minced"
]
```

**Output (database)**:
```sql
-- ingredients table
INSERT INTO ingredients (name, display_name, category)
VALUES
  ('flour', 'All-Purpose Flour', 'grains'),
  ('salt', 'Salt', 'spices'),
  ('garlic', 'Garlic', 'vegetables');

-- recipe_ingredients table
INSERT INTO recipe_ingredients (recipe_id, ingredient_id, amount, unit, preparation, position)
VALUES
  ('recipe-123', 'ing-1', '2', 'cup', 'sifted', 0),
  ('recipe-123', 'ing-2', '1/2', 'teaspoon', '', 1),
  ('recipe-123', 'ing-3', '3', 'clove', 'minced', 2);
```

## Features

- ✅ LLM-powered extraction (Claude Sonnet 4.5)
- ✅ Batch processing with rate limiting
- ✅ Automatic deduplication
- ✅ Progress tracking with ETA
- ✅ Checkpoint system for resume
- ✅ Comprehensive error handling
- ✅ Dry-run mode for testing
- ✅ Detailed statistics and reports

## Common Queries

### Find recipes by ingredient
```sql
SELECT r.*
FROM recipes r
JOIN recipe_ingredients ri ON r.id = ri.recipe_id
JOIN ingredients i ON ri.ingredient_id = i.id
WHERE i.name = 'garlic';
```

### Get ingredient list for recipe
```sql
SELECT i.display_name, ri.amount, ri.unit, ri.preparation
FROM recipe_ingredients ri
JOIN ingredients i ON ri.ingredient_id = i.id
WHERE ri.recipe_id = 'recipe-id'
ORDER BY ri.position;
```

### Most popular ingredients
```sql
SELECT display_name, usage_count, category
FROM ingredients
ORDER BY usage_count DESC
LIMIT 20;
```

## Troubleshooting

### API Key Error
Add to `.env.local`:
```env
OPENROUTER_API_KEY=sk-or-v1-...
```

### Script Interrupted
Resume with:
```bash
npx tsx scripts/extract-ingredients.ts --execute --resume
```

### Rate Limit Errors
Script auto-retries with backoff. If persistent, reduce batch size or increase delay in script.

## Files Created

- `tmp/ingredient-extraction-checkpoint.json` - Progress checkpoint
- `tmp/ingredient-extraction-errors-{timestamp}.json` - Error log (if any)

## Documentation

See full documentation: `docs/guides/INGREDIENT_EXTRACTION_GUIDE.md`

---

**Script**: `scripts/extract-ingredients.ts`
**Version**: 1.0.0
**Model**: Claude Sonnet 4.5 (anthropic/claude-sonnet-4.5)
**Status**: Ready for production use
