# Quick Fixes for Production Issues

**Based on:** API QA Comprehensive Report (2025-11-01)

---

## 🚨 CRITICAL: Fix Recipe Images (93.58% affected)

### The Problem
- 4,429 out of 4,733 recipes have NULL in `image_url` field
- Database has TWO image fields: `image_url` (mostly NULL) and `images` (more populated)
- 608 recipes have data in `images` array but not in `image_url`

### The Fix (5 minutes)

```sql
-- Connect to database
psql $DATABASE_URL

-- Step 1: Populate image_url from images array (fixes 608 recipes)
UPDATE recipes
SET image_url = (
  CASE
    WHEN images IS NOT NULL AND images != '' AND images != '[]'
    THEN (images::jsonb->0)::text
    ELSE NULL
  END
)
WHERE image_url IS NULL
  AND deleted_at IS NULL;

-- Step 2: Set default placeholder for remaining recipes
UPDATE recipes
SET image_url = '/images/recipe-placeholder.jpg'
WHERE image_url IS NULL
  AND deleted_at IS NULL;

-- Step 3: Verify fix
SELECT
  COUNT(*) FILTER (WHERE image_url IS NULL) as null_count,
  COUNT(*) FILTER (WHERE image_url LIKE '%placeholder%') as placeholder_count,
  COUNT(*) FILTER (WHERE image_url IS NOT NULL AND image_url NOT LIKE '%placeholder%') as real_images,
  COUNT(*) as total
FROM recipes
WHERE deleted_at IS NULL;

-- Expected result:
-- null_count: 0
-- placeholder_count: ~4,125
-- real_images: ~608
-- total: 4,733
```

### Verification
```bash
# After running migration, test the API
curl http://localhost:3005/api/recipes/paginated?page=1&limit=10 | jq '.recipes[] | {name, image_url}'

# Should see NO null values
```

---

## 🔍 HIGH PRIORITY: Fix Meals Page (Not Displaying Data)

### The Problem
- Database has 10 meals (9 public)
- All have slugs and images
- Meals page loads but shows 0 meals

### Investigation Steps

1. **Check the meals page component:**
```bash
# Open the meals page
cat /Users/masa/Projects/joanies-kitchen/src/app/meals/page.tsx
```

2. **Add debug logging to getUserMeals:**
```typescript
// In src/app/actions/meals.ts
export async function getUserMeals(data: unknown) {
  // Add logging
  console.log('🔍 getUserMeals called with:', data);
  const result = await db.select()...;
  console.log('🔍 Meals found:', result.length);
  console.log('🔍 Public meals:', result.filter(m => m.is_public).length);
  return result;
}
```

3. **Test directly:**
```bash
# Check server logs while loading /meals
pm2 logs joanies-kitchen --lines 50
```

### Possible Causes
- Query filtering by user_id when it should show public meals
- Frontend conditional rendering issue
- Meal card component not receiving data
- is_public filter too restrictive

---

## 🔍 MEDIUM PRIORITY: Fix Chefs Page (Not Displaying Data)

### Same Issue as Meals
- 31 chefs in database
- Page loads but shows 0 chefs
- Likely same root cause as meals issue

### Quick Check
```typescript
// Check if chefs query is filtering by user_id
// Chefs should be global/public, not user-scoped
```

---

## ✅ NO ACTION NEEDED: Meal Slugs

**Status:** All working correctly

The database shows:
- 10 meals total
- 10 have slugs (100%)
- All slugs are valid and unique

Previous "meal not found" errors were likely due to:
- Testing before slugs were generated
- Stale data
- Accessing private meals without authentication

**No fix needed** - this issue is resolved.

---

## 📝 RECOMMENDED: Add Database Constraints

### Prevent Future Issues

```sql
-- Prevent meals without slugs
ALTER TABLE meals
ALTER COLUMN slug SET NOT NULL;

-- Prevent recipes without image_url
ALTER TABLE recipes
ALTER COLUMN image_url SET NOT NULL;

-- Add default value for new recipes
ALTER TABLE recipes
ALTER COLUMN image_url SET DEFAULT '/images/recipe-placeholder.jpg';
```

---

## 🧪 Testing After Fixes

### Test Recipe Images
```bash
# Should show 100% with image_url
curl http://localhost:3005/api/recipes/paginated?limit=100 | \
  jq '[.recipes[] | select(.image_url == null)] | length'
# Expected: 0
```

### Test Meals Page
```bash
# Visit in browser
open http://localhost:3005/meals
# Should show 9 public meals
```

### Test Chefs Page
```bash
# Visit in browser
open http://localhost:3005/chefs
# Should show 31 chefs
```

---

## 📊 Expected Outcomes

**After Recipe Image Fix:**
- ✅ 0 recipes with NULL image_url
- ✅ 608 recipes with real images
- ✅ 4,125 recipes with placeholder images
- ✅ All API responses have valid image URLs

**After Meals/Chefs Fix:**
- ✅ Meals page shows 9 public meals
- ✅ Chefs page shows 31 chefs
- ✅ All public data visible to users

---

## 🚀 Deployment Checklist

- [ ] Run recipe image_url migration
- [ ] Verify 0 NULL image_urls
- [ ] Debug meals page rendering
- [ ] Debug chefs page rendering
- [ ] Test all pages in browser
- [ ] Test API endpoints
- [ ] Add database constraints
- [ ] Monitor logs for errors
- [ ] Update documentation

---

**Total Estimated Time:** 1.5 hours
- Recipe migration: 5 minutes
- Meals/Chefs debugging: 60 minutes
- Testing and verification: 25 minutes

**Files to Review:**
- `/Users/masa/Projects/joanies-kitchen/src/app/meals/page.tsx`
- `/Users/masa/Projects/joanies-kitchen/src/app/chefs/page.tsx`
- `/Users/masa/Projects/joanies-kitchen/src/app/actions/meals.ts`
- `/Users/masa/Projects/joanies-kitchen/src/app/actions/chefs.ts`
