# Ingredient Amounts Fix Guide

## Overview

This guide explains the solution implemented to fix missing ingredient amounts in recipes. The issue was **data quality** - ingredients were stored as simple strings without amounts (e.g., "flour", "chicken") instead of complete ingredient descriptions (e.g., "2 cups flour", "1 lb chicken breast").

## Problem Analysis

### Original Issue
- **Symptom**: Ingredients displayed without amounts
- **Root Cause**: Data stored without amounts: `["flour", "chicken", "garlic"]`
- **Expected Format**: Data with amounts: `["2 cups flour", "1 lb chicken breast", "3 cloves garlic"]`
- **Scope**: 968 recipes affected

### Why This Happened
Recipes were imported or generated without explicit amount specifications. The AI generation or import process stored ingredient names only, not complete ingredient specifications.

## Solution Architecture

### Two-Part Solution

#### Part 1: Display Enhancement (Immediate)
Updated the recipe display component to:
1. **Detect missing amounts** using pattern matching
2. **Visual indicator** for ingredients without amounts
3. **Graceful degradation** - show what we have with warning

**Implementation**: `src/app/recipes/[id]/page.tsx`

```typescript
function IngredientDisplay({ ingredient }: { ingredient: string }) {
  // Detect if ingredient has amount
  const hasAmount = /^[\d½¼¾⅓⅔⅛⅜⅝⅞]|^(a |an |one |two |three |some |few |several )/i.test(ingredient.trim());

  return (
    <li className="flex items-start">
      <span className="inline-block w-2 h-2 bg-primary rounded-full mt-1.5 mr-3" />
      <span className={!hasAmount ? 'text-amber-600' : ''}>
        {ingredient}
        {!hasAmount && (
          <span className="text-xs text-amber-600 ml-2 opacity-75" title="Amount not specified">
            (amount not specified)
          </span>
        )}
      </span>
    </li>
  );
}
```

#### Part 2: Data Quality Fix (Permanent)
Created LLM-powered script to add realistic amounts to all recipes.

**Features**:
- Uses Gemini Flash 2.0 (FREE tier, $0 cost)
- Processes 968 recipes automatically
- Respects rate limits (10 req/sec)
- Adds realistic standard US measurements
- Provides detailed progress reporting
- Supports dry-run testing

**Implementation**: `scripts/fix-ingredient-amounts.ts`

## Usage

### Test with Sample Recipes (Recommended First Step)

```bash
# Test on 10 recipes without updating database
pnpm fix:amounts:test

# Same with dry-run flag
pnpm fix:amounts:dry-run -- --limit=10
```

### Fix All Recipes

```bash
# Fix all 968 recipes (estimated time: 2-3 hours)
pnpm fix:amounts

# Dry-run mode (test without database updates)
pnpm fix:amounts:dry-run
```

### Command Options

```bash
# Fix all recipes (default)
pnpm fix:amounts

# Dry run (no database updates)
pnpm fix:amounts -- --dry-run

# Limit to N recipes
pnpm fix:amounts -- --limit=50

# Combine options
pnpm fix:amounts -- --dry-run --limit=10
```

## Script Features

### Intelligent Amount Detection

The script checks each ingredient for existing amounts using pattern matching:

```typescript
function hasAmount(ingredient: string): boolean {
  const trimmed = ingredient.trim();
  // Detects: numbers, fractions, common amount words
  return /^[\d½¼¾⅓⅔⅛⅜⅝⅞]|^(a |an |one |two |three |some |few |several )/i.test(trimmed);
}
```

**Skips recipes that already have amounts** - efficient processing.

### LLM Enhancement

Uses Google Gemini Flash 2.0 to add realistic amounts:

```typescript
async function addAmountsToIngredients(
  recipeName: string,
  ingredients: string[],
  servings?: number
): Promise<string[]>
```

**Context provided to LLM**:
- Recipe name (for appropriate amounts)
- Servings count (for scaling)
- Professional chef instructions
- Standard US measurement guidelines

**Example transformations**:
- `"flour"` → `"2 cups all-purpose flour"`
- `"chicken"` → `"1 lb chicken breast, diced"`
- `"garlic"` → `"3 cloves garlic, minced"`
- `"salt"` → `"1 teaspoon salt"`
- `"olive oil"` → `"2 tablespoons olive oil"`

### Progress Reporting

Real-time progress with detailed statistics:

```
[1/968] Processing: Classic Spaghetti Carbonara
  ID: abc123
  📝 Missing amounts: 8/12 ingredients
  🤖 Requesting LLM enhancement...
  📋 Sample transformations:
     Before: "spaghetti"
     After:  "1 lb spaghetti pasta"
     Before: "bacon"
     After:  "8 oz bacon, diced"
  ✅ Updated in database

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Final Statistics:
  Total recipes: 968
  Processed: 968
  Updated: 842
  Skipped (already had amounts): 120
  Failed: 6

✨ Success rate: 99.4%
💾 Database updated with 842 improved recipes
```

