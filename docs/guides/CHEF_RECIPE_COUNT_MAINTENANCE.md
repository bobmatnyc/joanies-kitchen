# Chef Recipe Count Maintenance Guide

## Overview

This guide explains how to maintain accurate chef recipe counts in the Joanie's Kitchen database.

## Quick Reference

### Verify Counts
```bash
npx tsx scripts/verify-chef-recipe-counts.ts
```

### Fix Discrepancies
```bash
npx tsx scripts/fix-chef-recipe-counts.ts
```

### Analyze Linkage
```bash
npx tsx scripts/check-recipe-chef-links.ts
```

## Understanding the Data Model

### Tables Involved

1. **`chefs`** - Chef profiles
   - `id` (UUID) - Primary key
   - `name` (text) - Chef name
   - `recipe_count` (integer) - **Denormalized count cache**
   - `updated_at` (timestamp)

2. **`chef_recipes`** - Chef-Recipe join table (many-to-many)
   - `id` (UUID) - Primary key
   - `chef_id` (UUID) - Foreign key to chefs
   - `recipe_id` (text) - Foreign key to recipes
   - **This is the source of truth for recipe counts**

3. **`recipes`** - Recipe data
   - `id` (text) - Primary key
   - `chef_id` (UUID, nullable) - Optional chef attribution

### Source of Truth

**IMPORTANT**: The `chef_recipes` join table is the authoritative source for chef-recipe relationships.

The `recipe_count` field in the `chefs` table is a **denormalized cache** for performance and should always match the actual count in `chef_recipes`.

## When to Update Counts

### Automatic Updates

The application automatically updates counts when:
- Linking a recipe to a chef (`linkRecipeToChef`)
- Unlinking a recipe from a chef (`unlinkRecipeFromChef`)

### Manual Updates Required

You may need to manually fix counts after:
- Database migrations
- Bulk data imports
- Manual database changes
- Recipe deletions outside normal flow

## Maintenance Procedures

### Monthly Verification

Run verification script to ensure data integrity:

```bash
# Check for discrepancies
npx tsx scripts/verify-chef-recipe-counts.ts

# If output shows discrepancies, run fix:
npx tsx scripts/fix-chef-recipe-counts.ts

# Verify fix was successful:
npx tsx scripts/verify-chef-recipe-counts.ts
```

**Expected output** (healthy state):
```
✅ All chef recipe counts are accurate!
Accuracy: 100.0%
```

### After Bulk Operations

If you perform bulk operations (imports, migrations, etc.), always verify counts:

```bash
# 1. Perform your bulk operation
# 2. Verify counts
npx tsx scripts/verify-chef-recipe-counts.ts
# 3. Fix if needed
npx tsx scripts/fix-chef-recipe-counts.ts
```

### Troubleshooting

If counts seem wrong:

1. **Check linkage methods**:
   ```bash
   npx tsx scripts/check-recipe-chef-links.ts
   ```
   This shows whether recipes are linked via `chef_recipes` table or `recipes.chef_id`.

2. **Analyze count source**:
   ```bash
   npx tsx scripts/analyze-chef-count-source.ts
   ```
   This identifies which linkage method matches the stored counts.

3. **Fix discrepancies**:
   ```bash
   npx tsx scripts/fix-chef-recipe-counts.ts
   ```

## Server Action Reference

### `updateChefRecipeCount(chefId: string)`

**Location**: `/src/app/actions/chefs.ts` (line 228)

**Purpose**: Recalculates and updates a single chef's recipe count

**Usage**:
```typescript
import { updateChefRecipeCount } from '@/app/actions/chefs';

// After modifying chef-recipe relationships
await updateChefRecipeCount(chefId);
```

**Implementation**:
```typescript
export async function updateChefRecipeCount(chefId: string) {
  // Count recipes for this chef
  const count = await db
    .select({ count: sql<number>`count(*)` })
    .from(chefRecipes)
    .where(eq(chefRecipes.chef_id, chefId));

  const recipeCount = Number(count[0]?.count || 0);

  await db
    .update(chefs)
    .set({ recipe_count: recipeCount, updated_at: new Date() })
    .where(eq(chefs.id, chefId));

  return { success: true, recipeCount };
}
```

## Best Practices

### 1. Always Use Join Table

When adding/removing chef-recipe relationships, use the `chef_recipes` join table, not just `recipes.chef_id`.

**Correct**:
```typescript
// Add relationship
await db.insert(chefRecipes).values({
  chef_id: chefId,
  recipe_id: recipeId,
});

// Update count
await updateChefRecipeCount(chefId);
```

**Incorrect**:
```typescript
// Don't do this alone - also update chef_recipes
await db.update(recipes)
  .set({ chef_id: chefId })
  .where(eq(recipes.id, recipeId));
```

### 2. Call Update After Modifications

Always call `updateChefRecipeCount()` after operations that affect chef-recipe relationships:

```typescript
// Link recipe
await linkRecipeToChef({ chefId, recipeId });
// ✅ linkRecipeToChef already calls updateChefRecipeCount

// Unlink recipe
await unlinkRecipeFromChef({ chef_id: chefId, recipeId });
// ✅ unlinkRecipeFromChef already calls updateChefRecipeCount
```

### 3. Verify After Bulk Operations

```typescript
// After bulk import
await bulkImportRecipes(recipes);

// Verify counts
for (const chefId of affectedChefIds) {
  await updateChefRecipeCount(chefId);
}
```

## Database Trigger (Future Enhancement)

Consider implementing a PostgreSQL trigger to automatically maintain counts:

```sql
CREATE OR REPLACE FUNCTION update_chef_recipe_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE chefs
    SET recipe_count = recipe_count + 1,
        updated_at = NOW()
    WHERE id = NEW.chef_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE chefs
    SET recipe_count = GREATEST(recipe_count - 1, 0),
        updated_at = NOW()
    WHERE id = OLD.chef_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER chef_recipe_count_trigger
AFTER INSERT OR DELETE ON chef_recipes
FOR EACH ROW
EXECUTE FUNCTION update_chef_recipe_count();
```

This would eliminate the need for manual `updateChefRecipeCount()` calls.

## Monitoring

### Health Check Query

Run this query to check for discrepancies:

```sql
SELECT
  c.name,
  c.recipe_count as stored_count,
  COUNT(cr.id)::int as actual_count,
  COUNT(cr.id)::int - c.recipe_count as difference
FROM chefs c
LEFT JOIN chef_recipes cr ON cr.chef_id = c.id
GROUP BY c.id, c.name, c.recipe_count
HAVING COUNT(cr.id)::int != c.recipe_count
ORDER BY ABS(COUNT(cr.id)::int - c.recipe_count) DESC;
```

**Expected result**: No rows (all counts match)

## Related Documentation

- [Chef Schema](/src/lib/db/chef-schema.ts) - Database schema definition
- [Chef Actions](/src/app/actions/chefs.ts) - Server actions for chef operations
- [Chef Count Fix Report](/docs/fixes/chef-recipe-count-fix-2025-10-24.md) - Historical fix documentation

## Support

If you encounter issues:
1. Check the verification script output
2. Review recent database changes
3. Run diagnostic scripts to identify the issue
4. Apply fixes using the fix script
5. Verify the fix was successful

---

**Last Updated**: October 24, 2025
**Maintainer**: Development Team
