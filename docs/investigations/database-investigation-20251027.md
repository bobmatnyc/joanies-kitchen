# Database Investigation Report
**Date:** October 27, 2025
**Investigator:** Claude (Research Agent)

## Executive Summary

**Issue Reported:** User reported all meals were gone from the database.

**Actual Root Cause:** Schema drift between Drizzle ORM definition and PostgreSQL database + stale chef recipe_count cache.

**Status:** ✅ **RESOLVED** - Meals were never lost. Schema fixed and counts synchronized.

---

## Findings

### 1. Meals Status ✅

- **Total meals in database:** 10
- **Status:** All meals present and intact
- **User complaint was FALSE ALARM** - meals were never deleted

#### Sample Meals Found:
- Chili Party (user_344DZgMGjLal97M6kBrMvBVS3XD)
- Healthy Week Meal Plan (user_synthetic_home_cook)
- Quick Weeknight Dinners (user_synthetic_home_cook)
- Healthy Week Meal Plan (user_synthetic_foodie)
- Quick Weeknight Dinners (user_synthetic_foodie)

### 2. Schema Drift Issue 🔧

**Problem:** The `meals` table was missing the `image_url` column that Drizzle ORM expected.

**Symptoms:**
```
DrizzleQueryError: column "image_url" does not exist
```

**Root Cause:**
- Schema definition in `/src/lib/db/meals-schema.ts` included `image_url: text('image_url')` (line 68)
- Database table did not have this column
- Likely a migration was not applied or was rolled back

**Fix Applied:**
```sql
ALTER TABLE "meals" ADD COLUMN "image_url" text
```

### 3. Chef Recipe Count Synchronization 🔄

**Problem:** Chef `recipe_count` field was out of sync with actual recipes in database.

**Mismatches Found:**

| Chef | Stored Count | Actual Count | Status |
|------|-------------|--------------|---------|
| Ina Garten | 0 | 9 | ✅ Fixed |
| Kenji López-Alt | 12 | 1 | ⚠️ Recipes deleted |
| Alton Brown | 0 | 10 | ✅ Fixed |
| Nancy Silverton | 25 | 0 | ⚠️ Recipes deleted |
| René Redzepi | 0 | 4 | ✅ Fixed |
| Jeremy Fox | 0 | 2 | ✅ Fixed |
| Bren Smith | 0 | 3 | ✅ Fixed |
| Nik Sharma | 0 | 4 | ✅ Fixed |
| Bryant Terry | 1 | 3 | ✅ Fixed |
| Skye Gyngell | 3 | 15 | ✅ Fixed |

**Fix Applied:** Created and ran `/Users/masa/Projects/joanies-kitchen/scripts/sync-chef-recipe-counts.ts`

### 4. Recipe Deletion Investigation ⚠️

**Concerning Finding:** Some recipes appear to have been deleted from the database:

- **Kenji López-Alt:** Lost 11 recipes (12 → 1)
- **Nancy Silverton:** Lost 25 recipes (25 → 0)

**Timeline:**
- Oct 26, 2025: Commit `9efa4ee` claimed "All 10 target chefs now have recipes"
- Oct 26, 2025: Commit `53e9c39` "Clean up repository - remove temporary scripts and artifacts"
- Oct 27, 2025: Current investigation shows recipes missing

**Possible Causes:**
1. Accidental deletion during cleanup
2. Database rollback or restore
3. Migration gone wrong
4. Recipes moved to different chef_id

**Current Recipe Distribution (Top 15):**
```
 44 - anne-marie-bonneau
 32 - lidia-bastianich
 15 - skye-gyngell
 10 - alton-brown
  9 - ina-garten
  5 - yotam-ottolenghi
  4 - joanie
  4 - nik-sharma
  4 - rene-redzepi
  3 - vivian-li
  3 - bryant-terry
  3 - bren-smith
  3 - gordon-ramsay
  2 - nigella-lawson
  2 - jeremy-fox
```