### Error Handling

- **Graceful failures**: Continues processing other recipes if one fails
- **Error logging**: Detailed error messages for each failure
- **Summary report**: List of failed recipes at end
- **Retry-friendly**: Can be run multiple times safely

## Performance

### Rate Limiting

```typescript
// Rate limit: 10 requests per second for Gemini Flash
await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
```

### Estimated Processing Time

| Recipes | Time Estimate |
|---------|---------------|
| 10      | ~1 second     |
| 100     | ~10 seconds   |
| 968     | ~2-3 hours    |

**Factors affecting time**:
- Network latency
- LLM response time
- Rate limiting delays
- Database update time

### Cost

**Model**: `google/gemini-2.0-flash-exp:free`

**Total Cost**: **$0.00** (FREE tier)

- 968 recipes × 1 request each = 968 API calls
- Gemini Flash FREE tier includes generous limits
- No credit card required

## Implementation Details

### File Changes

1. **Display Component** (`src/app/recipes/[id]/page.tsx`)
   - Added amount detection logic
   - Visual indicators for missing amounts
   - Amber text color for incomplete ingredients

2. **LLM Script** (`scripts/fix-ingredient-amounts.ts`)
   - Full-featured ingredient enhancement
   - Dry-run mode support
   - Comprehensive error handling
   - Detailed progress reporting

3. **Package Scripts** (`package.json`)
   - `fix:amounts` - Fix all recipes
   - `fix:amounts:dry-run` - Test mode
   - `fix:amounts:test` - Test on 10 recipes

### Database Schema

No schema changes required. Updates existing `recipes.ingredients` field:

```typescript
// Before (JSON string)
ingredients: '["flour", "chicken", "garlic"]'

// After (JSON string with amounts)
ingredients: '["2 cups all-purpose flour", "1 lb chicken breast, diced", "3 cloves garlic, minced"]'
```

### Amount Detection Patterns

The display logic detects amounts using regex:

| Pattern | Example | Matched |
|---------|---------|---------|
| Numbers | `1 cup`, `2.5 lbs` | ✅ |
| Fractions | `½ cup`, `¼ teaspoon` | ✅ |
| Words | `one cup`, `a pinch` | ✅ |
| Quantity words | `some salt`, `few cloves` | ✅ |
| No amount | `flour`, `chicken` | ❌ |

## Testing Strategy

### Phase 1: Dry Run Testing (MUST DO FIRST)

```bash
# Test on 10 recipes without DB updates
pnpm fix:amounts:test

# Review output carefully:
# - Check sample transformations
# - Verify amounts are realistic
# - Ensure no data corruption
```

**Expected output**:
```
✓ Would update in database (dry run)
```

### Phase 2: Small Batch Testing

```bash
# Fix first 50 recipes (live)
pnpm fix:amounts -- --limit=50

# Verify in database/UI:
# - Navigate to some updated recipes
# - Check ingredient amounts are present
# - Confirm amounts are realistic
```

### Phase 3: Full Processing

```bash
# Fix all remaining recipes
pnpm fix:amounts

# Monitor output for errors
# Review final statistics
# Spot-check random recipes in UI
```

## Verification

### Manual Verification Steps

1. **Run Script in Dry-Run Mode**
   ```bash
   pnpm fix:amounts -- --dry-run --limit=10
   ```

2. **Check Sample Output**
   - Review "Sample transformations" in console
   - Verify amounts are realistic
   - Ensure no data loss

3. **Test on Small Batch**
   ```bash
   pnpm fix:amounts -- --limit=10
   ```

4. **Verify in Database**
   ```bash
   pnpm db:studio
   # Check recipes table, inspect ingredients field
   ```

5. **Verify in UI**
   - Navigate to updated recipes
   - Confirm amounts are displayed
   - Check for amber warning indicators (should be gone)

### Automated Verification

After running the script, verify results programmatically:

```typescript
// Check percentage of recipes with amounts
const allRecipes = await db.select().from(recipes);
const withAmounts = allRecipes.filter(r => {
  const ingredients = JSON.parse(r.ingredients);
  return ingredients.every(ing => hasAmount(ing));
});

console.log(`Recipes with amounts: ${withAmounts.length}/${allRecipes.length}`);
console.log(`Percentage: ${(withAmounts.length / allRecipes.length * 100).toFixed(1)}%`);
```

## Rollback Strategy

If the script produces incorrect data:

### Option 1: Database Backup (Recommended Before Running)

