# Recipe QA Validation Scripts - User Guide

**Purpose**: Comprehensive quality assurance for 4,707 recipes in Joanie's Kitchen database using local LLM (Qwen2.5-7B via Ollama).

**Last Updated**: 2025-10-24
**Version**: 1.0.0
**Launch Deadline**: October 27, 2025 (6 days)

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Quick Start](#quick-start)
4. [Phase-by-Phase Workflow](#phase-by-phase-workflow)
5. [Command Reference](#command-reference)
6. [Troubleshooting](#troubleshooting)
7. [Time Estimates](#time-estimates)
8. [Output Files](#output-files)

---

## Overview

### What These Scripts Do

The QA validation system consists of 5 phases:

1. **Phase 1: Structure Validation** - Fast scan for missing/malformed data (no LLM)
2. **Phase 2: LLM Ingredient Extraction** - Compare declared ingredients vs. instructions
3. **Phase 3: Missing Ingredient Derivation** - Generate ingredient lists using LLM
4. **Phase 4: Database Updates** - Apply high-confidence fixes with backups
5. **Phase 5: Reporting** - Generate executive summary and CSV for manual review

### Why Local LLM?

- **Cost**: Zero API costs (vs. $500-1000 for cloud LLMs at scale)
- **Privacy**: All data stays local
- **Speed**: No rate limits, can process thousands of recipes
- **Control**: Full control over model behavior and retries

---

## Prerequisites

### 1. Install Ollama

**macOS**:
```bash
brew install ollama
```

**Linux**:
```bash
curl https://ollama.ai/install.sh | sh
```

**Windows**:
Download from https://ollama.ai/download

### 2. Pull Qwen2.5-7B Model

```bash
ollama pull qwen2.5-coder:7b-instruct
```

**Model Size**: ~4.7 GB
**RAM Required**: 8 GB minimum (16 GB recommended)

### 3. Start Ollama Server

```bash
ollama serve
```

Leave this running in a separate terminal window.

### 4. Install Node Dependencies

```bash
pnpm add ollama cli-progress @types/cli-progress
```

---

## Quick Start

### Step 1: Test the Setup

Run the test script to verify everything is working:

```bash
pnpm tsx scripts/qa-test-sample.ts
```

**Expected Output**:
```
🧪 QA Test Suite - Sample Recipe Validation
═══════════════════════════════════════════════════════════

[1/5] Testing Ollama connectivity...
      ✅ Successfully connected to Ollama

[2/5] Testing model availability...
      ✅ Found 1 Qwen model(s)

[3/5] Testing ingredient extraction...
      ✅ Extracted 5 ingredients, found 5/5 expected

[4/5] Testing derivation with quantities...
      ✅ Derived 5 ingredients, 5 with quantities

[5/5] Testing database sample (10 recipes)...
      ✅ 8/10 recipes have valid structure (80%)

═══════════════════════════════════════════════════════════
TEST SUMMARY
═══════════════════════════════════════════════════════════
✅ Passed:   5/5
⚠️  Warnings: 0/5
❌ Failed:   0/5

🎉 All tests passed! Ready to run full QA workflow.
```

### Step 2: Run All Phases

```bash
# Phase 1: Structure validation (fast, ~2 hours)
pnpm tsx scripts/qa-recipe-structure.ts

# Phase 2: LLM extraction (slow, ~10-12 hours)
pnpm tsx scripts/qa-recipe-ingredients-llm.ts

# Phase 3: Derive missing ingredients (~4 hours)
pnpm tsx scripts/qa-derive-missing-ingredients.ts

# Phase 4: Apply fixes (DRY-RUN first!)
pnpm tsx scripts/qa-apply-fixes.ts --dry-run

# Review the dry-run output, then apply for real:
pnpm tsx scripts/qa-apply-fixes.ts --apply

# Phase 5: Generate reports
pnpm tsx scripts/qa-generate-report.ts
```

---

## Phase-by-Phase Workflow

### Phase 1: Structure Validation

**Purpose**: Identify recipes with structural issues (no LLM needed).

**Command**:
```bash
pnpm tsx scripts/qa-recipe-structure.ts
```

**What It Does**:
- Scans all 4,707 recipes
- Checks for missing ingredients/instructions
- Validates JSON structure
- Flags empty strings in arrays

**Output**: `tmp/qa-structure-report.json`

**Example Output**:
```
📋 Structure Validation Summary:
──────────────────────────────────────────────────────────
Total Recipes:           4,707
✅ Recipes OK:           4,000 (85.00%)
⚠️  Recipes Flagged:      707 (15.00%)

By Severity:
  🔴 Critical:           231
  🟠 High:               0
  🟡 Medium:             476

Critical Issues:
  Missing Ingredients:   20
  Missing Instructions:  211
  Malformed JSON:        0
```

**Time Estimate**: 2-3 minutes (fast, no LLM)

---

### Phase 2: LLM Ingredient Extraction

**Purpose**: Use Qwen2.5-7B to extract ingredients from instructions and compare with declared lists.

**Command**:
```bash
pnpm tsx scripts/qa-recipe-ingredients-llm.ts
```

**Advanced Options**:
```bash
# Resume from checkpoint (if interrupted)
pnpm tsx scripts/qa-recipe-ingredients-llm.ts --resume
```

**What It Does**:
- Sends instructions to Qwen2.5-7B
- Extracts ingredient names (no quantities)
- Compares with declared ingredients
- Calculates match percentage
- Saves checkpoint every 500 recipes

**Output**: `tmp/qa-ingredient-extraction-report.json`

**Example Output**:
```
📋 Ingredient Extraction Summary:
──────────────────────────────────────────────────────────
Total Recipes:           4,707
Processed:               4,707
Model Used:              qwen2.5-coder:7b-instruct

Match Quality:
  🟢 Perfect (100%):     1,234 (26.21%)
  🟡 High (≥80%):        2,567 (54.53%)
  🟠 Medium (≥60%):      678 (14.40%)
  🔴 Low (<60%):         198 (4.21%)
  ❌ Errors:             30 (0.64%)
```

**Time Estimate**: 10-12 hours (depends on CPU/GPU)

**Performance**:
- M1 Mac: ~1.5 seconds/recipe → 2 hours
- Intel i7: ~3 seconds/recipe → 4 hours
- No GPU: ~8 seconds/recipe → 10-12 hours

**Checkpoints**: Saved every 500 recipes to `tmp/qa-ingredient-extraction-checkpoint.json`

---

### Phase 3: Missing Ingredient Derivation

**Purpose**: Generate complete ingredient lists (with quantities) for recipes missing ingredients.

**Command**:
```bash
pnpm tsx scripts/qa-derive-missing-ingredients.ts
```

**Advanced Options**:
```bash
# Resume from checkpoint
pnpm tsx scripts/qa-derive-missing-ingredients.ts --resume

# Change confidence threshold
pnpm tsx scripts/qa-derive-missing-ingredients.ts --min-confidence=0.85
```

**What It Does**:
- Loads recipes with missing ingredients (from Phase 1)
- Uses Qwen2.5-7B to derive ingredients with quantities
- Calculates confidence score (0.00-1.00)
- Only outputs high-confidence results (≥0.90 by default)

**Output**: `tmp/qa-derived-ingredients.json`

**Example Output**:
```
📋 Ingredient Derivation Summary:
──────────────────────────────────────────────────────────
Total Candidates:        20
Processed:               20
Model Used:              qwen2.5-coder:7b-instruct
Min Confidence:          0.90

Confidence Distribution:
  🟢 High (≥0.90):       15 (75.00%)
  🟡 Medium (0.70-0.89): 3 (15.00%)
  🔴 Low (<0.70):        2 (10.00%)
  ❌ Errors:             0

📦 Ready for DB Update:  15 recipes (≥0.90 confidence)
```

**Time Estimate**: 2-4 hours (20 recipes × 3-5 seconds each)

**Confidence Scoring**:
- **≥0.90**: Safe to auto-apply
- **0.70-0.89**: Review recommended
- **<0.70**: Manual intervention required

---

### Phase 4: Database Updates

**Purpose**: Apply validated fixes to database with safety features.

**IMPORTANT**: Always run with `--dry-run` first!

**Commands**:
```bash
# DRY-RUN (review changes without applying)
pnpm tsx scripts/qa-apply-fixes.ts --dry-run

# APPLY fixes for real (creates backup first)
pnpm tsx scripts/qa-apply-fixes.ts --apply

# Backup only (no changes)
pnpm tsx scripts/qa-apply-fixes.ts --backup-only

# Custom confidence threshold
pnpm tsx scripts/qa-apply-fixes.ts --apply --min-confidence=0.85
```

**What It Does**:
- Loads high-confidence fixes from Phase 3
- Creates backup of affected recipes (if not dry-run)
- Applies fixes in transactions
- Updates QA tracking fields:
  - `qa_status`: 'fixed'
  - `qa_method`: 'qwen2.5-7b-instruct'
  - `qa_timestamp`: Current timestamp
  - `qa_confidence`: Confidence score
  - `qa_fixes_applied`: JSON array of changes

**Output**: `tmp/qa-apply-fixes-log.json`

**Example Output (Dry-Run)**:
```
[DRY-RUN] Would update recipe: Chocolate Chip Cookies
  Ingredients before: 0
  Ingredients after:  8
  Confidence:         0.95
  Sample ingredients: 2 cups all-purpose flour, 1 cup sugar, 3 eggs...
```

**Example Output (Apply)**:
```
📦 Creating backup of 15 recipes...
✅ Backup created: tmp/qa-recipes-backup-2025-10-24T12-00-00.json

Applying |████████████████████| 100% | 15/15 | Applied: 15 | Errors: 0

📋 Apply Fixes Summary:
──────────────────────────────────────────────────────────
Mode:                    APPLY
Min Confidence:          0.90
Total Fixes:             15
Applied:                 15
Skipped:                 0
Errors:                  0
Backup Created:          Yes
Backup Location:         tmp/qa-recipes-backup-2025-10-24T12-00-00.json

✅ Database updated successfully!
```

**Safety Features**:
- ✅ Dry-run mode (default)
- ✅ Automatic backup before applying
- ✅ Transaction rollback on error
- ✅ Confidence threshold filtering
- ✅ Audit trail logging

**Time Estimate**: 1-2 minutes (15-20 recipes)

---

### Phase 5: Reporting

**Purpose**: Generate comprehensive reports for stakeholders.

**Command**:
```bash
pnpm tsx scripts/qa-generate-report.ts
```

**What It Does**:
- Combines results from all phases
- Generates executive summary (text)
- Creates detailed JSON report
- Exports CSV for manual review

**Outputs**:
1. `tmp/qa-executive-summary.txt` - Human-readable summary
2. `tmp/qa-full-report.json` - Complete data for dashboards
3. `tmp/qa-manual-review.csv` - Spreadsheet for manual review

**Example Summary**:
```
═══════════════════════════════════════════════════════════════════
RECIPE QA VALIDATION - EXECUTIVE SUMMARY
═══════════════════════════════════════════════════════════════════

Generated: 10/24/2025, 12:00:00 PM
Total Recipes Analyzed: 4,707

──────────────────────────────────────────────────────────────────
OVERALL STATISTICS
──────────────────────────────────────────────────────────────────
✅ Validated (No Issues):        4,000 (85.00%)
🔧 Fixed Automatically:          15 (0.32%)
⚠️  Needs Manual Review:          692 (14.70%)
🔴 Critical Issues:              231

──────────────────────────────────────────────────────────────────
ISSUES BY TYPE
──────────────────────────────────────────────────────────────────
Missing Ingredients:             5 (remaining after fixes)
Missing Instructions:            211
Ingredient Mismatch:             198
Malformed JSON:                  0
Empty Strings in Arrays:         476

──────────────────────────────────────────────────────────────────
RECOMMENDATIONS
──────────────────────────────────────────────────────────────────

⚠️  692 recipes require manual review.
   See tmp/qa-manual-review.csv for detailed list.

🔴 211 recipes have missing instructions.
   These require manual intervention - cannot be auto-fixed.
```

**Time Estimate**: < 1 minute

---

## Command Reference

### Test Suite

```bash
# Run all tests (default: 10 recipes)
pnpm tsx scripts/qa-test-sample.ts

# Test with custom sample size
pnpm tsx scripts/qa-test-sample.ts --sample-size=20
```

### Phase 1: Structure Validation

```bash
pnpm tsx scripts/qa-recipe-structure.ts
```

### Phase 2: LLM Extraction

```bash
# Full run
pnpm tsx scripts/qa-recipe-ingredients-llm.ts

# Resume from checkpoint
pnpm tsx scripts/qa-recipe-ingredients-llm.ts --resume
```

### Phase 3: Derivation

```bash
# Full run (default: ≥0.90 confidence)
pnpm tsx scripts/qa-derive-missing-ingredients.ts

# Resume from checkpoint
pnpm tsx scripts/qa-derive-missing-ingredients.ts --resume

# Custom confidence threshold
pnpm tsx scripts/qa-derive-missing-ingredients.ts --min-confidence=0.85
```

### Phase 4: Apply Fixes

```bash
# DRY-RUN (always run this first!)
pnpm tsx scripts/qa-apply-fixes.ts --dry-run

# APPLY for real
pnpm tsx scripts/qa-apply-fixes.ts --apply

# Backup only
pnpm tsx scripts/qa-apply-fixes.ts --backup-only

# Custom confidence threshold
pnpm tsx scripts/qa-apply-fixes.ts --apply --min-confidence=0.85
```

### Phase 5: Reporting

```bash
pnpm tsx scripts/qa-generate-report.ts
```

---

## Troubleshooting

### Issue: "Ollama is not running or not accessible"

**Solution**:
```bash
# Start Ollama server
ollama serve

# In another terminal, verify it's running
ollama list
```

### Issue: "Qwen model not found"

**Solution**:
```bash
# Pull the model
ollama pull qwen2.5-coder:7b-instruct

# Verify it's installed
ollama list
```

### Issue: "Out of memory" during LLM processing

**Solution**:
- Close other applications
- Restart Ollama server
- Use smaller batch sizes (edit `BATCH_SIZE` in scripts)
- Consider using smaller model (qwen2.5:3b)

### Issue: Script interrupted/crashed

**Solution**:
- Phase 2 & 3 support checkpoints
- Resume with `--resume` flag:
  ```bash
  pnpm tsx scripts/qa-recipe-ingredients-llm.ts --resume
  pnpm tsx scripts/qa-derive-missing-ingredients.ts --resume
  ```

### Issue: LLM responses are inconsistent

**Solution**:
- Temperature is already set to 0.1 (low)
- Check Ollama server logs for errors
- Verify model integrity:
  ```bash
  ollama rm qwen2.5-coder:7b-instruct
  ollama pull qwen2.5-coder:7b-instruct
  ```

### Issue: Database connection errors

**Solution**:
```bash
# Verify DATABASE_URL in .env.local
cat .env.local | grep DATABASE_URL

# Test connection
pnpm db:studio
```

---

## Time Estimates

### Hardware-Based Estimates

**M1 Mac (Apple Silicon) - 16GB RAM**:
- Phase 1: 3 minutes
- Phase 2: 2 hours (1.5s/recipe)
- Phase 3: 15 minutes (20 recipes × 45s)
- Phase 4: 1 minute
- Phase 5: < 1 minute
- **Total**: ~2.3 hours

**Intel i7 CPU - 16GB RAM**:
- Phase 1: 3 minutes
- Phase 2: 4 hours (3s/recipe)
- Phase 3: 30 minutes (20 recipes × 90s)
- Phase 4: 1 minute
- Phase 5: < 1 minute
- **Total**: ~4.6 hours

**No GPU - 8GB RAM**:
- Phase 1: 3 minutes
- Phase 2: 10-12 hours (8s/recipe)
- Phase 3: 2 hours (20 recipes × 6 minutes)
- Phase 4: 2 minutes
- Phase 5: < 1 minute
- **Total**: ~14 hours

### Optimization Tips

1. **Run overnight**: Phase 2 is the bottleneck
2. **Use checkpoints**: Resume if interrupted
3. **Parallel processing**: Run Phase 1 while setting up Ollama
4. **Skip Phase 2**: If only fixing missing ingredients, run Phases 1, 3, 4, 5

---

## Output Files

All outputs are saved to `tmp/` directory:

| File | Phase | Description |
|------|-------|-------------|
| `qa-structure-report.json` | 1 | Structural validation results |
| `qa-ingredient-extraction-report.json` | 2 | LLM extraction results |
| `qa-ingredient-extraction-checkpoint.json` | 2 | Resume checkpoint (deleted after completion) |
| `qa-derived-ingredients.json` | 3 | Derived ingredient lists |
| `qa-derive-ingredients-checkpoint.json` | 3 | Resume checkpoint (deleted after completion) |
| `qa-recipes-backup-YYYY-MM-DDTHH-MM-SS.json` | 4 | Database backup before applying fixes |
| `qa-apply-fixes-log.json` | 4 | Audit trail of applied fixes |
| `qa-executive-summary.txt` | 5 | Human-readable summary |
| `qa-full-report.json` | 5 | Complete JSON report |
| `qa-manual-review.csv` | 5 | Spreadsheet for manual review |

### File Sizes (Estimated)

- Structure report: ~5 MB
- Extraction report: ~50 MB
- Derivation report: ~500 KB
- Backup files: ~100 KB per 15 recipes
- Executive summary: ~5 KB
- Full report: ~60 MB
- Manual review CSV: ~200 KB

---

## Best Practices

### Before Starting

1. ✅ Run `qa-test-sample.ts` to verify setup
2. ✅ Ensure Ollama is running (`ollama serve`)
3. ✅ Check available disk space (500 MB recommended)
4. ✅ Backup your database manually (optional but recommended)

### During Processing

1. ✅ Monitor Ollama server logs for errors
2. ✅ Keep terminal windows open (don't close)
3. ✅ Check checkpoints are being created (every 500 recipes in Phase 2)
4. ✅ Note any errors in `tmp/qa-errors.log` (created automatically)

### After Processing

1. ✅ Review dry-run output before applying fixes
2. ✅ Verify backup was created before applying
3. ✅ Review manual review CSV for critical issues
4. ✅ Keep backup files for at least 7 days

---

## Support

For issues or questions:

1. Check this documentation first
2. Review `tmp/qa-errors.log` for error details
3. Check Ollama server logs
4. Verify database connection
5. Run test suite again to isolate issue

---

**Last Updated**: 2025-10-24
**Maintained By**: Joanie's Kitchen QA Team