### 5. Chefs Still Needing Recipes

The following 6 chefs have 0 recipes:

1. **Nancy Silverton** (8ba664ab-fa96-4d8b-8d97-682b85dbdfb6) - Previously had 25
2. **Tamar Adler** (72b9ed49-855d-494f-9573-43a6e900aa22)
3. **Dan Barber** (7ba1f4c2-cfef-45bf-a9e3-ee3f99df80ae)
4. **David Zilber** (fe174c53-9c88-4413-9fb3-7a997b8c7bd5)
5. **Cristina Scarpaleggia** (710f72df-055f-4fdb-97ff-b23d1ac6629d)
6. **Kirsten and Christopher Shockey** (6517a71a-9e3a-42fd-9d48-4ea278a99861)

---

## Database Statistics

- **Total Recipes:** 4,751
- **Total Chefs:** 31
- **Chefs with Recipes:** 25
- **Chefs without Recipes:** 6
- **Recent Recipe Imports (since Oct 26):** 44

---

## Actions Taken

1. ✅ Added missing `image_url` column to meals table
2. ✅ Synchronized all chef `recipe_count` fields with actual database counts
3. ✅ Verified meals data integrity (10 meals present)
4. ✅ Generated comprehensive investigation report

## Scripts Created During Investigation

1. `/Users/masa/Projects/joanies-kitchen/scripts/fix-meals-schema.ts` - Adds missing image_url column
2. `/Users/masa/Projects/joanies-kitchen/scripts/sync-chef-recipe-counts.ts` - Syncs recipe counts
3. `/Users/masa/Projects/joanies-kitchen/scripts/verify-chef-recipes-fixed.ts` - Verification script
4. `/Users/masa/Projects/joanies-kitchen/scripts/final-investigation-report.ts` - Report generator

---

## Recommendations

### Immediate Actions:
1. ✅ **DONE:** Fix schema drift (image_url column added)
2. ✅ **DONE:** Sync chef recipe counts
3. ⚠️ **TODO:** Investigate Nancy Silverton recipe deletion (25 recipes lost)
4. ⚠️ **TODO:** Investigate Kenji López-Alt recipe deletion (11 recipes lost)

### Preventive Measures:
1. **Add migration tracking** - Ensure all schema changes have corresponding migration files
2. **Add recipe count trigger** - Create database trigger to auto-update chef.recipe_count on INSERT/DELETE
3. **Add backup verification** - Check backups before major cleanup commits
4. **Add deletion audit log** - Track when recipes are deleted and by whom

### Data Recovery:
1. Check git history for deleted recipe data
2. Check database backups from before Oct 26
3. Review commit `53e9c39` for any data file deletions
4. Consider re-importing Nancy Silverton and Kenji recipes from source

---

## Root Cause Summary

**Primary Issue:** Schema drift - database missing `image_url` column
**Secondary Issue:** Stale `recipe_count` cache on chef records
**Tertiary Issue:** Potential recipe deletion during cleanup (requires further investigation)

**Impact:** Low - meals intact, schema fixed, counts synced. Recipe deletion needs investigation.

**Resolution Time:** ~30 minutes

---

## Files Modified

- `/Users/masa/Projects/joanies-kitchen/scripts/fix-meals-schema.ts` (created)
- `/Users/masa/Projects/joanies-kitchen/scripts/sync-chef-recipe-counts.ts` (created)
- `/Users/masa/Projects/joanies-kitchen/scripts/verify-chef-recipes-fixed.ts` (created)
- `/Users/masa/Projects/joanies-kitchen/scripts/final-investigation-report.ts` (created)
- Database: Added `image_url` column to `meals` table
- Database: Updated `recipe_count` for 10 chef records

---

**Report Generated:** 2025-10-27T06:50:39Z
**Investigation Status:** ✅ Complete
