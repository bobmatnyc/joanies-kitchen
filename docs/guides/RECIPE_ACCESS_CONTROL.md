# Recipe Access Control Implementation

## Overview

This document describes the access control system implemented for recipe management, ensuring users can only edit/delete their own recipes and that system recipes remain protected.

## Access Control Rules

### 1. User Recipe Ownership
- **Rule**: Users can only edit or delete recipes they own
- **Enforcement**: Server-side validation in `updateRecipe()` and `deleteRecipe()`
- **UI Behavior**: Edit/Delete buttons only shown for user's own recipes

### 2. System Recipe Protection
- **Rule**: System recipes (`isSystemRecipe: true`) cannot be modified or deleted by anyone
- **Enforcement**: Server-side validation blocks all modification attempts
- **UI Behavior**: Edit/Delete buttons hidden for system recipes
- **Visual Indicator**: System Recipe badge displayed on recipe detail pages

### 3. Public Recipe Viewing
- **Rule**: Public recipes from other users can be viewed but not edited
- **Enforcement**: `getRecipe()` allows viewing public recipes, modification blocked by ownership checks
- **UI Behavior**: Edit/Delete buttons hidden for other users' recipes

## Implementation Details

### Server-Side Protection

#### File: `src/app/actions/recipes.ts`

**updateRecipe() Function**
```typescript
export async function updateRecipe(id: string, data: Partial<Recipe>) {
  // 1. Authenticate user
  const { userId } = await auth();
  if (!userId) {
    return { success: false, error: 'Authentication required' };
  }

  // 2. Fetch recipe
  const existingRecipe = await db.select().from(recipes)
    .where(eq(recipes.id, id))
    .limit(1);

  if (existingRecipe.length === 0) {
    return { success: false, error: 'Recipe not found' };
  }

  const recipe = existingRecipe[0];

  // 3. Verify ownership
  if (recipe.userId !== userId) {
    return { success: false, error: 'You do not have permission to edit this recipe' };
  }

  // 4. Block system recipe modifications
  if (recipe.isSystemRecipe) {
    return { success: false, error: 'System recipes cannot be modified' };
  }

  // 5. Proceed with update...
}
```

**deleteRecipe() Function**
```typescript
export async function deleteRecipe(id: string) {
  // 1. Authenticate user
  const { userId } = await auth();
  if (!userId) {
    return { success: false, error: 'Authentication required' };
  }

  // 2. Fetch recipe
  const existingRecipe = await db.select().from(recipes)
    .where(eq(recipes.id, id))
    .limit(1);

  if (existingRecipe.length === 0) {
    return { success: false, error: 'Recipe not found' };
  }

  const recipe = existingRecipe[0];

  // 3. Verify ownership
  if (recipe.userId !== userId) {
    return { success: false, error: 'You do not have permission to delete this recipe' };
  }

  // 4. Block system recipe deletion
  if (recipe.isSystemRecipe) {
    return { success: false, error: 'System recipes cannot be deleted' };
  }

  // 5. Proceed with deletion...
}
```

### Client-Side UI Protection

#### File: `src/app/recipes/[id]/page.tsx`

**Ownership Check Logic**
```typescript
// Check if current user is the owner
// System recipes cannot be edited by anyone
if (result.data.isSystemRecipe) {
  setIsOwner(false);
} else {
  // In development mode (no auth), treat all recipes as owned
  const isDevelopment = process.env.NODE_ENV === 'development';
  if (isDevelopment && !isSignedIn) {
    setIsOwner(true);
  } else if (isSignedIn && user?.id === result.data.userId) {
    setIsOwner(true);
  }
}
```

**Conditional Button Rendering**
```tsx
{isOwner && (
  <>
    <Link href={`/recipes/${recipeId}/edit`}>
      <Button variant="outline">
        <Edit className="w-4 h-4 mr-2" />
        Edit
      </Button>
    </Link>
    <Button
      variant="outline"
      onClick={() => setShowDeleteDialog(true)}
      disabled={deleting}
    >
      <Trash2 className="w-4 h-4 mr-2" />
      Delete
    </Button>
  </>
)}
```

