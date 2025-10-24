# Recipe QA System - Quick Start Guide
**For Implementation Team**

---

## 🚀 Getting Started (5 Minutes)

### Prerequisites

```bash
# 1. Install Ollama (if using local LLM)
brew install ollama

# 2. Pull Qwen2.5-7B model
ollama pull qwen2.5:7b-instruct

# 3. Verify model works
ollama run qwen2.5:7b-instruct "Extract ingredients from: Mix flour and salt"
```

### Project Setup

```bash
# Navigate to project
cd /Users/masa/Projects/joanies-kitchen

# Install dependencies (if needed)
pnpm install

# Verify database connection
pnpm db:studio
```

---

## 📋 Implementation Checklist

### Day 1-2: Development (12 hours)

**Scripts to Build**:

1. **Phase 1: Structure Validation** (2 hours)
   - File: `scripts/qa/1-structure-validation.ts`
   - Goal: Find missing ingredients, instructions, malformed JSON
   - Output: `tmp/qa-reports/phase1-structure-{timestamp}.json`

2. **Phase 2: LLM Validation** (4 hours)
   - File: `scripts/qa/2-llm-validation.ts`
   - Goal: Compare ingredients in list vs. instructions
   - Output: `tmp/qa-reports/phase2-llm-validation-{timestamp}.json`

3. **Phase 3: Apply Fixes** (2 hours)
   - File: `scripts/qa/3-apply-fixes.ts`
   - Goal: Apply high-confidence automated fixes
   - Output: `tmp/qa-reports/phase3-fixes-{timestamp}.json`

4. **Phase 4: Review Queue** (1 hour)
   - File: `scripts/qa/4-generate-review-queue.ts`
   - Goal: Generate CSV for manual review
   - Output: `tmp/qa-reports/phase4-review-queue-{timestamp}.csv`

**Supporting Files**:
- `scripts/qa/lib/llm-client.ts` - LLM interface
- `scripts/qa/lib/ingredient-extractor.ts` - Extraction logic
- `scripts/qa/config.ts` - Configuration

**Testing**: Test on 50 sample recipes before full run

---

### Day 3: Execution (15-17 hours)

**Morning** (2 hours):
```bash
# Step 1: Backup database
pg_dump $DATABASE_URL > /tmp/db-backup-$(date +%Y%m%d).sql

# Step 2: Run Phase 1
npx tsx scripts/qa/1-structure-validation.ts

# Step 3: Review critical issues
cat tmp/qa-reports/phase1-structure-*.json | jq '.critical_issues'

# Step 4: Fix critical issues manually if needed
```

**Afternoon** (10-12 hours):
```bash
# Step 5: Start Phase 2 (long-running)
npx tsx scripts/qa/2-llm-validation.ts --batch-size=50

# Monitor progress (in another terminal)
tail -f tmp/qa-reports/progress.log
```

**Evening** (3 hours):
```bash
# Step 6: Review auto-fix candidates
cat tmp/qa-reports/phase2-llm-validation-*.json | jq '.summary'

# Step 7: Apply fixes (with manual approval)
npx tsx scripts/qa/3-apply-fixes.ts

# Step 8: Generate review queue
npx tsx scripts/qa/4-generate-review-queue.ts
```

---

### Day 4-5: Manual Review (10 hours)

**Process**:
1. Open CSV in Google Sheets or Excel
2. Review Tier 1 (critical) issues first
3. For each recipe:
   - Read instructions
   - Check declared ingredients
   - Confirm missing ingredients
   - Approve/reject fix
4. Apply manual fixes to database

**CSV Format**:
```csv
recipe_id,recipe_name,missing_ingredients,confidence,suggested_action,review_status
abc123,"Pasta Carbonara","salt; black pepper",0.85,"Add ingredients","approved"
```

---

### Day 6: Final Validation (2 hours)

```bash
# Re-run Phase 1 to verify fixes
npx tsx scripts/qa/1-structure-validation.ts

# Check final metrics
psql $DATABASE_URL -c "
  SELECT
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE ingredients IS NULL OR ingredients = '[]') as missing_ing,
    COUNT(*) FILTER (WHERE instructions IS NULL OR instructions = '[]') as missing_inst
  FROM recipes;
"

# Verify launch readiness
# - missing_ing should be 0
# - missing_inst should be <20
```

---

## 🎯 Key Commands Reference

### Database Queries

```sql
-- Check recipe data quality
SELECT
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE ingredients IS NULL) as null_ing,
  COUNT(*) FILTER (WHERE instructions IS NULL) as null_inst,
  COUNT(*) FILTER (WHERE jsonb_array_length(ingredients::jsonb) < 3) as few_ing
FROM recipes;

-- Find specific problem recipes
SELECT id, name, ingredients, instructions
FROM recipes
WHERE ingredients IS NULL OR instructions IS NULL
LIMIT 10;

-- Check normalization coverage
SELECT COUNT(DISTINCT recipe_id) as normalized_recipes
FROM recipe_ingredients;
```

### Script Execution

