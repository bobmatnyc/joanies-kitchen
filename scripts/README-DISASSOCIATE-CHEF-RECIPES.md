# Chef Recipe Disassociation - Summary

## Problem
Two recipes were incorrectly associated with "Joanie from Joanie's Kitchen" chef profile, but they actually belong to a different person named Joanie (Joanie Simon from "Dorm Room Recipes").

## Recipe IDs Updated
1. `d8e9184c-144a-4bff-a518-a4d63e3146ab` - "Dorm Room Recipes | Joanie Simon"
2. `fc3bb79b-a596-4c9c-bbe8-10a08a3e621f` - "Joanie's Cheese Dip"

## Solution Implemented

### Understanding the Architecture
The application uses TWO mechanisms to associate recipes with chefs:

1. **Direct foreign key**: `recipes.chef_id` references `chefs.id`
2. **Junction table**: `chef_recipes` table creates many-to-many relationships

The chef profile page (`/chef/joanie`) uses the junction table to fetch recipes, so both mechanisms needed to be updated.

### Changes Made

#### 1. Database Updates
**Script**: `scripts/disassociate-recipes-from-chef.ts`

The script performs two operations:
- **Removes entries from `chef_recipes` junction table** for both recipe IDs
- **Sets `chef_id` to `null` in `recipes` table** while keeping `is_public = true`

#### 2. Verification
**Script**: `scripts/verify-joanie-recipes.ts`

Confirms that:
- The recipes no longer appear on `/chef/joanie` page
- The recipes remain public and accessible
- Other Joanie recipes remain unaffected

## Results

### Before
- Both recipes appeared on `/chef/joanie` page
- `recipes.chef_id` = `f1272147-9a8f-47e3-8f21-09339e278002` (Joanie's chef ID)
- `chef_recipes` table had 2 entries linking these recipes to Joanie

### After
- ✅ Recipes do NOT appear on `/chef/joanie` page
- ✅ `recipes.chef_id` = `null` for both recipes
- ✅ `chef_recipes` table has 0 entries for these recipe IDs
- ✅ Recipes remain public (`is_public = true`)
- ✅ Recipes are still accessible at their URLs
- ✅ Other Joanie recipes remain intact (e.g., "Joanie's Monday Night Crab Salad")

## Running the Scripts

### To disassociate recipes:
```bash
npx tsx scripts/disassociate-recipes-from-chef.ts
```

### To verify changes:
```bash
npx tsx scripts/verify-joanie-recipes.ts
```

## Impact

### What Changed
- 2 recipes disassociated from Joanie chef profile
- 2 entries removed from `chef_recipes` junction table
- 2 recipes updated in `recipes` table (chef_id set to null)

### What Didn't Change
- Recipes remain public and accessible
- Recipe content, images, and metadata unchanged
- All other chef-recipe associations intact
- Joanie's other recipes still properly attributed

## Database Schema Reference

### recipes table
```typescript
{
  chef_id: uuid | null,  // Direct FK reference to chefs.id
  is_public: boolean,    // Recipe visibility
  // ... other fields
}
```

### chef_recipes table (junction)
```typescript
{
  id: uuid,
  chef_id: uuid,      // FK to chefs.id
  recipe_id: text,    // FK to recipes.id
  original_url: text,
  scraped_at: timestamp,
}
```

### How Chef Pages Work
The `/chef/[slug]` page uses this query:
```typescript
db.select()
  .from(chefRecipes)
  .innerJoin(recipes, eq(chefRecipes.recipe_id, recipes.id))
  .where(eq(chefRecipes.chef_id, chef.id))
```

This means recipes ONLY appear on a chef page if there's an entry in the `chef_recipes` junction table.

## Files Created

1. **scripts/disassociate-recipes-from-chef.ts** - Main update script
2. **scripts/verify-joanie-recipes.ts** - Verification script
3. **scripts/README-DISASSOCIATE-CHEF-RECIPES.md** - This documentation

## Future Considerations

If similar issues arise:
1. Check BOTH `recipes.chef_id` AND `chef_recipes` table
2. Use the disassociate script as a template
3. Always verify with the verification script
4. Consider adding chef attribution validation during recipe import

---

**Date**: 2025-10-23
**Status**: ✅ Completed Successfully
**Impact**: Minimal (2 recipes, no breaking changes)
