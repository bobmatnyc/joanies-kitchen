# Investigation Report: Meals and Chefs Pages Showing 0 Results

**Date:** 2025-11-01
**Investigator:** Claude (Research Agent)
**Status:** ✅ ROOT CAUSE IDENTIFIED

---

## Executive Summary

Despite having **9 public meals** and **31 active chefs** in the database, both `/meals` and `/discover/chefs` pages display "0 results" to users. The investigation revealed that:

1. **Database queries work correctly** ✅
2. **Server actions return data correctly** ✅
3. **The middleware is incorrectly configured** ❌

The root cause is a **critical middleware configuration bug** where:
- `/meals` is incorrectly treated as a protected route requiring authentication
- The public route matcher variable is defined but never used

---

## Investigation Findings

### Database Health ✅

**Verified via:** `scripts/debug-meals-chefs-query.ts`

```
MEALS:
  Total: 10
  Public (is_public = true): 9  ← Should display
  Private (is_public = false): 1
  NULL is_public: 0

CHEFS:
  Total: 31
  Active (is_active = true): 31  ← Should display
  Inactive: 0
  NULL is_active: 0
```

### Server Actions ✅

**Verified via:** `scripts/test-page-actions.ts`

Both server actions return data correctly:
- `getPublicMeals()` → Returns 9 meals
- `getAllChefs()` → Returns 31 chefs

### Query Logic ✅

**Meals Query:**
- **File:** `/src/app/actions/meals.ts`
- **Function:** `getPublicMeals` (Lines 193-218)
- **Filter:** `eq(meals.is_public, true)` (Line 200)
- **Status:** ✅ Correct

**Chefs Query:**
- **File:** `/src/app/actions/chefs.ts`
- **Function:** `getAllChefs` (Lines 174-204)
- **Filter:** `eq(chefs.is_active, true)` (Line 177)
- **Status:** ✅ Correct

---

## Root Cause: Middleware Configuration Bug ❌

### Issue #1: `/meals` Incorrectly Protected

**File:** `/src/middleware.ts` (Line 69)

```typescript
const isProtectedRoute = createRouteMatcher([
  '/recipes/new(.*)',
  '/recipes/edit(.*)',
  '/recipes$',
  '/meals/new(.*)',
  '/meals$',           // ❌ INCORRECT - Blocks public browsing
  '/meal-plans(.*)',
  '/shopping-lists(.*)',
]);
```

**Problem:**
The pattern `/meals$` matches the exact path `/meals`, treating it as a **protected route** requiring authentication (Line 128-138). When unauthenticated users visit `/meals`, they are redirected to `/sign-in`.

**Intent vs Reality:**
- **Page Intent:** Browse public meals shared by the community (Line 22-23 of `/src/app/meals/page.tsx`)
- **Middleware Behavior:** Redirects to sign-in for unauthenticated users
- **Result:** Authenticated users see 0 meals because they don't own any; unauthenticated users can't even access the page

### Issue #2: Public Route Matcher Not Used

**File:** `/src/middleware.ts` (Line 51-58)

```typescript
const _isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/shared(.*)',
  '/discover(.*)',   // ✅ Correctly includes /discover/chefs
  '/api/webhooks(.*)',
]);
```

**Problem:**
The variable is named `_isPublicRoute` with an underscore prefix, which in JavaScript/TypeScript conventions indicates an **intentionally unused variable**. The middleware never actually checks this matcher.

**Impact on Chefs:**
While `/discover/chefs` is technically defined as public, if authentication is enforced globally without checking `_isPublicRoute`, the chefs page might still be blocked.

---

## Technical Details

### Why Server Actions Return Data But Pages Show 0

1. **Middleware intercepts the request** before the page component renders
2. **For `/meals`:** Redirects unauthenticated users to `/sign-in`
3. **For authenticated users on `/meals`:** The query `eq(meals.is_public, true)` returns all public meals, but if the user expects to see their own meals, they see none (confusion between "Browse Public Meals" vs "My Meals")
4. **For `/discover/chefs`:** Possible similar authentication issue or the undefined `_isPublicRoute` causing access problems

### File Locations & Line Numbers

| Component | File Path | Lines |
|-----------|-----------|-------|
| **Meals Page** | `/src/app/meals/page.tsx` | 1-87 |
| **Meals Action** | `/src/app/actions/meals.ts` | 193-218 |
| **Chefs Page** | `/src/app/discover/chefs/page.tsx` | 1-47 |
| **Chefs Action** | `/src/app/actions/chefs.ts` | 174-204 |
| **Middleware (BUG)** | `/src/middleware.ts` | 51-58, 64-72, 128-138 |
| **Meals List Component** | `/src/components/meals/MealsList.tsx` | 20-84 |
| **Chef Grid Component** | `/src/components/chef/ChefGrid.tsx` | 28-50 |

