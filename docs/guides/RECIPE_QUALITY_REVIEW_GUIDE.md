# Recipe Quality Review & Removal Guide

Comprehensive guide for identifying and removing low-quality recipes from the Recipe Manager database.

## Table of Contents

- [Overview](#overview)
- [Quality Evaluation System](#quality-evaluation-system)
- [Quality Criteria](#quality-criteria)
- [Current Database Status](#current-database-status)
- [Removal Thresholds](#removal-thresholds)
- [Implementation Workflow](#implementation-workflow)
- [Scripts Reference](#scripts-reference)
- [Safety & Rollback](#safety--rollback)

---

## Overview

**Current Status (as of 2025-10-16):**
- **Total Recipes**: 3,282
- **Rated Recipes**: 3,240 (98.7%)
- **Average Rating**: 4.21/5.0
- **Low Quality (< 2.0)**: 6 recipes (0.2%)
- **Fair Quality (2.0-2.9)**: 168 recipes (5.1%)
- **Good+ Quality (3.0+)**: 3,066 recipes (94.6%)

**Primary Goal**: Remove recipes with critical quality issues (rating < 2.0) to improve overall database quality and user experience.

---

## Quality Evaluation System

### AI-Powered Rating System

The Recipe Manager uses an **AI-powered quality evaluator** (`src/lib/ai/recipe-quality-evaluator.ts`) that rates recipes on a **0-5 scale** based on:

1. **Clarity of Instructions** - Are steps clear, logical, and easy to follow?
2. **Ingredient Completeness** - Well-defined measurements and descriptions?
3. **Cooking Techniques** - Appropriate methods for the dish?
4. **Recipe Completeness** - Has all necessary information?
5. **Practicality** - Can average home cook make this successfully?

### Rating Scale

| Rating | Quality Level | Description | Action |
|--------|---------------|-------------|--------|
| **0.0-0.9** | Unusable | Critical issues, cannot be followed | 🔴 **REMOVE** |
| **1.0-1.9** | Poor | Major problems, unclear, incomplete | 🔴 **REMOVE** |
| **2.0-2.9** | Fair | Significant issues, missing details | 🟡 **REVIEW** |
| **3.0-3.9** | Good | Usable but has some issues | 🟢 **KEEP** |
| **4.0-4.9** | Very Good | Minor improvements possible | 🟢 **KEEP** |
| **5.0** | Excellent | Professional quality, clear, complete | 🟢 **KEEP** |

### Database Schema Fields

```typescript
// recipes table (src/lib/db/schema.ts)
{
  system_rating: decimal('system_rating', { precision: 2, scale: 1 }), // 0.0-5.0
  system_rating_reason: text('system_rating_reason'), // AI explanation
  avg_user_rating: decimal('avg_user_rating', { precision: 2, scale: 1 }), // User ratings
  total_user_ratings: integer('total_user_ratings').default(0), // Rating count
}
```

---

## Quality Criteria

### Critical Quality Issues (Rating < 2.0)

Recipes are rated below 2.0 when they have **critical defects** that make them unusable:

#### Content Completeness Issues
- **Missing critical information**: No cooking times, temperatures, or serving sizes
- **Incomplete ingredients list**: Missing key ingredients or entire ingredient sections
- **No instructions**: Missing or extremely vague cooking steps

#### Content Clarity Issues
- **Vague measurements**: "Some flour", "A bit of salt" instead of specific amounts
- **Unclear instructions**: Steps that don't make sense or contradict each other
- **Missing preparation details**: No indication of how to prepare ingredients

#### Content Accuracy Issues
- **Impossible cooking times**: "Cook for 5 seconds" for a roast
- **Incorrect measurements**: Obviously wrong quantities
- **Broken formatting**: Garbled text, HTML artifacts, encoding issues

#### Duplicate/Redundant Content
- **Near-identical recipes**: Same recipe with minor title variations
- **Auto-generated spam**: Low-effort content from automated scraping

### Example: Poor Quality Recipe

```json
{
  "name": "homemade  vegetable soup from a can",
  "rating": 1.5,
  "reason": "The recipe lacks clear instructions, specific ingredient measurements,
             and important cooking details. It appears to be a simple canned soup
             recipe rather than a homemade vegetable soup, making it impractical
             for an average home cook.",
  "source": "food.com/recipe/87098"
}
```

### Fair Quality Issues (Rating 2.0-2.9)

These recipes have **significant issues** but may be salvageable:

- **Partially incomplete**: Some details missing but core recipe is present
- **Poor formatting**: Hard to read but information is there
- **Inconsistent units**: Mix of metric and imperial without conversions
- **Minimal instructions**: Very brief but technically complete
- **Source quality**: Low-quality source but recipe itself is functional

---

## Current Database Status

### Rating Distribution (3,240 rated recipes)

```
0.0-0.9 (Unusable):        0 recipes (0.0%)
1.0-1.9 (Poor):            6 recipes (0.2%)   ← REMOVE THESE
2.0-2.9 (Fair):          168 recipes (5.2%)   ← REVIEW THESE
3.0-3.9 (Good):          480 recipes (14.8%)
4.0-4.9 (Very Good):   2,586 recipes (79.8%)
5.0 (Excellent):           0 recipes (0.0%)
```

### Source Breakdown

| Source | Total | Rated | Avg Rating | Low Quality |
|--------|-------|-------|------------|-------------|
| epicurious.com | 2,259 | 2,259 | 4.46 | 0 |
| food.com | ~980 | ~976 | 3.85 | 6 |
| Web crawls | ~12 | ~5 | 4.65 | 0 |
| System/Internal | 31 | 0 | N/A | 0 |

**Key Insight**: All 6 low-quality recipes are from food.com scraping, while Epicurious recipes have consistently high quality (avg 4.46).

---

## Removal Thresholds

### Recommended Approach: Option A (Conservative)

**Threshold**: Remove recipes with `system_rating < 2.0`

**Rationale**:
- ✅ **Conservative**: Only removes recipes with critical issues
- ✅ **Low impact**: Only 6 recipes (0.2% of total)
- ✅ **High confidence**: AI identified severe problems in all cases
- ✅ **Minimal risk**: Very unlikely to remove salvageable content
- ✅ **Clear criteria**: Unambiguous threshold

**Impact**:
- Removes: 6 recipes
- Database size reduction: < 0.2%
- Average rating improvement: 4.21 → 4.22 (minimal)
- Minimum rating improvement: 1.5 → 2.0

### Alternative: Option B (Moderate)

**Threshold**: Remove recipes with `system_rating < 2.5`

**Impact**:
- Removes: ~90 recipes (interpolated between 2.0-2.9 range)
- Database size reduction: ~2.7%
- Requires more careful review

### Alternative: Option C (Aggressive)

**Threshold**: Remove recipes with `system_rating < 3.0`

**Impact**:
- Removes: 174 recipes (5.3%)
- Database size reduction: 5.3%
- Higher risk of removing salvageable recipes
- **Not recommended** without manual review

---

## Implementation Workflow

### Phase 1: Analysis (Already Complete ✅)

```bash
# Check current quality status
npx tsx scripts/check-recipe-quality.ts
```

**Output**:
- Total recipes and rating distribution
- Source breakdown with quality metrics
- Sample low-quality recipes
- Recommendations

### Phase 2: Review & Export

```bash
# Export low-quality recipes for manual review (JSON)
npx tsx scripts/export-low-quality-recipes.ts

# Export to CSV for spreadsheet review
npx tsx scripts/export-low-quality-recipes.ts --format=csv

# Custom threshold (review 2.0-3.0 range)
npx tsx scripts/export-low-quality-recipes.ts --threshold=3.0
```

**Review Checklist**:
- [ ] Examine ingredient lists for completeness
- [ ] Check instruction clarity and completeness
- [ ] Verify cooking times/temperatures are present
- [ ] Identify truly unusable vs. salvageable recipes
- [ ] Note any patterns (source, date, etc.)

### Phase 3: Dry Run Removal

```bash
# Dry run with default threshold (< 2.0)
npx tsx scripts/remove-low-quality-recipes.ts

# Dry run with custom threshold
npx tsx scripts/remove-low-quality-recipes.ts --threshold=2.5
```

**Dry Run Output**:
- List of recipes to be removed
- Backup file location
- Impact summary
- No actual changes to database

### Phase 4: Execute Removal

```bash
# Execute removal (with 5-second confirmation delay)
npx tsx scripts/remove-low-quality-recipes.ts --execute

# Execute with custom threshold
npx tsx scripts/remove-low-quality-recipes.ts --execute --threshold=2.5
```

**Safety Features**:
- ✅ Automatic backup before removal
- ✅ 5-second countdown for confirmation
- ✅ Detailed logging of all removals
- ✅ Cascading deletes (embeddings, ratings, flags)
- ✅ Error handling and rollback support

### Phase 5: Verification

```bash
# Re-run quality check to verify removal
npx tsx scripts/check-recipe-quality.ts
```

**Verify**:
- [ ] Total recipe count decreased correctly
- [ ] No recipes remain below threshold
- [ ] Average rating improved
- [ ] Minimum rating increased
- [ ] No errors in logs

---

## Scripts Reference

### 1. Check Recipe Quality

**Script**: `scripts/check-recipe-quality.ts`

**Purpose**: Analyze current database quality and identify issues

**Usage**:
```bash
npx tsx scripts/check-recipe-quality.ts
```

**Output**:
- Overall statistics (total, rated, unrated)
- Rating distribution breakdown
- Source-level quality metrics
- Sample low-quality recipes
- Actionable recommendations

**When to Use**:
- Initial analysis before removal
- After removal to verify changes
- Regular quality audits
- Before/after cleanup operations

---

### 2. Export Low-Quality Recipes

**Script**: `scripts/export-low-quality-recipes.ts`

**Purpose**: Export fair-quality recipes (2.0-2.9) for manual review

**Usage**:
```bash
# Export to JSON (default)
npx tsx scripts/export-low-quality-recipes.ts

# Export to CSV
npx tsx scripts/export-low-quality-recipes.ts --format=csv

# Custom threshold
npx tsx scripts/export-low-quality-recipes.ts --threshold=3.0
```

**Output Files**:
- `tmp/review-recipes-TIMESTAMP.json` (full recipe data)
- `tmp/review-recipes-TIMESTAMP.csv` (summary data)

**Exported Data**:
- Recipe ID, name, rating, reason
- Full ingredients and instructions
- Source, metadata, timestamps
- Rating and source breakdowns

**When to Use**:
- Manual review of borderline recipes
- Identifying patterns in low-quality recipes
- Bulk editing/cleanup preparation
- Quality audit documentation

---

### 3. Remove Low-Quality Recipes

**Script**: `scripts/remove-low-quality-recipes.ts`

**Purpose**: Remove recipes with critical quality issues

**Usage**:
```bash
# Dry run (default - safe)
npx tsx scripts/remove-low-quality-recipes.ts

# Execute removal
npx tsx scripts/remove-low-quality-recipes.ts --execute

# Custom threshold
npx tsx scripts/remove-low-quality-recipes.ts --threshold=2.5 --execute
```

**Options**:
- `--execute`: Apply changes (default is dry-run)
- `--threshold=N.N`: Custom rating threshold (default: 2.0)

**Safety Features**:
- Automatic backup to `tmp/low-quality-recipes-backup-TIMESTAMP.json`
- Detailed log to `tmp/recipe-removal-log-TIMESTAMP.json`
- 5-second confirmation delay in execute mode
- Cascading deletes (safe foreign key handling)
- Error tracking and reporting

**What Gets Deleted**:
- Recipe record from `recipes` table
- Associated embeddings from `recipe_embeddings` (CASCADE)
- Associated ratings from `recipe_ratings` (CASCADE)
- Associated flags from `recipe_flags` (CASCADE)

**When to Use**:
- After reviewing dry-run output
- After manual review confirms removal
- During regular quality maintenance
- After bulk import from low-quality sources

---

### 4. Cleanup Recipe Content (Existing Script)

**Script**: `scripts/cleanup-recipe-content.ts`

**Purpose**: Fix quality issues in existing recipes (complementary to removal)

**Usage**:
```bash
# Dry run
npx tsx scripts/cleanup-recipe-content.ts

# Execute cleanup
npx tsx scripts/cleanup-recipe-content.ts --execute
```

**What It Fixes**:
- Missing ingredient amounts
- Title capitalization
- Description grammar and clarity

**When to Use**:
- **AFTER** removing truly unusable recipes
- For borderline recipes (2.0-2.9 range)
- To improve fair-quality recipes
- Regular maintenance

---

## Safety & Rollback

### Backup Strategy

**Automatic Backups**:
- Created before every removal operation
- Stored in `tmp/` directory with timestamp
- Contains full recipe data including all fields
- JSON format for easy restoration

**Backup Location**:
```
tmp/low-quality-recipes-backup-YYYY-MM-DDTHH-MM-SS.json
```

**Backup Contents**:
```json
[
  {
    "id": "recipe-uuid",
    "name": "Recipe Name",
    "system_rating": 1.5,
    "system_rating_reason": "Explanation...",
    "ingredients": "...",
    "instructions": "...",
    // ... all recipe fields
  }
]
```

### Rollback Procedure

**If you need to restore removed recipes**:

1. **Locate Backup File**:
   ```bash
   ls -lht tmp/low-quality-recipes-backup-*.json | head
   ```

2. **Create Rollback Script** (`scripts/rollback-recipe-removal.ts`):
   ```typescript
   #!/usr/bin/env tsx
   import { db } from '../src/lib/db';
   import { recipes } from '../src/lib/db/schema';
   import fs from 'fs/promises';

   async function rollback(backupFile: string) {
     const data = await fs.readFile(backupFile, 'utf-8');
     const recipesToRestore = JSON.parse(data);

     console.log(`Restoring ${recipesToRestore.length} recipes...`);

     for (const recipe of recipesToRestore) {
       await db.insert(recipes).values(recipe).onConflictDoNothing();
       console.log(`✓ Restored: ${recipe.name}`);
     }

     console.log('✅ Rollback complete');
   }

   const backupFile = process.argv[2];
   if (!backupFile) {
     console.error('Usage: npx tsx scripts/rollback-recipe-removal.ts <backup-file>');
     process.exit(1);
   }

   rollback(backupFile);
   ```

3. **Execute Rollback**:
   ```bash
   npx tsx scripts/rollback-recipe-removal.ts tmp/low-quality-recipes-backup-2025-10-16T08-00-35.json
   ```

### Log Files

**Removal Logs**: `tmp/recipe-removal-log-TIMESTAMP.json`

Contains:
- Timestamp of operation
- Statistics (total, removed, failed)
- Full list of removed recipes
- Error details (if any)

**Example Log**:
```json
{
  "timestamp": "2025-10-16T08-00-35",
  "stats": {
    "total": 6,
    "removed": 6,
    "failed": 0,
    "errors": []
  },
  "recipesRemoved": [
    {
      "id": "uuid",
      "name": "Recipe Name",
      "rating": 1.5,
      "reason": "Quality issues...",
      "source": "food.com"
    }
  ]
}
```

---

## Best Practices

### Before Removal

1. ✅ **Run quality check** to understand current state
2. ✅ **Export borderline recipes** for manual review
3. ✅ **Run dry-run** to preview changes
4. ✅ **Review sample recipes** in dry-run output
5. ✅ **Verify backup creation** works

### During Removal

1. ✅ **Start with conservative threshold** (< 2.0)
2. ✅ **Review 5-second countdown** before confirming
3. ✅ **Monitor console output** for errors
4. ✅ **Don't interrupt process** once started
5. ✅ **Save log files** for audit trail

### After Removal

1. ✅ **Re-run quality check** to verify changes
2. ✅ **Check database statistics** match expectations
3. ✅ **Review log files** for any errors
4. ✅ **Test recipe browsing** in application
5. ✅ **Keep backups** for at least 30 days

### Regular Maintenance

1. 🔄 **Monthly quality audits** with check script
2. 🔄 **Quarterly cleanup** of fair-quality recipes
3. 🔄 **Rate new recipes** within 24 hours of import
4. 🔄 **Monitor source quality** and adjust import strategy
5. 🔄 **Archive old backups** after 90 days

---

## Frequently Asked Questions

### Q: How were recipes rated?

**A**: Recipes were rated using the AI quality evaluator (`src/lib/ai/recipe-quality-evaluator.ts`) which analyzes:
- Ingredient completeness and clarity
- Instruction quality and detail
- Recipe metadata (times, servings, etc.)
- Overall practicality for home cooks

The evaluator uses Claude 3 Haiku via OpenRouter API and provides both a numerical rating (0-5) and a text explanation.

### Q: Can I change the rating threshold?

**A**: Yes! Use the `--threshold` flag:

```bash
# Remove recipes < 2.5
npx tsx scripts/remove-low-quality-recipes.ts --threshold=2.5 --execute

# Review recipes 2.0-3.5
npx tsx scripts/export-low-quality-recipes.ts --threshold=3.5
```

### Q: What happens to associated data?

**A**: The database uses **CASCADE deletes** for foreign keys:
- Recipe embeddings (vector search) are automatically deleted
- User ratings are automatically deleted
- Content flags are automatically deleted

This prevents orphaned data and maintains referential integrity.

### Q: Can I manually adjust ratings?

**A**: Yes! You can update ratings directly:

```sql
-- Increase rating for specific recipe
UPDATE recipes
SET system_rating = 3.0,
    system_rating_reason = 'Manual adjustment after cleanup'
WHERE id = 'recipe-uuid';

-- Re-rate all recipes from a source
UPDATE recipes
SET system_rating = NULL,
    system_rating_reason = NULL
WHERE source LIKE 'food.com%';
```

Then re-run the quality evaluator on those recipes.

### Q: Should I remove or cleanup fair-quality recipes?

**A**: **Recommendation**: Try cleanup first, then remove if still low quality.

**Workflow**:
1. Run cleanup script on fair-quality recipes (2.0-2.9)
2. Wait for AI to re-evaluate cleaned recipes
3. Remove any that still fall below threshold
4. Manual review remaining borderline cases

```bash
# Cleanup fair recipes
npx tsx scripts/cleanup-recipe-content.ts --execute

# Re-check quality
npx tsx scripts/check-recipe-quality.ts

# Remove any still below 2.0
npx tsx scripts/remove-low-quality-recipes.ts --execute
```

### Q: How do I rate the 42 unrated recipes?

**A**: Create a script to evaluate unrated recipes:

```bash
# scripts/rate-unrated-recipes.ts
import { db } from '../src/lib/db';
import { recipes } from '../src/lib/db/schema';
import { isNull } from 'drizzle-orm';
import { evaluateRecipeQuality } from '../src/lib/ai/recipe-quality-evaluator';

async function rateUnratedRecipes() {
  const unrated = await db.select().from(recipes)
    .where(isNull(recipes.system_rating));

  for (const recipe of unrated) {
    const evaluation = await evaluateRecipeQuality({
      name: recipe.name,
      description: recipe.description,
      ingredients: JSON.parse(recipe.ingredients),
      instructions: JSON.parse(recipe.instructions),
      // ...
    });

    await db.update(recipes)
      .set({
        system_rating: evaluation.rating.toString(),
        system_rating_reason: evaluation.reasoning,
      })
      .where(eq(recipes.id, recipe.id));
  }
}
```

### Q: What's the cost of AI rating?

**A**: Using Claude 3 Haiku via OpenRouter:
- Cost: ~$0.25 per 1 million input tokens
- Per recipe: ~500 tokens average = $0.000125 per recipe
- 3,282 recipes: ~$0.41 total

Very affordable for quality assurance!

---

## Summary: Recommended Action Plan

### Immediate Action (Conservative Approach)

✅ **APPROVED FOR EXECUTION**

```bash
# 1. Final review
npx tsx scripts/check-recipe-quality.ts

# 2. Execute removal of critical quality issues
npx tsx scripts/remove-low-quality-recipes.ts --execute

# 3. Verify changes
npx tsx scripts/check-recipe-quality.ts
```

**Impact**:
- Removes: 6 recipes (0.2% of database)
- All from food.com source
- All have critical quality issues
- Minimal risk, high quality improvement

### Future Actions (Optional)

1. **Manual review fair-quality recipes**:
   ```bash
   npx tsx scripts/export-low-quality-recipes.ts --format=csv
   ```

2. **Cleanup borderline recipes**:
   ```bash
   npx tsx scripts/cleanup-recipe-content.ts --execute
   ```

3. **Rate remaining unrated recipes**:
   Create script to evaluate 42 unrated recipes

4. **Monitor new imports**:
   Automatically rate recipes at import time

---

## Related Documentation

- **Database Schema**: `src/lib/db/schema.ts`
- **Quality Evaluator**: `src/lib/ai/recipe-quality-evaluator.ts`
- **Content Cleanup**: `docs/guides/RECIPE_CONTENT_CLEANUP_GUIDE.md`
- **Project Organization**: `docs/reference/PROJECT_ORGANIZATION.md`

---

**Last Updated**: 2025-10-16
**Author**: Recipe Manager Team
**Status**: Ready for Implementation
