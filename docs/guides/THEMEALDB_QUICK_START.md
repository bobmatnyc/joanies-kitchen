# TheMealDB Import - Quick Start Guide

## TL;DR

```bash
# 1. Test with 10 recipes
pnpm import:themealdb:pilot

# 2. View in browser
pnpm dev
# Visit: http://localhost:3002/discover

# 3. Import all ~280 recipes
pnpm import:themealdb
```

## Prerequisites

- ✅ Database configured (`DATABASE_URL` in `.env.local`)
- ✅ Project dependencies installed (`pnpm install`)
- ⚠️ Internet connection required (API access)

## Step-by-Step

### 1. Environment Setup (30 seconds)

Add to `.env.local` (or use default):

```env
THEMEALDB_API_KEY=1
```

> **Note:** Key "1" is the free test key. Works for development!

### 2. Run Pilot Import (1 minute)

```bash
pnpm import:themealdb:pilot
```

**Expected Output:**
```
🍽️  TheMealDB Recipe Import Script
Mode: PILOT (10 recipes)
...
✅ Import complete!
📊 Progress: 100% (10 imported, 0 failed, 0 skipped / 10 total)
```

### 3. Verify Import (30 seconds)

Check in database:

```bash
pnpm db:studio
```

Or in UI:

```bash
pnpm dev
# Visit: http://localhost:3002/discover
# Filter by: System Recipes
```

### 4. Full Import (5-6 minutes)

```bash
pnpm import:themealdb
```

**Expected:**
- ~280 recipes imported
- ~5-6 minutes total time
- Progress displayed in real-time

## Common Commands

### Import Specific Category

```bash
tsx scripts/import-themealdb.ts --category=Chicken
tsx scripts/import-themealdb.ts --category=Dessert
```

### Limit Number of Recipes

```bash
tsx scripts/import-themealdb.ts --max=50
```

### Test API Client

```bash
tsx scripts/test-themealdb-client.ts
```

### Resume Interrupted Import

Just re-run the same command. Progress is automatically saved:

```bash
pnpm import:themealdb
# Resumes from where it left off
```

## Troubleshooting

### Import Fails Immediately

**Check database connection:**
```bash
echo $DATABASE_URL
pnpm db:studio
```

### API Connection Errors

**Test API directly:**
```bash
curl "https://www.themealdb.com/api/json/v1/1/categories.php"
```

**If API is down:**
- Wait 5-10 minutes
- Try again later
- Check https://www.themealdb.com status

### Duplicate Recipes

**Reset and start fresh:**
```bash
# Delete progress file
rm tmp/import-progress-themealdb.json

# Delete imported recipes (optional)
# Use db:studio to manually delete, or:
pnpm db:studio
# Filter: source_id = themealdb
# Delete all
```

### Progress File Corrupted

```bash
rm tmp/import-progress-themealdb.json
pnpm import:themealdb:pilot
```

## What Gets Imported?

Each recipe includes:

- ✅ Name and image
- ✅ Ingredients with measurements (up to 20)
- ✅ Step-by-step instructions
- ✅ Category (Beef, Chicken, Dessert, etc.)
- ✅ Cuisine (Italian, Chinese, Mexican, etc.)
- ✅ Tags (vegan, vegetarian, pasta, etc.)
- ✅ Optional YouTube link
- ❌ Prep/cook times (not in API)
- ❌ Nutrition info (not in API)

## Categories Available

14 categories total:

- Beef, Chicken, Dessert, Lamb
- Miscellaneous, Pasta, Pork, Seafood
- Side, Starter, Vegan, Vegetarian
- Breakfast, Goat

## Next Steps After Import

### 1. Generate Embeddings (for search)

```bash
pnpm embeddings:generate
```

### 2. Check for Duplicates

```bash
pnpm db:check-duplicates
```

### 3. Review in UI

```bash
pnpm dev
# Browse recipes at /discover
```

## Success Metrics

After import completion:

- ✅ ~280 recipes in database
- ✅ All linked to TheMealDB source
- ✅ Proper categorization and tags
- ✅ No duplicate slugs
- ✅ Progress file shows 100% completion

## Getting Help

**Documentation:**
- Full guide: `scripts/README-THEMEALDB.md`
- Implementation: `THEMEALDB_IMPLEMENTATION_SUMMARY.md`

**Test Scripts:**
- API client: `scripts/test-themealdb-client.ts`
- Import script: `scripts/import-themealdb.ts`

**Database:**
- View recipes: `pnpm db:studio`
- Check sources: `recipe_sources` table
- Check progress: `tmp/import-progress-themealdb.json`

---

**Ready to start?** Run `pnpm import:themealdb:pilot` now!
