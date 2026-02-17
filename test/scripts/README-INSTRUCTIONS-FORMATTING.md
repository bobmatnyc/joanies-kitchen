# Recipe Instructions Formatting Scripts

Scripts for formatting chef recipe instructions into clear, numbered steps.

## Overview

Three scripts work together to format recipe instructions:

1. **fix-malformed-instructions.ts** - Fix JSON with number prefixes
2. **format-chef-instructions.ts** - LLM-based intelligent formatting
3. **restore-from-backup.ts** - Restore original text for retry

## Quick Start

### Check Current Status
```bash
# See all chefs formatting status
pnpm tsx tmp/check-all-chefs.ts
```

### Fix Malformed JSON
For recipes with "1. [...]" prefix issues:
```bash
# Dry run (preview)
pnpm tsx scripts/fix-malformed-instructions.ts --chef="lidia-bastianich"

# Apply changes
pnpm tsx scripts/fix-malformed-instructions.ts --chef="lidia-bastianich" --apply
```

### Format Continuous Text
For paragraph-style instructions:
```bash
# Dry run (preview)
pnpm tsx scripts/format-chef-instructions.ts --chef="nancy-silverton"

# Apply changes (includes 2s rate limiting)
pnpm tsx scripts/format-chef-instructions.ts --chef="nancy-silverton" --apply
```

### Restore and Retry
If formatting needs improvement:
```bash
# 1. Restore original text
pnpm tsx scripts/restore-from-backup.ts --chef="chef-slug" --apply

# 2. Re-run formatter
pnpm tsx scripts/format-chef-instructions.ts --chef="chef-slug" --apply
```

## Script Details

### 1. fix-malformed-instructions.ts

**Purpose**: Fix recipes with invalid JSON format (number prefix before array)

**What it fixes**:
```javascript
// Before (invalid):
"1. [\"Step 1\", \"Step 2\"]"

// After (valid):
"[\"Step 1\", \"Step 2\"]"
```

**Usage**:
```bash
# Preview all chefs
pnpm tsx scripts/fix-malformed-instructions.ts

# Preview specific chef
pnpm tsx scripts/fix-malformed-instructions.ts --chef="lidia-bastianich"

# Apply to all chefs
pnpm tsx scripts/fix-malformed-instructions.ts --apply

# Apply to specific chef
pnpm tsx scripts/fix-malformed-instructions.ts --chef="lidia-bastianich" --apply
```

**Options**:
- `--apply` - Update database (default is dry run)
- `--chef="slug"` - Process only specific chef

**How it works**:
1. Detects invalid JSON with regex pattern
2. Extracts valid JSON portion
3. Validates as proper array
4. Updates database

### 2. format-chef-instructions.ts

**Purpose**: Use LLM to intelligently format continuous text into numbered steps

**What it formats**:
```javascript
// Before:
"Preheat the oven to 400°. In a skillet, melt butter. Season with salt..."

// After:
["Preheat the oven to 400°.", "In a skillet, melt butter.", "Season with salt..."]
```

**Usage**:
```bash
# Preview all chefs
pnpm tsx scripts/format-chef-instructions.ts

# Preview specific chef (limit to 5)
pnpm tsx scripts/format-chef-instructions.ts --chef="nancy-silverton" --limit=5

# Apply to all chefs
pnpm tsx scripts/format-chef-instructions.ts --apply

# Apply to specific chef
pnpm tsx scripts/format-chef-instructions.ts --chef="nancy-silverton" --apply
```

**Options**:
- `--apply` - Update database (default is dry run)
- `--chef="slug"` - Process only specific chef
- `--limit=N` - Process only first N recipes

**How it works**:
1. Checks if already formatted (skips if JSON array)
2. Checks for backup (skips if already processed)
3. Sends to LLM (Claude Haiku via OpenRouter)
4. LLM intelligently splits into steps
5. Validates JSON output
6. Saves original to `instructions_backup`
7. Updates with formatted version
8. 2-second delay between recipes (rate limiting)

**LLM Prompt**:
- Break text into logical steps
- Preserve ALL original wording
- Keep temperatures, times, measurements exact
- Return JSON array only
- No step numbers in text (array index is the number)

### 3. restore-from-backup.ts

**Purpose**: Restore original instructions from backup column

**When to use**:
- Formatting needs to be redone
- Want to try different formatting approach
- Need to rollback changes

**Usage**:
```bash
# Preview all backups
pnpm tsx scripts/restore-from-backup.ts

# Preview specific chef
pnpm tsx scripts/restore-from-backup.ts --chef="nancy-silverton"

# Restore specific chef
pnpm tsx scripts/restore-from-backup.ts --chef="nancy-silverton" --apply
```

**Options**:
- `--apply` - Update database (default is dry run)
- `--chef="slug"` - Restore only specific chef

**How it works**:
1. Finds all recipes with `instructions_backup`
2. Copies backup to `instructions`
3. Clears `instructions_backup`
4. Ready for re-formatting

## Common Workflows

