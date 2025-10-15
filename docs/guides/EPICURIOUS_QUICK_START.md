# Epicurious Dataset - Quick Start Guide

Get 20,000+ high-quality recipes from Epicurious into your database in under 10 minutes (sample) or 3 hours (full dataset).

---

## Prerequisites (5 Minutes)

### 1. Install Kaggle CLI

```bash
pip install kaggle
```

### 2. Configure Kaggle API

1. Go to: https://www.kaggle.com/settings/account
2. Click "Create New Token"
3. Download `kaggle.json`
4. Place it here:
   - **Mac/Linux**: `~/.kaggle/kaggle.json`
   - **Windows**: `%USERPROFILE%\.kaggle\kaggle.json`

```bash
# Set permissions (Mac/Linux)
chmod 600 ~/.kaggle/kaggle.json
```

### 3. Verify Setup

```bash
kaggle --version
# Should output: Kaggle API 1.x.x
```

---

## Quick Start: Sample Ingestion (1000 Recipes)

**Total Time**: ~10-15 minutes

### Step 1: Download Dataset (2-3 minutes)

```bash
pnpm data:epicurious:download
```

**Expected Output**:
```
[Kaggle] ✓ Kaggle CLI is installed
[Kaggle] ✓ Kaggle credentials found
[Download] Downloading Epicurious dataset from Kaggle...
[Download] ✓ Download complete
[Verify] ✓ Found 20,130 recipes
✓ SUCCESS
```

### Step 2: Ingest Sample (10-12 minutes)

```bash
pnpm data:epicurious:sample
```

This ingests **1000 recipes** with:
- ✅ AI quality evaluation
- ✅ Semantic embeddings
- ✅ Duplicate detection
- ✅ Full metadata

**Expected Output**:
```
EPICURIOUS RECIPE INGESTION PIPELINE
Started: 2025-10-14T10:30:00.000Z
Batch Size: 500 recipes
Max Recipes: 1000

[Epicurious] Processing 1000 recipes...

[1/1000] Processing "Classic Pasta Carbonara"...
  Quality: 4.5/5.0 - Excellent recipe with clear instructions
  Embedding: ✓ Generated (384d)
  Recipe ID: abc-123
  Embedding: ✓ Stored
✓ Stored "Classic Pasta Carbonara"

...

BATCH 1 COMPLETE - Progress: 500/1000 recipes processed
Success: 485 | Skipped: 12 | Failed: 3

...

INGESTION COMPLETE
Total Recipes: 1000
✓ Success: 970
⊘ Skipped: 28
✗ Failed: 2
Duration: 685.42 seconds
Rate: 1.46 recipes/second
```

### Step 3: Verify Ingestion

```bash
# Check recipe count
psql $DATABASE_URL -c "SELECT COUNT(*) FROM recipes WHERE source = 'epicurious.com';"
```

**Expected**: ~970 recipes (some skipped due to duplicates/missing data)

---

## Full Ingestion (All 20K+ Recipes)

**Total Time**: ~2-4 hours

### One-Command Full Workflow

```bash
# Download + Ingest everything
pnpm data:epicurious:full
```

OR run steps separately:

### Step 1: Download (2-3 minutes)

```bash
pnpm data:epicurious:download
```

### Step 2: Ingest All Recipes (2-4 hours)

```bash
pnpm data:epicurious:ingest
```

**What to Expect**:
- **Duration**: 2-4 hours
- **Success Rate**: ~95-98%
- **Total Recipes**: ~19,000-20,000 stored
- **Skipped**: ~2-5% (duplicates, missing data)

### Monitor Progress

Open a second terminal:

```bash
# Watch log file
tail -f data/recipes/incoming/epicurious/logs/ingestion-*.json
```

---

## Custom Ingestion Options

### Smaller Batches (Slower, More Stable)

```bash
# Process 250 recipes at a time
tsx scripts/data-acquisition/ingest-epicurious.ts 250
```

### Larger Batches (Faster, May Hit Rate Limits)

```bash
# Process 1000 recipes at a time
tsx scripts/data-acquisition/ingest-epicurious.ts 1000
```

### Specific Number of Recipes

```bash
# Ingest first 5000 recipes
tsx scripts/data-acquisition/ingest-epicurious.ts 500 5000
```

---

## Verification Steps

### 1. Check Total Count

```sql
SELECT COUNT(*) as total_epicurious_recipes
FROM recipes
WHERE source = 'epicurious.com';
```

### 2. Check Quality Distribution

```sql
SELECT
  system_rating,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) as percentage
FROM recipes
WHERE source = 'epicurious.com'
GROUP BY system_rating
ORDER BY system_rating DESC;
```

**Expected Distribution**:
```
system_rating | count | percentage
--------------+-------+-----------
    5.0       |  250  |   1.3%
    4.5       | 3800  |  19.5%
    4.0       | 7200  |  36.9%
    3.5       | 5400  |  27.7%
    3.0       | 2100  |  10.8%
    2.5       |  700  |   3.6%
    2.0       |   50  |   0.3%
```

### 3. Check Embeddings

```sql
SELECT COUNT(*) as recipes_with_embeddings
FROM recipe_embeddings
WHERE recipe_id IN (
  SELECT id FROM recipes WHERE source = 'epicurious.com'
);
```

