# Ingredient Normalization Scripts

**Production-ready scripts for normalizing and consolidating ingredients in Joanie's Kitchen.**

---

## Quick Reference

### Analysis
```bash
pnpm ingredients:analyze              # View current ingredient issues
```

### Normalization
```bash
pnpm ingredients:normalize            # Preview normalization changes
pnpm ingredients:normalize:execute    # Execute normalization
```

### Consolidation
```bash
pnpm ingredients:consolidate          # Preview all duplicates
pnpm ingredients:consolidate:execute  # Execute consolidation
pnpm ingredients:consolidate:exact    # Only exact duplicates
pnpm ingredients:consolidate:variants # Only variant duplicates
```

### Rollback
```bash
pnpm ingredients:rollback:list        # List available backups
pnpm ingredients:rollback -- --backup <TABLE> --execute  # Restore from backup
```

---

## File Structure

```
scripts/
├── analyze-duplicates.ts          # Analysis tool (diagnostic)
├── normalize-ingredients.ts       # Main normalization script
├── consolidate-duplicates.ts      # Duplicate consolidation script
└── rollback-normalization.ts      # Rollback/restore script

src/lib/ingredients/
├── normalization.ts               # Core normalization logic
├── preparation-parser.ts          # Preparation extraction
└── fuzzy-matching.ts              # Similarity algorithms
```

---

## Script Details

### 1. `analyze-duplicates.ts`

**Purpose**: Diagnostic tool to identify ingredient issues.

**What it detects**:
- Exact duplicates (same name, different IDs)
- Preparation suffixes ("Basil Leaves")
- Quantity in names ("(1/4 Stick) Butter")
- Variant duplicates ("olive oil" vs "olive_oil")
- Category distribution

**Usage**:
```bash
pnpm ingredients:analyze
```

**Output**:
```
📊 Total Ingredients: 3042
🔴 Exact Duplicates: 0
🟡 Preparation Suffixes: 29
🟠 Quantity in Names: 3
🔵 Variant Duplicates: 59 clusters
```

**When to use**:
- Before normalization (understand scope)
- After normalization (verify improvements)
- Regular health checks

---

### 2. `normalize-ingredients.ts`

**Purpose**: Normalize ingredient names and extract metadata.

**What it does**:
1. Removes quantity prefixes: `"(1/4 Stick) Butter"` → `"Butter"`
2. Extracts preparation: `"Basil Leaves"` → `"Basil"` (preparation: "leaves")
3. Standardizes case: `"OLIVE OIL"` → `"Olive Oil"`
4. Generates slugs: `"Extra-Virgin Olive Oil"` → `"extra-virgin-olive-oil"`

**Usage**:
```bash
# Dry-run (preview)
pnpm ingredients:normalize

# Execute
pnpm ingredients:normalize:execute

# Advanced
npx tsx scripts/normalize-ingredients.ts --help
npx tsx scripts/normalize-ingredients.ts --limit 100 --verbose
```

**Options**:
- `--execute`: Apply changes (default: dry-run)
- `--verbose`: Show detailed progress
- `--limit N`: Process only N ingredients (for testing)
- `--help`: Show help

**Output**:
- Console summary
- `tmp/normalization-report.md`: Detailed report
- Automatic backup table: `ingredients_backup_TIMESTAMP`

**Example output**:
```
📊 Analysis Results:
   Total Ingredients: 3042
   Need Normalization: 31
   - With Quantity: 3
   - With Preparation: 29
   Affected Recipes: 153

📝 Preview of Changes (first 10):
   "basil leaves" → "basil"
      └─ Preparation: leaves
      └─ Affects 31 recipes
```

**Safety**:
- ✅ Dry-run by default
- ✅ Automatic backup before execution
- ✅ Atomic transaction (all or nothing)
- ✅ No data loss

---

### 3. `consolidate-duplicates.ts`

**Purpose**: Find and merge duplicate ingredients.

**What it does**:

**Phase 1: Exact Duplicates**
- Finds ingredients with identical names but different IDs
- Merges to canonical ingredient
- Updates all recipe relationships

**Phase 2: Variant Duplicates**
- Uses fuzzy matching (Levenshtein distance)
- Clusters similar ingredients (e.g., "olive oil" vs "olive_oil")
- Merges variants to canonical form
- Stores merged names as aliases

**Usage**:
```bash
# Dry-run (all phases)
pnpm ingredients:consolidate

# Execute (all phases)
pnpm ingredients:consolidate:execute

# Specific phases
pnpm ingredients:consolidate:exact     # Only exact duplicates
pnpm ingredients:consolidate:variants  # Only variants

# Advanced
npx tsx scripts/consolidate-duplicates.ts --help
npx tsx scripts/consolidate-duplicates.ts --threshold 0.9  # Stricter matching
npx tsx scripts/consolidate-duplicates.ts --verbose
```