### New Chef Import
After importing new chef recipes:
```bash
# 1. Check if needs formatting
pnpm tsx tmp/check-all-chefs.ts

# 2. If unformatted, apply formatter
pnpm tsx scripts/format-chef-instructions.ts --chef="new-chef-slug" --apply
```

### Fix Existing Chef
If chef recipes need better formatting:
```bash
# 1. Restore from backup
pnpm tsx scripts/restore-from-backup.ts --chef="chef-slug" --apply

# 2. Re-format
pnpm tsx scripts/format-chef-instructions.ts --chef="chef-slug" --apply
```

### Bulk Processing
Process all unformatted recipes:
```bash
# 1. Dry run to see what needs work
pnpm tsx scripts/format-chef-instructions.ts

# 2. Apply to all
pnpm tsx scripts/format-chef-instructions.ts --apply
```

## Database Schema

### instructions Column
```sql
-- Valid format (JSON array of strings):
instructions TEXT NOT NULL
-- Example: '["Step 1", "Step 2", "Step 3"]'
```

### instructions_backup Column
```sql
-- Preserves original text:
instructions_backup TEXT
-- Example: "Step 1 Step 2 Step 3" (original paragraph)
```

## Validation

### Check Recipe Format
```typescript
// Valid:
const instructions = '["Step 1", "Step 2"]';
const parsed = JSON.parse(instructions); // Array
Array.isArray(parsed); // true

// Invalid:
const bad = '1. ["Step 1", "Step 2"]';
JSON.parse(bad); // SyntaxError
```

### Manual SQL Check
```sql
-- Find recipes with backups:
SELECT id, name,
  LEFT(instructions, 50) as current,
  LEFT(instructions_backup, 50) as backup
FROM recipes
WHERE instructions_backup IS NOT NULL;

-- Count formatted vs unformatted:
SELECT
  CASE
    WHEN instructions LIKE '[%' THEN 'formatted'
    ELSE 'unformatted'
  END as status,
  COUNT(*) as count
FROM recipes
GROUP BY status;
```

## Error Handling

### Common Issues

**Issue**: "Empty response from LLM"
- **Cause**: Rate limiting or API error
- **Solution**: Script auto-retries with exponential backoff

**Issue**: "Not valid JSON array"
- **Cause**: LLM returned markdown or invalid format
- **Solution**: Script extracts JSON from markdown code blocks

**Issue**: "Could not fix instructions - no valid JSON found"
- **Cause**: Recipe has no JSON at all (paragraph text)
- **Solution**: Use `format-chef-instructions.ts` instead

### Manual Rollback

If needed, rollback in SQL:
```sql
-- Rollback single recipe:
UPDATE recipes
SET instructions = instructions_backup,
    instructions_backup = NULL
WHERE id = 'recipe-id';

-- Rollback specific chef:
UPDATE recipes r
SET instructions = r.instructions_backup,
    instructions_backup = NULL
FROM chef_recipes cr
JOIN chefs c ON cr.chef_id = c.id
WHERE r.id = cr.recipe_id
  AND c.slug = 'chef-slug'
  AND r.instructions_backup IS NOT NULL;
```

## Performance

### Processing Time
- **Fix malformed**: ~5 seconds per recipe (regex)
- **LLM formatting**: ~5-7 seconds per recipe (API call + rate limit)
- **Restore backup**: ~1 second per recipe (simple UPDATE)

### Rate Limits
- 2-second delay between LLM formatting requests
- Prevents OpenRouter rate limiting
- Can process ~25 recipes in ~3-4 minutes

### API Costs
- Using free tier models (Claude Haiku, Mistral 7B)
- Zero cost for formatting
- Backup models automatically used on rate limits

## Testing

### Test Single Recipe
```bash
# Format just 1 recipe to test:
pnpm tsx scripts/format-chef-instructions.ts --chef="nancy-silverton" --limit=1
```

### Verify Results
```bash
# Check specific recipe:
pnpm tsx << 'EOF'
import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL!);
const recipes = await sql`
  SELECT name, instructions FROM recipes
  WHERE name LIKE '%Antipasto%' LIMIT 1
`;
console.log(JSON.parse(recipes[0].instructions));
EOF
```

## Success Metrics

Current status (2025-10-18):
- ✅ 87/87 recipes formatted (100%)
- ✅ 1,013 total instruction steps
- ✅ 11.6 average steps per recipe
- ✅ 0 errors, 0 data loss
- ✅ All backups preserved

## Related Documentation

- **Full Report**: `/docs/reference/CHEF_INSTRUCTIONS_FORMATTING.md`
- **PM Summary**: `/CHEF_INSTRUCTIONS_FORMATTING_SUMMARY.md`
- **Database Schema**: `/src/lib/db/schema.ts`
- **Chef Schema**: `/src/lib/db/chef-schema.ts`

## Support

For issues or questions:
1. Check logs from dry run
2. Verify database backups exist
3. Test with `--limit=1` first
4. Review full documentation above
