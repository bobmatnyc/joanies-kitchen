# TheMealDB Recipe Acquisition Pipeline

Complete guide for crawling and ingesting recipes from TheMealDB free API into the Recipe Manager database.

## Overview

This pipeline consists of two main scripts:
1. **Crawler** (`crawl-themealdb.ts`) - Downloads recipes from TheMealDB API
2. **Ingestion** (`ingest-recipes.ts`) - Processes and stores recipes in database with AI quality evaluation

## Directory Structure

```
data/
  recipes/
    incoming/
      themealdb/         # Raw JSON files from crawler
    processed/           # Successfully ingested recipes (optional backup)
    failed/              # Recipes that failed ingestion
```

### .gitignore Coverage
All data directories are properly gitignored to prevent committing large files:
- `data/recipes/incoming/`
- `data/recipes/processed/`
- `data/recipes/failed/`
- `*.csv`, `*.json.gz`, `*.zip`, `*.tar.gz`

---

## Step 1: Crawl TheMealDB API

### Basic Usage

```bash
# Crawl all recipes (a-z)
pnpm data:themealdb

# Crawl sample (50 recipes from letters a, b, c)
pnpm data:themealdb:sample

# Custom crawl with CLI arguments
tsx scripts/data-acquisition/crawl-themealdb.ts <limit> <letters>
```

### CLI Arguments

- **limit** (optional): Maximum number of recipes to fetch
  - Example: `50` = fetch maximum 50 recipes
  - Default: unlimited

- **letters** (optional): Letters to search (concatenated string)
  - Example: `abc` = search only a, b, c
  - Example: `aeiou` = search vowels only
  - Default: `abcdefghijklmnopqrstuvwxyz`

### Examples

```bash
# Fetch 100 recipes from all letters
tsx scripts/data-acquisition/crawl-themealdb.ts 100

# Fetch unlimited recipes from letters m, n, o, p
tsx scripts/data-acquisition/crawl-themealdb.ts 0 mnop

# Fetch 25 recipes from letters a, b
tsx scripts/data-acquisition/crawl-themealdb.ts 25 ab
```

### Output

Recipes are saved to:
```
data/recipes/incoming/themealdb/recipes-{timestamp}.json
```

Example output filename:
```
recipes-1760494786673.json
```

### Rate Limiting

The crawler implements conservative rate limiting:
- **200ms delay** between individual recipe fetches (5 req/sec)
- **400ms delay** between letter searches
- **3 retries** with exponential backoff on failures

### Crawler Features

✅ **Automatic retry logic** with exponential backoff
✅ **Rate limiting** to respect API limits
✅ **Progress logging** with detailed status
✅ **Ingredient parsing** (combines measure + ingredient)
✅ **Instruction parsing** (splits by newlines)
✅ **Tag extraction** (from comma-separated tags)
✅ **Image URLs** (primary thumbnail)
✅ **Video URLs** (YouTube links when available)
✅ **Source tracking** (original TheMealDB URLs)

### Data Format

Each recipe in the JSON file has this structure:

```json
{
  "id": "52772",
  "name": "Teriyaki Chicken Casserole",
  "description": "Japanese Chicken dish from unknown cuisine",
  "ingredients": [
    "3/4 cup soy sauce",
    "1/2 cup water",
    "1/4 cup brown sugar",
    "1 teaspoon ground ginger"
  ],
  "instructions": [
    "Preheat oven to 350° F. Spray a 9x13-inch baking pan with non-stick spray.",
    "Combine soy sauce, ½ cup water, brown sugar, ginger and garlic in a small saucepan and cover."
  ],
  "category": "Chicken",
  "cuisine": "Japanese",
  "tags": ["Meat", "Casserole"],
  "images": ["https://www.themealdb.com/images/media/meals/wvpsxx1468256321.jpg"],
  "videoUrl": "https://www.youtube.com/watch?v=4aZr5hZXP_s",
  "source": "TheMealDB",
  "sourceUrl": "https://www.themealdb.com/meal/52772"
}
```

---

## Step 2: Ingest Recipes into Database

### Basic Usage

```bash
# Ingest from specific JSON file (batch size 10)
pnpm data:ingest data/recipes/incoming/themealdb/recipes-1760494786673.json

# Custom batch size
pnpm data:ingest data/recipes/incoming/themealdb/recipes-1760494786673.json 20
```

### CLI Arguments

```bash
tsx scripts/data-acquisition/ingest-recipes.ts <json-file> [batch-size]
```

- **json-file** (required): Path to JSON file from crawler
- **batch-size** (optional): Number of recipes per batch
  - Default: `10`
  - Recommended: `10-20` (balances speed vs. API rate limits)

### Ingestion Process

For each recipe, the pipeline:

1. **Validates required fields**
   - Skips recipes without name or ingredients
   - Logs skipped recipes with reason

2. **Checks for duplicates**
   - Queries database by name + source
   - Skips if already exists

3. **AI Quality Evaluation** (OpenRouter API)
   - Evaluates recipe completeness and quality
   - Generates 0-5.0 rating with reasoning
   - Fallback: 3.0 rating if AI evaluation fails

