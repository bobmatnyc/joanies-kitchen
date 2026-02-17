# Local Embedding Generation Guide

## Overview

This guide covers the local embedding generation system for Joanie's Kitchen. Due to HuggingFace API availability issues in production, we pre-calculate all recipe embeddings using a local sentence-transformers model.

**Critical Context**: Production site has intermittent HuggingFace API availability. Pre-calculating embeddings ensures 100% uptime for recipe discovery features before the October 27, 2025 launch.

---

## Quick Start

### 1. Install Dependencies

```bash
# Install Python dependencies
pip install -r scripts/requirements-embeddings.txt
```

This installs:
- `sentence-transformers` - Local embedding generation
- `psycopg2-binary` - PostgreSQL database connectivity
- `python-dotenv` - Environment variable loading
- `tqdm` - Progress bar UI
- `numpy` - Numerical operations

**Note**: On first run, `sentence-transformers` will auto-download the BAAI/bge-small-en-v1.5 model (~133MB).

### 2. Verify Database Connection

Ensure `.env.local` contains valid `DATABASE_URL`:

```bash
# Check DATABASE_URL is set
grep DATABASE_URL .env.local
```

Expected format:
```
DATABASE_URL=postgresql://user:pass@host/database?sslmode=require
```

### 3. Test Run (10 Recipes)

```bash
# Dry run first (no database changes)
python scripts/generate_embeddings_local.py --limit=10 --dry-run

# Execute test on 10 recipes
python scripts/generate_embeddings_local.py --limit=10 --execute
```

### 4. Full Production Run

```bash
# Full execution (all 4,644 recipes)
python scripts/generate_embeddings_local.py --execute

# Estimated time: 8-10 hours
# Performance: ~8-10 recipes/minute
```

---

## Technical Details

### Model Information

**Model**: `BAAI/bge-small-en-v1.5`
- **Source**: Beijing Academy of Artificial Intelligence
- **Type**: Sentence transformer for semantic similarity
- **Dimensions**: 384 (matches database schema)
- **Normalization**: Enabled (critical for cosine similarity)
- **Max Sequence Length**: 512 tokens

**Why This Model?**
- Exact parity with production HuggingFace API configuration
- Optimal balance of speed and quality for recipe embeddings
- Proven performance in semantic search tasks
- Efficient size (133MB) for local deployment

### Embedding Text Construction

The script replicates the exact TypeScript logic from `src/lib/ai/embeddings.ts`:

```python
def build_recipe_embedding_text(recipe):
    parts = []

    if recipe.name:
        parts.append(recipe.name)

    if recipe.description:
        parts.append(recipe.description)

    if recipe.cuisine:
        parts.append(f"Cuisine: {recipe.cuisine}")

    if recipe.tags:
        tags = json.loads(recipe.tags)
        if tags:
            parts.append(f"Tags: {', '.join(tags)}")

    if recipe.ingredients:
        ingredients = json.loads(recipe.ingredients)
        if ingredients:
            parts.append(f"Ingredients: {', '.join(ingredients)}")

    if recipe.difficulty:
        parts.append(f"Difficulty: {recipe.difficulty}")

    return '. '.join(parts).strip()
```

**Example Output**:
```
Spaghetti Carbonara. Classic Italian pasta with eggs, pancetta, and Parmesan.
Cuisine: Italian. Tags: pasta, comfort-food, quick-meals.
Ingredients: spaghetti, eggs, pancetta, parmesan cheese, black pepper.
Difficulty: medium
```

### Database Schema

**Table**: `recipe_embeddings`

```sql
CREATE TABLE recipe_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id TEXT NOT NULL UNIQUE REFERENCES recipes(id) ON DELETE CASCADE,
  embedding vector(384) NOT NULL,
  embedding_text TEXT NOT NULL,
  model_name VARCHAR(100) NOT NULL DEFAULT 'all-MiniLM-L6-v2',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Note**: `model_name` is updated to `BAAI/bge-small-en-v1.5` by the script.

---

## Usage Guide

### Command-Line Options

```bash
# Basic usage
python scripts/generate_embeddings_local.py [OPTIONS]

# Options:
--execute          # Execute (default is dry-run mode)
--dry-run          # Preview only, no database changes (default)
--limit=N          # Process only N recipes (useful for testing)
--batch-size=N     # Batch size (default: 100)
--resume           # Resume from last checkpoint
```

### Common Workflows

#### 1. Preview Mode (Default)

```bash
# See what would be processed without making changes
python scripts/generate_embeddings_local.py --dry-run
```

**Output**:
```
📊 EMBEDDING GENERATION STATISTICS
===================================================
Total recipes in database: 4,644
Already embedded: 0
Remaining to embed: 4,644
⚠️  DRY RUN MODE - No database changes will be made
===================================================
```

#### 2. Test Small Batch

```bash
# Test on 10 recipes
python scripts/generate_embeddings_local.py --limit=10 --execute
```

**Use Case**: Verify everything works before full run.

#### 3. Full Production Run

```bash
# Process all recipes
python scripts/generate_embeddings_local.py --execute
```

**Estimated Time**: 8-10 hours (4,644 recipes)

#### 4. Resume After Interruption

```bash
# Resume from checkpoint
python scripts/generate_embeddings_local.py --execute --resume
```

**How It Works**:
- Checkpoint saved every 10 batches (1,000 recipes)
- Resume from last successfully processed recipe
- Safe to interrupt (Ctrl+C) and resume

#### 5. Custom Batch Size

```bash
# Smaller batch size for limited memory
python scripts/generate_embeddings_local.py --execute --batch-size=50

