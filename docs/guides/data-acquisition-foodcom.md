# Food.com Dataset - Data Acquisition Guide

## Overview

This guide covers downloading and ingesting the Food.com recipes dataset from Kaggle into Joanie's Kitchen database.

**Dataset Information:**
- **Source**: Kaggle - "Food.com Recipes and Interactions"
- **Dataset URL**: https://www.kaggle.com/datasets/shuyangli94/food-com-recipes-and-user-interactions
- **Size**: 180K+ recipes
- **Format**: CSV files
- **License**: CC0: Public Domain

---

## Prerequisites

### 1. Kaggle Account & API Setup

You need a Kaggle account and API credentials to download datasets.

#### Step 1: Create Kaggle Account
1. Visit https://www.kaggle.com/
2. Sign up for a free account

#### Step 2: Generate API Token
1. Go to https://www.kaggle.com/settings
2. Scroll to the "API" section
3. Click "Create New API Token"
4. This downloads a `kaggle.json` file

#### Step 3: Install Kaggle Credentials
```bash
# Create Kaggle directory
mkdir -p ~/.kaggle

# Move downloaded kaggle.json to the directory
mv ~/Downloads/kaggle.json ~/.kaggle/

# Set proper permissions (required by Kaggle API)
chmod 600 ~/.kaggle/kaggle.json
```

#### Step 4: Install Kaggle CLI
```bash
# Using pip
pip install kaggle

# Verify installation
kaggle --version
```

### 2. Verify Kaggle Setup

Use the provided setup script to verify your configuration:

```bash
npm run data:setup
```

This will check:
- ✓ Kaggle credentials exist at `~/.kaggle/kaggle.json`
- ✓ File permissions are correctly set to 600
- ✗ If something is wrong, it will show detailed instructions

---

## Dataset Structure

### CSV Files

The Food.com dataset contains two main CSV files:

1. **RAW_recipes.csv** (used for ingestion)
   - Recipe metadata, ingredients, instructions
   - ~180K recipes
   - ~540MB

2. **RAW_interactions.csv** (not currently used)
   - User reviews and ratings
   - ~1M interactions

### RAW_recipes.csv Schema

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `name` | string | Recipe name | "Brownies in the World" |
| `id` | string | Food.com recipe ID | "412271" |
| `minutes` | string | Total time in minutes | "40" |
| `contributor_id` | string | User who submitted | "985201" |
| `submitted` | string | Date submitted | "2008-01-01" |
| `tags` | JSON string | Array of tags | `["dessert", "chocolate"]` |
| `nutrition` | JSON array | [calories, fat, sugar, sodium, protein, saturated_fat, carbs] | `[138.4, 10.0, 50.0, ...]` |
| `n_steps` | string | Number of steps | "10" |
| `steps` | JSON string | Array of instruction steps | `["preheat oven", "mix ingredients"]` |
| `description` | string | Recipe description | "Best ever brownies!" |
| `ingredients` | JSON string | Array of ingredients | `["1 cup flour", "2 eggs"]` |
| `n_ingredients` | string | Number of ingredients | "9" |

---

## Workflow

### Complete Workflow (Download + Ingest)

```bash
# Download dataset from Kaggle AND ingest all recipes
npm run data:food-com:full
```

This runs both steps sequentially:
1. Downloads dataset from Kaggle
2. Ingests all 180K+ recipes into database

**Duration**: 10-24 hours (depending on API rate limits)

---

### Step-by-Step Workflow

#### Step 1: Download Dataset

```bash
npm run data:food-com
```

This downloads the Food.com dataset from Kaggle and extracts it to:
```
data/recipes/incoming/food-com/
├── RAW_recipes.csv
├── RAW_interactions.csv
└── metadata.json (auto-generated)
```

**Expected output:**
```
[Food.com] Starting download...
[Food.com] Downloading from Kaggle...
[Food.com] Dataset: shuyangli94/food-com-recipes-and-user-interactions
[Food.com] Output: /path/to/data/recipes/incoming/food-com
Downloading...
[Food.com] ✓ Download complete
[Food.com] Files downloaded: [ 'RAW_recipes.csv', 'RAW_interactions.csv' ]
```

#### Step 2: Ingest Recipes

```bash
npm run data:food-com:ingest
```

This ingests all recipes from the CSV file into the database with:
- AI quality evaluation (0-5 rating)
- Embedding generation for semantic search
- Duplicate detection
- Error handling and logging

