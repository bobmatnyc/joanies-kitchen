# Hide Corrupted Recipes Script

**Purpose**: Automatically hide recipes with empty instructions, empty ingredients, or known corrupted data by setting `is_public = false`.

**Launch Critical**: This script addresses 224 corrupted recipes discovered via data quality audit before October 27, 2025 launch.

---

## Problem Summary

From data quality audit:
- **224 recipes** with corruption issues (4.8% of 4,697 total)
  - **210 recipes**: Empty instructions (from food.com scraping failures)
  - **13 recipes**: Empty ingredients
  - **1 recipe**: Both empty (Shannon Martinez recipe from Wine Selectors)

All 224 corrupted recipes are currently **public** and must be hidden before launch.

---

## What the Script Does

1. **Scans Database**: Analyzes all recipes for corruption patterns
2. **Detects Corruption**:
   - Empty instructions (`[]`, `""`, or invalid JSON)
   - Empty ingredients (`[]`, `""`, or invalid JSON)
   - Arrays containing only empty strings
   - Known corrupted recipes (e.g., Shannon Martinez)
3. **Hides Recipes**: Sets `is_public = false` for all corrupted recipes
4. **Generates Report**: Creates detailed JSON report in `tmp/` directory

---

## Usage

### Dry Run (Preview Only)

```bash
# Preview what will be hidden (no changes made)
npx tsx scripts/hide-corrupted-recipes.ts

# Verbose mode (shows sample of corrupted recipes)
npx tsx scripts/hide-corrupted-recipes.ts --verbose
```

### Execute (Apply Changes)

```bash
# Actually hide corrupted recipes
npx tsx scripts/hide-corrupted-recipes.ts --execute

# Execute with verbose output
npx tsx scripts/hide-corrupted-recipes.ts --execute --verbose
```

---

## Output

### Console Summary

```
================================================================================
📊 CORRUPTION ANALYSIS SUMMARY
================================================================================
Mode: 🔍 DRY RUN
Timestamp: 2025-10-24T02:58:37.465Z

Total Corrupted Recipes: 224
Total Hidden: 224

📋 Breakdown by Corruption Type:
  - Empty Instructions Only: 210
  - Empty Ingredients Only: 13
  - Both Empty: 1
  - Corrupted Data: 0

🔓 Visibility Status (Before):
  - Was Public: 224
  - Was Private: 0

📂 By Source:
  - food.com/recipe/*: 210 recipes
  - ottolenghi.co.uk: 5 recipes
  - masterclass.com: 3 recipes
  - zerowastechef.com: 3 recipes
  - gordonramsay.com: 2 recipes
  - nigella.com: 2 recipes
  - other sources: varies
================================================================================
```

### JSON Report

Generated at: `tmp/corrupted-recipes-hidden-report.json`

**Structure**:
```json
{
  "execution_mode": "dry_run" | "execute",
  "timestamp": "ISO 8601 datetime",
  "total_corrupted": 224,
  "total_hidden": 224,
  "breakdown": {
    "empty_instructions": 210,
    "empty_ingredients": 13,
    "both": 1,
    "corrupted_data": 0
  },
  "recipes": [
    {
      "id": "uuid",
      "name": "Recipe Name",
      "corruption_type": "empty_instructions",
      "was_public": true,
      "chef_id": null,
      "source": "food.com/recipe/12345",
      "created_at": "2025-10-15T07:57:29.057Z"
    }
  ],
  "summary": {
    "was_public_count": 224,
    "was_private_count": 0,
    "by_source": {
      "food.com/recipe/12345": 1,
      "...": "..."
    }
  }
}
```

---

## Corruption Detection Logic

### Empty or Invalid Detection

The script checks for:

1. **Null or undefined values**
2. **Empty strings** (`""`)
3. **Empty JSON arrays** (`[]`)
4. **Arrays with only empty strings** (`["", "", ""]`)
5. **Invalid JSON** (malformed syntax)

### Known Corrupted Recipes

- Shannon Martinez Calabrian Spaghetti (Wine Selectors source)
- (Add more as discovered)

---

## Safety Features

1. **Idempotent**: Safe to run multiple times (already hidden recipes remain hidden)
2. **Dry Run Default**: Requires explicit `--execute` flag to make changes
3. **Batch Processing**: Updates in batches of 100 to avoid timeouts
4. **Detailed Logging**: Shows progress for each batch
5. **Error Handling**: Captures and reports errors with stack traces
6. **Report Preservation**: JSON report saved regardless of success/failure

---

## Verification

After execution, verify results:

```bash
# Count hidden recipes in database
psql $DATABASE_URL -c "SELECT COUNT(*) FROM recipes WHERE is_public = false;"

# Check specific corrupted recipe
psql $DATABASE_URL -c "SELECT name, is_public, instructions FROM recipes WHERE id = 'uuid';"

# Review report
cat tmp/corrupted-recipes-hidden-report.json | jq .
```

---

## Recovery (If Needed)

If you need to unhide specific recipes:

```sql
-- Unhide specific recipe
UPDATE recipes
SET is_public = true, updated_at = NOW()
WHERE id = 'recipe-uuid';

-- Unhide all recipes from specific source
UPDATE recipes
SET is_public = true, updated_at = NOW()
WHERE source LIKE 'food.com/recipe/%' AND is_public = false;
```

---

## Pre-Launch Checklist

- [x] Run dry-run to preview changes
- [x] Review `tmp/corrupted-recipes-hidden-report.json`
- [ ] Execute script with `--execute` flag
- [ ] Verify 224 recipes are hidden
- [ ] Check public recipe count: `4,697 - 224 = 4,473 public recipes`
- [ ] Spot-check several hidden recipes in database
- [ ] Re-run functional tests to ensure no broken links
- [ ] Update SEO sitemap (exclude hidden recipes)

---

## Technical Details

**Database Impact**:
- **Table**: `recipes`
- **Field Changed**: `is_public` (boolean)
- **Also Updated**: `updated_at` (timestamp)
- **Batch Size**: 100 records per transaction
- **Expected Duration**: 2-5 seconds for 224 recipes

**No Data Loss**:
- Recipes are NOT deleted
- Only visibility flag is changed
- Recipes can be manually reviewed and unhidden later
- All original data (instructions, ingredients, etc.) preserved

---

## Next Steps After Hiding

1. **Root Cause Analysis**: Investigate food.com scraping failures
2. **Fix Scraping**: Update scraper to handle edge cases
3. **Re-scrape**: Attempt to re-scrape 210 food.com recipes
4. **Manual Review**: Check remaining 14 recipes (Ottolenghi, MasterClass, etc.)
5. **Cleanup**: Delete recipes that cannot be fixed (optional)

---

## Related Files

- **Script**: `scripts/hide-corrupted-recipes.ts`
- **Report**: `tmp/corrupted-recipes-hidden-report.json`
- **Data Audit**: `tmp/data-quality-audit-report.json` (original detection)
- **Database Schema**: `src/lib/db/schema.ts` (recipes table definition)

---

**Last Updated**: 2025-10-24
**Status**: ✅ Ready for execution
**Launch Blocker**: 🔴 CRITICAL - Must run before October 27, 2025
