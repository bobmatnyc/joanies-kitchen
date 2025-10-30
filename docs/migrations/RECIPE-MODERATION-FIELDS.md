# Recipe Moderation Fields Migration

## Overview

This migration adds moderation tracking fields to the `recipes` table to support the admin recipe moderation queue workflow. User-uploaded recipes will now go through a moderation process before being publicly visible.

## Migration Details

**Date:** 2025-10-30
**Schema Version:** Added to v0.7.2+
**Migration Script:** `/scripts/migrations/add-moderation-fields.ts`

## Schema Changes

### New Fields Added to `recipes` Table

| Field Name | Type | Nullable | Default | Description |
|------------|------|----------|---------|-------------|
| `moderation_status` | TEXT (enum) | NOT NULL | 'pending' | Current moderation status: 'pending', 'approved', 'rejected', or 'flagged' |
| `moderation_notes` | TEXT | YES | NULL | Admin notes explaining rejection or flagging reasons |
| `moderated_by` | TEXT | YES | NULL | Clerk user ID of the moderator who took action |
| `moderated_at` | TIMESTAMP | YES | NULL | When the moderation action was taken |
| `submission_notes` | TEXT | YES | NULL | User's notes when submitting the recipe for review |

### Moderation Status Values

- **`pending`**: Recipe submitted, awaiting moderation (default for new user uploads)
- **`approved`**: Recipe reviewed and approved for public display
- **`rejected`**: Recipe rejected, not suitable for public display
- **`flagged`**: Recipe flagged for investigation (previously approved, now under review)

### New Indexes

1. **`idx_recipes_moderation_status`**
   - Column: `moderation_status`
   - Purpose: Fast filtering of recipes by moderation status

2. **`idx_recipes_moderation_pending`**
   - Columns: `moderation_status, created_at DESC`
   - Purpose: Efficient querying of pending moderation queue sorted by submission time

## Moderation Workflow

```
User Upload → pending
    ↓
Admin Review
    ↓
┌───────┼───────┐
↓       ↓       ↓
approved rejected flagged
```

### Workflow States

1. **New Recipe Submission**
   - `moderation_status` = 'pending'
   - Recipe not visible to public
   - `submission_notes` can contain user's context

2. **Admin Approval**
   - `moderation_status` = 'approved'
   - `moderated_by` = Admin's Clerk user ID
   - `moderated_at` = Current timestamp
   - Recipe becomes publicly visible (if `is_public` = true)

3. **Admin Rejection**
   - `moderation_status` = 'rejected'
   - `moderation_notes` = Reason for rejection
   - `moderated_by` = Admin's Clerk user ID
   - `moderated_at` = Current timestamp
   - Recipe remains private

4. **Flagging for Review**
   - `moderation_status` = 'flagged'
   - `moderation_notes` = Reason for flagging
   - `moderated_by` = Admin's Clerk user ID
   - `moderated_at` = Current timestamp
   - Recipe may be hidden from public view

## Visibility Logic

### Previous Logic
```typescript
recipe.is_public === true
```

### New Logic
```typescript
recipe.is_public === true && recipe.moderation_status === 'approved'
```

**Important:** The `is_public` field is kept for backward compatibility and author control. A recipe must meet both criteria to be visible:
- Author wants it public (`is_public = true`)
- Moderators have approved it (`moderation_status = 'approved'`)

## Migration Execution

### Running the Migration

```bash
# Run migration
pnpm tsx scripts/migrations/add-moderation-fields.ts

# Or with npm
npm run tsx scripts/migrations/add-moderation-fields.ts
```

### Rollback

```bash
# Rollback migration
pnpm tsx scripts/migrations/add-moderation-fields.ts --rollback
```

## Data Migration

All existing recipes are automatically marked as `approved` with `moderated_at` set to the migration timestamp. This ensures:
- No disruption to existing publicly visible recipes
- All current recipes bypass moderation queue
- Clean slate for future user submissions

## Implementation Checklist

### Backend Changes