# Larger batch size for better performance
python scripts/generate_embeddings_local.py --execute --batch-size=200
```

**Recommendations**:
- **Default (100)**: Good balance for most systems
- **50**: Use if memory-constrained
- **200**: Use if high-memory machine (16GB+ RAM)

---

## Output Files

### 1. Checkpoint File

**Location**: `tmp/embedding-generation-checkpoint.json`

**Format**:
```json
{
  "last_recipe_id": "abc123...",
  "processed": 1500,
  "timestamp": "2025-10-23T10:30:00"
}
```

**Use**: Resume processing after interruption

### 2. Error Log

**Location**: `tmp/embedding-generation-errors.log`

**Format**:
```
2025-10-23 10:30:00 [ERROR] Failed to parse ingredients for recipe xyz789
2025-10-23 10:31:15 [WARNING] Empty embedding text for recipe abc456
```

**Use**: Debug failed recipes

### 3. Final Report

**Location**: `tmp/embedding-generation-report.json`

**Format**:
```json
{
  "total_recipes": 4644,
  "already_embedded": 0,
  "to_process": 4644,
  "processed": 4644,
  "successful": 4641,
  "failed": 3,
  "start_time": "2025-10-23T08:00:00",
  "end_time": "2025-10-23T16:30:00",
  "duration_seconds": 30600,
  "duration_formatted": "8:30:00",
  "recipes_per_minute": 9.12,
  "model_name": "BAAI/bge-small-en-v1.5",
  "embedding_dimension": 384,
  "batch_size": 100
}
```

**Use**: Performance analysis and success metrics

---

## Performance Optimization

### System Requirements

**Minimum**:
- **RAM**: 4GB
- **CPU**: 2 cores
- **Disk**: 500MB free (for model cache)
- **Network**: Download model on first run (~133MB)

**Recommended**:
- **RAM**: 8GB+
- **CPU**: 4+ cores
- **Disk**: 1GB free
- **GPU**: Optional (PyTorch CUDA support for 3-5x speedup)

### Batch Size Tuning

**Default (100)**: Optimal for most systems
- Memory usage: ~800MB
- Speed: ~8-10 recipes/minute

**Small (50)**: Memory-constrained systems
- Memory usage: ~400MB
- Speed: ~7-9 recipes/minute

**Large (200)**: High-memory systems
- Memory usage: ~1.6GB
- Speed: ~10-12 recipes/minute

### GPU Acceleration (Optional)

If PyTorch with CUDA is available, the script automatically uses GPU:

```bash
# Check if GPU is available
python -c "import torch; print(torch.cuda.is_available())"
```

**GPU Speedup**: 3-5x faster than CPU
- CPU: ~8-10 recipes/minute
- GPU: ~30-50 recipes/minute

---

## Troubleshooting

### Issue 1: Model Download Fails

**Symptom**:
```
❌ Failed to load model: [ConnectionError]
```

**Solution**:
1. Check internet connection
2. Retry (downloads are resumable)
3. Manually download model:
   ```bash
   python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('BAAI/bge-small-en-v1.5')"
   ```

### Issue 2: Database Connection Error

**Symptom**:
```
❌ Failed to connect to database: [connection refused]
```

**Solution**:
1. Verify `DATABASE_URL` in `.env.local`
2. Test connection:
   ```bash
   psql $DATABASE_URL -c "SELECT 1"
   ```
3. Check firewall/VPN settings

### Issue 3: pgvector Extension Missing

**Symptom**:
```
⚠️  pgvector extension not found - vector operations may fail
```

**Solution**:
1. Install pgvector on database:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
2. Verify installation:
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'vector';
   ```

### Issue 4: Out of Memory

**Symptom**:
```
MemoryError: Unable to allocate array
```

**Solution**:
1. Reduce batch size:
   ```bash
   python scripts/generate_embeddings_local.py --execute --batch-size=50
   ```
2. Close other applications
3. Use system with more RAM

### Issue 5: Empty Embedding Text

**Symptom**:
```
[WARNING] Batch contains empty text - skipping N recipes
```

**Cause**: Recipe missing all embedding fields (name, description, ingredients, etc.)