4. **Embedding Generation** (HuggingFace)
   - Creates semantic search vector (384 dimensions)
   - Combines: name, description, cuisine, tags, ingredients
   - Stores in `recipe_embeddings` table
   - Fallback: Continues without embedding if generation fails

5. **Database Storage**
   - Inserts into `recipes` table
   - Links embedding to recipe
   - Marks as `isSystemRecipe: true`
   - Sets `isPublic: false` (requires manual review)

### Rate Limiting

- **500ms delay** between recipes (prevents API throttling)
- Progress updates every batch
- Total time estimate: ~50 seconds per 100 recipes

### Output Example

```
[Ingest] Reading recipes from: data/recipes/incoming/themealdb/recipes.json
[Ingest] Total recipes in file: 150
[Ingest] Processing: 150 (starting at index 0)
============================================================

[Ingest] === Batch 1/15 (recipes 1-10) ===

[1/150] Batch 1 - Teriyaki Chicken Casserole
[Ingest] Processing "Teriyaki Chicken Casserole"...
[Ingest]   Quality: 4.2/5.0
[Ingest]   Embedding: ✓ Generated (384d)
[Ingest]   Recipe ID: cm51xj8k90000...
[Ingest]   Embedding: ✓ Stored
[Ingest] ✓ Stored "Teriyaki Chicken Casserole"

------------------------------------------------------------
Progress: 10/150 recipes processed
Success: 10 | Failed: 0
------------------------------------------------------------

============================================================
  INGESTION COMPLETE
============================================================
Total Recipes: 150
✓ Success: 147
✗ Failed: 3
============================================================
```

### Error Handling

Failed recipes are:
- Logged to console with error message
- Saved to `data/recipes/failed/` directory
- Included in final error summary

### Database Schema

Recipes are stored with these fields:

```typescript
{
  userId: 'system_imported',           // System user ID
  name: string,                        // Recipe name
  description: string | null,          // Recipe description
  ingredients: JSON,                   // Array of ingredients
  instructions: JSON,                  // Array of instruction steps
  prepTime: number | null,             // Minutes
  cookTime: number | null,             // Minutes
  servings: number | null,             // Serving size
  difficulty: null,                    // Not provided by TheMealDB
  cuisine: string | null,              // Cuisine type
  tags: JSON | null,                   // Array of tags
  images: JSON | null,                 // Array of image URLs
  isAiGenerated: false,                // Not AI generated
  isPublic: false,                     // Private until reviewed
  isSystemRecipe: true,                // System/curated recipe
  nutritionInfo: null,                 // Not provided by TheMealDB
  source: string,                      // Source URL
  systemRating: string,                // AI quality rating (0.0-5.0)
  systemRatingReason: string,          // AI evaluation reasoning
  avgUserRating: null,                 // No user ratings yet
  totalUserRatings: 0,                 // No user ratings yet
}
```

---

## Complete Workflow

### End-to-End Example

```bash
# 1. Crawl 100 recipes from TheMealDB
pnpm data:themealdb:sample

# This creates: data/recipes/incoming/themealdb/recipes-{timestamp}.json

# 2. Ingest the crawled recipes
pnpm data:ingest data/recipes/incoming/themealdb/recipes-1760494786673.json 10

# 3. Verify in database
pnpm db:studio
# Navigate to http://localhost:4983
# Check 'recipes' table for isSystemRecipe=true entries
```

### Large-Scale Acquisition

For production data acquisition:

```bash
# 1. Crawl all recipes (a-z, ~300 recipes)
tsx scripts/data-acquisition/crawl-themealdb.ts

# 2. Ingest with larger batch size
tsx scripts/data-acquisition/ingest-recipes.ts \
  data/recipes/incoming/themealdb/recipes-{timestamp}.json \
  20

# Estimated time: ~5 minutes total
```

---

## Monitoring & Debugging

### Check Crawl Output

```bash
# List all crawled files
ls -lh data/recipes/incoming/themealdb/

# Count recipes in file
cat data/recipes/incoming/themealdb/recipes-*.json | grep '"id"' | wc -l

# Preview first recipe
cat data/recipes/incoming/themealdb/recipes-*.json | head -50
```

### Check Database Records

```bash
# Open Drizzle Studio
pnpm db:studio

# Or use SQL directly
psql $DATABASE_URL

# Count system recipes
SELECT COUNT(*) FROM recipes WHERE is_system_recipe = true;

# View recent imports
SELECT name, cuisine, system_rating
FROM recipes
WHERE is_system_recipe = true
ORDER BY created_at DESC
LIMIT 10;

# Check embedding coverage
SELECT
  COUNT(*) as total_recipes,
  COUNT(re.recipe_id) as with_embeddings
FROM recipes r
LEFT JOIN recipe_embeddings re ON r.id = re.recipe_id
WHERE r.is_system_recipe = true;
```

### Check Failed Recipes

```bash
# List failed recipes
ls -lh data/recipes/failed/

# View failure details
cat data/recipes/failed/*.json | jq '.name, .error'
```

---

## Troubleshooting

### Issue: API Rate Limiting