**Expected**: Should match recipe count (or be slightly lower if some embedding generation failed)

### 4. Test Semantic Search

```bash
pnpm test:semantic-search
```

Search for "pasta carbonara" and verify Epicurious recipes appear in results.

---

## Troubleshooting

### Problem: "Kaggle CLI not found"

```bash
# Install Kaggle CLI
pip install kaggle

# Verify
kaggle --version
```

---

### Problem: "Kaggle credentials not configured"

1. Create API token: https://www.kaggle.com/settings/account
2. Download `kaggle.json`
3. Place in `~/.kaggle/kaggle.json`
4. Set permissions: `chmod 600 ~/.kaggle/kaggle.json`

---

### Problem: "JSON file not found"

```bash
# Re-download dataset
pnpm data:epicurious:download
```

---

### Problem: "HuggingFace API rate limit"

**Solution 1**: Wait 5-10 minutes for model to warm up, then retry

**Solution 2**: Reduce batch size:
```bash
tsx scripts/data-acquisition/ingest-epicurious.ts 250
```

---

### Problem: "OpenRouter API error"

- Check `OPENROUTER_API_KEY` in `.env.local`
- Verify quota: https://openrouter.ai/account
- Pipeline continues with default 3.0 rating if evaluation fails

---

### Problem: Slow ingestion

**Expected Speed**: 1-2 recipes per second

If slower:
1. Check internet connection
2. Verify API keys are valid
3. Monitor API rate limits
4. Consider running overnight for full dataset

---

## Next Steps

After successful ingestion:

### 1. Browse Recipes in UI

Visit: `http://localhost:3001/discover`

Filter by:
- Source: "Epicurious"
- Cuisine: Italian, Mexican, etc.
- Difficulty: Easy, Medium, Hard

### 2. Test Semantic Search

```bash
pnpm test:semantic-search
```

Try searches like:
- "quick weeknight pasta"
- "vegetarian mexican dinner"
- "chocolate dessert easy"

### 3. Analyze Recipe Quality

```sql
-- Top-rated Epicurious recipes
SELECT
  name,
  system_rating,
  system_rating_reason,
  cuisine,
  difficulty
FROM recipes
WHERE source = 'epicurious.com'
  AND system_rating::numeric >= 4.5
ORDER BY system_rating::numeric DESC
LIMIT 20;
```

### 4. Explore Categories

```sql
-- Most common categories/tags
SELECT
  tag,
  COUNT(*) as recipe_count
FROM recipes,
  LATERAL jsonb_array_elements_text(tags::jsonb) AS tag
WHERE source = 'epicurious.com'
GROUP BY tag
ORDER BY recipe_count DESC
LIMIT 20;
```

---

## Performance Expectations

### Sample Ingestion (1000 recipes)

| Metric | Value |
|--------|-------|
| Duration | 10-15 minutes |
| Success Rate | ~97% |
| Stored Recipes | ~970 |
| Skipped | ~28 (duplicates, missing data) |
| Failed | ~2 (API errors) |

### Full Ingestion (20,130 recipes)

| Metric | Value |
|--------|-------|
| Duration | 2-4 hours |
| Success Rate | ~95-98% |
| Stored Recipes | ~19,000-20,000 |
| Skipped | ~500-1000 (duplicates, missing data) |
| Failed | ~50-100 (API errors) |

---

## Advanced Configuration

### Skip Quality Evaluation (Faster)

Edit `ingest-epicurious.ts` and comment out quality evaluation:

```typescript
// Step 1: Evaluate quality using AI
// let qualityRating = 3.0;
// let qualityReason = 'Quality evaluation skipped';

// try {
//   const quality = await evaluateRecipeQuality({ ... });
//   qualityRating = quality.rating;
//   qualityReason = quality.reasoning;
// } catch (error) { ... }

// Use defaults instead:
const qualityRating = 3.0;
const qualityReason = 'Quality evaluation skipped';
```

**Time Saved**: ~50% faster (1-2 hours instead of 2-4)

### Skip Embedding Generation (Much Faster)

Comment out embedding generation in `ingest-epicurious.ts`:

```typescript
// Step 2: Generate embedding for semantic search
let embeddingVector: number[] | null = null;
// let embeddingText = '';

// (comment out entire embedding block)
```

**Warning**: Semantic search won't work for these recipes.

---

## Data Files Location

```
data/recipes/incoming/epicurious/
├── epi_r.json                           # Main dataset (20K+ recipes)
├── metadata.json                        # Download metadata
└── logs/
    └── ingestion-2025-10-14T10-30-00.json  # Ingestion log
```

---

## Support

For detailed documentation, see: [data-acquisition-epicurious.md](./data-acquisition-epicurious.md)

For issues:
1. Check troubleshooting section above
2. Review ingestion logs in `data/recipes/incoming/epicurious/logs/`
3. Verify API keys in `.env.local`

---

**Quick Reference**:

```bash
# Download dataset
pnpm data:epicurious:download

# Ingest sample (1000 recipes)
pnpm data:epicurious:sample

# Ingest all recipes
pnpm data:epicurious:ingest

# One-command full workflow
pnpm data:epicurious:full
```

**Happy cooking with 20,000+ Epicurious recipes!** 🍳👨‍🍳