**System Recipe Badge**
```tsx
{recipe.isSystemRecipe && (
  <Badge variant="default" className="bg-jk-tomato">
    <Lock className="w-3 h-3 mr-1" />
    System Recipe
  </Badge>
)}
```

## Error Messages

The system returns clear, user-friendly error messages:

| Scenario | Error Message |
|----------|--------------|
| Unauthenticated request | "Authentication required" |
| Recipe doesn't exist | "Recipe not found" |
| Editing another user's recipe | "You do not have permission to edit this recipe" |
| Deleting another user's recipe | "You do not have permission to delete this recipe" |
| Editing system recipe | "System recipes cannot be modified" |
| Deleting system recipe | "System recipes cannot be deleted" |

## Testing

### Test Script: `scripts/test-access-control.ts`

The test script validates:
1. Recipe ownership checks work correctly
2. System recipe flag is properly set
3. Users can access their own recipes
4. Users cannot modify other users' recipes
5. System recipes are protected from all modifications
6. Public/private access control works correctly

**Run Tests:**
```bash
npx tsx scripts/test-access-control.ts
```

### Manual Testing Checklist

- [ ] User can edit their own recipes
- [ ] User can delete their own recipes
- [ ] User cannot see edit button for other users' recipes
- [ ] User cannot see edit button for system recipes
- [ ] System Recipe badge displays on system recipes
- [ ] Attempting to edit another user's recipe via API returns error
- [ ] Attempting to delete another user's recipe via API returns error
- [ ] Attempting to modify system recipe via API returns error
- [ ] Public recipes from other users are viewable but not editable
- [ ] Private recipes from other users are not accessible

## Security Considerations

### Defense in Depth
1. **Server-side validation is primary defense** - Never rely on client-side checks alone
2. **Client-side UI improves UX** - Hides options that would fail anyway
3. **Database constraints** - Recipe schema includes userId and isSystemRecipe flags
4. **Authentication required** - All modification actions require valid Clerk session

### Attack Scenarios Prevented

| Attack | Prevention |
|--------|-----------|
| Direct API call to edit another user's recipe | Server validates userId matches recipe owner |
| Direct API call to delete system recipe | Server blocks all system recipe modifications |
| Manipulating client state to show edit buttons | Server validation prevents actual modification |
| SQL injection to modify recipes | Drizzle ORM uses parameterized queries |
| Session hijacking | Clerk handles secure session management |

## Database Schema

### Relevant Fields

```typescript
export const recipes = pgTable('recipes', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),        // Clerk user ID (ownership)
  isPublic: boolean('is_public').default(false), // Visibility flag
  isSystemRecipe: boolean('is_system_recipe').default(false), // System recipe flag
  // ... other fields
});
```

## Future Enhancements

Potential improvements to consider:

1. **Role-based access control**: Add admin role that can modify system recipes
2. **Recipe collaborators**: Allow multiple users to edit a recipe
3. **Edit history**: Track who made changes and when
4. **Soft delete**: Mark recipes as deleted instead of removing them
5. **Recipe forking**: Allow users to create editable copies of system recipes
6. **Audit logging**: Log all access attempts for security monitoring

## Related Documentation

- Authentication Guide: `docs/guides/AUTHENTICATION_GUIDE.md`
- Database Schema: `src/lib/db/schema.ts`
- Recipe Actions: `src/app/actions/recipes.ts`
- Recipe Detail Page: `src/app/recipes/[id]/page.tsx`

## Changelog

### 2025-10-15 - Initial Implementation
- Added userId validation to `updateRecipe()` and `deleteRecipe()`
- Added system recipe protection to server actions
- Updated UI to hide edit/delete buttons for non-owned recipes
- Added System Recipe badge to recipe detail page
- Created comprehensive test script
- Documented access control implementation

---

**Last Updated**: 2025-10-15
**Version**: 1.0.0
**Maintained By**: Recipe Manager Team
