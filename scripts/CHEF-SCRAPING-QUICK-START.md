# Chef Recipe Scraping - Quick Start Guide

## 🚀 One-Line Start

```bash
# Test (no changes)
pnpm chef:scrape:recipes

# Live (insert to DB)
pnpm chef:scrape:recipes:apply

# Resume
pnpm chef:scrape:recipes:resume
```

## ✅ Prerequisites Checklist

- [ ] API keys in `.env.local`
  ```bash
  SERPAPI_API_KEY=your_key
  FIRECRAWL_API_KEY=your_key
  ```
- [ ] Active chefs in database
- [ ] Database connection working

## 📊 What It Does

1. Queries active chefs from database
2. Searches Google for recipe URLs (SerpAPI)
3. Scrapes recipe content (Firecrawl)
4. Validates quality (min 3 ingredients OR 2 instructions)
5. Checks for duplicates (URL + title similarity)
6. Inserts into `recipes` + `chef_recipes` tables
7. Updates chef `recipe_count`
8. Saves progress to `tmp/` for resume

## ⚙️ Configuration

Default limits (edit script to change):
- **5 recipes per chef**
- **1s delay** between SerpAPI calls
- **2s delay** between Firecrawl scrapes
- **30s timeout** per request

## 🎯 Usage Patterns

### Test One Chef
```bash
pnpm tsx scripts/scrape-chef-recipes.ts --chef=kenji-lopez-alt
```

### Dry Run All Chefs
```bash
pnpm chef:scrape:recipes
```

### Live Run All Chefs
```bash
pnpm chef:scrape:recipes:apply
```

### Resume After Stop
```bash
pnpm chef:scrape:recipes:resume
```

## 📈 Expected Output

```
======================================================================
CHEF RECIPE SCRAPING SCRIPT
======================================================================
Mode: ⊛ DRY RUN
Max recipes per chef: 5
======================================================================

Found 31 chef(s) to process

======================================================================
📚 SCRAPING RECIPES FOR: Kenji López-Alt
======================================================================
   Current Recipe Count: 0

🔍 Searching for recipes...
   ✓ Found: Recipe Title 1
   ✓ Found: Recipe Title 2
   📊 Found 5 unique recipe URLs

📄 Scraping recipe: https://...
   ✓ Successfully scraped
   ✓ Inserted recipe: uuid

📊 CHEF SUMMARY:
   ✓ Success: 4
   ⊘ Skipped (duplicates): 1
   ✗ Failed: 0

======================================================================
FINAL SUMMARY
======================================================================
✓ Successfully scraped: 142
⊘ Skipped (duplicates): 5
✗ Failed: 8
```

## 🔍 Check Progress

```bash
cat tmp/chef-recipe-scraping-progress.json
```

## 🗃️ Database Verification

```sql
-- Check chef recipe counts
SELECT name, recipe_count FROM chefs ORDER BY recipe_count DESC;

-- Check scraped recipes
SELECT c.name, r.name as recipe
FROM chef_recipes cr
JOIN chefs c ON cr.chef_id = c.id
JOIN recipes r ON cr.recipe_id = r.id
WHERE cr.scraped_at IS NOT NULL;
```

## ⚠️ Troubleshooting

### "No recipe URLs found"
- Check chef has website in database
- Try with different chef

### "API key not found"
- Check `.env.local` has keys
- Restart terminal/IDE

### "Scraping failed"
- Check Firecrawl quota
- Try different URL manually

### "Duplicate detected"
- Expected behavior
- Prevents duplicate content

## 📚 Full Documentation

- **Detailed Guide**: `scripts/README-CHEF-RECIPE-SCRAPING.md`
- **Implementation**: `scripts/SCRAPE-CHEF-RECIPES-SUMMARY.md`
- **Script**: `scripts/scrape-chef-recipes.ts`

## 🎯 Common Workflows

### First Time Setup
```bash
# 1. Test with one chef
pnpm tsx scripts/scrape-chef-recipes.ts --chef=kenji-lopez-alt

# 2. Review output
cat tmp/chef-recipe-scraping-progress.json

# 3. Live run single chef
APPLY_CHANGES=true pnpm tsx scripts/scrape-chef-recipes.ts --chef=kenji-lopez-alt

# 4. Verify in database
# (Run SQL query above)

# 5. Run all chefs
pnpm chef:scrape:recipes:apply
```

### Production Run
```bash
# 1. Dry run to estimate
pnpm chef:scrape:recipes

# 2. Check API quotas
# - SerpAPI: https://serpapi.com/dashboard
# - Firecrawl: https://firecrawl.dev/dashboard

# 3. Live run with monitoring
pnpm chef:scrape:recipes:apply | tee logs/chef-scraping-$(date +%Y%m%d).log

# 4. If interrupted, resume
pnpm chef:scrape:recipes:resume
```

### Cleanup/Restart
```bash
# Remove progress to start fresh
rm tmp/chef-recipe-scraping-progress.json

# Start new run
pnpm chef:scrape:recipes:apply
```

## 💡 Pro Tips

1. **Start with dry run** - always test first
2. **Monitor API quotas** - check dashboards
3. **Use resume** - don't restart from scratch
4. **Single chef test** - debug individual chefs
5. **Check progress file** - review between runs
6. **Backup database** - before large runs

## 🚨 Safety Features

✅ **Dry-run default** - must opt-in to changes
✅ **Duplicate detection** - prevents double-insertion
✅ **Quality validation** - filters bad recipes
✅ **Progress tracking** - resume from any point
✅ **Error recovery** - continues on failures

## 📝 API Quotas

### Free Tiers
- **SerpAPI**: 100 searches/month
- **Firecrawl**: 500 pages/month

### Estimates
- **5 recipes/chef** = 8 searches + 5 scrapes per chef
- **Free quotas** = ~10-20 chefs max per month
- **Paid plans** - consider for >20 chefs

## ✨ Next Steps

1. Run dry-run test
2. Review progress file
3. Test single chef live
4. Run full batch
5. Monitor database
6. Adjust config as needed

---

**Ready to start?** → `pnpm chef:scrape:recipes`
