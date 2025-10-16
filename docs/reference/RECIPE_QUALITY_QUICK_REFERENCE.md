# Recipe Quality Review - Quick Reference

Fast reference guide for recipe quality review and removal operations.

## Current Status

```
Total Recipes: 3,282
Rated: 3,240 (98.7%)
Average Rating: 4.21/5.0

Low Quality (< 2.0): 6 recipes (0.2%) ← REMOVE
Fair Quality (2.0-2.9): 168 recipes (5.1%) ← REVIEW
Good+ Quality (3.0+): 3,066 recipes (94.6%) ← KEEP
```

---

## Quick Commands

### Analysis
```bash
# Check overall quality status
npx tsx scripts/check-recipe-quality.ts
```

### Export for Review
```bash
# Export to JSON
npx tsx scripts/export-low-quality-recipes.ts

# Export to CSV (for spreadsheets)
npx tsx scripts/export-low-quality-recipes.ts --format=csv

# Custom threshold (2.0-3.0 range)
npx tsx scripts/export-low-quality-recipes.ts --threshold=3.0
```

### Removal
```bash
# Dry run (safe - no changes)
npx tsx scripts/remove-low-quality-recipes.ts

# Execute removal (after review)
npx tsx scripts/remove-low-quality-recipes.ts --execute

# Custom threshold
npx tsx scripts/remove-low-quality-recipes.ts --threshold=2.5 --execute
```

---

## Rating Scale

| Rating | Quality | Action |
|--------|---------|--------|
| 0.0-1.9 | Poor | 🔴 **REMOVE** |
| 2.0-2.9 | Fair | 🟡 **REVIEW** |
| 3.0-3.9 | Good | 🟢 **KEEP** |
| 4.0-5.0 | Very Good+ | 🟢 **KEEP** |

---

## Recommended Workflow

### Option 1: Conservative (Recommended)

Remove only critical quality issues:

```bash
# 1. Check status
npx tsx scripts/check-recipe-quality.ts

# 2. Preview removal
npx tsx scripts/remove-low-quality-recipes.ts

# 3. Execute (removes 6 recipes)
npx tsx scripts/remove-low-quality-recipes.ts --execute

# 4. Verify
npx tsx scripts/check-recipe-quality.ts
```

**Impact**: Removes 6 recipes (0.2%), minimal risk

### Option 2: Review Fair Quality

Export and manually review borderline recipes:

```bash
# 1. Export for review
npx tsx scripts/export-low-quality-recipes.ts --format=csv

# 2. Review in spreadsheet
open tmp/review-recipes-*.csv

# 3. Remove after manual review
npx tsx scripts/remove-low-quality-recipes.ts --threshold=2.5 --execute
```

**Impact**: Removes ~90 recipes (2.7%), requires review

### Option 3: Cleanup First

Try improving recipes before removal:

```bash
# 1. Cleanup fair-quality recipes
npx tsx scripts/cleanup-recipe-content.ts --execute

# 2. Re-check quality
npx tsx scripts/check-recipe-quality.ts

# 3. Remove any still below threshold
npx tsx scripts/remove-low-quality-recipes.ts --execute
```

---

## Safety Features

✅ **Automatic backups** before removal
✅ **Dry-run mode** by default
✅ **5-second confirmation** in execute mode
✅ **Detailed logging** of all operations
✅ **Cascade deletes** (embeddings, ratings, flags)

### Backup Location
```
tmp/low-quality-recipes-backup-TIMESTAMP.json
tmp/recipe-removal-log-TIMESTAMP.json
```

### Rollback
```bash
# If needed, restore from backup
npx tsx scripts/rollback-recipe-removal.ts tmp/low-quality-recipes-backup-*.json
```

---

## Quality Criteria

### Critical Issues (< 2.0)

- ❌ Missing critical information (times, temps, servings)
- ❌ Incomplete ingredients or instructions
- ❌ Vague measurements ("some", "a bit")
- ❌ Unclear or contradictory steps
- ❌ Broken formatting or garbled text

### Example Low-Quality Recipe
```
Name: "1 2 3 bread"
Rating: 1.5/5.0
Reason: "Instructions are extremely vague and incomplete,
         with no clear measurements or cooking techniques.
         Missing critical information."
```

---

## File Locations

### Scripts
- `scripts/check-recipe-quality.ts` - Analysis tool
- `scripts/remove-low-quality-recipes.ts` - Removal tool
- `scripts/export-low-quality-recipes.ts` - Export tool
- `scripts/cleanup-recipe-content.ts` - Cleanup tool (existing)

### Documentation
- `docs/guides/RECIPE_QUALITY_REVIEW_GUIDE.md` - Full guide
- `docs/reference/RECIPE_QUALITY_QUICK_REFERENCE.md` - This file

### Database
- `src/lib/db/schema.ts` - Schema with rating fields
- `src/lib/ai/recipe-quality-evaluator.ts` - AI evaluator

---

## Troubleshooting

### "No recipes found"
Good news! Database is clean.

### "Script fails to connect"
Check `DATABASE_URL` in `.env.local`

### "Want to restore removed recipes"
Use rollback script with backup file

### "Need to rate unrated recipes"
See full guide for rating script example

---

## Next Steps After Removal

1. ✅ Run cleanup on fair-quality recipes (2.0-2.9)
2. ✅ Rate the 42 unrated recipes
3. ✅ Monitor new imports for quality
4. ✅ Set up automatic rating at import time
5. ✅ Schedule monthly quality audits

---

## Source Quality Insights

**Epicurious**: Excellent quality (avg 4.46)
**Food.com**: Mixed quality (avg 3.85, contains all 6 low-quality recipes)
**Web Crawls**: Good quality (avg 4.65)

**Recommendation**: Continue importing from Epicurious, screen food.com imports more carefully.

---

## Help & Documentation

**Full Documentation**: `docs/guides/RECIPE_QUALITY_REVIEW_GUIDE.md`

**Quick Help**:
```bash
# Any script help
npx tsx scripts/[script-name].ts --help

# Or just run without flags to see usage
npx tsx scripts/remove-low-quality-recipes.ts
```

---

**Last Updated**: 2025-10-16
**Quick Start**: Run `npx tsx scripts/check-recipe-quality.ts` to begin
