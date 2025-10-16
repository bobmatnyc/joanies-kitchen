# Resuming Epicurious Recipe Import

**Last Status**: 3,322 recipes processed out of 20,130 (16.5%)
**Last Run**: October 16, 2025
**Location**: `scripts/data-acquisition/ingest-epicurious.ts`

---

## Current Status

The Epicurious import has been **paused** at recipe #3,322. The script encountered many duplicates and has been safely stopped.

### Import Statistics (as of pause)
- **Total recipes in dataset**: 20,130
- **Recipes processed**: 3,322 (16.5%)
- **Recipes remaining**: 16,808
- **Duplicates skipped**: High (most recent recipes were duplicates)

---

## How to Resume Import

### Option 1: Resume from Last Position (Recommended)

The import script tracks progress automatically through the database. Simply restart the import:

```bash
# Run in background with logging
nohup npx tsx scripts/data-acquisition/ingest-epicurious.ts > /tmp/epicurious-import.log 2>&1 &

# Check progress
tail -f /tmp/epicurious-import.log
```

The script will:
- Check each recipe against the database before importing
- Skip recipes that already exist (duplicate detection)
- Continue from where it left off

### Option 2: Check Current Database State First

Before resuming, verify how many recipes were actually imported:

```bash
# Connect to database
pnpm db:studio

# Or run this query
npx tsx -e "
import { db } from './src/lib/db/index.ts';
import { recipes } from './src/lib/db/schema.ts';
import { sql } from 'drizzle-orm';

const count = await db.select({ count: sql\`count(*)\` }).from(recipes);
console.log('Total recipes in database:', count[0].count);
"
```

### Option 3: Start Fresh (Not Recommended)

If you want to clear and restart:

```bash
# WARNING: This will delete existing Epicurious recipes
# Only run if you're sure you want to start over

# Delete Epicurious recipes
npx tsx -e "
import { db } from './src/lib/db/index.ts';
import { recipes } from './src/lib/db/schema.ts';
import { eq } from 'drizzle-orm';

await db.delete(recipes).where(eq(recipes.source, 'epicurious'));
console.log('Deleted Epicurious recipes');
"

# Then restart import
npx tsx scripts/data-acquisition/ingest-epicurious.ts
```

---

## Monitoring Progress

### Real-time Log Monitoring
```bash
# Watch import progress live
tail -f /tmp/epicurious-import.log

# Check last 50 lines
tail -50 /tmp/epicurious-import.log

# Count successful imports
grep "✓ Saved" /tmp/epicurious-import.log | wc -l

# Count duplicates skipped
grep "⊘ Skipped" /tmp/epicurious-import.log | wc -l
```

### Check Import Process Status
```bash
# Check if import is running
ps aux | grep "ingest-epicurious" | grep -v grep

# Kill import process if needed
pkill -f "ingest-epicurious"
```

---

## Expected Completion Time

Based on current progress:
- **Processing rate**: ~1-2 recipes per second (with duplicates)
- **Remaining recipes**: ~16,808
- **Estimated time**: 2-5 hours (depending on duplicate rate)

**Note**: The high duplicate rate suggests many Epicurious recipes already exist in the database from previous imports. Final count may be lower than 20,130.

---

## Troubleshooting

### Import Seems Stuck

If the import appears frozen:

```bash
# Check last activity in log
tail -20 /tmp/epicurious-import.log

# Check if process is running
ps aux | grep "ingest-epicurious"

# If stuck, restart:
pkill -f "ingest-epicurious"
nohup npx tsx scripts/data-acquisition/ingest-epicurious.ts > /tmp/epicurious-import.log 2>&1 &
```

### Database Connection Errors

If you see database connection errors:

```bash
# Verify DATABASE_URL is set
echo $DATABASE_URL

# Test database connection
pnpm db:studio

# Check if Neon database is accessible
curl -I https://neon.tech
```

### Memory Issues

If the import crashes due to memory:

```bash
# Run with increased Node.js memory
NODE_OPTIONS="--max-old-space-size=4096" npx tsx scripts/data-acquisition/ingest-epicurious.ts
```

---

## Post-Import Verification

After import completes, verify data integrity:

```bash
# Count total recipes
npx tsx -e "
import { db } from './src/lib/db/index.ts';
import { recipes } from './src/lib/db/schema.ts';
import { sql, eq } from 'drizzle-orm';

const total = await db.select({ count: sql\`count(*)\` }).from(recipes);
const epicurious = await db.select({ count: sql\`count(*)\` }).from(recipes).where(eq(recipes.source, 'epicurious'));

console.log('Total recipes:', total[0].count);
console.log('Epicurious recipes:', epicurious[0].count);
"
```

### Quality Check

```bash
# Check for recipes without required fields
npx tsx scripts/validate-recipe-data.ts
```

---

## Notes

- **Duplicate Detection**: The script checks for duplicates by recipe name. Similar names may be considered duplicates.
- **Database Source**: Data comes from `data/epicurious/full_format_recipes.json`
- **Import Strategy**: Sequential processing to avoid overwhelming the database
- **Safety**: Each recipe is validated before insertion
- **Recovery**: Script is designed to be interrupted and resumed safely

---

## Related Scripts

- **Cleanup Script**: `scripts/cleanup-recipe-content.ts` - Clean up ingredient amounts
- **Validation**: `scripts/validate-recipe-data.ts` - Check data integrity
- **Database Studio**: `pnpm db:studio` - Visual database inspection

---

**Last Updated**: October 16, 2025
**Status**: Paused at 16.5% completion, ready to resume
