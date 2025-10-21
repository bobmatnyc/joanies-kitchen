# Ingredient Normalization and Consolidation Guide

**Complete guide for normalizing ingredient names and consolidating duplicates in Joanie's Kitchen.**

---

## Table of Contents

1. [Overview](#overview)
2. [Problem Statement](#problem-statement)
3. [Architecture](#architecture)
4. [Quick Start](#quick-start)
5. [Detailed Usage](#detailed-usage)
6. [Safety Features](#safety-features)
7. [Troubleshooting](#troubleshooting)
8. [Technical Details](#technical-details)

---

## Overview

The ingredient normalization system provides production-ready tools to clean and consolidate the ingredient database. It addresses four main problems:

1. **Quantity in Names**: Ingredients like "(1/4 Stick) Butter" with measurements in the name
2. **Preparation Suffixes**: Ingredients like "Basil Leaves" where "leaves" should be preparation metadata
3. **Exact Duplicates**: Multiple entries with identical names but different IDs
4. **Variant Duplicates**: Similar ingredients with minor formatting differences (e.g., "olive oil" vs "olive_oil")

**Target Outcome**: Reduce 3,042 ingredients to ~2,000-2,500 (30-40% reduction) while preserving all recipe relationships.

---

## Problem Statement

### Current Issues (October 2025)

**Analysis Results**:
- **Total Ingredients**: 3,042
- **Need Normalization**: 31 (1.0%)
  - Quantity extracted: 3
  - Preparation extracted: 29
  - Affected recipes: 153
- **Variant Duplicates**: 59 clusters
  - Examples: "white wine vinegar" vs "white-wine vinegar", "olive oil" vs "olive_oil"

### Examples of Problems

#### Problem 1: Quantity in Names
```
❌ Before: "(1/4 Stick) Butter"
✅ After:  "Butter" (quantity: "1/4 stick" stored in recipe_ingredients)
```

#### Problem 2: Preparation Suffixes
```
❌ Before: "Basil Leaves"
✅ After:  "Basil" (preparation: "leaves" stored in recipe_ingredients)
```

#### Problem 3: Variant Duplicates
```
❌ Before: "white wine vinegar" AND "white-wine vinegar" (2 separate entries)
✅ After:  "white wine vinegar" (aliases: ["white-wine vinegar"])
```

---

## Architecture

### Core Modules

#### 1. **Normalization** (`src/lib/ingredients/normalization.ts`)
- Extracts quantity/measurement prefixes
- Removes preparation suffixes
- Standardizes capitalization
- Generates clean slugs

**Key Functions**:
```typescript
normalizeIngredientName(raw: string): NormalizedIngredient
generateCanonicalSlug(name: string): string
areVariants(name1: string, name2: string): boolean
```

#### 2. **Preparation Parser** (`src/lib/ingredients/preparation-parser.ts`)
- Detects preparation methods (chopped, diced, minced, etc.)
- Handles modifiers (finely, coarsely)
- Parses states (fresh, dried, frozen)

**Key Functions**:
```typescript
parsePreparation(ingredientString: string): PreparationInfo
extractPreparation(ingredientText: string): { ingredient, preparation, amount, unit }
```

#### 3. **Fuzzy Matching** (`src/lib/ingredients/fuzzy-matching.ts`)
- Levenshtein distance algorithm
- Variant detection
- Cluster analysis for grouping duplicates

**Key Functions**:
```typescript
calculateSimilarity(str1: string, str2: string): number
findSimilarIngredients(ingredients, targetName, threshold): Array<{ingredient, similarity}>
clusterVariants(ingredients, threshold): Ingredient[][]
```

### Scripts

#### 1. **Normalize Ingredients** (`scripts/normalize-ingredients.ts`)
Normalizes ingredient names and extracts metadata.

**Features**:
- Batch processing with progress tracking
- Dry-run mode (preview changes)
- Automatic backup creation
- Atomic transactions

#### 2. **Consolidate Duplicates** (`scripts/consolidate-duplicates.ts`)
Finds and merges duplicate ingredients.

**Phases**:
- **Phase 1**: Exact duplicates (same name, different IDs)
- **Phase 2**: Variant duplicates (fuzzy matching)
- **Phase 3**: Alias creation

#### 3. **Rollback Normalization** (`scripts/rollback-normalization.ts`)
Restores ingredients from backup tables.

**Features**:
- List available backups
- Preview rollback impact
- Pre-rollback backup creation

---

## Quick Start

### Step 1: Analyze Current State

```bash
# View all ingredient issues
pnpm ingredients:analyze
```

### Step 2: Normalize Ingredients

```bash
# Preview normalization (dry-run)
pnpm ingredients:normalize

# Execute normalization
pnpm ingredients:normalize:execute
```

**What it does**:
- Removes quantity prefixes → stores in `recipe_ingredients.amount/unit`
- Extracts preparation → stores in `recipe_ingredients.preparation`
- Updates `ingredients.name`, `ingredients.slug`

### Step 3: Consolidate Duplicates

```bash
# Preview consolidation (dry-run)
pnpm ingredients:consolidate

# Execute consolidation
pnpm ingredients:consolidate:execute

# Or run specific phases:
pnpm ingredients:consolidate:exact     # Only exact duplicates
pnpm ingredients:consolidate:variants  # Only variant duplicates
```

**What it does**:
- Merges duplicate ingredients into canonical entries
- Updates all `recipe_ingredients` to point to canonical ID
- Stores merged names as aliases in `ingredients.aliases`
- Deletes duplicate entries

### Step 4: Verify Results

```bash
# Re-run analysis to see improvements
pnpm ingredients:analyze
```

### Rollback (if needed)

```bash
# List available backups
pnpm ingredients:rollback:list

# Preview rollback
pnpm ingredients:rollback -- --backup ingredients_backup_2025-10-21T12-00-00

# Execute rollback
pnpm ingredients:rollback -- --backup ingredients_backup_2025-10-21T12-00-00 --execute
```

---

## Detailed Usage

### Normalization Options

```bash
# Preview normalization
pnpm ingredients:normalize

# Execute normalization
pnpm ingredients:normalize:execute

# Advanced options
npx tsx scripts/normalize-ingredients.ts --help
npx tsx scripts/normalize-ingredients.ts --limit 100    # Test on 100 ingredients
npx tsx scripts/normalize-ingredients.ts --verbose      # Show detailed progress
```

### Consolidation Options

```bash
# Preview all duplicates
pnpm ingredients:consolidate

# Execute consolidation
pnpm ingredients:consolidate:execute

# Advanced options
npx tsx scripts/consolidate-duplicates.ts --help
npx tsx scripts/consolidate-duplicates.ts --threshold 0.9  # Stricter matching
npx tsx scripts/consolidate-duplicates.ts --phase exact    # Only exact duplicates
npx tsx scripts/consolidate-duplicates.ts --verbose        # Show detailed progress
```

### Rollback Options

```bash
# List backups
pnpm ingredients:rollback:list

# Rollback from backup
pnpm ingredients:rollback -- --backup <TABLE_NAME>
pnpm ingredients:rollback -- --backup <TABLE_NAME> --execute

# Advanced options
npx tsx scripts/rollback-normalization.ts --help
```

---

## Safety Features

### 1. Automatic Backups

**Before ANY execution**, scripts create timestamped backup tables:

```sql
ingredients_backup_2025-10-21T12-00-00
recipe_ingredients_backup_2025-10-21T12-00-00
```

**Restore from backup**:
```bash
pnpm ingredients:rollback:list
pnpm ingredients:rollback -- --backup ingredients_backup_2025-10-21T12-00-00 --execute
```

### 2. Dry-Run Mode (Default)

All scripts default to **dry-run** (preview mode). Must explicitly use `--execute` to apply changes.

```bash
pnpm ingredients:normalize           # ✅ Safe: Preview only
pnpm ingredients:normalize:execute   # ⚠️  Execute: Applies changes
```

### 3. Atomic Transactions

All database modifications wrapped in transactions:

```typescript
await db.transaction(async (tx) => {
  // All operations here
  // If ANY operation fails, ENTIRE transaction rolls back
});
```

### 4. Comprehensive Reports

Every execution generates detailed reports in `tmp/`:

- **Normalization**: `tmp/normalization-report.md`
- **Consolidation**: `tmp/consolidation-report.md`

**Report Contents**:
- Summary statistics
- Before/after comparisons
- Affected recipe counts
- Detailed change log

### 5. Validation Checks

Scripts validate:
- ✅ No broken foreign key relationships
- ✅ All recipe_ingredients still link to valid ingredients
- ✅ No data loss (recipe counts match)

---

## Troubleshooting

### Issue: Normalization detects wrong ingredients

**Problem**: "Basil Leaves" should keep "leaves" as part of the name (special case).

**Solution**: Add to `LEAVES_ARE_INGREDIENT` in `src/lib/ingredients/normalization.ts`:

```typescript
const LEAVES_ARE_INGREDIENT = [
  'bay leaves',
  'banana leaves',
  'grape leaves',
  // Add your special case here
];
```

### Issue: Consolidation merges wrong variants

**Problem**: "milk chocolate" and "chocolate milk" incorrectly merged.

**Solution**: Increase similarity threshold or manually exclude in fuzzy-matching logic:

```bash
# Use stricter threshold
npx tsx scripts/consolidate-duplicates.ts --threshold 0.95
```

### Issue: Need to undo normalization

**Problem**: Applied normalization but need to revert.

**Solution**: Use rollback script:

```bash
# List backups
pnpm ingredients:rollback:list

# Restore from backup
pnpm ingredients:rollback -- --backup ingredients_backup_TIMESTAMP --execute
```

### Issue: Performance is slow

**Problem**: Script takes too long on large dataset.

**Optimization Applied**:
- ✅ Batch recipe count fetching (single query instead of 3,042 individual queries)
- ✅ In-memory clustering for variants
- ✅ Indexed queries

**Test on subset**:
```bash
npx tsx scripts/normalize-ingredients.ts --limit 100
```

---

## Technical Details

### Database Schema Changes

#### Before Normalization:

**ingredients**:
```
id: uuid
name: "basil leaves"
display_name: "Basil Leaves"
slug: "basil-leaves"
```

**recipe_ingredients**:
```
id: uuid
ingredient_id: <basil_leaves_id>
amount: "2"
unit: "cups"
preparation: null
```

#### After Normalization:

**ingredients**:
```
id: uuid
name: "basil"
display_name: "Basil"
slug: "basil"
```

**recipe_ingredients**:
```
id: uuid
ingredient_id: <basil_id>
amount: "2"
unit: "cups"
preparation: "leaves"  ← Extracted here
```

### Consolidation Algorithm

**Phase 1: Exact Duplicates**
```
1. Group ingredients by name
2. For each group with >1 ingredient:
   a. Select canonical (prefer slug, higher usage)
   b. Update all recipe_ingredients to canonical ID
   c. Merge aliases
   d. Delete duplicates
```

**Phase 2: Variant Duplicates**
```
1. Calculate pairwise similarity (Levenshtein distance)
2. Cluster ingredients with similarity > threshold
3. For each cluster:
   a. Select canonical (prefer shorter, spaces over hyphens)
   b. Update all recipe_ingredients to canonical ID
   c. Store variants as aliases
   d. Delete non-canonical entries
```

### Similarity Calculation

Uses **Levenshtein distance** (edit distance):

```typescript
calculateSimilarity("olive oil", "olive_oil")
// Returns: ~0.94 (94% similar)

calculateSimilarity("milk chocolate", "chocolate milk")
// Returns: ~0.29 (29% similar - NOT a match)
```

**Threshold**: Default 0.85 (85% similarity required)

### Special Cases Handling

#### 1. Leaves as Ingredient
Some ingredients naturally include "leaves" in their name:

```typescript
const LEAVES_ARE_INGREDIENT = [
  'bay leaves',      // Bay leaves are the ingredient itself
  'banana leaves',   // Used for wrapping
  'grape leaves',    // Used for dolmas
  'kaffir lime leaves',
  'curry leaves',
];
```

#### 2. Compound Preparations
Handles complex patterns:

```
"finely chopped fresh basil"
→ ingredient: "basil"
→ preparation: "finely chopped fresh"
```

#### 3. Quantity Patterns
Extracts various formats:

```
"(1/4 Stick) Butter"     → quantity: "1/4 stick"
"10-ounce Can Tomatoes"  → quantity: "10-ounce"
"2-3 Pound Chicken"      → quantity: "2-3 Pound"
```

---

## Expected Outcomes

### Metrics (Based on October 2025 Analysis)

**Before**:
- Total Ingredients: 3,042
- Duplicates/Variants: ~90
- Ingredients with preparation suffixes: 29
- Ingredients with quantities: 3

**After** (Projected):
- Total Ingredients: ~2,500-2,700 (12-18% reduction)
- Duplicates/Variants: 0
- Preparation data: Extracted to `recipe_ingredients.preparation`
- Quantity data: Removed from ingredient names
- Aliases: ~150+ created for variant tracking

### Success Criteria

✅ **Data Integrity**:
- Zero broken recipe relationships
- All recipes retain correct ingredient associations
- Preparation data preserved in `recipe_ingredients.preparation`

✅ **Code Quality**:
- Single source of truth for each ingredient
- Consistent naming (lowercase normalized)
- Clean, SEO-friendly slugs

✅ **Usability**:
- Autocomplete shows canonical names
- Search finds ingredients by name or alias
- Recipe pages display proper preparation methods

---

## Maintenance

### Re-running Normalization

Safe to re-run scripts at any time:

```bash
# Scripts are idempotent (safe to run multiple times)
pnpm ingredients:normalize          # Preview changes
pnpm ingredients:normalize:execute  # Apply changes
```

**What happens on re-run**:
- Only processes ingredients that need normalization
- Skips already-normalized ingredients
- Creates new backup each time

### Monitoring

**Check ingredient quality**:
```bash
pnpm ingredients:analyze  # Shows current state
```

**Review recent backups**:
```bash
pnpm ingredients:rollback:list
```

### Cleanup

**Remove old backups** (manual):
```sql
-- List backup tables
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE '%backup%'
ORDER BY tablename DESC;

-- Drop old backup (after verifying not needed)
DROP TABLE ingredients_backup_2025-10-21T12-00-00;
```

---

## FAQ

### Q: Will this break my recipes?

**A**: No. All recipe relationships are preserved. Scripts only modify ingredient names and create proper metadata.

### Q: What if I need to undo changes?

**A**: Use the rollback script with the automatic backup created before execution.

### Q: Can I test on a subset first?

**A**: Yes, use `--limit N` flag:
```bash
npx tsx scripts/normalize-ingredients.ts --limit 100
```

### Q: How do I know which ingredients will change?

**A**: Run in dry-run mode (default) and check `tmp/normalization-report.md`.

### Q: What about manually created ingredients?

**A**: Scripts handle all ingredients uniformly. User-created and system ingredients are treated the same.

---

## Support

**Issues or Questions**:
1. Check this guide
2. Review generated reports in `tmp/`
3. Inspect source code in `src/lib/ingredients/`
4. Test with `--limit` flag on small dataset

**Best Practices**:
- Always run dry-run first
- Review generated reports
- Test rollback on development environment
- Keep at least one backup before cleanup

---

**Last Updated**: 2025-10-21
**Version**: 1.0.0