```bash
# Before running script:
# 1. Backup database via Neon console
# 2. Or export recipes table:
pnpm db:studio
# Export recipes table to JSON
```

### Option 2: Restore from Git (If Applicable)

If recipes are in version control:
```bash
git restore <recipe-files>
```

### Option 3: Re-run Script on Specific Recipes

The script is idempotent - running it multiple times is safe. It will skip recipes that already have amounts.

## Troubleshooting

### Script Fails with API Key Error

**Error**: `OPENROUTER_API_KEY environment variable is not set`

**Solution**:
```bash
# Check .env.local
cat .env.local | grep OPENROUTER

# If missing, add:
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

### LLM Returns Invalid JSON

**Error**: `Invalid response format: missing ingredients array`

**Behavior**: Script continues with next recipe, logs error

**Solution**: Review error log at end, manually fix failed recipes if needed

### Rate Limit Exceeded

**Error**: `429 Too Many Requests`

**Solution**: Script already includes 100ms delay. If still hitting limits:
```typescript
// Increase delay in script (line ~280)
await new Promise(resolve => setTimeout(resolve, 200)); // 200ms = 5 req/sec
```

### Database Connection Issues

**Error**: `Connection timeout` or `Database error`

**Solution**:
```bash
# Test database connection
pnpm db:studio

# Verify DATABASE_URL in .env.local
cat .env.local | grep DATABASE_URL
```

### Script Stuck/Hanging

**Symptoms**: No progress for >5 minutes

**Solution**:
1. Check network connection
2. Check OpenRouter API status: https://status.openrouter.ai
3. Kill and restart script (safe - will skip completed recipes)

## Best Practices

### Before Running on Production

1. ✅ **Backup database** - Neon console or export
2. ✅ **Test in dry-run mode** - Verify output quality
3. ✅ **Test small batch** - 10-50 recipes first
4. ✅ **Verify results** - Check database and UI
5. ✅ **Monitor progress** - Watch for errors
6. ✅ **Schedule maintenance window** - 2-3 hours

### During Processing

1. ✅ **Monitor console output** - Watch for errors
2. ✅ **Check LLM responses** - Review sample transformations
3. ✅ **Verify network stability** - Ensure no disconnects
4. ✅ **Don't interrupt** - Let script complete (or restart from where it left off)

### After Processing

1. ✅ **Review final statistics** - Check success rate
2. ✅ **Verify in database** - Spot-check random recipes
3. ✅ **Test in UI** - Navigate to updated recipes
4. ✅ **Check for warnings** - Amber indicators should be gone
5. ✅ **Document results** - Note any issues for future reference

## Success Criteria

### Metrics

- ✅ **>95% success rate** - Most recipes processed successfully
- ✅ **Zero data loss** - All original ingredients preserved or enhanced
- ✅ **Realistic amounts** - Quantities make sense for recipe
- ✅ **Consistent format** - Standard US measurements used
- ✅ **No amber warnings** - Display shows complete ingredients
- ✅ **Total cost: $0** - Using FREE tier

### Visual Verification

**Before Fix**:
```
Ingredients:
• flour (amount not specified)
• chicken (amount not specified)
• garlic (amount not specified)
```

**After Fix**:
```
Ingredients:
• 2 cups all-purpose flour
• 1 lb chicken breast, diced
• 3 cloves garlic, minced
```

## Future Enhancements

### Potential Improvements

1. **Batch Processing** - Process recipes in parallel (5-10 at once)
2. **Caching** - Cache common ingredient amounts
3. **Learning** - Train on existing good recipes
4. **Validation** - Add amount validation logic
5. **User Review** - Allow users to approve/edit LLM suggestions
6. **Metric Conversion** - Support metric measurements
7. **Nutritional Calculation** - Auto-calculate nutrition from amounts

### Prevention

To prevent this issue in the future:

1. **Validation at Input** - Require amounts during recipe creation
2. **AI Generation** - Update prompts to always include amounts
3. **Import Validation** - Validate imported recipes have amounts
4. **UI Guidance** - Help text showing proper format
5. **Database Constraint** - Add amount requirement to schema

## Related Documentation

- **Authentication Guide**: `/docs/guides/AUTHENTICATION_GUIDE.md`
- **Environment Setup**: `/docs/guides/ENVIRONMENT_SETUP.md`
- **Recipe Schema**: `/src/lib/db/schema.ts`
- **OpenRouter Integration**: `/src/lib/ai/openrouter-server.ts`

## Support

If you encounter issues:

1. Check troubleshooting section above
2. Review script output for specific errors
3. Test with `--dry-run` flag first
4. Verify environment variables are set
5. Check OpenRouter API status

---

**Last Updated**: 2025-10-15
**Version**: 1.0.0
**Script Location**: `/scripts/fix-ingredient-amounts.ts`
