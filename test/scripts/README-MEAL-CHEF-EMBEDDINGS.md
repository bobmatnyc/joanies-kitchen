# Meal and Chef Embeddings Quick Start

Generate vector embeddings for semantic search of meals and chefs.

## Prerequisites

1. **HuggingFace API Key** (free tier)
   ```bash
   # Get from: https://huggingface.co/settings/tokens
   # Add to .env.local:
   HUGGINGFACE_API_KEY=hf_...
   ```

2. **Database with pgvector**
   ```sql
   CREATE EXTENSION vector;  -- Run in your database if not already
   ```

## Quick Start (3 Steps)

### Step 1: Apply Database Schema

Create the tables and indexes:

```bash
# Dry run (see what will be created)
pnpm embeddings:schema:dry-run

# Apply schema
pnpm embeddings:schema
```

This creates:
- `meals_embeddings` table with HNSW index
- `chefs_embeddings` table with HNSW index

### Step 2: Generate Meal Embeddings

```bash
# Test on 10 meals first
pnpm embeddings:meals:test

# Generate all meal embeddings
pnpm embeddings:meals
```

Meal embeddings include:
- Meal name, description, type, occasion
- Tags
- Recipe names
- Serving information

### Step 3: Generate Chef Embeddings

```bash
# Test on 10 chefs first
pnpm embeddings:chefs:test

# Generate all chef embeddings
pnpm embeddings:chefs
```

Chef embeddings include:
- Chef name and display name
- Biography
- Specialties
- Location information

## Advanced Usage

### Resume from Checkpoint

If generation is interrupted:

```bash
pnpm embeddings:meals:resume
pnpm embeddings:chefs:resume
```

### Custom Batch Configuration

```bash
# Smaller batches (better for rate limiting)
npx tsx scripts/generate-meal-embeddings.ts --execute --batch-size=5 --delay=3000

# Larger batches (faster, more memory)
npx tsx scripts/generate-meal-embeddings.ts --execute --batch-size=20 --delay=1000
```

### Dry Run Everything

Always available for testing:

```bash
pnpm embeddings:schema:dry-run
pnpm embeddings:meals:dry-run
pnpm embeddings:chefs:dry-run
```

## What Gets Generated

### Meal Embedding Example

**Input:**
```json
{
  "name": "Thanksgiving Dinner",
  "description": "Traditional family feast",
  "meal_type": "holiday",
  "occasion": "Thanksgiving",
  "tags": ["Family Dinner", "Holiday"],
  "recipes": ["Roast Turkey", "Mashed Potatoes", "Green Bean Casserole", "Pumpkin Pie"],
  "serves": 8
}
```

**Embedding Text:**
```
Thanksgiving Dinner. Traditional family feast. Type: holiday. Occasion: Thanksgiving. Tags: Family Dinner, Holiday. Recipes: Roast Turkey, Mashed Potatoes, Green Bean Casserole, Pumpkin Pie. Serves: 8
```

**Output:**
- 384-dimensional vector
- Stored in `meals_embeddings` table
- Indexed with HNSW for fast similarity search

### Chef Embedding Example

**Input:**
```json
{
  "name": "J. Kenji López-Alt",
  "display_name": "Kenji López-Alt",
  "bio": "Food scientist and author known for rigorous testing",
  "specialties": ["Science", "Technique", "Asian"],
  "location_city": "San Francisco",
  "location_state": "CA",
  "location_country": "USA"
}
```

**Embedding Text:**
```
J. Kenji López-Alt. Kenji López-Alt. Food scientist and author known for rigorous testing. Specialties: Science, Technique, Asian. Location: San Francisco, CA, USA
```

**Output:**
- 384-dimensional vector
- Stored in `chefs_embeddings` table
- Indexed with HNSW for fast similarity search

## Using Embeddings in Code

### Meal Search

```typescript
import { searchMealsBySimilarity } from '@/app/actions/meal-search';

const results = await searchMealsBySimilarity('holiday dinner', 10);
// Returns: meals similar to "holiday dinner"
```

### Chef Search

```typescript
import { searchChefsBySimilarity } from '@/app/actions/chef-search';

const results = await searchChefsBySimilarity('italian cuisine expert', 10);
// Returns: chefs similar to "italian cuisine expert"
```

### Manual Query

```typescript
import { generateEmbedding } from '@/lib/ai/embeddings';
import { findSimilarMeals, findSimilarChefs } from '@/lib/db/meal-chef-embeddings';

// Generate query embedding
const queryEmbedding = await generateEmbedding('family weekend brunch');

// Find similar meals
const meals = await findSimilarMeals(queryEmbedding, 10, 0.5);

// Find similar chefs
const chefs = await findSimilarChefs(queryEmbedding, 10, 0.5);
```

## Monitoring Progress

During generation, you'll see:

```
[Batch 1] Processing 10 meals...

[1/100] (1.0%) Thanksgiving Dinner
  ID: 550e8400-e29b-41d4-a716-446655440000
  ✅ Success (1 attempt)

📊 Progress Report:
  Processed: 10/100 (10.0%)
  Success: 10 | Failed: 0 | Retried: 0
  Elapsed: 45s | ETA: 6m 45s
  Rate: 13.3 meals/min
```

## Checkpoint Files

Created in `tmp/` directory:

```
tmp/
├── meal-embedding-generation-checkpoint.json    # Resume from here
├── meal-embedding-errors.log                     # Failed meals
├── meal-embedding-generation-report-*.json       # Final report
├── chef-embedding-generation-checkpoint.json     # Resume from here
├── chef-embedding-errors.log                     # Failed chefs
└── chef-embedding-generation-report-*.json       # Final report
```

## Troubleshooting

### API Key Error
```
❌ HUGGINGFACE_API_KEY not configured
```
**Fix:** Add `HUGGINGFACE_API_KEY=hf_...` to `.env.local`

### Model Loading (503)
```
⏳ Model loading or rate limited (HTTP 503), retrying in 5.0s
```
**Fix:** Wait for model to warm up (automatic retry)

### Rate Limiting (429)
```
⏳ Retry 1/3 in 2.0s... (HTTP 429)
```
**Fix:** Increase delay: `--delay=3000`

### pgvector Missing
```
❌ pgvector extension not installed
```
**Fix:** `CREATE EXTENSION vector;` in your database

## Performance Tips

1. **Start Small**: Always test with `--limit=10` first
2. **Use Checkpoints**: Enable resume for large batches
3. **Tune Batch Size**:
   - Small (5): Better for rate limiting
   - Medium (10): Balanced (recommended)
   - Large (20): Faster but more memory
4. **Adjust Delay**: Increase if hitting rate limits
5. **Monitor Logs**: Check `tmp/*-errors.log` for failures

## Next Steps

After generating embeddings:

1. Create semantic search UI for meals and chefs
2. Build "Similar meals" and "Related chefs" features
3. Implement recommendation engines
4. Add discovery features based on user preferences

## Full Documentation

See: `docs/guides/EMBEDDINGS_GENERATION_GUIDE.md`

## Support

- HuggingFace API: https://huggingface.co/docs/api-inference
- pgvector: https://github.com/pgvector/pgvector
- BAAI/bge-small-en-v1.5: https://huggingface.co/BAAI/bge-small-en-v1.5