**Expected output:**
```
================================================================================
  FOOD.COM RECIPE INGESTION PIPELINE
================================================================================
Started: 2025-10-14T20:00:00.000Z
Batch Size: 1000 recipes
Rate Limit: 500ms between recipes
================================================================================

[Food.com] Reading CSV file...
[Food.com] Found 180164 recipes in CSV

[1/180164] Processing "Brownies in the World"...
[1/180164]   Quality: 4.2/5.0 - Clear instructions, good ingredient list
[1/180164]   Embedding: ✓ Generated (384d)
[1/180164]   Recipe ID: a1b2c3d4...
[1/180164]   Embedding: ✓ Stored
[1/180164] ✓ Stored "Brownies in the World"

...

================================================================================
  INGESTION COMPLETE
================================================================================
Total Recipes: 180164
✓ Success: 175432
⊘ Skipped: 3210
✗ Failed: 1522
Duration: 18432.50 seconds
Rate: 9.77 recipes/second
================================================================================
```

---

## Advanced Usage

### Test with Sample Dataset

Ingest only the first 1000 recipes for testing:

```bash
npm run data:food-com:sample
```

This runs with parameters: `batch-size=100, max-recipes=1000`

### Custom Batch Size

```bash
# Ingest with custom batch size (500 recipes per batch)
npm run data:food-com:ingest -- 500

# Or use tsx directly
tsx scripts/data-acquisition/ingest-foodcom.ts 500
```

### Limit Total Recipes

```bash
# Ingest only first 5000 recipes
tsx scripts/data-acquisition/ingest-foodcom.ts 1000 5000
```

### Resume Failed Ingestion

The ingestion script automatically skips duplicates, so you can safely re-run it:

```bash
npm run data:food-com:ingest
```

It will skip recipes that were already successfully ingested.

---

## Data Transformation

### CSV → Database Schema Mapping

| Food.com Field | Database Field | Transformation |
|---------------|----------------|----------------|
| `name` | `name` | Direct copy |
| `description` | `description` | Direct copy |
| `ingredients` | `ingredients` | Parse JSON array → stringify |
| `steps` | `instructions` | Parse JSON array → stringify |
| `minutes` | `prepTime` + `cookTime` | Split 30/70 heuristic |
| `tags` | `tags` | Parse JSON array → stringify |
| `nutrition` | `nutritionInfo` | Parse array → object with keys |
| `id` | `source` | Format as `food.com/recipe/{id}` |
| `submitted` | `discoveryDate` | Parse date string |
| - | `userId` | Set to `system_imported` |
| - | `isPublic` | Set to `true` |
| - | `isSystemRecipe` | Set to `true` |
| AI evaluation | `systemRating` | 0.0-5.0 quality score |
| AI evaluation | `systemRatingReason` | Text explanation |
| Generated | `embedding` | 384d vector for search |

### Nutrition Array Format

Food.com provides nutrition as 7-element array:
```json
[138.4, 10.0, 50.0, 3.0, 3.0, 19.0, 6.0]
```

Mapped to:
```json
{
  "calories": "138.4",
  "total_fat": "10.0",
  "sugar": "50.0",
  "sodium": "3.0",
  "protein": "3.0",
  "saturated_fat": "19.0",
  "carbohydrates": "6.0"
}
```

### Time Calculation

Food.com only provides total time (`minutes`). We split it:
- **Prep Time**: 30% of total
- **Cook Time**: 70% of total

Example: 40 minutes total → 12 min prep, 28 min cook

---

## Quality Evaluation

Each recipe is evaluated by AI on a 0-5 scale based on:

### Evaluation Criteria

1. **Clarity of Instructions** (are steps clear, logical, and easy to follow?)
2. **Ingredient Quality** (well-defined measurements and descriptions?)
3. **Cooking Techniques** (appropriate methods for the dish?)
4. **Recipe Completeness** (has all necessary information?)
5. **Practicality** (can average home cook make this successfully?)

### Rating Scale

- **5.0**: Excellent - Professional quality, clear, complete, practical
- **4.0-4.9**: Very Good - Minor improvements possible but highly usable
- **3.0-3.9**: Good - Usable but has some issues or missing details
- **2.0-2.9**: Fair - Significant issues or missing important information
- **1.0-1.9**: Poor - Major problems, unclear, or incomplete
- **0.0-0.9**: Unusable - Critical issues, cannot be followed

### Fallback

