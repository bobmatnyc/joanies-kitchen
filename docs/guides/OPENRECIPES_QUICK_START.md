# OpenRecipes Quick Start Guide

**Get OpenRecipes data into Joanie's Kitchen in 5 minutes**

## Prerequisites

✅ Node.js 18+ installed
✅ PostgreSQL database with pgvector extension
✅ Environment variables configured in `.env.local`

Required environment variables:
```env
DATABASE_URL=postgresql://...
HUGGINGFACE_API_KEY=hf_...
OPENROUTER_API_KEY=sk-or-...
```

---

## Quick Setup (5 Minutes)

### Step 1: Install Dependencies

```bash
pnpm install
```

### Step 2: Download Sample Data

```bash
pnpm data:openrecipes:sample
```

This will:
- Download sample OpenRecipes data
- Ingest first 1000 recipes
- Generate AI quality ratings
- Create semantic search embeddings

**Expected Time**: 3-5 minutes

### Step 3: Verify Ingestion

```bash
pnpm db:studio
```

Open Drizzle Studio and check:
- `recipes` table: Should have ~800-900 recipes (some skipped due to quality)
- `recipeEmbeddings` table: Should have matching embeddings
- Look for `source` values like: `allrecipes.com`, `foodnetwork.com`, etc.

---

## Full Dataset Ingestion

### One-Command Full Pipeline

```bash
pnpm data:openrecipes:full
```

This runs:
1. **Download**: All OpenRecipes JSON dumps (~300 MB)
2. **Ingest**: All recipes with AI evaluation and embeddings

**Expected Time**: 30-50 hours for 200K recipes

**Alternative**: Run in background
```bash
nohup pnpm data:openrecipes:full > openrecipes.log 2>&1 &
```

### Step-by-Step Full Pipeline

If you prefer more control:

#### 1. Download All Sources

```bash
pnpm data:openrecipes:download
```

**What it does**:
- Downloads: `allrecipes.json`, `foodnetwork.json`, `epicurious.json`, `bbcgoodfood.json`
- Saves to: `data/recipes/incoming/openrecipes/`
- Creates: `metadata.json` with file info

**Expected Output**:
```
================================================================================
  OPENRECIPES DATASET DOWNLOADER
================================================================================
[Download] Files to download: 4
[Download] Processing: allrecipes (allrecipes.json)
[Download] Progress: 100.0% (150.23 MB / 150.23 MB)
[Validation] ✓ Found 80,234 recipes
✓ Completed: allrecipes
...
================================================================================
  DOWNLOAD COMPLETE
================================================================================
Status: COMPLETE
Files Downloaded: 4
Total Recipes: 195,482
```

#### 2. Ingest All Recipes

```bash
pnpm data:openrecipes:ingest
```

**What it does**:
- Processes all JSON files in `data/recipes/incoming/openrecipes/`
- Validates recipe data
- Evaluates quality with AI
- Generates embeddings
- Stores in database

**Expected Output**:
```
================================================================================
  OPENRECIPES RECIPE INGESTION PIPELINE
================================================================================
[OpenRecipes] Files to process: 4
  - allrecipes.json
  - foodnetwork.json
  - epicurious.json
  - bbcgoodfood.json
================================================================================
[OpenRecipes] Processing file: allrecipes.json
[OpenRecipes] Found 80234 recipes in JSON
[OpenRecipes] Filtered 12445 invalid recipes
[OpenRecipes] Valid recipes: 67789
[OpenRecipes] Ingesting 67789 recipes from allrecipes.json...
[1/67789] Processing "Classic Spaghetti Carbonara"...
  Quality: 4.5/5.0 - Clear instructions, well-structured ingredients
  Embedding: ✓ Generated (384d)
  Recipe ID: abc123...
  Embedding: ✓ Stored
✓ Stored "Classic Spaghetti Carbonara"
...
```

---

## Advanced Usage

### Download Specific Sources Only

```bash
tsx scripts/data-acquisition/download-openrecipes.ts --sources=allrecipes,foodnetwork
```

### Ingest Specific File Only

```bash
tsx scripts/data-acquisition/ingest-openrecipes.ts --file allrecipes.json
```

### Custom Batch Size

Process 250 recipes at a time (default is 500):

```bash
tsx scripts/data-acquisition/ingest-openrecipes.ts 250
```

### Limit Total Recipes

Ingest only first 5000 recipes:

```bash
tsx scripts/data-acquisition/ingest-openrecipes.ts --limit 5000
```

---

## Verification Steps

### 1. Check Database

```bash
pnpm db:studio
```

Navigate to:
- **recipes** table → Filter by `isSystemRecipe = true`
- **recipeEmbeddings** table → Should have matching `recipeId`

### 2. Run Semantic Search Test

```bash
pnpm test:semantic-search
```

Should find recipes based on semantic similarity.

