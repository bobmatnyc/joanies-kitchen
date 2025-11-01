# Meal Slug Migration Guide

## Problem Statement

**Issue**: "Meal not found" errors occur when accessing meals via slug-based URLs (`/meals/[slug]`).

**Root Cause**:
1. Some meal records have `slug IS NULL` or `slug = ''` in the database
2. The application routing uses `/meals/[slug]` pattern
3. The `getMealBySlug` function (src/app/actions/meals.ts:276-315) returns "not found" when slug doesn't exist

## Solution

Run the meal slug generation migration script to:
1. Identify meals without valid slugs
2. Generate SEO-friendly slugs from meal names
3. Handle duplicate slug conflicts automatically
4. Update the database with generated slugs

## Migration Script

**Location**: `/scripts/migrations/generate-meal-slugs.ts`

### Features

- ✅ Identifies meals with `NULL` or empty slugs
- ✅ Generates slugs using proper slug generation algorithm
- ✅ Handles duplicate slugs by appending numbers (`-1`, `-2`, etc.)
- ✅ Includes year suffix for uniqueness (`meal-name-2024`)
- ✅ Provides detailed summary report
- ✅ Tracks errors and conflicts
- ✅ Verifies results after migration

### Slug Generation Algorithm

The script uses the `regenerateMealSlug` function which:

1. **Normalizes the meal name**:
   - Converts to lowercase
   - Removes special characters
   - Replaces spaces with hyphens
   - Removes multiple/leading/trailing hyphens

2. **Adds year suffix**:
   - Appends creation year for uniqueness
   - Example: "Thanksgiving Dinner" (created 2024) → `thanksgiving-dinner-2024`

3. **Ensures uniqueness**:
   - Checks against existing slugs
   - Appends counter if conflict exists
   - Example: `thanksgiving-dinner-2024`, `thanksgiving-dinner-2024-1`, etc.

### Example Slug Generation

| Meal Name | Created Date | Generated Slug |
|-----------|--------------|----------------|
| Thanksgiving Dinner | 2024-11-15 | `thanksgiving-dinner-2024` |
| Mom's Apple Pie | 2024-03-20 | `moms-apple-pie-2024` |
| Sunday Brunch! | 2024-06-01 | `sunday-brunch-2024` |
| Family Dinner (duplicate) | 2024-08-10 | `family-dinner-2024-1` |

## Running the Migration

### Prerequisites

1. Ensure you have a database connection configured
2. Backup your database (recommended)
3. Verify `.env` file has valid `DATABASE_URL`

### Execution

```bash
# Run the migration
npx tsx scripts/migrations/generate-meal-slugs.ts
```

### Expected Output

```
🔍 Checking for meals without slugs...

📊 Found 15 meals without slugs

📋 Meals needing slugs:
   - "Thanksgiving Dinner" (ID: 550e8400-e29b-41d4-a716-446655440000)
   - "Christmas Eve Feast" (ID: 660e8400-e29b-41d4-a716-446655440001)
   - "Sunday Brunch" (ID: 770e8400-e29b-41d4-a716-446655440002)
   ...

🔧 Generating slugs (avoiding 42 existing slugs)...

✓ "Thanksgiving Dinner" → thanksgiving-dinner-2024
✓ "Christmas Eve Feast" → christmas-eve-feast-2024
✓ "Sunday Brunch" → sunday-brunch-2024
...

💾 Updating 15 meals in database...

🔍 Verifying results...

============================================================
✅ MIGRATION COMPLETED SUCCESSFULLY!
============================================================

📊 Summary:
   Total meals in database: 57
   Meals processed: 15
   Successfully updated: 15
   Failed updates: 0
   Meals with slugs: 57
   Meals without slugs: 0

✓ Migration complete!
```

## Verification

After running the migration, verify the results:

### 1. Check Database

```sql
-- Count meals with and without slugs
SELECT
  COUNT(*) as total_meals,
  COUNT(slug) as meals_with_slugs,
  COUNT(*) FILTER (WHERE slug IS NULL OR slug = '') as meals_without_slugs
FROM meals;
```

Expected result:
```
total_meals | meals_with_slugs | meals_without_slugs
------------|------------------|--------------------
     57     |        57        |         0
```

### 2. Test Slug-Based Routing

```bash
# Test accessing a meal by slug
curl http://localhost:3000/meals/thanksgiving-dinner-2024
```

Should return the meal details instead of "not found" error.

### 3. Manual Verification

Check a few meals in the database:

```sql
SELECT id, name, slug, created_at
FROM meals
ORDER BY created_at DESC
LIMIT 10;
```

Verify that:
- All meals have non-null slugs
- Slugs are properly formatted (lowercase, hyphen-separated)
- Slugs include year suffix
- No duplicate slugs exist

## Rollback

If you need to rollback (rarely needed):

```bash
npx tsx scripts/migrations/generate-meal-slugs.ts --rollback
```

**Note**: The rollback is intentionally limited for safety. It will NOT automatically remove slugs, as this would break routing. If you truly need to remove slugs, you must do so manually.

## Troubleshooting

### Issue: Migration reports errors

**Solution**: Check the error details in the output. Common issues:
- Database connection problems
- Constraint violations (e.g., unique constraint on slug)
- Permission issues

### Issue: Some meals still don't have slugs

**Solution**: Run the migration again. The script is idempotent and will only process meals without slugs.

### Issue: Duplicate slug constraint violation

**Solution**: The script should handle this automatically by appending numbers. If it still fails:
1. Check for unique constraint on meals.slug column
2. Verify the `ensureUniqueSlug` function is working correctly
3. Run the migration again (it will skip successfully updated meals)

## Integration with Application

The migration script uses the same slug generation utilities as the application:

- `generateMealSlug()` - Located in `/src/lib/utils/meal-slug.ts`
- `ensureUniqueSlug()` - Located in `/src/lib/utils/meal-slug.ts`
- `regenerateMealSlug()` - Located in `/src/lib/utils/meal-slug.ts`

This ensures consistency between:
- Slugs generated during migration
- Slugs generated when creating new meals
- Slug-based routing in the application

## Related Files

- **Migration Script**: `/scripts/migrations/generate-meal-slugs.ts`
- **Slug Utilities**: `/src/lib/utils/meal-slug.ts`
- **Meals Schema**: `/src/lib/db/meals-schema.ts` (line 71)
- **getMealBySlug Action**: `/src/app/actions/meals.ts` (lines 276-315)
- **Meal Routes**: `/src/app/meals/[slug]/page.tsx`

## Success Criteria

✅ All meals have valid, unique slugs
✅ Slugs follow proper format (lowercase, hyphen-separated, year suffix)
✅ No "meal not found" errors when accessing via slug URLs
✅ Slug-based routing works correctly
✅ No duplicate slugs in database

## Next Steps

After running this migration:

1. **Monitor Application**: Watch for any "meal not found" errors
2. **Test Slug URLs**: Verify slug-based routing works for all meals
3. **Future Meals**: Ensure new meals get slugs automatically during creation (already implemented in `createMeal` action)
4. **Consider Schema Change**: If desired, make slug column `NOT NULL` in future migration

## References

- Slug Generation Pattern: Similar to recipe slug generation (`/scripts/generate-recipe-slugs.ts`)
- Moderation Fields Migration: Pattern reference (`/scripts/migrations/add-moderation-fields.ts`)
- SEO Best Practices: Slug format follows SEO-friendly URL guidelines
