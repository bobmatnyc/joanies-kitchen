# Cookware Extraction System Guide

## Overview

The cookware extraction system extends the kitchen tools infrastructure to automatically identify and extract cooking vessels (pots, pans, baking dishes, etc.) from recipe instructions and ingredient lists.

## Features

- **Pattern-based extraction**: Uses comprehensive regex patterns to detect cookware mentions
- **Deduplication**: Automatically consolidates duplicate tool entries
- **Ontology classification**: Categorizes cookware using the 5-type, 48-subtype system
- **Safe execution**: Transaction-based with dry-run mode by default
- **Comprehensive coverage**: 20+ cookware types with variations

## Cookware Categories

### Cookware (Stovetop)
- **Skillets/Frying Pans**: Regular, cast iron, non-stick
- **Saucepans**: Small, medium, large
- **Pots**: Cooking pots, stockpots, Dutch ovens
- **Specialty**: Woks, grill pans

### Bakeware (Oven)
- **Sheet Pans**: Baking sheets, cookie sheets, half-sheet pans
- **Baking Dishes**: Casserole dishes, roasting pans, 9x13 pans
- **Cake Pans**: Round, springform, bundt, tube
- **Specialty**: Loaf pans, muffin tins, pie dishes

## Extraction Patterns

The system uses sophisticated regex patterns to match cookware variations:

```typescript
// Example: Skillet patterns
/\b(?:large\s+)?skillets?\b/gi           // "skillet", "large skillet"
/\bfrying\s+pans?\b/gi                   // "frying pan"
/\bsaut[ée]\s+pans?\b/gi                 // "sauté pan", "sautee pan"
/\bcast[- ]iron\s+skillets?\b/gi         // "cast iron skillet"
```

Each pattern group maps to a canonical tool name with:
- Normalized name (e.g., `skillet`)
- Display name (e.g., `Skillet`)
- Category (`cookware` or `bakeware`)
- Type/subtype (ontology classification)
- Essential status
- Description

## Usage

### Dry Run (Default)

```bash
# Test extraction without making changes
pnpm tsx scripts/extract-cookware-from-recipes.ts

# Test on limited recipes
LIMIT=10 pnpm tsx scripts/extract-cookware-from-recipes.ts
```

### Production Mode

```bash
# Apply extraction to database
APPLY_CHANGES=true pnpm tsx scripts/extract-cookware-from-recipes.ts
```

### Environment Variables

- `APPLY_CHANGES=true`: Execute changes (default: false)
- `LIMIT=N`: Process only N recipes for testing

## Database Schema

