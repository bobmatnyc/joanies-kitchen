# Instruction Classification System - Quick Start Guide

**Status**: ✅ Ready to Use
**Last Updated**: 2025-10-18

---

## What This System Does

Automatically classifies each recipe instruction step to identify:
- **Work type** (prep, cook, setup, rest, etc.)
- **Technique** (dice, sauté, roast, simmer, etc.)
- **Required tools** (chef's knife, skillet, oven, etc.)
- **Time estimates** (by skill level: beginner, intermediate, advanced)
- **Parallelization** (can this step run alongside others?)
- **Equipment conflicts** (prevents scheduling conflicts)

---

## Quick Commands

### 1. Test on Sample Recipe

```bash
pnpm tsx scripts/test-instruction-classification.ts
```

Tests the system on a hardcoded spaghetti carbonara recipe.

### 2. Classify a Specific Recipe

```bash
# First, find a recipe ID
psql $DATABASE_URL -c "SELECT id, name FROM recipes LIMIT 10;"

# Then classify it
pnpm tsx scripts/test-single-recipe-from-db.ts <recipe-id>
```

### 3. Batch Process All Recipes

```bash
# Dry run first (no database writes)
DRY_RUN=true pnpm tsx scripts/classify-all-recipes.ts

# Process 100 recipes
BATCH_SIZE=100 pnpm tsx scripts/classify-all-recipes.ts

# Process all unclassified recipes
pnpm tsx scripts/classify-all-recipes.ts
```

### 4. Check Quality

```bash
pnpm tsx scripts/validate-classifications.ts
```

Shows coverage, confidence scores, and quality metrics.

---

## Expected Output

### Single Recipe Test

```
Recipe: Classic Spaghetti Carbonara
Instructions: 9 steps

Step 1: "Bring a large pot of salted water to a boil."
  Work Type:       setup
  Technique:       boil
  Tools:           stock_pot, stove
  Time (intermediate): 10 min
  Can Parallelize: Yes ✓
  Needs Attention: No ✗
  Confidence:      98.0%

Total Time: 45 minutes (intermediate cook)
Average Confidence: 95.2%
```

### Batch Processing

```
Configuration:
  Batch Size:        100 recipes
  Rate Limit:        15 requests/minute
  Delay:             4000ms between requests

Processing:
  [1/100] Processing: "Chicken Parmesan"
  ✅ Success (confidence: 92.5%)
  ⏱️  Waiting 4000ms...

Results:
  ✅ Success:        98 recipes
  ❌ Errors:         2 recipes
  💰 Total Cost:     $0.0294
  Success Rate:      98.0%
```

### Validation

```
Coverage Statistics:
  Total Recipes:          3,500
  Classified Recipes:     3,432
  Coverage:               98.06%

Quality Metrics:
  Average Confidence:     91.25%
  Min Confidence:         72.00%
  Max Confidence:         99.50%

Health Check:
  ✅ Coverage > 95%
  ✅ Avg Confidence > 85%
  ✅ Low confidence recipes < 5%
```

---

## Troubleshooting

### Rate Limit Error (429)

```
Error: 429 Provider returned error
```

**Solution**: Wait 60 seconds and retry. The free tier has 15 requests/minute.

```bash
# Wait and retry
sleep 60 && pnpm tsx scripts/test-instruction-classification.ts
```

### JSON Parse Error

```
Error: Unexpected token '`', "```json..." is not valid JSON
```

**Solution**: Already fixed! The parser now strips markdown code blocks.

### Recipe Not Found

```
Error: Recipe not found: abc123
```

**Solution**: Verify the recipe ID exists:

```bash
psql $DATABASE_URL -c "SELECT id, name FROM recipes WHERE id='abc123';"
```

### Missing Environment Variable

```
Error: OPENROUTER_API_KEY environment variable is not set
```

**Solution**: Ensure `.env.local` has the API key:

```bash
echo "OPENROUTER_API_KEY=sk-or-v1-..." >> .env.local
```

---

## Production Workflow

### Step 1: Test (5 minutes)

```bash
# Test on sample data
pnpm tsx scripts/test-instruction-classification.ts

# Test on 1 real recipe
psql $DATABASE_URL -c "SELECT id FROM recipes LIMIT 1;" | tail -1
pnpm tsx scripts/test-single-recipe-from-db.ts <recipe-id>
```

### Step 2: Small Batch (10 minutes)

```bash
# Process 10 recipes
BATCH_SIZE=10 pnpm tsx scripts/classify-all-recipes.ts

# Validate quality
pnpm tsx scripts/validate-classifications.ts
```

### Step 3: Full Batch (3-4 hours)

```bash
# Process all recipes (respects 15 req/min limit)
pnpm tsx scripts/classify-all-recipes.ts

# Monitor progress in another terminal
watch -n 60 "pnpm tsx scripts/validate-classifications.ts"
```

### Step 4: Validate (2 minutes)

```bash
# Final quality check
pnpm tsx scripts/validate-classifications.ts
```

---

## Querying Classifications

### Get Recipes by Technique

```sql
SELECT id, name
FROM recipes
WHERE instruction_metadata @> '[{"classification": {"technique": "saute"}}]'::jsonb;
```

### Get Recipes by Required Tool

```sql
SELECT id, name
FROM recipes
WHERE instruction_metadata @> '[{"classification": {"tools": ["stand_mixer"]}}]'::jsonb;
```

### Get Beginner-Friendly Recipes

```sql
SELECT id, name
FROM recipes
WHERE instruction_metadata IS NOT NULL
AND NOT EXISTS (
  SELECT 1
  FROM jsonb_array_elements(instruction_metadata::jsonb) elem
  WHERE elem->'classification'->>'skill_level_required' != 'beginner'
);
```

### Get Total Prep Time

```sql
SELECT
  id,
  name,
  (
    SELECT SUM((elem->'classification'->'estimated_time_minutes'->>'intermediate')::integer)
    FROM jsonb_array_elements(instruction_metadata::jsonb) elem
  ) as total_time_intermediate
FROM recipes
WHERE instruction_metadata IS NOT NULL;
```

---

## Cost Tracking

### Per Recipe
- **Average**: $0.0003 - $0.001
- **8 steps**: ~4,400 tokens

### Full Database (3,500 recipes)
- **Estimated**: $1.05 - $3.50
- **Processing time**: ~3.9 hours (15 req/min)

### Monitor Actual Cost

OpenRouter dashboard: https://openrouter.ai/activity

---

## Next Steps

After classification is complete:

1. **UI Integration**:
   - Enhanced meal prep timeline
   - Equipment checklist
   - Skill level filtering
   - Parallel task suggestions

2. **Analytics**:
   - Most common techniques
   - Average prep times by cuisine
   - Equipment requirements analysis

3. **Features**:
   - Smart recipe recommendations based on available tools
   - Skill progression tracking
   - Personalized time estimates

---

## Files Reference

```
Database:
  scripts/migrations/add-instruction-metadata-column.ts

Core Service:
  src/lib/ai/instruction-classifier.ts

Server Actions:
  src/app/actions/classify-instructions.ts

Scripts:
  scripts/test-instruction-classification.ts        # Test on sample
  scripts/test-single-recipe-from-db.ts            # Test on DB recipe
  scripts/classify-all-recipes.ts                  # Batch processing
  scripts/validate-classifications.ts              # Quality check

Types:
  src/types/instruction-metadata.ts                # TypeScript types

Prompts:
  src/lib/ai/instruction-classifier-prompt.ts      # LLM prompts

Documentation:
  INSTRUCTION_CLASSIFICATION_IMPLEMENTATION_COMPLETE.md
  docs/reference/INSTRUCTION_CLASSIFICATION_TAXONOMY.md
  docs/reference/INSTRUCTION_METADATA_SCHEMA.md
```

---

## Support

Rate limit issues? Quality concerns?

1. Check validation: `pnpm tsx scripts/validate-classifications.ts`
2. Review sample: `pnpm tsx scripts/test-single-recipe-from-db.ts <id>`
3. Check logs in console output
4. Verify OpenRouter quota: https://openrouter.ai/account

---

**Ready to classify?**

```bash
# Start with a test
pnpm tsx scripts/test-instruction-classification.ts
```
