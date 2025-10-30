# Recipe Moderation Migration - Quick Reference

## Summary

Added moderation workflow fields to the recipes table to support admin review of user-uploaded recipes before they become publicly visible.

## What Changed

### New Database Fields

```sql
-- recipes table additions
moderation_status   TEXT NOT NULL DEFAULT 'pending'  -- 'pending' | 'approved' | 'rejected' | 'flagged'
moderation_notes    TEXT                              -- Admin notes about rejection/flagging
moderated_by        TEXT                              -- Clerk user ID of moderator
moderated_at        TIMESTAMP                         -- When moderation occurred
submission_notes    TEXT                              -- User's notes when submitting
```

### New Indexes

```sql
CREATE INDEX idx_recipes_moderation_status ON recipes(moderation_status);
CREATE INDEX idx_recipes_moderation_pending ON recipes(moderation_status, created_at DESC);
```

## Running the Migration

```bash
# Apply migration
pnpm tsx scripts/migrations/add-moderation-fields.ts

# Rollback if needed
pnpm tsx scripts/migrations/add-moderation-fields.ts --rollback
```

## What Happened to Existing Recipes?

All existing recipes were automatically marked as `approved` during migration. No changes to public visibility.

## Updated Recipe Visibility Logic

**Before:**
```typescript
recipe.is_public === true
```

**After:**
```typescript
recipe.is_public === true && recipe.moderation_status === 'approved'
```

## Moderation Workflow

```
New User Recipe
    ↓
moderation_status = 'pending'
    ↓
Admin Reviews
    ↓
┌──────────┼──────────┐
↓          ↓          ↓
approved   rejected   flagged
```

## Quick Usage Examples

### Check if Recipe is Publicly Visible

```typescript
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

// Get publicly visible recipes
const publicRecipes = await db
  .select()
  .from(recipes)
  .where(
    and(
      eq(recipes.is_public, true),
      eq(recipes.moderation_status, 'approved')
    )
  );
```

### Get Pending Moderation Queue

```typescript
import { desc } from 'drizzle-orm';

const pendingRecipes = await db
  .select()
  .from(recipes)
  .where(eq(recipes.moderation_status, 'pending'))
  .orderBy(desc(recipes.created_at));
```

### Approve a Recipe

```typescript
async function approveRecipe(recipeId: string, moderatorId: string) {
  await db
    .update(recipes)
    .set({
      moderation_status: 'approved',
      moderated_by: moderatorId,
      moderated_at: new Date(),
    })
    .where(eq(recipes.id, recipeId));
}
```

### Reject a Recipe

```typescript
async function rejectRecipe(
  recipeId: string,
  moderatorId: string,
  reason: string
) {
  await db
    .update(recipes)
    .set({
      moderation_status: 'rejected',
      moderation_notes: reason,
      moderated_by: moderatorId,
      moderated_at: new Date(),
    })
    .where(eq(recipes.id, recipeId));
}
```

### Flag an Approved Recipe

```typescript
async function flagRecipe(
  recipeId: string,
  moderatorId: string,
  reason: string
) {
  await db
    .update(recipes)
    .set({
      moderation_status: 'flagged',
      moderation_notes: reason,
      moderated_by: moderatorId,
      moderated_at: new Date(),
    })
    .where(eq(recipes.id, recipeId));
}
```

## TypeScript Types

The schema types are automatically updated:

```typescript
import type { Recipe, NewRecipe } from '@/lib/db/schema';

// Recipe type now includes:
interface Recipe {
  // ... existing fields
  moderation_status: 'pending' | 'approved' | 'rejected' | 'flagged';
  moderation_notes: string | null;
  moderated_by: string | null;
  moderated_at: Date | null;
  submission_notes: string | null;
}
```

## Implementation Checklist

### ✅ Completed
- [x] Schema updated with moderation fields
- [x] Migration script created
- [x] Indexes created for performance
- [x] Existing recipes marked as approved
- [x] Documentation created

### 🔲 To Do
- [ ] Update recipe creation logic to set moderation_status based on user role
- [ ] Update all recipe queries to check moderation_status
- [ ] Create admin moderation queue UI
- [ ] Add server actions for approve/reject/flag
- [ ] Add moderation status to user dashboard
- [ ] Add submission_notes field to recipe creation form
- [ ] Test visibility logic with different moderation states

## Testing

```typescript
// Test that pending recipes are not visible
const pendingRecipe = await db.insert(recipes).values({
  name: 'Test Recipe',
  user_id: 'test-user',
  moderation_status: 'pending',
  is_public: true,
  // ... other required fields
});

// Should NOT appear in public query
const publicRecipes = await db
  .select()
  .from(recipes)
  .where(
    and(
      eq(recipes.is_public, true),
      eq(recipes.moderation_status, 'approved')
    )
  );

expect(publicRecipes).not.toContainEqual(
  expect.objectContaining({ id: pendingRecipe.id })
);
```

## Important Notes

1. **Backward Compatibility**: All existing recipes are marked as 'approved' - no disruption to current public recipes
2. **Default Behavior**: New recipes default to 'pending' status
3. **is_public Field**: Still respected - recipe must be both public AND approved to be visible
4. **System Recipes**: Should be created with 'approved' status
5. **Admin Uploads**: Can be auto-approved or require moderation based on business rules

## Rollback Instructions

If you need to rollback:

```bash
# Backup database first (recommended)
pg_dump $DATABASE_URL > backup.sql

# Run rollback
pnpm tsx scripts/migrations/add-moderation-fields.ts --rollback
```

**Warning:** Rollback will delete all moderation data (status, notes, timestamps).

## Files Changed

1. **Schema**: `/src/lib/db/schema.ts`
   - Added moderation fields to recipes table
   - Added moderation indexes

2. **Migration**: `/scripts/migrations/add-moderation-fields.ts`
   - Adds fields and indexes
   - Marks existing recipes as approved
   - Includes rollback functionality

3. **Documentation**:
   - `/docs/migrations/RECIPE-MODERATION-FIELDS.md` (detailed docs)
   - `/RECIPE_MODERATION_MIGRATION.md` (this file)

## Next Steps

1. Run the migration in development
2. Test recipe visibility with different moderation states
3. Implement admin moderation queue UI
4. Add server actions for moderation workflow
5. Update recipe creation flow
6. Run migration in production (during maintenance window if possible)

## Support

For questions or issues:
- See detailed docs: `/docs/migrations/RECIPE-MODERATION-FIELDS.md`
- Check schema: `/src/lib/db/schema.ts`
- Review migration: `/scripts/migrations/add-moderation-fields.ts`