### 3. Check Ingestion Logs

```bash
cat data/recipes/incoming/openrecipes/logs/ingestion-*.json
```

Look for:
- `success`: Number of recipes successfully ingested
- `skipped`: Duplicates or invalid recipes
- `failed`: Errors (should be low)

### 4. Query Sample Recipes

Open `pnpm db:studio` and run:

```sql
SELECT name, source, systemRating, cuisine
FROM recipes
WHERE isSystemRecipe = true
  AND source LIKE '%allrecipes%'
LIMIT 10;
```

---

## Common Issues & Quick Fixes

### Issue: "HUGGINGFACE_API_KEY not configured"

**Fix**: Add to `.env.local`:
```env
HUGGINGFACE_API_KEY=hf_...
```

Get key from: https://huggingface.co/settings/tokens

---

### Issue: "File not found" during download

**Fix**: Repository structure may have changed. Manual download:

```bash
git clone https://github.com/openrecipes/openrecipes
cp openrecipes/*.json data/recipes/incoming/openrecipes/
```

---

### Issue: High skip rate (50%+ skipped)

**Normal**: OpenRecipes has variable quality. Typical skip rate: 20-30%

Recipes skipped for:
- Missing required fields
- Invalid JSON structure
- Duplicate detection

---

### Issue: Slow ingestion (< 0.5 recipes/sec)

**Causes**:
- Cold start for embedding model (first few requests slow)
- Network latency to Neon PostgreSQL
- AI evaluation rate limits

**Fix**: Be patient. Speed improves after first 100 recipes.

---

### Issue: Out of memory

**Fix**: Process one file at a time:

```bash
tsx scripts/data-acquisition/ingest-openrecipes.ts --file allrecipes.json
```

---

## Performance Expectations

### Sample Ingestion (1000 recipes)

- **Time**: 10-20 minutes
- **Success Rate**: 70-80%
- **Storage**: ~5 MB database

### Full Ingestion (200K recipes)

- **Download**: 5-10 minutes (300 MB)
- **Ingestion**: 30-50 hours
- **Success Rate**: 70-80% (140-160K recipes)
- **Storage**: ~1.1 GB total

**Processing Rate**:
- Initial: 0.5-1 recipes/sec (cold start)
- Steady: 1-2 recipes/sec
- Peak: 2-3 recipes/sec

---

## Next Steps

### After Sample Ingestion

1. **Test the UI**: Open http://localhost:3001 and browse recipes
2. **Try Search**: Use semantic search to find recipes
3. **Check Quality**: View `systemRating` to see AI quality scores

### After Full Ingestion

1. **Combine Sources**: Run all data sources
   ```bash
   pnpm data:all
   ```

2. **Analyze Quality**: Query database for quality distribution
   ```sql
   SELECT systemRating, COUNT(*)
   FROM recipes
   WHERE isSystemRecipe = true
   GROUP BY systemRating
   ORDER BY systemRating DESC;
   ```

3. **Export Recipes**: Use recipe export features in the UI

---

## All Data Sources Pipeline

To ingest ALL recipe sources (TheMealDB, Food.com, Epicurious, OpenRecipes):

```bash
pnpm data:all
```

This runs sequentially:
1. TheMealDB crawl (~600 recipes)
2. Food.com download + ingest (~180K recipes)
3. Epicurious download + ingest (~20K recipes)
4. OpenRecipes download + ingest (~200K recipes)

**Total Time**: 60-80 hours
**Total Recipes**: ~400K recipes

---

## Troubleshooting Resources

- **Full Guide**: [docs/guides/data-acquisition-openrecipes.md](./data-acquisition-openrecipes.md)
- **OpenRecipes Repo**: https://github.com/openrecipes/openrecipes
- **schema.org/Recipe**: https://schema.org/Recipe

---

## Quick Reference

### Commands

```bash
# Sample (1000 recipes)
pnpm data:openrecipes:sample

# Full pipeline
pnpm data:openrecipes:full

# Download only
pnpm data:openrecipes:download

# Ingest only
pnpm data:openrecipes:ingest

# All sources
pnpm data:all
```

### File Locations

- **JSON dumps**: `data/recipes/incoming/openrecipes/*.json`
- **Logs**: `data/recipes/incoming/openrecipes/logs/`
- **Metadata**: `data/recipes/incoming/openrecipes/metadata.json`
- **Scripts**: `scripts/data-acquisition/`

### Database Tables

- **recipes**: Main recipe data
- **recipeEmbeddings**: Semantic search embeddings

### Key Columns

- `isSystemRecipe`: `true` for OpenRecipes data
- `source`: Recipe source URL or domain
- `systemRating`: AI quality score (0-5)
- `systemRatingReason`: AI quality explanation

---

**Last Updated**: 2025-10-14
**Estimated Setup Time**: 5 minutes (sample) | 30-50 hours (full)
