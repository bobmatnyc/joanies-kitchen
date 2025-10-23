# Cookware Extraction - Quick Start Guide

## What This Does

Automatically extracts cookware/cooking vessels (pots, pans, baking dishes, etc.) from recipe instructions and stores them in the tools database.

## Supported Cookware (20+ types)

**Stovetop**: Skillets, Saucepans, Pots, Stockpots, Dutch Ovens, Woks, Cast Iron, Grill Pans

**Oven**: Baking Dishes, Sheet Pans, Roasting Pans, Cake Pans, Loaf Pans, Muffin Tins, Pie Dishes, Bundt Pans

## Usage

### 1. Test First (Recommended)

```bash
# Test on just 10 recipes
pnpm tools:extract-cookware:test
```

### 2. Review Output

Look for:
- Number of cookware instances found
- Unique cookware types
- Frequency distribution
- Any unexpected patterns

### 3. Run Full Extraction

```bash
# Dry run on all recipes (shows what would happen)
pnpm tools:extract-cookware

# Apply changes to database
pnpm tools:extract-cookware:apply
```

## Example Output

```
🍳 Cookware Extraction Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Extraction Results:
  ✅ 4,644 recipes processed
  ✅ 8,234 cookware instances found
  ✅ 18 unique cookware types identified

Cookware frequency:
  Skillet: 1,823 instances in 1,456 recipes
  Pot: 1,234 instances in 982 recipes
  Baking Dish: 876 instances in 743 recipes
  ...

Database Changes:
  ✅ 15 new tools created
  ✅ 8,234 recipe-tool relationships created
```

## What Happens

1. **Scans recipes**: Reads description, ingredients, and instructions
2. **Finds cookware**: Uses pattern matching to identify mentions
3. **Creates tools**: Adds new cookware types to tools table
4. **Links to recipes**: Creates recipe_tools relationships

## Safety Features

- **Dry run by default**: Won't change database unless you use `:apply`
- **Transaction-based**: All-or-nothing execution (no partial changes)
- **Deduplication**: Won't create duplicate tools or relationships
- **Rollback on error**: Automatic cleanup if anything fails

## Troubleshooting

### No cookware found
- Check if recipes have instructions populated
- Verify patterns match your recipe text style

### Unexpected results
- Run with `LIMIT=10` first to review
- Check pattern definitions in script
- Review dry-run output before applying

## Files

- **Script**: `scripts/extract-cookware-from-recipes.ts`
- **Documentation**: `docs/reference/COOKWARE_EXTRACTION_GUIDE.md`
- **Implementation**: `docs/reference/COOKWARE_EXTRACTION_IMPLEMENTATION.md`

## Database Tables

- **`tools`**: Stores cookware definitions
- **`recipe_tools`**: Links recipes to cookware they use

## Next Steps After Extraction

1. **Verify results**: Check tools table for new entries
2. **Review relationships**: Spot-check recipe_tools for accuracy
3. **Update UI**: Display required cookware on recipe pages
4. **Filter recipes**: Allow users to search by available cookware

## Questions?

See full documentation:
- `docs/reference/COOKWARE_EXTRACTION_GUIDE.md` - Detailed guide
- `docs/reference/COOKWARE_EXTRACTION_IMPLEMENTATION.md` - Technical details