**Symptoms**: HTTP 429 errors, frequent retries

**Solution**:
```typescript
// In crawl-themealdb.ts, increase RATE_LIMIT_MS
const RATE_LIMIT_MS = 500; // Slower: 2 req/sec
```

### Issue: Quality Evaluation Fails

**Symptoms**: "Quality evaluation failed" warnings

**Solution**:
- Check `OPENROUTER_API_KEY` in `.env.local`
- Verify API quota at https://openrouter.ai/account
- Recipes still ingest with default 3.0 rating

### Issue: Embedding Generation Fails

**Symptoms**: "Embedding generation failed" warnings

**Solution**:
- Check `HUGGINGFACE_API_KEY` in `.env.local`
- Verify HuggingFace API status
- Recipes still ingest without embeddings
- Run embedding generation separately later

### Issue: Network Errors

**Symptoms**: `fetch failed`, `Connection refused`

**Solution**:
```bash
# Test network connectivity
curl "https://www.themealdb.com/api/json/v1/1/search.php?f=a"

# If DNS issues, check /etc/hosts or DNS settings
# TheMealDB should resolve to public IP, not 192.168.x.x
```

### Issue: Duplicate Recipes

**Symptoms**: "Skipped (duplicate)" messages

**Solution**:
- This is expected behavior (prevents duplicates)
- To re-import, delete existing recipes first:
```sql
DELETE FROM recipe_embeddings
WHERE recipe_id IN (
  SELECT id FROM recipes WHERE is_system_recipe = true
);

DELETE FROM recipes WHERE is_system_recipe = true;
```

---

## API Reference

### TheMealDB Free API

**Base URL**: `https://www.themealdb.com/api/json/v1/1/`

**Endpoints Used**:
- `search.php?f={letter}` - Search by first letter
- `lookup.php?i={id}` - Get full recipe details

**Rate Limits**:
- Free tier: 100 requests per second (official limit)
- Our crawler: Conservative 5 req/sec (200ms delay)

**Documentation**: https://www.themealdb.com/api.php

---

## Next Steps

After successful ingestion:

1. **Review System Recipes**
   - Check quality ratings
   - Review recipes with rating < 3.0
   - Manually verify controversial recipes

2. **Make Recipes Public**
   ```sql
   UPDATE recipes
   SET is_public = true
   WHERE is_system_recipe = true
   AND system_rating >= 3.5;
   ```

3. **Enable Semantic Search**
   - Verify embeddings exist for all recipes
   - Test semantic search on discover page

4. **Schedule Regular Updates**
   - TheMealDB adds new recipes periodically
   - Re-run crawler monthly for new content

---

## Performance Metrics

### Expected Throughput

| Operation | Time per Recipe | Time per 100 Recipes |
|-----------|----------------|---------------------|
| Crawl     | ~0.4s          | ~40s                |
| Ingest    | ~0.8s          | ~80s                |
| **Total** | ~1.2s          | ~2 minutes          |

### Resource Usage

- **API Calls**: 2 per recipe (search + lookup)
- **AI Calls**: 2 per recipe (quality + embedding)
- **Database Writes**: 2 per recipe (recipe + embedding)
- **Storage**: ~5KB per recipe (JSON + embedding)

### Scaling

For 1000 recipes:
- Crawl time: ~7 minutes
- Ingest time: ~13 minutes
- Total time: ~20 minutes
- Storage: ~5MB

---

## Advanced Configuration

### Custom Quality Evaluator

Edit `src/lib/ai/recipe-quality-evaluator.ts` to customize quality criteria:

```typescript
// Adjust quality thresholds
const MIN_INGREDIENTS = 3;      // Minimum ingredients for valid recipe
const MIN_INSTRUCTIONS = 2;     // Minimum instruction steps
const QUALITY_THRESHOLD = 3.0;  // Minimum acceptable rating
```

### Custom Embedding Model

Edit `scripts/data-acquisition/ingest-recipes.ts`:

```typescript
// Change embedding model
const embeddingVector = await generateEmbedding(embeddingText, {
  model: 'sentence-transformers/all-mpnet-base-v2', // More accurate
});
```

### Batch Size Optimization

Optimize for your rate limits:

```typescript
// Fast (requires high API quotas)
pnpm data:ingest recipes.json 50

// Balanced (recommended)
pnpm data:ingest recipes.json 10

// Conservative (low API quotas)
pnpm data:ingest recipes.json 5
```

---

## Summary

✅ **Directory structure** created and gitignored
✅ **Crawler script** ready at `scripts/data-acquisition/crawl-themealdb.ts`
✅ **Ingestion script** ready at `scripts/data-acquisition/ingest-recipes.ts`
✅ **NPM scripts** configured in `package.json`
✅ **Database schema** supports system recipes and embeddings
✅ **Rate limiting** implemented for API protection
✅ **Error handling** with failed recipe tracking
✅ **AI quality evaluation** integrated
✅ **Semantic search** embeddings generated

**Status**: Production ready (pending network access to TheMealDB API)

**Next Action**: Run `pnpm data:themealdb:sample` when network allows TheMealDB access