- [x] Add fields to schema.ts
- [x] Create migration script
- [ ] Update recipe creation logic:
  - System recipes: `moderation_status = 'approved'`
  - Admin uploads: `moderation_status = 'approved'`
  - User uploads: `moderation_status = 'pending'`
- [ ] Update visibility queries to check moderation_status
- [ ] Create server actions for moderation:
  - `approveRecipe(recipeId, moderatorId)`
  - `rejectRecipe(recipeId, moderatorId, notes)`
  - `flagRecipe(recipeId, moderatorId, notes)`

### Frontend Changes

- [ ] Admin moderation queue page:
  - List pending recipes
  - Show recipe preview
  - Approve/reject/flag buttons
  - Notes input for rejection/flagging
- [ ] User recipe submission form:
  - Optional submission_notes field
  - Clear messaging about moderation process
- [ ] User dashboard:
  - Show moderation status of user's recipes
  - Display rejection reasons
- [ ] Recipe display:
  - Hide pending/rejected recipes from public
  - Show appropriate message to recipe author

### Testing

- [ ] Test recipe visibility with different moderation states
- [ ] Test moderation queue filtering and sorting
- [ ] Test approval/rejection flow
- [ ] Test flagging of previously approved recipes
- [ ] Verify indexes improve query performance
- [ ] Test backward compatibility with is_public field

## Query Examples

### Get Pending Moderation Queue

```typescript
const pendingRecipes = await db
  .select()
  .from(recipes)
  .where(eq(recipes.moderation_status, 'pending'))
  .orderBy(desc(recipes.created_at));
```

### Get All Publicly Visible Recipes

```typescript
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

### Approve Recipe

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

### Reject Recipe

```typescript
async function rejectRecipe(
  recipeId: string,
  moderatorId: string,
  notes: string
) {
  await db
    .update(recipes)
    .set({
      moderation_status: 'rejected',
      moderation_notes: notes,
      moderated_by: moderatorId,
      moderated_at: new Date(),
    })
    .where(eq(recipes.id, recipeId));
}
```

## Performance Considerations

- **Index Usage**: The composite index `idx_recipes_moderation_pending` optimizes the most common query (pending recipes sorted by submission date)
- **Status Index**: Single-column index on `moderation_status` supports efficient filtering
- **Query Patterns**: Moderation queries should use these indexes for optimal performance

## Security Considerations

1. **Access Control**: Only admin users should be able to change moderation_status
2. **Audit Trail**: moderated_by and moderated_at provide accountability
3. **User Privacy**: Rejected recipes remain private to their authors
4. **Transparency**: moderation_notes help users understand rejection reasons

## Backward Compatibility

- All existing recipes are marked as 'approved'
- `is_public` field behavior is preserved
- No breaking changes to existing queries (new field has default value)
- Opt-in moderation: only new user uploads require moderation

## Future Enhancements

1. **Automated Moderation**: AI-based content screening for common issues
2. **Moderation History**: Track all status changes with timestamps
3. **Bulk Actions**: Approve/reject multiple recipes at once
4. **Moderation Reports**: Analytics on moderation queue and patterns
5. **Appeal Process**: Allow users to resubmit rejected recipes
6. **Moderation Levels**: Different tiers of moderators with different permissions

## Related Documentation

- [Admin Moderation Queue Specification](../features/admin-moderation-queue.md)
- [Recipe Schema Documentation](../schema/recipes.md)
- [Database Migrations Guide](./README.md)

## Rollback Plan

If issues arise, the migration can be rolled back:

```bash
pnpm tsx scripts/migrations/add-moderation-fields.ts --rollback
```

This will:
1. Drop both moderation indexes
2. Remove all 5 moderation columns
3. Restore recipes table to previous state

**Note:** Rollback will lose all moderation data (status, notes, timestamps). Consider backing up the database before migration if concerned.

## Version History

- **v1.0.0** (2025-10-30): Initial migration
  - Added 5 moderation fields
  - Created 2 indexes
  - Marked existing recipes as approved