```bash
# Structure validation
npx tsx scripts/qa/1-structure-validation.ts

# LLM validation (dry-run)
npx tsx scripts/qa/2-llm-validation.ts --dry-run

# LLM validation (production)
npx tsx scripts/qa/2-llm-validation.ts --batch-size=50

# Apply fixes
npx tsx scripts/qa/3-apply-fixes.ts --input=tmp/qa-reports/phase2-*.json

# Generate review queue
npx tsx scripts/qa/4-generate-review-queue.ts
```

### Monitoring

```bash
# Watch progress
tail -f tmp/qa-reports/progress.log

# Check errors
tail -f tmp/qa-reports/error-log.jsonl

# Monitor system resources
htop  # or Activity Monitor on macOS
```

---

## 🔧 Configuration Options

### config.ts

```typescript
export const QA_CONFIG = {
  // LLM settings
  llm: {
    provider: 'ollama',  // or 'openrouter'
    model: 'qwen2.5:7b-instruct',
    temperature: 0.1,
    max_tokens: 512,
  },

  // Processing
  processing: {
    batch_size: 50,       // Recipes per batch
    max_concurrent: 3,    // Parallel LLM calls
  },

  // Thresholds
  thresholds: {
    auto_fix: 0.90,       // Auto-fix if confidence ≥ 0.90
    manual_review: 0.75,  // Flag for review if < 0.75
  },

  // Output
  output: {
    dry_run: false,       // Set true for testing
    reports_dir: '/tmp/qa-reports',
  },
};
```

---

## 🐛 Troubleshooting

### LLM Issues

**Problem**: Ollama not responding
```bash
# Restart Ollama service
brew services restart ollama

# Test connection
ollama list
ollama run qwen2.5:7b-instruct "test"
```

**Problem**: Out of memory
```bash
# Reduce batch size
npx tsx scripts/qa/2-llm-validation.ts --batch-size=25
```

### Database Issues

**Problem**: Connection timeout
```bash
# Check connection
psql $DATABASE_URL -c "SELECT 1;"

# Verify DATABASE_URL
echo $DATABASE_URL
```

**Problem**: Need to rollback
```bash
# Restore from backup
pg_restore -d $DATABASE_URL /tmp/db-backup-20251024.sql
```

### Script Issues

**Problem**: TypeScript errors
```bash
# Rebuild
pnpm build

# Check types
npx tsc --noEmit
```

**Problem**: Missing dependencies
```bash
# Reinstall
pnpm install
```

---

## 📊 Expected Results

### Phase 1 Output

```json
{
  "total_recipes": 4707,
  "critical_issues": {
    "missing_ingredients": 20,
    "missing_instructions": 211,
    "malformed_json": 5,
    "non_string_elements": 2
  },
  "auto_fixes_applied": 7,
  "manual_review_required": 231
}
```

### Phase 2 Output

```json
{
  "total_recipes_analyzed": 4476,
  "summary": {
    "perfect_matches": 3800,
    "minor_issues": 450,
    "major_issues": 226,
    "auto_fix_candidates": 380,
    "manual_review_required": 296
  },
  "processing_time_seconds": 41200
}
```

### Phase 3 Output

```json
{
  "fixes_applied": 380,
  "recipes_updated": [
    {
      "recipe_id": "abc123",
      "changes": {
        "added_ingredients": ["salt", "pepper"]
      }
    }
  ]
}
```

---

## ⏱️ Time Estimates

| Phase | Task | Estimated Time |
|-------|------|----------------|
| **Dev** | Phase 1 script | 2 hours |
| **Dev** | Phase 2 script | 4 hours |
| **Dev** | Phase 3 script | 2 hours |
| **Dev** | Phase 4 script | 1 hour |
| **Dev** | Testing | 3 hours |
| **Exec** | Structure validation | 30 min |
| **Exec** | LLM validation | 10-12 hours |
| **Exec** | Apply fixes | 2 hours |
| **Exec** | Generate review queue | 30 min |
| **Review** | Manual review | 8-10 hours |
| **Final** | Validation & testing | 2 hours |
| **TOTAL** | | **35-39 hours** |

**With 6 days to launch**: Highly achievable (8 hours/day pace)

---

## ✅ Success Criteria

**Launch Ready When**:
- ✅ Zero recipes with missing ingredients
- ✅ <20 recipes with missing instructions (hidden from search)
- ✅ 95%+ ingredient-instruction match rate
- ✅ All critical issues resolved
- ✅ Manual review queue processed

---

## 📚 Full Documentation

- **Comprehensive Strategy**: `docs/qa/INGREDIENT_INSTRUCTION_QA_STRATEGY.md`
- **Executive Summary**: `docs/qa/QA_RESEARCH_EXECUTIVE_SUMMARY.md`
- **This Quick Start**: `docs/qa/QUICK_START_GUIDE.md`

---

## 🆘 Need Help?

**Questions? Issues?**
- Review full strategy document for detailed explanations
- Check troubleshooting section above
- Examine sample validation scripts in `scripts/` directory
- Test on small batch (10-20 recipes) first

**Testing Commands**:
```bash
# Test on 10 recipes only
npx tsx scripts/qa/2-llm-validation.ts --limit=10 --dry-run

# Check output
cat tmp/qa-reports/phase2-*.json | jq '.'
```

---

**Ready to Start?** Begin with Day 1 development tasks!