**Options**:
- `--execute`: Apply changes (default: dry-run)
- `--verbose`: Show detailed progress
- `--threshold N`: Similarity threshold (0.0-1.0, default: 0.85)
- `--phase TYPE`: Run specific phase (exact, variants, or all)
- `--help`: Show help

**Output**:
- Console summary with similarity scores
- `tmp/consolidation-report.md`: Detailed report
- Automatic backup tables

**Example output**:
```
🔍 Phase 1: Exact Duplicates
   ✅ Found 0 exact duplicate groups

🔍 Phase 2: Variant Duplicates (threshold: 0.85)
   Found 59 variant clusters

   Cluster: "white wine vinegar" + 1 variants
      - "white-wine vinegar" (similarity: 94.4%)
   Cluster: "extra virgin olive oil" + 1 variants
      - "extra-virgin olive oil" (similarity: 95.5%)
```

**Safety**:
- ✅ Dry-run by default
- ✅ Automatic backup before execution
- ✅ Atomic transaction (all or nothing)
- ✅ Preserves all recipe relationships
- ✅ Creates aliases for merged names

---

### 4. `rollback-normalization.ts`

**Purpose**: Restore ingredients from backup tables.

**What it does**:
1. Lists available backup tables
2. Verifies backup integrity
3. Creates pre-rollback backup (safety)
4. Restores ingredients from backup

**Usage**:
```bash
# List available backups
pnpm ingredients:rollback:list

# Preview rollback
pnpm ingredients:rollback -- --backup ingredients_backup_2025-10-21T12-00-00

# Execute rollback
pnpm ingredients:rollback -- --backup ingredients_backup_2025-10-21T12-00-00 --execute

# Advanced
npx tsx scripts/rollback-normalization.ts --help
```

**Options**:
- `--backup TABLE`: Backup table name (required)
- `--execute`: Apply rollback (default: dry-run)
- `--list`: List all available backups
- `--help`: Show help

**Output**:
```
📦 Available Backup Tables:
   backup_2025-10-21T12-00-00:
      - ingredients_backup_2025-10-21T12-00-00
      - recipe_ingredients_backup_2025-10-21T12-00-00

✅ Backup table verified (3042 rows)

🔍 Analyzing rollback impact...
   Current ingredients: 2850
   Backup ingredients: 3042
   Difference: +192
```

**Safety**:
- ✅ Dry-run by default
- ✅ Creates pre-rollback backup
- ✅ Atomic transaction
- ✅ Verifies backup integrity before rollback

---

## Workflow

### Standard Workflow

**Step 1: Analyze**
```bash
pnpm ingredients:analyze
```
Review current state and identify issues.

**Step 2: Normalize**
```bash
# Preview
pnpm ingredients:normalize

# Execute
pnpm ingredients:normalize:execute
```
Cleans ingredient names and extracts metadata.

**Step 3: Consolidate**
```bash
# Preview
pnpm ingredients:consolidate

# Execute
pnpm ingredients:consolidate:execute
```
Merges duplicate ingredients.

**Step 4: Verify**
```bash
pnpm ingredients:analyze
```
Confirm improvements.

### Testing Workflow

**Test on small dataset**:
```bash
npx tsx scripts/normalize-ingredients.ts --limit 100
npx tsx scripts/consolidate-duplicates.ts --threshold 0.95
```

**Review reports**:
```bash
cat tmp/normalization-report.md
cat tmp/consolidation-report.md
```

**Rollback if needed**:
```bash
pnpm ingredients:rollback:list
pnpm ingredients:rollback -- --backup <TABLE> --execute
```

---

## Reports

All scripts generate detailed reports in `tmp/`:

### `tmp/normalization-report.md`

**Contents**:
- Summary statistics
- Normalization changes table
- Detailed changes (before/after)
- Affected recipe counts

**Example**:
```markdown
## Summary Statistics
- Total Ingredients: 3042
- Normalized: 31 (1.0%)
- Quantity Extracted: 3
- Preparation Extracted: 29
- Affected Recipes: 153

## Normalization Changes
| Original Name | New Name | Quantity | Preparation | Recipes |
|---------------|----------|----------|-------------|---------|
| basil leaves  | basil    | -        | leaves      | 31      |
| mint leaves   | mint     | -        | leaves      | 28      |
```

### `tmp/consolidation-report.md`

**Contents**:
- Summary statistics
- Exact duplicates merged
- Variant duplicates merged
- Aliases created
- Similarity scores

