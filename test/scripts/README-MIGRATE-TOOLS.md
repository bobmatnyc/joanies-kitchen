# Kitchen Tools Migration Script

## Overview

This script migrates 31 kitchen tools from the `ingredients` table to the dedicated `tools` and `recipe_tools` tables. It consolidates duplicate variants (e.g., "skewers" + "bamboo skewers" → "skewer") and preserves all recipe relationships.

## Quick Start

### Dry Run (Recommended First)
```bash
# Preview changes without modifying database
pnpm tsx scripts/migrate-tools-to-dedicated-table.ts
```

### Production Migration
```bash
# Apply changes to database
APPLY_CHANGES=true pnpm tsx scripts/migrate-tools-to-dedicated-table.ts
```

## What It Does

### Phase 1: Tool Migration
- Fetches 31 tools from `ingredients` table
- Groups into 23 canonical tools
- Consolidates 8 duplicate variants:
  - `skewers` + `bamboo-skewers` → `skewer`
  - `thermometer` + `deep-fat-thermometer` → `thermometer`
  - `ramekin` + `ramekins` → `ramekin`
  - `measuring-spoon` + `measuring-spoons` → `measuring-spoon`
  - `muddler` + `muddlers` → `muddler`
  - `wooden-stick` + `wooden-sticks` → `wooden-stick`
  - `oven-roasting-bag` + `oven-cooking-bag` → `oven-roasting-bag`
  - `nonstick-cooking-spray` + `nonstick-vegetable-oil-spray` → `nonstick-cooking-spray`

### Phase 2: Recipe References
- Migrates 65 `recipe_ingredients` entries to `recipe_tools`
- Maps old ingredient IDs to new tool IDs
- Converts:
  - `amount` → `quantity` (parsed to integer)
  - `unit` + `preparation` → `notes`
  - `is_optional` → `is_optional`

### Phase 3: Cleanup
- Deletes 65 tool entries from `recipe_ingredients`
- Deletes 31 tools from `ingredients` table

## Data Mapping

### Tools Table
```typescript
// From ingredients table:
ingredients.id          → Generate new UUID
ingredients.name        → tools.name (canonical slug)
ingredients.display_name → tools.display_name
ingredients.category    → tools.category (mapped to enum)
ingredients.description → tools.description

// New fields (from CANONICAL_TOOLS mapping):
→ tools.type         // CUTTING_PREP, COOKING_VESSELS, etc.
→ tools.subtype      // prep_skewers, cooking_roasting, etc.
→ tools.is_essential // Essential kitchen tool
→ tools.is_specialized // Specialized equipment
→ tools.alternatives // JSON array of variant names
```

### Recipe Tools Table
```typescript
// From recipe_ingredients table:
recipe_ingredients.recipe_id      → recipe_tools.recipe_id
recipe_ingredients.ingredient_id  → recipe_tools.tool_id (mapped)
recipe_ingredients.amount         → recipe_tools.quantity (parsed to int)
recipe_ingredients.is_optional    → recipe_tools.is_optional
recipe_ingredients.unit + prep    → recipe_tools.notes
```

## Safety Features

### Transaction Safety
- Entire migration runs in a single database transaction
- Rolls back automatically on any error
- No partial migrations possible

### Dry-Run Mode
- Default mode shows what would be changed
- No database modifications
- Safe to run multiple times

### Validation Checks
- ✅ Tools table has ~23 entries
- ✅ Recipe_tools table has 65 entries
- ✅ No tools remain in ingredients table
- ✅ No orphaned recipe_tools entries

## Example Output

