# Fix Double Numbered Instructions Script

## Overview
This script fixes recipe instructions that display with double numbering due to number prefixes stored in the database conflicting with frontend rendering.

## Problem
- **Issue**: Instructions display as "1. 1. Step text" instead of "1. Step text"
- **Cause**: Database stores "1. Step text" and frontend adds "1. " during render
- **Impact**: 148 recipes affected (3.4% of database)

## Usage

### Dry Run (Check Only)
```bash
pnpm tsx scripts/fix-double-numbered-instructions.ts
```
This will:
- Scan all recipes
- Report how many would be fixed
- Show sample before/after examples
- **Not modify** any data

### Execute Fix
```bash
pnpm tsx scripts/fix-double-numbered-instructions.ts --execute
```
This will:
- Scan all recipes
- Remove number prefixes from instructions
- Update database
- Report results

### Verify Fix
```bash
# Run again in dry mode to verify no issues remain
pnpm tsx scripts/fix-double-numbered-instructions.ts

# Or use verification script
pnpm tsx scripts/verify-fix.ts
```

## What It Does

### Pattern Detection
Finds instructions starting with:
- `1. Step text`
- `2. Step text`
- `10. Step text`
- etc.

### Fix Applied
```
Before: "1. Bring a large pot of water to a boil."
After:  "Bring a large pot of water to a boil."
```

### Frontend Behavior
```tsx
// Frontend adds step number:
{index + 1}. {instruction}

// Result:
1. Bring a large pot of water to a boil.
```

## Safety Features

1. **Dry run by default**: Must use `--execute` flag to modify data
2. **Validation**: Checks that fixes were applied correctly
3. **Error reporting**: Logs any issues encountered
4. **Sample preview**: Shows before/after for first 5 recipes
5. **JSON parsing**: Safely handles malformed JSON

## Output

```
🔍 Double Numbered Instructions Fix Script
==========================================

📋 Running in DRY RUN mode (use --execute to apply fixes)

📊 Fetching recipes from database...
Found 4345 total recipes

📝 Would fix: Penne Rigate with Sausage, Mushrooms, and Ricotta
...

==========================================
📈 EXECUTION REPORT
==========================================

Total Recipes Scanned: 4345
Affected Recipes Found: 148
Recipes That Would Be Fixed: 148
Errors Encountered: 0
```

## Files

- **Main script**: `fix-double-numbered-instructions.ts`
- **Verification**: `verify-fix.ts`
- **Detection utility**: `find-double-numbered.ts`
- **Report**: `../DOUBLE_NUMBERING_FIX_REPORT.md`
- **Summary**: `../docs/fixes/DOUBLE_NUMBERING_FIX_SUMMARY.md`

## Status

✅ **Completed**: All 148 affected recipes have been fixed
✅ **Verified**: Zero recipes with number prefixes remain
✅ **Safe**: No data loss or errors

## Prevention

For future recipe imports, ensure number prefixes are removed before storing:

```typescript
function normalizeInstructions(instructions: string[]): string[] {
  return instructions.map(inst =>
    inst.trim().replace(/^\d+\.\s*/, '')
  );
}
```

Apply this pattern in:
- `ingest-epicurious.ts`
- `ingest-foodcom.ts`
- `import-*-recipes.ts`
- Any new import scripts