### Tools Table
```sql
CREATE TABLE tools (
  id UUID PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,           -- Canonical: 'skillet'
  display_name TEXT NOT NULL,          -- Display: 'Skillet'
  category TEXT NOT NULL,              -- 'cookware' | 'bakeware'
  type VARCHAR(50),                    -- 'COOKING_VESSELS'
  subtype VARCHAR(100),                -- 'cooking_pans'
  is_essential BOOLEAN DEFAULT false,
  is_specialized BOOLEAN DEFAULT false,
  description TEXT,
  alternatives TEXT,                   -- JSON array of aliases
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Recipe Tools Table
```sql
CREATE TABLE recipe_tools (
  id UUID PRIMARY KEY,
  recipe_id TEXT REFERENCES recipes(id) ON DELETE CASCADE,
  tool_id UUID REFERENCES tools(id) ON DELETE CASCADE,
  is_optional BOOLEAN DEFAULT false,
  quantity INTEGER DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Extraction Process

### Phase 1: Fetch Recipes
- Loads all recipes from database (or limited set with `LIMIT`)
- Prepares text for pattern matching

### Phase 2: Pattern Matching
- Combines recipe description, ingredients, and instructions
- Applies regex patterns to detect cookware mentions
- Deduplicates matches per recipe
- Tracks frequency and recipe counts

### Phase 3: Tool Creation
- Checks for existing tools to avoid duplicates
- Creates new tools with proper ontology classification
- Maintains ID mapping for relationship creation

### Phase 4: Recipe-Tool Relationships
- Creates `recipe_tools` entries linking recipes to cookware
- Skips existing relationships to avoid duplicates
- Sets quantity to 1 by default

## Output Example

```
🚀 Cookware Extraction Script
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ⚠️  Running in DRY RUN mode - no changes will be made
  ℹ️  Set APPLY_CHANGES=true to execute extraction

🔍 Phase 1: Fetching Recipes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅ Found 4,644 recipes to process

🍳 Phase 2: Extracting Cookware from Recipes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅ Processed 4,644 recipes
  ✅ Found 8,234 cookware instances
  ✅ Identified 18 unique cookware types

  ℹ️  Cookware frequency:
    Skillet: 1,823 instances in 1,456 recipes
    Pot: 1,234 instances in 982 recipes
    Baking Dish: 876 instances in 743 recipes
    Sheet Pan: 654 instances in 598 recipes
    ...

🔧 Phase 3: Creating Tools in Database
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ℹ️  Found 3 existing tools
  ℹ️  Would create tool: Saucepan
  ℹ️  Would create tool: Dutch Oven
  ...
  ✅ Created 15 new tools

📋 Phase 4: Creating Recipe-Tool Relationships
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅ Created 8,234 recipe-tool relationships

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🍳 Cookware Extraction Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Extraction Results:
  ✅ 4,644 recipes processed
  ✅ 8,234 cookware instances found
  ✅ 18 unique cookware types identified

Database Changes:
  ✅ 15 new tools created
  ✅ 8,234 recipe-tool relationships created

⚠️  DRY RUN MODE - No changes were made to the database
   Run with APPLY_CHANGES=true to execute extraction
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Safety Features

### Transaction Support
- All database operations run in a single transaction
- Automatic rollback on errors
- No partial state changes

### Dry Run Mode
- Default mode shows what would happen
- No database modifications
- Safe for testing patterns and coverage

### Deduplication
- Tools deduplicated by canonical name
- Recipe-tool relationships checked before insertion
- Existing tools reused instead of recreated

### Error Handling
- Comprehensive error messages
- Transaction rollback on failure
- No orphaned data

## Extending the System

### Adding New Cookware Patterns

```typescript
// In COOKWARE_PATTERNS array
{
  canonical: 'pressure-cooker',
  display_name: 'Pressure Cooker',
  patterns: [
    /\bpressure\s+cookers?\b/gi,
    /\binstant\s+pots?\b/gi,
  ],
  category: 'cookware',
  type: 'COOKING_VESSELS',
  subtype: 'cooking_pots',
  is_essential: false,
  description: 'High-pressure cooking vessel for fast cooking',
}
```

### Customizing Extraction

Modify the `extractCookwareFromRecipe` function to:
- Change text sources (currently: description + ingredients + instructions)
- Add filtering logic
- Implement confidence scoring
- Add manual overrides

## Integration Points

### Existing Scripts
- `scripts/migrate-tools-to-dedicated-table.ts`: Original tool migration
- `scripts/seed-common-ingredients-tools.ts`: Seed essential tools

### Database Schema
- `src/lib/db/schema.ts`: Tools and recipe_tools tables
- `src/lib/db/ingredients-schema.ts`: Ingredient system (separate)

### Future Enhancements
- AI-powered extraction using LLMs for ambiguous cases
- Quantity extraction (e.g., "2 skillets")
- Size extraction (e.g., "10-inch skillet")
- Confidence scoring for matches
- User feedback loop for corrections

## Troubleshooting

### No Cookware Found
- Check if recipes have instructions/ingredients populated
- Verify pattern regex syntax
- Test patterns individually with sample text

### Duplicate Tools Created
- Ensure canonical names are unique
- Check existing tools before running
- Use transaction rollback if needed

### Performance Issues
- Use `LIMIT` for testing
- Consider batch processing for large datasets
- Add indexes on tool name and category

## Maintenance

### Pattern Updates
Cookware patterns may need updates when:
- New cookware types emerge in recipes
- Regional variations need support
- Pattern matches are too broad/narrow

### Database Cleanup
Periodically review:
- Unused tools (not linked to any recipes)
- Duplicate tools with slight name variations
- Orphaned recipe_tools entries

## References

- [Kitchen Tools Migration Analysis](./KITCHEN_TOOLS_MIGRATION_ANALYSIS.md)
- [Project Organization](./PROJECT_ORGANIZATION.md)
- [Database Schema Documentation](../../src/lib/db/schema.ts)

## Version History

- **v1.0.0** (2025-10-23): Initial cookware extraction system
  - 20+ cookware types with pattern matching
  - Transaction-based safe execution
  - Dry-run and production modes
  - Comprehensive logging and reporting