**Example**:
```markdown
## Summary Statistics
- Total Duplicate Groups: 59
- Exact Duplicates: 0
- Variant Duplicates: 59
- Ingredients Deleted: 59
- Recipe Links Updated: 1247
- Aliases Created: 118

## Variant Duplicates
### "white wine vinegar"
- Canonical ID: abc123
- Variants Merged: 1
- Aliases: ["white-wine vinegar"]
- Variant Names:
  - "white-wine vinegar" (similarity: 94.4%, usage: 12)
```

---

## Backup Management

### Automatic Backups

Every execution creates timestamped backups:

```sql
ingredients_backup_2025-10-21T12-00-00
recipe_ingredients_backup_2025-10-21T12-00-00
```

**Location**: PostgreSQL database (same as production data)

### List Backups

```bash
pnpm ingredients:rollback:list
```

**Output**:
```
📦 Available Backup Tables:
   backup_2025-10-21T12-00-00:
      - ingredients_backup_2025-10-21T12-00-00
      - recipe_ingredients_backup_2025-10-21T12-00-00
   backup_2025-10-20T15-30-00:
      - ingredients_backup_2025-10-20T15-30-00
```

### Restore from Backup

```bash
pnpm ingredients:rollback -- --backup ingredients_backup_2025-10-21T12-00-00 --execute
```

### Manual Cleanup

```sql
-- View backup tables
SELECT tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables
WHERE schemaname = 'public' AND tablename LIKE '%backup%'
ORDER BY tablename DESC;

-- Drop old backup (after verification)
DROP TABLE ingredients_backup_2025-10-21T12-00-00;
```

---

## Performance

### Optimizations Applied

1. **Batch Recipe Counting**: Single query instead of 3,042 individual queries
2. **In-Memory Clustering**: Variant detection uses efficient algorithms
3. **Indexed Queries**: Uses existing database indexes
4. **Transaction Batching**: Groups updates for efficiency

### Benchmarks

**Normalization** (3,042 ingredients):
- Analysis: ~2 seconds
- Execution: ~5 seconds
- Total: ~7 seconds

**Consolidation** (59 clusters):
- Analysis: ~8 seconds
- Execution: ~3 seconds
- Total: ~11 seconds

### Large Dataset Tips

**Test on subset**:
```bash
npx tsx scripts/normalize-ingredients.ts --limit 100
```

**Use verbose mode** to track progress:
```bash
npx tsx scripts/normalize-ingredients.ts --verbose --execute
```

---

## Troubleshooting

### Issue: Script timeout

**Cause**: Large dataset or slow database connection

**Solution**:
```bash
# Test on subset
npx tsx scripts/normalize-ingredients.ts --limit 100

# Or increase timeout in script
```

### Issue: Wrong ingredients detected

**Cause**: Normalization logic too aggressive

**Solution**:
Edit `src/lib/ingredients/normalization.ts`:
```typescript
const LEAVES_ARE_INGREDIENT = [
  'bay leaves',
  // Add your exception here
];
```

### Issue: Consolidation merges wrong items

**Cause**: Similarity threshold too low

**Solution**:
```bash
# Increase threshold (default: 0.85)
npx tsx scripts/consolidate-duplicates.ts --threshold 0.95
```

### Issue: Need to undo changes

**Solution**:
```bash
pnpm ingredients:rollback:list
pnpm ingredients:rollback -- --backup <TABLE> --execute
```

---

## Development

### Adding New Preparation Methods

Edit `src/lib/db/ingredients-schema.ts`:

```typescript
export const PREPARATION_METHODS = [
  'chopped',
  'diced',
  // Add new method here
] as const;
```

### Adding Special Cases

Edit `src/lib/ingredients/normalization.ts`:

```typescript
const LEAVES_ARE_INGREDIENT = [
  'bay leaves',
  // Add exception here
];
```

### Adjusting Similarity Algorithm

Edit `src/lib/ingredients/fuzzy-matching.ts`:

```typescript
export function calculateIngredientSimilarity(ing1, ing2): number {
  const nameSim = calculateSimilarity(ing1.name, ing2.name) * 0.8;  // Adjust weight
  // ...
}
```

---

## Best Practices

1. **Always dry-run first**: Review changes before execution
2. **Check reports**: Read generated reports in `tmp/`
3. **Test on subset**: Use `--limit` for large datasets
4. **Keep backups**: Don't delete backups immediately
5. **Monitor effects**: Run analysis before and after
6. **Incremental changes**: Normalize → Consolidate → Verify

---

**For detailed guide, see**: `docs/guides/INGREDIENT_NORMALIZATION_GUIDE.md`

**Last Updated**: 2025-10-21
**Version**: 1.0.0
