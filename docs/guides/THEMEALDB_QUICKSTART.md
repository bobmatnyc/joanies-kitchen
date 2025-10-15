# TheMealDB Quick Start Guide

**5-minute guide to crawling and ingesting recipes from TheMealDB**

---

## Prerequisites

✅ Network access to TheMealDB API
✅ Environment variables configured:
- `DATABASE_URL` - PostgreSQL connection
- `OPENROUTER_API_KEY` - AI quality evaluation
- `HUGGINGFACE_API_KEY` - Embedding generation

---

## Quick Commands

### 1. Test API Access

```bash
curl "https://www.themealdb.com/api/json/v1/1/search.php?f=a"
# Should return JSON with meals
```

### 2. Crawl Sample Recipes (50 from a, b, c)

```bash
pnpm data:themealdb:sample
```

**Output**: `data/recipes/incoming/themealdb/recipes-{timestamp}.json`

### 3. Ingest into Database

```bash
# Replace {timestamp} with actual timestamp from step 2
pnpm data:ingest data/recipes/incoming/themealdb/recipes-{timestamp}.json
```

### 4. Verify in Database

```bash
pnpm db:studio
# Open http://localhost:4983
# Navigate to 'recipes' table
# Filter: is_system_recipe = true
```

---

## Full Crawl (All Recipes)

### Crawl ~300 recipes from TheMealDB

```bash
pnpm data:themealdb
```

**Time**: ~5 minutes
**Output**: `data/recipes/incoming/themealdb/recipes-{timestamp}.json`

### Ingest All Recipes

```bash
pnpm data:ingest data/recipes/incoming/themealdb/recipes-{timestamp}.json 20
```

**Time**: ~15 minutes for 300 recipes
**Batch size**: 20 recipes per batch

---

## Check Results

### Count System Recipes

```bash
pnpm db:studio
```

```sql
SELECT COUNT(*) FROM recipes WHERE is_system_recipe = true;
```

### View Top Rated Recipes

```sql
SELECT name, cuisine, system_rating
FROM recipes
WHERE is_system_recipe = true
ORDER BY CAST(system_rating AS FLOAT) DESC
LIMIT 10;
```

### Make Quality Recipes Public

```sql
UPDATE recipes
SET is_public = true
WHERE is_system_recipe = true
AND CAST(system_rating AS FLOAT) >= 3.5;
```

---

## Troubleshooting

### Network Error

```bash
# Test connectivity
curl "https://www.themealdb.com/api/json/v1/1/search.php?f=a"

# If fails, check DNS
nslookup www.themealdb.com
```

### No Recipes Crawled

Check output JSON file:
```bash
cat data/recipes/incoming/themealdb/recipes-*.json | jq 'length'
# Should show number > 0
```

### Ingestion Fails

Check environment variables:
```bash
echo $DATABASE_URL
echo $OPENROUTER_API_KEY
echo $HUGGINGFACE_API_KEY
```

---

## Advanced Usage

### Custom Letter Range

```bash
# Only letters m, n, o, p
tsx scripts/data-acquisition/crawl-themealdb.ts 0 mnop
```

### Limited Recipe Count

```bash
# Maximum 100 recipes
tsx scripts/data-acquisition/crawl-themealdb.ts 100
```

### Smaller Batch Size (Lower API Quotas)

```bash
# 5 recipes per batch (slower but safer)
tsx scripts/data-acquisition/ingest-recipes.ts <json-file> 5
```

---

## File Locations

| Item | Location |
|------|----------|
| Crawler Script | `scripts/data-acquisition/crawl-themealdb.ts` |
| Ingestion Script | `scripts/data-acquisition/ingest-recipes.ts` |
| Crawled JSON | `data/recipes/incoming/themealdb/` |
| Failed Recipes | `data/recipes/failed/` |
| Full Documentation | `docs/guides/THEMEALDB_PIPELINE.md` |

---

## Next Steps

1. **Review Quality Ratings**
   - Check recipes with rating < 3.0
   - Manually verify controversial recipes

2. **Make Recipes Public**
   - Update `is_public = true` for quality recipes
   - Add to discover page

3. **Test Semantic Search**
   - Verify embeddings exist
   - Test search functionality

4. **Schedule Regular Updates**
   - Re-run monthly for new TheMealDB recipes

---

For detailed documentation, see: `docs/guides/THEMEALDB_PIPELINE.md`