If AI evaluation fails (API error, rate limit), recipe gets:
- Rating: 3.0 (neutral)
- Reason: "Quality evaluation skipped"

---

## Embedding Generation

Each recipe gets a 384-dimensional embedding vector for semantic search.

### Embedding Text Format

The embedding is generated from:
```
{name}. {description}. Tags: {tags}. Ingredients: {first 10 ingredients}
```

Example:
```
Brownies in the World. Best ever brownies!. Tags: dessert, chocolate, baked. Ingredients: 1 cup flour, 2 eggs, 1 cup sugar, ...
```

### Model

- **Model**: `sentence-transformers/all-MiniLM-L6-v2`
- **Provider**: Hugging Face Inference API
- **Dimensions**: 384
- **Use Case**: Semantic similarity search

### Fallback

If embedding generation fails:
- Recipe is still stored
- Embedding can be generated later
- Search functionality may be limited for that recipe

---

## Error Handling

### Automatic Retries

The ingestion pipeline includes automatic retries for:
- **AI Quality Evaluation**: 3 retries with backoff
- **Embedding Generation**: 5 retries with backoff (handles model cold starts)
- **Database Operations**: Standard Drizzle ORM error handling

### Duplicate Detection

Recipes are checked for duplicates by:
- Exact name match
- Same source URL

Duplicates are skipped with log message:
```
[123/180164] ⊘ Skipped "Recipe Name" (duplicate)
```

### Error Logging

All errors are logged to:
```
data/recipes/incoming/food-com/logs/
└── ingestion-{timestamp}.json
```

Log file contains:
```json
{
  "total": 180164,
  "success": 175432,
  "failed": 1522,
  "skipped": 3210,
  "errors": [
    {
      "recipe": "Recipe Name",
      "error": "Error message"
    }
  ],
  "startTime": "2025-10-14T20:00:00.000Z",
  "endTime": "2025-10-14T23:07:12.500Z",
  "duration": 11232.5
}
```

---

## Troubleshooting

### Kaggle CLI Not Found

**Error**: `Kaggle CLI not found`

**Solution**:
```bash
pip install kaggle
# Or with pip3
pip3 install kaggle
```

### Kaggle API Not Configured

**Error**: `❌ Kaggle API not configured`