**Solution**:
1. Review error log: `tmp/embedding-generation-errors.log`
2. Fix recipes with missing data:
   ```sql
   SELECT id, name FROM recipes
   WHERE name IS NULL OR name = '';
   ```
3. Re-run script with `--resume`

---

## Validation

### 1. Verify Embedding Count

```sql
-- Check total embeddings
SELECT COUNT(*) FROM recipe_embeddings;
-- Expected: 4,644 (or close to it)

-- Check model name
SELECT model_name, COUNT(*)
FROM recipe_embeddings
GROUP BY model_name;
-- Expected: BAAI/bge-small-en-v1.5
```

### 2. Test Similarity Search

```sql
-- Example similarity search
SELECT
  r.name,
  1 - (e.embedding <=> '[0.1,0.2,...]'::vector) AS similarity
FROM recipe_embeddings e
JOIN recipes r ON e.recipe_id = r.id
ORDER BY e.embedding <=> '[0.1,0.2,...]'::vector
LIMIT 10;
```

### 3. Verify Embedding Dimensions

```python
# Test embedding dimension
import psycopg2
from dotenv import load_dotenv
import os

load_dotenv('.env.local')
conn = psycopg2.connect(os.getenv('DATABASE_URL'))
cur = conn.cursor()

cur.execute("SELECT embedding FROM recipe_embeddings LIMIT 1")
embedding = cur.fetchone()[0]

# Parse pgvector format
embedding_list = [float(x) for x in embedding.strip('[]').split(',')]
print(f"Embedding dimension: {len(embedding_list)}")
# Expected: 384

cur.close()
conn.close()
```

---

## Production Deployment

### Pre-Launch Checklist

- [ ] Install dependencies: `pip install -r scripts/requirements-embeddings.txt`
- [ ] Verify database connection
- [ ] Test on 10 recipes: `--limit=10 --execute`
- [ ] Validate test results in database
- [ ] Run full production: `--execute`
- [ ] Monitor progress in `tmp/` logs
- [ ] Verify final count matches recipe count
- [ ] Test similarity search functionality
- [ ] Update application to use embeddings

### Ongoing Maintenance

**Weekly**: Re-run for new recipes
```bash
# Only processes recipes without embeddings
python scripts/generate_embeddings_local.py --execute
```

**After Recipe Updates**: Regenerate specific embeddings
```sql
-- Delete embeddings for updated recipes
DELETE FROM recipe_embeddings
WHERE recipe_id IN ('id1', 'id2', 'id3');

-- Re-run script to regenerate
python scripts/generate_embeddings_local.py --execute
```

**Monitoring**: Check error logs periodically
```bash
# View recent errors
tail -n 50 tmp/embedding-generation-errors.log
```

---

## Advanced Usage

### Custom Filtering

Modify `fetch_recipes_needing_embeddings()` to filter specific recipes:

```python
# Example: Only system recipes
query = """
SELECT ... FROM recipes r
LEFT JOIN recipe_embeddings e ON r.id = e.recipe_id
WHERE e.id IS NULL
  AND r.is_system_recipe = true
ORDER BY r.id ASC
"""
```

### Parallel Processing

For very large datasets, run multiple instances with ID ranges:

```bash
# Instance 1: First 2000 recipes
python scripts/generate_embeddings_local.py --execute --limit=2000

# Instance 2: Next 2000 recipes (after first completes)
# Modify script to add WHERE r.id > 'last_id_from_instance_1'
```

### Integration with Application

Once embeddings are generated, update application search to use them:

```typescript
// Example TypeScript similarity search
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

async function searchRecipesBySimilarity(queryEmbedding: number[], limit = 10) {
  const embeddingStr = '[' + queryEmbedding.join(',') + ']';

  const results = await db.execute(sql`
    SELECT
      r.*,
      1 - (e.embedding <=> ${embeddingStr}::vector) AS similarity
    FROM recipe_embeddings e
    JOIN recipes r ON e.recipe_id = r.id
    WHERE r.is_public = true
    ORDER BY e.embedding <=> ${embeddingStr}::vector
    LIMIT ${limit}
  `);

  return results;
}
```

---

## References

### Documentation
- [sentence-transformers](https://www.sbert.net/)
- [BAAI/bge-small-en-v1.5](https://huggingface.co/BAAI/bge-small-en-v1.5)
- [pgvector](https://github.com/pgvector/pgvector)

### Related Files
- `src/lib/ai/embeddings.ts` - TypeScript embedding utilities
- `src/lib/db/schema.ts` - Database schema
- `scripts/generate_embeddings_local.py` - This script

### Support
For issues or questions, check:
1. Error log: `tmp/embedding-generation-errors.log`
2. Report: `tmp/embedding-generation-report.json`
3. Project documentation: `docs/`

---

**Last Updated**: 2025-10-23
**Version**: 1.0.0
**Maintainer**: Recipe Manager Team