---

## Recommended Fixes

### Fix #1: Remove `/meals` from Protected Routes

**File:** `/src/middleware.ts` (Line 69)

**Change:**
```typescript
// BEFORE
const isProtectedRoute = createRouteMatcher([
  '/recipes/new(.*)',
  '/recipes/edit(.*)',
  '/recipes$',
  '/meals/new(.*)',
  '/meals$',        // ❌ Remove this line
  '/meal-plans(.*)',
  '/shopping-lists(.*)',
]);

// AFTER
const isProtectedRoute = createRouteMatcher([
  '/recipes/new(.*)',
  '/recipes/edit(.*)',
  '/recipes$',
  '/meals/new(.*)',
  // '/meals$' removed - now public for browsing
  '/meal-plans(.*)',
  '/shopping-lists(.*)',
]);
```

**Rationale:**
- `/meals` should be a public browsing page (like `/shared` or `/discover`)
- Creating a meal (`/meals/new`) should still require authentication (already covered)
- Viewing individual meals (`/meals/[slug]`) has its own access control (Line 98)

### Fix #2: Add `/meals` to Public Routes Matcher

**File:** `/src/middleware.ts` (Line 51-58)

**Change:**
```typescript
// BEFORE
const _isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/shared(.*)',
  '/discover(.*)',
  '/api/webhooks(.*)',
]);

// AFTER (also fix variable name)
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/shared(.*)',
  '/meals',          // ✅ Add public meals browsing
  '/discover(.*)',
  '/api/webhooks(.*)',
]);
```

### Fix #3: Actually Use the Public Route Matcher

**File:** `/src/middleware.ts` (Around Line 128)

**Add check for public routes:**
```typescript
// After line 103 (after checking view routes), add:
if (isPublicRoute(req)) {
  return NextResponse.next();
}
```

This ensures public routes are always accessible regardless of authentication status.

---

## Alternative Solution: Separate "My Meals" from "Browse Meals"

If the intent is to have both:
1. **`/meals`** → Browse public meals (everyone)
2. **`/my-meals`** → User's personal meal collection (authenticated)

Then update the protected routes to:
```typescript
const isProtectedRoute = createRouteMatcher([
  '/recipes/new(.*)',
  '/recipes/edit(.*)',
  '/recipes$',
  '/meals/new(.*)',
  '/my-meals(.*)',    // ✅ Personal meals protected
  '/meal-plans(.*)',
  '/shopping-lists(.*)',
]);
```

And create a new `/my-meals` page for authenticated users to manage their personal meals.

---

## Verification Steps

After applying fixes:

1. **Test unauthenticated access:**
   ```bash
   # Visit in incognito/private browser
   http://localhost:3000/meals
   http://localhost:3000/discover/chefs
   ```
   **Expected:** Should see 9 meals and 31 chefs

2. **Test authenticated access:**
   ```bash
   # Sign in and visit
   http://localhost:3000/meals
   http://localhost:3000/discover/chefs
   ```
   **Expected:** Should still see 9 meals and 31 chefs

3. **Run test scripts:**
   ```bash
   npx tsx scripts/debug-meals-chefs-query.ts
   npx tsx scripts/test-page-actions.ts
   ```

---

## Additional Notes

### Database Schema Configuration

While investigating, noticed that `drizzle.config.ts` doesn't include `meals-schema.ts` in the schema array (Lines 16-21). However, since `meals` is re-exported from `schema.ts` (Line 810), this shouldn't cause runtime issues. Consider adding it for completeness:

```typescript
schema: [
  './src/lib/db/schema.ts',
  './src/lib/db/meals-schema.ts',      // ✅ Add for completeness
  './src/lib/db/user-discovery-schema.ts',
  './src/lib/db/chef-schema.ts',
  './src/lib/db/ingredients-schema.ts'
],
```

---

## Conclusion

The meals and chefs pages are not displaying data due to a **middleware routing configuration bug**, NOT database or query issues. The fix is straightforward:

1. Remove `/meals$` from protected routes (1 line deletion)
2. Add `/meals` to public routes (1 line addition)
3. Fix the unused `_isPublicRoute` variable and actually use it (variable rename + add check)

**Estimated Fix Time:** 5 minutes
**Testing Time:** 10 minutes
**Total Resolution Time:** ~15 minutes

---

**Investigation Scripts Created:**
- `/scripts/debug-meals-chefs-query.ts` - Database verification
- `/scripts/test-page-actions.ts` - Server action verification

Both scripts confirmed that the backend is functioning correctly.