**Solution**: Follow [Kaggle Account & API Setup](#1-kaggle-account--api-setup) section above.

### Kaggle Permissions Error

**Error**: `⚠️ Kaggle API configured but permissions are incorrect`

**Solution**:
```bash
chmod 600 ~/.kaggle/kaggle.json
```

### CSV File Not Found

**Error**: `CSV file not found: data/recipes/incoming/food-com/RAW_recipes.csv`

**Solution**: Download the dataset first:
```bash
npm run data:food-com
```

### Hugging Face API Rate Limit

**Error**: `Rate limit or model loading after 5 attempts`

**Solution**:
1. Wait 5-10 minutes for rate limit to reset
2. Check your Hugging Face API key is valid
3. Consider getting a Pro account for higher rate limits

### Database Connection Error

**Error**: `Connection refused` or `Database not found`

**Solution**:
1. Verify `DATABASE_URL` in `.env.local`
2. Check Neon PostgreSQL is accessible
3. Run database migrations: `npm run db:push`

### Out of Memory

**Error**: `JavaScript heap out of memory`

**Solution**:
1. Process in smaller batches:
   ```bash
   tsx scripts/data-acquisition/ingest-foodcom.ts 500 10000
   ```
2. Increase Node.js memory:
   ```bash
   NODE_OPTIONS="--max-old-space-size=4096" npm run data:food-com:ingest
   ```

---

## Performance Optimization

### Batch Processing

- **Default**: 1000 recipes per batch
- **Memory constrained**: Use 500 or 250
- **Fast server**: Use 2000+

### Rate Limiting

- **Default**: 500ms delay between recipes
- **Reduce for faster**: 250ms (may hit API limits)
- **Increase for stability**: 1000ms

To customize, edit `ingest-foodcom.ts`:
```typescript
const RATE_LIMIT_DELAY_MS = 500; // Change this value
```

### Parallel Processing

Currently single-threaded for API rate limit safety. For future optimization:
1. Split CSV into chunks
2. Run multiple ingestion processes
3. Each with different Hugging Face API key (if available)

---

## Monitoring Progress

### Real-time Monitoring

Watch the terminal output:
```
[1234/180164] Processing "Recipe Name"...
[1234/180164]   Quality: 4.2/5.0 - Clear instructions
[1234/180164]   Embedding: ✓ Generated (384d)
[1234/180164] ✓ Stored "Recipe Name"
```

### Check Database

```bash
# Open Drizzle Studio
npm run db:studio

# Then navigate to:
# - `recipes` table: See imported recipes
# - `recipeEmbeddings` table: See generated embeddings
```

### Check Logs

```bash
# View latest log
ls -lt data/recipes/incoming/food-com/logs/

# Read log file
cat data/recipes/incoming/food-com/logs/ingestion-*.json | jq
```

---

## Best Practices

### 1. Start Small
Test with sample dataset before full ingestion:
```bash
npm run data:food-com:sample
```

### 2. Monitor First Batch
Watch the first 100-200 recipes to ensure:
- Quality evaluations are reasonable
- Embeddings are generating successfully
- No unexpected errors

### 3. Check Database State
After first 1000 recipes, verify in Drizzle Studio:
- Recipes are properly formatted
- Embeddings are stored
- Quality ratings make sense

### 4. Plan for Time
Full ingestion takes 10-24 hours. Run overnight or in background:
```bash
# Using nohup
nohup npm run data:food-com:ingest > foodcom.log 2>&1 &

# Using screen
screen -S foodcom
npm run data:food-com:ingest
# Detach: Ctrl+A, D
```

### 5. Resume on Failure
If process fails, simply re-run. Duplicates are automatically skipped.

---

## API Keys Required

### Hugging Face API Key

Required for embedding generation.

1. Create account: https://huggingface.co/
2. Generate token: https://huggingface.co/settings/tokens
3. Add to `.env.local`:
   ```env
   HUGGINGFACE_API_KEY=hf_...
   ```

### OpenRouter API Key

Required for AI quality evaluation.

1. Create account: https://openrouter.ai/
2. Get API key: https://openrouter.ai/keys
3. Add to `.env.local`:
   ```env
   OPENROUTER_API_KEY=sk-or-...
   ```

---

## FAQ

### How long does full ingestion take?

**Answer**: 10-24 hours for all 180K recipes, depending on:
- API rate limits
- Server performance
- Network speed

### Can I run multiple ingestions in parallel?

**Answer**: Not recommended due to API rate limits. You may hit rate limits and cause failures.

### What happens if process crashes?

**Answer**: Simply re-run the ingestion script. It automatically skips already-imported recipes.

### Do I need to re-download if ingestion fails?

**Answer**: No. The CSV files remain in `data/recipes/incoming/food-com/`. Just re-run the ingestion.

### Can I filter recipes during ingestion?

**Answer**: Currently no. Post-process filtering options:
1. Query database with `WHERE` clauses
2. Delete unwanted recipes via Drizzle Studio
3. Use quality ratings to filter low-quality recipes

### How much database space is needed?

**Answer**: Approximately:
- Recipes: ~2GB
- Embeddings: ~500MB
- Total: ~2.5GB for 180K recipes

---

## Next Steps

After successful ingestion:

1. **Verify Data Quality**
   ```bash
   npm run db:studio
   ```
   - Check recipe formatting
   - Review quality ratings
   - Test search functionality

2. **Make Recipes Public**
   - By default, recipes are `isPublic: true`
   - Adjust in database if needed

3. **Test Semantic Search**
   ```bash
   npm run test:semantic-search
   ```

4. **Enable in UI**
   - Recipes appear in "Discover" page
   - Can be added to meal plans
   - Can be searched semantically

---

## Support & Resources

### Documentation
- Main README: `/README.md`
- Project Organization: `/docs/reference/PROJECT_ORGANIZATION.md`
- Data Acquisition Overview: `/docs/guides/data-acquisition.md` (if exists)

### Script Files
- Download: `/scripts/data-acquisition/download-food-com.ts`
- Ingest: `/scripts/data-acquisition/ingest-foodcom.ts`
- Setup: `/scripts/data-acquisition/setup-kaggle.ts`
- Parser: `/scripts/data-acquisition/parsers/food-com-parser.ts`

### Related Tools
- AI Quality Evaluator: `/src/lib/ai/recipe-quality-evaluator.ts`
- Embedding Generator: `/src/lib/ai/embeddings.ts`
- Database Schema: `/src/lib/db/schema.ts`

---

**Last Updated**: 2025-10-14
**Dataset Version**: Food.com Kaggle (shuyangli94/food-com-recipes-and-user-interactions)
**Ingestion Script Version**: 1.0.0
