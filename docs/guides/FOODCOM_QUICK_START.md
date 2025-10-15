# Food.com Quick Start Guide

**One-Page Reference for Food.com Recipe Ingestion**

---

## Prerequisites Checklist

- [ ] Kaggle account created
- [ ] Kaggle API token downloaded (`kaggle.json`)
- [ ] Kaggle CLI installed (`pip install kaggle`)
- [ ] Credentials configured (`~/.kaggle/kaggle.json`, chmod 600)
- [ ] Hugging Face API key in `.env.local`
- [ ] OpenRouter API key in `.env.local`
- [ ] Database connection working

---

## Quick Setup (5 Minutes)

```bash
# 1. Install Kaggle CLI
pip install kaggle

# 2. Download Kaggle API token from:
# https://www.kaggle.com/settings (click "Create New API Token")

# 3. Configure credentials
mkdir -p ~/.kaggle
mv ~/Downloads/kaggle.json ~/.kaggle/
chmod 600 ~/.kaggle/kaggle.json

# 4. Verify setup
npm run data:setup
```

---

## Usage Commands

### Test Run (1000 recipes, ~10 minutes)
```bash
npm run data:food-com:sample
```

### Download Dataset Only
```bash
npm run data:food-com
```

### Ingest Dataset Only (assumes already downloaded)
```bash
npm run data:food-com:ingest
```

### Complete Workflow (Download + Ingest all 180K recipes, 10-24 hours)
```bash
npm run data:food-com:full
```

### Custom Batch Size
```bash
# 500 recipes per batch
tsx scripts/data-acquisition/ingest-foodcom.ts 500

# Limit to first 5000 recipes
tsx scripts/data-acquisition/ingest-foodcom.ts 1000 5000
```

---

## Background Execution

For long-running ingestion:

```bash
# Using nohup (output to log file)
nohup npm run data:food-com:ingest > foodcom.log 2>&1 &

# Check progress
tail -f foodcom.log

# Using screen (detachable terminal)
screen -S foodcom
npm run data:food-com:ingest
# Detach: Ctrl+A, then D
# Reattach: screen -r foodcom
```

---

## Expected Output

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
[1/180164]   Recipe ID: a1b2c3d4-e5f6-7890-abcd-ef1234567890
[1/180164]   Embedding: ✓ Stored
[1/180164] ✓ Stored "Brownies in the World"

--------------------------------------------------------------------------------
BATCH 1 COMPLETE - Progress: 1000/180164 recipes processed
Success: 987 | Skipped: 8 | Failed: 5
--------------------------------------------------------------------------------
```

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Processing Speed | ~10 recipes/second |
| Total Duration | 10-24 hours (180K recipes) |
| Rate Limiting | 500ms between recipes |
| Memory Usage | ~500MB peak |
| Database Size | ~2.5GB (recipes + embeddings) |

---

## Monitoring

### Check Database
```bash
npm run db:studio
```

Navigate to:
- `recipes` table → See imported recipes
- `recipeEmbeddings` table → See embeddings

### View Logs
```bash
ls data/recipes/incoming/food-com/logs/
cat data/recipes/incoming/food-com/logs/ingestion-*.json | jq
```

---

## Troubleshooting (Top 5 Issues)

### 1. Kaggle CLI Not Found
```bash
pip install kaggle
# Verify: kaggle --version
```

### 2. Kaggle API Not Configured
```bash
# Check file exists:
ls -la ~/.kaggle/kaggle.json

# Fix permissions:
chmod 600 ~/.kaggle/kaggle.json
```

### 3. CSV File Not Found
```bash
# Download dataset first:
npm run data:food-com
```

### 4. Hugging Face Rate Limit
Wait 5-10 minutes, then resume. Duplicates are automatically skipped.

### 5. Database Connection Error
```bash
# Verify DATABASE_URL in .env.local
# Push schema:
npm run db:push
```

---

## Files & Directories

```
scripts/data-acquisition/
├── setup-kaggle.ts              # Credential validation
├── download-food-com.ts         # Download from Kaggle
└── ingest-foodcom.ts           # Ingestion pipeline

data/recipes/incoming/food-com/
├── RAW_recipes.csv             # Downloaded dataset
├── RAW_interactions.csv        # User interactions (not used)
└── logs/                       # Ingestion logs

docs/guides/
├── data-acquisition-foodcom.md # Full documentation
├── FOODCOM_IMPLEMENTATION_SUMMARY.md
└── FOODCOM_QUICK_START.md      # This file
```

---

## What Gets Imported

**Each recipe includes:**
- ✅ Name, description, ingredients, instructions
- ✅ Prep/cook times (split from total)
- ✅ Tags (dessert, baking, etc.)
- ✅ Nutrition (calories, fat, protein, etc.)
- ✅ AI quality rating (0-5 scale)
- ✅ Embedding vector (384d for search)
- ✅ Source URL (food.com/recipe/ID)

**Database fields:**
- `isPublic`: true
- `isSystemRecipe`: true
- `userId`: system_imported

---

## Resume After Failure

Simply re-run the ingestion. Duplicates are automatically skipped:

```bash
npm run data:food-com:ingest
```

The script checks for existing recipes by name + source URL.

---

## Success Indicators

✅ Recipes appear in Drizzle Studio (`recipes` table)
✅ Embeddings stored (`recipeEmbeddings` table)
✅ Quality ratings between 0-5
✅ Log file saved with statistics
✅ Console shows "INGESTION COMPLETE"

---

## Next Steps After Ingestion

1. **Verify Data Quality**
   ```bash
   npm run db:studio
   ```

2. **Test Semantic Search**
   ```bash
   npm run test:semantic-search
   ```

3. **Make Recipes Public** (if needed)
   - Update `isPublic` field via Drizzle Studio
   - Or use SQL: `UPDATE recipes SET "isPublic" = true WHERE "isSystemRecipe" = true`

4. **View in App**
   - Navigate to `/discover` page
   - Recipes should appear in system recipe list

---

## Documentation Links

- **Full Guide**: `docs/guides/data-acquisition-foodcom.md`
- **Implementation Summary**: `docs/guides/FOODCOM_IMPLEMENTATION_SUMMARY.md`
- **Script Source**: `scripts/data-acquisition/ingest-foodcom.ts`

---

## API Keys Required

Add to `.env.local`:

```env
# Hugging Face (for embeddings)
HUGGINGFACE_API_KEY=hf_...

# OpenRouter (for quality evaluation)
OPENROUTER_API_KEY=sk-or-...

# Database
DATABASE_URL=postgresql://...
```

Get keys:
- Hugging Face: https://huggingface.co/settings/tokens
- OpenRouter: https://openrouter.ai/keys

---

## Support

**Issues?** See troubleshooting section in:
`docs/guides/data-acquisition-foodcom.md`

**Questions?** Check implementation summary:
`docs/guides/FOODCOM_IMPLEMENTATION_SUMMARY.md`

---

**Last Updated**: 2025-10-14
**Status**: Production Ready ✅
