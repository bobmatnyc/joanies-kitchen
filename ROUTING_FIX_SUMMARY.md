# Recipe Routing Fix Summary

## Overview
Fixed recipe routing to use slugs for primary detail pages and GUIDs for special routes like "similar", ensuring consistent and SEO-friendly URLs.

## Changes Made

### 1. Route Structure
**Final Structure:**
```
src/app/recipes/
├── page.tsx                    # Recipe index
├── new/page.tsx               # Create new recipe
├── top-50/page.tsx            # Top 50 recipes
└── [slug]/
    ├── page.tsx               # Recipe detail (slug-based, redirects GUIDs to slugs)
    ├── edit/page.tsx          # Edit recipe (slug-based)
    └── similar/page.tsx       # Similar recipes (GUID-based, redirects slugs to GUIDs)
```

### 2. Recipe Detail Page (`/recipes/[slug]/page.tsx`)
**Behavior:**
- ✅ Primary access via slug: `/recipes/baked-ziti`
- ✅ GUID access redirects to slug: `/recipes/8626d87e-...` → `/recipes/baked-ziti` (line 176-179)
- ✅ Supports backward compatibility

**No changes needed** - already implemented redirect logic.

### 3. Similar Recipes Route (`/recipes/[slug]/similar/page.tsx`)
**Behavior:**
- ✅ Primary access via GUID: `/recipes/8626d87e-.../similar`
- ✅ Slug access redirects to GUID: `/recipes/baked-ziti/similar` → `/recipes/8626d87e-.../similar`
- ✅ Uses stable IDs to avoid issues if slug changes

**Changes:**
- Added `isUUID()` helper function to detect GUID format
- Added redirect logic if accessed via slug (lines 60-64)
- Kept parameter name as `slug` to match folder structure `[slug]`

### 4. Recipe Detail Page - Similar Button
**File:** `src/app/recipes/[slug]/page.tsx`

**Change:**
```typescript
// BEFORE:
<Link href={`/recipes/${recipe.slug || recipe.id}/similar`}>

// AFTER:
<Link href={`/recipes/${recipe.id}/similar`}>
```

**Reasoning:** Similar route expects GUID for stability.

### 5. Edit Page (`/recipes/[slug]/edit/page.tsx`)
**Changes:**
- Fixed parameter name from `id` to `slug` for consistency with folder structure
- Updated all references from `id` to `slug`
- Added smart back URL logic using slug if available, otherwise ID

### 6. RecipeCard Component
**No changes needed** - Already uses slugs correctly:
```typescript
const recipeUrl = recipe.slug ? `/recipes/${recipe.slug}` : `/recipes/${recipe.id}`;
```

### 7. SimilarRecipesWidget Component
**No changes needed** - Already uses recipe ID correctly:
```typescript
<Link href={`/recipes/${recipeId}/similar`}>
```

## Routing Behavior Summary

| Route Pattern | Parameter Type | Behavior | Example |
|--------------|---------------|----------|---------|
| `/recipes/[slug]` | Slug (primary) or GUID | GUID → Redirect to slug | `/recipes/baked-ziti` |
| `/recipes/[slug]/edit` | Slug (primary) or GUID | Accepts both | `/recipes/baked-ziti/edit` |
| `/recipes/[slug]/similar` | GUID (primary) | Slug → Redirect to GUID | `/recipes/8626d87e-.../similar` |

## Why This Approach?

### Single-Path Enforcement
- **Detail Pages:** Use slugs for SEO-friendly URLs
- **Similar Pages:** Use GUIDs to avoid breaking if slug changes
- **Edit Pages:** Use slugs for consistency with detail page

### Avoided Approaches
❌ **Separate [id] and [slug] folders:** Next.js doesn't allow different param names at same level
❌ **Always use GUIDs:** Not SEO-friendly
❌ **Always use slugs:** Breaks similar page if slug changes

### Chosen Solution
✅ **Smart redirects:** Accept both, redirect to canonical form
- Detail pages → Canonical: slug
- Similar pages → Canonical: GUID
- Edit pages → Accept both

## Testing Checklist

✅ `/recipes/baked-ziti` → Works (slug-based detail)
✅ `/recipes/8626d87e-...` → Redirects to `/recipes/baked-ziti` (GUID to slug)
✅ `/recipes/8626d87e-.../similar` → Works (GUID-based similar)
✅ `/recipes/baked-ziti/similar` → Redirects to `/recipes/8626d87e-.../similar` (slug to GUID)
✅ `/recipes/baked-ziti/edit` → Works (slug-based edit)
✅ All RecipeCard links use slugs
✅ "Similar" button uses recipe ID
✅ No Next.js routing conflicts
✅ Dev server starts without errors

## Files Modified

1. `src/app/recipes/[slug]/page.tsx` - Similar button link updated
2. `src/app/recipes/[slug]/edit/page.tsx` - Parameter name fixed, back URL improved
3. `src/app/recipes/[slug]/similar/page.tsx` - Recreated with GUID redirect logic

## Success Criteria Met

✅ Primary detail pages use slugs
✅ Similar pages use GUIDs (with slug-to-GUID redirect)
✅ GUID-based detail pages redirect to slug URLs
✅ All internal links updated appropriately
✅ No broken links
✅ Clear separation of concerns (detail=slug, special=GUID)
✅ No Next.js routing conflicts
✅ Single source of truth for each route type

## Implementation Date
2025-10-18

## Version
0.5.0