```
🚀 Kitchen Tools Migration Script
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔍 Phase 1: Fetching Tools from Ingredients Table
  ✅ Found 31 tools in ingredients table

🔧 Phase 2: Creating Canonical Tools
  ℹ️  Grouped 31 tools into 23 canonical tools
  ✅ Consolidated 8 duplicate variants
  ℹ️  Creating tool: Skewer (2 variants)
  ℹ️  Creating tool: Thermometer (2 variants)
  ...
  ✅ Created 23 canonical tools

📋 Phase 3: Migrating Recipe References
  ✅ Found 65 recipe_ingredients entries referencing tools
  ✅ Migrated 65 recipe_tools entries

🧹 Phase 4: Cleanup
  ✅ 65 tool entries removed from recipe_ingredients
  ✅ 31 tools removed from ingredients table

✅ Validation: All checks passed!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔧 Kitchen Tools Migration Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Phase 1: Tool Migration
  ✅ 31 tools migrated to tools table
  ✅ 8 duplicate variants consolidated
  ✅ 23 canonical tools created

Phase 2: Recipe References
  ✅ 65 recipe_ingredients found
  ✅ 65 recipe_tools entries created

Phase 3: Cleanup
  ✅ 65 tool entries removed from recipe_ingredients
  ✅ 31 tools removed from ingredients table

Validation:
  ✅ All validation checks passed!

✨ Migration complete!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Tool Categories

The script maps tools to these categories:

- **cookware**: Pots, pans, roasting bags
- **bakeware**: Baking sheets, ramekins, muffin liners
- **utensils**: Spatulas, tongs, spoons, skewers
- **measuring**: Thermometers, measuring spoons
- **appliances**: Spice grinders
- **serving**: Cake stands, storage containers
- **other**: Cooking sprays, misc items

## Ontology Classification

Tools are classified using a 2-level ontology:

### Type (5 main categories)
- `CUTTING_PREP`: Knives, cutters, prep tools
- `COOKING_VESSELS`: Pots, pans, bakeware
- `MIXING_MEASURING`: Bowls, spoons, measuring tools
- `HEAT_POWER`: Appliances, grinders
- `STORAGE_SERVING`: Containers, platters

### Subtype (48 specialized categories)
- `prep_skewers`: Skewers, sticks
- `cooking_roasting`: Roasting bags, racks
- `measuring_thermometer`: Thermometers
- `measuring_spoons`: Measuring spoons
- And more...

## Post-Migration

After successful migration:

1. **Update Code**: The `src/app/actions/tools.ts` file can be updated to query the `tools` table directly instead of filtering `ingredients`
2. **Remove Constants**: Delete hardcoded `TOOL_IDS` and `CANONICAL_TOOLS` from the codebase
3. **UI Updates**: Update `/tools` page note (lines 21-22 mention migration)
4. **Verify**: Check `/tools` page displays all 23 canonical tools correctly

## Troubleshooting

### Migration Fails with Transaction Error
**Problem**: Script shows "No transactions support" error

**Solution**: The script now uses `db-with-transactions.ts` which provides WebSocket-based connections with transaction support. Ensure your `DATABASE_URL` is valid.

### Validation Errors After Migration
**Problem**: Validation checks fail after running with `APPLY_CHANGES=true`

**Solution**:
1. Check the error messages for specific issues
2. Run dry-run mode again to verify state
3. Check database directly:
   ```sql
   SELECT COUNT(*) FROM tools;           -- Should be ~23
   SELECT COUNT(*) FROM recipe_tools;    -- Should be 65
   SELECT COUNT(*) FROM ingredients
   WHERE id IN (...TOOL_IDS...);         -- Should be 0
   ```

### Some Tools Missing
**Problem**: Not all 31 tools found in ingredients table

**Solution**:
1. Verify tool IDs exist in database:
   ```sql
   SELECT id, name, display_name
   FROM ingredients
   WHERE id IN (...TOOL_IDS...);
   ```
2. Check if tools were already migrated
3. Review `TOOL_IDS` array for typos

## Rollback

If you need to rollback the migration:

1. The transaction automatically rolls back on error
2. For manual rollback after successful migration, you would need to:
   - Re-insert tools into ingredients table (from backup)
   - Re-insert recipe_ingredients entries (from backup)
   - Delete entries from tools and recipe_tools tables

**Best Practice**: Always test in dry-run mode first!

## References

- **Migration Analysis**: `/docs/reference/KITCHEN_TOOLS_MIGRATION_ANALYSIS.md`
- **Tools Schema**: `/src/lib/db/schema.ts` (lines 456-509)
- **Ingredients Schema**: `/src/lib/db/ingredients-schema.ts`
- **Tools Actions**: `/src/app/actions/tools.ts`

## Support

For issues or questions:
1. Check this README
2. Review migration analysis document
3. Inspect dry-run output
4. Check database state manually

---

**Last Updated**: 2025-10-22
**Script Version**: 1.0.0
**Status**: Ready for Production
