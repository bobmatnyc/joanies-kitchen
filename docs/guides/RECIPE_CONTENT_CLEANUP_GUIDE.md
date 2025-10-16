# Recipe Content Cleanup Guide

## Overview

The Recipe Content Cleanup script is a comprehensive tool for fixing critical data quality issues across all recipes in the database. It uses AI (Gemini 2.0 Flash - FREE) to:

- **Add missing ingredient amounts** (CRITICAL) - ensures every ingredient has a quantity
- **Fix title capitalization** - proper Title Case formatting
- **Improve descriptions** - grammar, clarity, and engagement

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Usage](#usage)
- [Testing](#testing)
- [Rollback](#rollback)
- [Technical Details](#technical-details)
- [Troubleshooting](#troubleshooting)

## Features

### ✅ Safety Features
- **Dry-run mode** (default) - preview changes without saving
- **Automatic backups** - saves original data before any changes
- **Rollback support** - restore from backup if needed
- **Comprehensive logging** - detailed JSON logs of all changes

### ✅ Performance Features
- **Batch processing** - processes 10 recipes at a time
- **Rate limiting** - respects API limits (10 recipes/minute)
- **Progress tracking** - real-time progress with ETA
- **Retry logic** - automatic retry on rate limits (up to 3 attempts)

### ✅ Quality Features
- **Ingredient validation** - ensures all ingredients have amounts
- **JSON validation** - validates LLM responses
- **Error handling** - continues on errors, logs failures
- **Sample output** - shows before/after examples

## Prerequisites

1. **Environment Setup**
   ```bash
   # Required environment variable
   OPENROUTER_API_KEY=sk-or-...
   ```

2. **Database Access**
   - Neon PostgreSQL connection configured
   - `DATABASE_URL` in `.env.local`

3. **Dependencies**
   ```bash
   pnpm install
   ```

## Quick Start

### 1. Test on Single Recipe (Recommended First Step)
```bash
# Dry run on 1 recipe
pnpm cleanup:content:test

# OR directly with npx
npx tsx scripts/cleanup-recipe-content.ts --limit=1
```

### 2. Test on Sample (10 Random Recipes)
```bash
# Dry run on 10 random recipes
pnpm cleanup:content:sample

# OR directly
npx tsx scripts/cleanup-recipe-content.ts --sample
```

### 3. Review Results
Check the output and the log file:
```bash
# View latest log
cat tmp/recipe-cleanup-log-*.json | jq '.'

# View latest backup
cat tmp/recipe-backup-*.json | jq '.'
```

### 4. Execute on All Recipes (Production Run)
```bash
# LIVE MODE - will update database
pnpm cleanup:content

# OR directly
npx tsx scripts/cleanup-recipe-content.ts --execute
```

## Usage

### Command Line Options

```bash
npx tsx scripts/cleanup-recipe-content.ts [OPTIONS]
```

**Options:**
- `--execute` - Apply changes to database (default is dry-run)
- `--limit=N` - Process only N recipes
- `--sample` - Process 10 random recipes
- (no options) - Dry run on all recipes

### NPM Scripts

```bash
# Dry run (default) - shows changes without saving
pnpm cleanup:content:dry-run

# Test on 5 recipes (dry run)
pnpm cleanup:content:test

# Test on 10 random recipes (dry run)
pnpm cleanup:content:sample

# Execute on all recipes (LIVE MODE)
pnpm cleanup:content
```

## Testing

### Phase 1: Local Testing (5-10 recipes)

```bash
# Test on 5 recipes
npx tsx scripts/cleanup-recipe-content.ts --limit=5

# Review output
# - Check title transformations
# - Verify ingredient amounts added
# - Confirm descriptions improved
```

**Expected Output:**
```
🧹 Recipe Content Cleanup Script
================================
Mode: DRY RUN (use --execute to apply changes)
Recipes to process: 5

✅ Backup saved to: /tmp/recipe-backup-2025-10-15T10-30-00.json

[1/5] Carrot Cake
  📝 Title: "carrot cake" → "Carrot Cake"
  ✅ Ingredients fixed: 3 amounts added
  📋 Sample changes (3 total):
     Before: "flour"
     After:  "2 cups all-purpose flour"
  ✓ Would update in database (dry run)
```

### Phase 2: Pilot Run (100 recipes)

```bash
# Execute on first 100 recipes
npx tsx scripts/cleanup-recipe-content.ts --limit=100 --execute

# Manually verify 10 random recipes in database
# Check logs for any errors
```

### Phase 3: Full Run (All Recipes)

```bash
# Process all recipes (will take ~5-6 hours for 3,282 recipes)
pnpm cleanup:content

# Monitor progress
# - Watch for rate limiting
# - Check success rate
# - Review error count
```

## Rollback

### Restore from Backup

If you need to undo changes:

```bash
# Rollback using latest backup
pnpm cleanup:rollback -- --latest

# OR rollback specific timestamp
pnpm cleanup:rollback -- 2025-10-15T10-30-00

# OR directly
npx tsx scripts/rollback-recipe-cleanup.ts --latest
```

**Rollback Process:**
1. Loads backup file
2. Restores original recipe data for each recipe
3. Updates `updatedAt` timestamp
4. Reports success/failure for each recipe

**Example Output:**
```
🔄 Recipe Cleanup Rollback Script
==================================
Backup file: /tmp/recipe-backup-2025-10-15T10-30-00.json

📦 Loaded 3,282 recipes from backup

[1/3282] Restoring: Carrot Cake
  ✅ Restored successfully

Summary:
  Successfully restored: 3,282
  Failed: 0

✨ Success rate: 100.0%
```

### List Available Backups

```bash
# List all backups
ls -lh tmp/recipe-backup-*.json

# View backup details
cat tmp/recipe-backup-2025-10-15T10-30-00.json | jq '.[0]'
```

## Technical Details

### LLM Prompt Template

The script uses this prompt structure:

```
You are a professional recipe editor. Clean up this recipe data:

RECIPE NAME: ${recipe.name}
DESCRIPTION: ${recipe.description}
SERVINGS: ${recipe.servings || 4}
CURRENT INGREDIENTS: ${JSON.stringify(ingredients)}

TASKS:
1. Fix title capitalization (Title Case)
2. Improve description grammar and clarity
3. **CRITICAL**: Ensure ALL ingredients have quantities

Return ONLY valid JSON:
{
  "name": "corrected title",
  "description": "improved description",
  "ingredients": ["properly formatted ingredients with amounts"]
}
```

### Processing Flow

1. **Fetch Recipes** - Load from database with optional limit/sample
2. **Create Backup** - Save original data to `tmp/recipe-backup-{timestamp}.json`
3. **Batch Processing** - Process 10 recipes per batch
4. **LLM Enhancement** - Call Gemini Flash with retry logic
5. **Validation** - Parse and validate JSON response
6. **Database Update** - Apply changes (if `--execute`)
7. **Save Log** - Write results to `tmp/recipe-cleanup-log-{timestamp}.json`

### Rate Limiting

- **Target**: 10 recipes per minute (6 seconds between batches)
- **Model**: `google/gemini-2.0-flash-exp:free`
- **Retry**: Up to 3 attempts with exponential backoff (10s, 20s)
- **Free Tier**: No cost, but rate limits apply

### File Locations

```
tmp/
├── recipe-backup-{timestamp}.json     # Original recipe data
└── recipe-cleanup-log-{timestamp}.json # Processing results
```

**Backup Format:**
```json
[
  {
    "id": "uuid",
    "name": "Recipe Name",
    "ingredients": "[\"ingredient 1\", \"ingredient 2\"]",
    // ... all recipe fields
  }
]
```

**Log Format:**
```json
{
  "timestamp": "2025-10-15T10-30-00",
  "stats": {
    "total": 3282,
    "processed": 3282,
    "titlesUpdated": 1456,
    "descriptionsUpdated": 2103,
    "ingredientsFixed": 8947,
    "recipesUpdated": 3200,
    "failed": 82,
    "errors": []
  },
  "results": [/* detailed results per recipe */],
  "errors": [/* error details */]
}
```

## Troubleshooting

### Rate Limiting Errors

**Symptom:**
```
⏳ Rate limit hit, waiting 10s (attempt 1/3)...
```

**Solution:** The script automatically retries up to 3 times. If it continues failing:
1. Increase wait time in script (modify `waitSeconds` multiplier)
2. Reduce batch size from 10 to 5
3. Check OpenRouter API status

### Invalid JSON Response

**Symptom:**
```
✗ Error: Invalid response format: missing required fields
```

**Solution:**
1. Check LLM response in logs
2. Verify recipe data isn't corrupted
3. Skip problematic recipe and continue
4. The script will log the error and continue

### Network Errors

**Symptom:**
```
✗ Error: Network request failed
```

**Solution:**
1. Check internet connection
2. Verify `OPENROUTER_API_KEY` is valid
3. Check OpenRouter service status
4. Retry the script - it will resume from backup

### Out of Memory

**Symptom:**
```
JavaScript heap out of memory
```

**Solution:**
1. Use `--limit` to process in smaller batches
2. Increase Node.js memory: `NODE_OPTIONS=--max-old-space-size=4096 pnpm cleanup:content`

### Database Connection Issues

**Symptom:**
```
Error: Database connection failed
```

**Solution:**
1. Verify `DATABASE_URL` in `.env.local`
2. Check Neon database is accessible
3. Test connection: `pnpm db:studio`

## Success Criteria

- ✅ 100% of processed recipes have ingredient amounts
- ✅ Titles are properly capitalized (Title Case)
- ✅ Descriptions are grammatically correct and engaging
- ✅ Changes are logged and reversible via backup
- ✅ No API throttling or blocking
- ✅ 95%+ success rate (allowing for edge cases)

## Performance Metrics

**For 3,282 recipes:**
- **Estimated Time**: 5-6 hours (at 10 recipes/minute)
- **API Calls**: 3,282 LLM requests
- **Cost**: $0 (using FREE Gemini Flash model)
- **Backups**: ~2-3 MB per backup file
- **Logs**: ~1-2 MB per log file

## Best Practices

1. **Always test first** - Run on 5-10 recipes before full run
2. **Review samples** - Check output quality before executing
3. **Monitor progress** - Watch for errors and rate limits
4. **Keep backups** - Don't delete backup files until verified
5. **Verify results** - Manually check 10-20 random recipes after completion
6. **Rollback if needed** - Don't hesitate to restore from backup

## Example Session

```bash
# 1. Test on 5 recipes
npx tsx scripts/cleanup-recipe-content.ts --limit=5

# Output: Review transformations
# ✅ Looks good!

# 2. Test on 10 random recipes
npx tsx scripts/cleanup-recipe-content.ts --sample

# Output: Check variety of recipe types
# ✅ Looks good!

# 3. Execute on all recipes
npx tsx scripts/cleanup-recipe-content.ts --execute

# Wait 5-6 hours...
# ✅ Processing complete!
# Success rate: 97.5%
# Ingredients fixed: 8,947

# 4. Verify in database
pnpm db:studio
# Check random recipes manually

# 5. If issues found, rollback
npx tsx scripts/rollback-recipe-cleanup.ts --latest
```

## Support

For issues or questions:
1. Check this guide first
2. Review script output and logs
3. Check `tmp/recipe-cleanup-log-*.json` for details
4. Consult `CLAUDE.md` for project context

---

**Last Updated**: 2025-10-15
**Script Version**: 1.0.0
**Status**: Ready for Production Use
