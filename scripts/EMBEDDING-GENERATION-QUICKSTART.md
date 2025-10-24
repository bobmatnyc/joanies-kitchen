# Local Embedding Generation - Quick Start

## Critical Context
Production HuggingFace API has availability issues. We must pre-calculate all 4,644 recipe embeddings before October 27 launch (4 days).

---

## Setup (5 minutes)

```bash
# 1. Install dependencies
pip install -r scripts/requirements-embeddings.txt

# 2. Verify database connection
grep DATABASE_URL .env.local

# 3. Test the script
python scripts/test-embedding-generator.py
```

---

## Test Run (2 minutes)

```bash
# Test on 10 recipes
python scripts/generate_embeddings_local.py --limit=10 --execute
```

**Expected Output**:
```
✅ EMBEDDING GENERATION COMPLETE
Recipes processed: 10
Successful: 10
Failed: 0
Duration: 0:01:15
Performance: 8.00 recipes/minute
```

---

## Production Run (8-10 hours)

```bash
# Full execution (all 4,644 recipes)
python scripts/generate_embeddings_local.py --execute

# Safe to interrupt with Ctrl+C and resume:
python scripts/generate_embeddings_local.py --execute --resume
```

---

## Verify Results

```sql
-- Check embedding count
SELECT COUNT(*) FROM recipe_embeddings;
-- Expected: 4,644 (or close)

-- Check model name
SELECT DISTINCT model_name FROM recipe_embeddings;
-- Expected: BAAI/bge-small-en-v1.5
```

---

## Troubleshooting

### "Missing required dependency"
```bash
pip install -r scripts/requirements-embeddings.txt
```

### "DATABASE_URL not found"
Check `.env.local` contains:
```
DATABASE_URL=postgresql://...
```

### "Out of memory"
Reduce batch size:
```bash
python scripts/generate_embeddings_local.py --execute --batch-size=50
```

---

## Key Files

- **Main Script**: `scripts/generate_embeddings_local.py`
- **Dependencies**: `scripts/requirements-embeddings.txt`
- **Full Documentation**: `scripts/README-LOCAL-EMBEDDINGS.md`
- **Test Script**: `scripts/test-embedding-generator.py`

---

## Success Criteria

✅ Script runs without errors on 10-recipe test
✅ Embeddings saved to `recipe_embeddings` table
✅ Dimension is 384 (check with SQL)
✅ Model name is `BAAI/bge-small-en-v1.5`
✅ All 4,644 recipes have embeddings before October 27

---

**Estimated Timeline**:
- Setup: 5 minutes
- Test run: 2 minutes
- Full production run: 8-10 hours
- Verification: 5 minutes

**Total**: ~10 hours (can run overnight)
