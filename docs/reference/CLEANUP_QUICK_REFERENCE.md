# Recipe Content Cleanup - Quick Reference

## 🚀 Quick Commands

```bash
# Test on 5 recipes (dry run)
pnpm cleanup:content:test

# Test on 10 random recipes (dry run)
pnpm cleanup:content:sample

# Dry run on all recipes (preview only)
pnpm cleanup:content:dry-run

# Execute on all recipes (LIVE - updates database)
pnpm cleanup:content

# Rollback latest changes
pnpm cleanup:rollback -- --latest

# Rollback specific timestamp
pnpm cleanup:rollback -- 2025-10-15T10-30-00
```

## 📋 NPM Script Reference

| Command | Description | Mode |
|---------|-------------|------|
| `pnpm cleanup:content:test` | Test on 5 recipes | Dry run |
| `pnpm cleanup:content:sample` | Test on 10 random | Dry run |
| `pnpm cleanup:content:dry-run` | Preview all changes | Dry run |
| `pnpm cleanup:content` | **Execute cleanup** | **LIVE** |
| `pnpm cleanup:rollback` | Restore from backup | LIVE |

## 🎯 Direct Script Usage

```bash
# Full control with options
npx tsx scripts/cleanup-recipe-content.ts [OPTIONS]

OPTIONS:
  --execute       Apply changes to database
  --limit=N       Process only N recipes
  --sample        Process 10 random recipes
  (no options)    Dry run on all recipes

EXAMPLES:
  # Dry run on 1 recipe
  npx tsx scripts/cleanup-recipe-content.ts --limit=1

  # Execute on first 100 recipes
  npx tsx scripts/cleanup-recipe-content.ts --limit=100 --execute

  # Test on 10 random recipes
  npx tsx scripts/cleanup-recipe-content.ts --sample

  # Execute on all recipes
  npx tsx scripts/cleanup-recipe-content.ts --execute
```

## 📊 What Gets Fixed

| Issue | Before | After |
|-------|--------|-------|
| Missing amounts | `"flour"` | `"2 cups all-purpose flour"` |
| Missing amounts | `"chicken"` | `"1 lb chicken breast, diced"` |
| Title case | `"carrot cake"` | `"Carrot Cake"` |
| Description | Short, bland | Engaging, grammatically correct |

## 📁 Generated Files

```
tmp/
├── recipe-backup-{timestamp}.json     # Backup for rollback
└── recipe-cleanup-log-{timestamp}.json # Processing results
```

**View files:**
```bash
# List all backups
ls -lh tmp/recipe-backup-*.json

# View latest log
cat tmp/recipe-cleanup-log-*.json | jq '.'

# View latest backup
cat tmp/recipe-backup-*.json | jq '.[0]'
```

## ⏱️ Performance

| Recipes | Estimated Time | Rate |
|---------|---------------|------|
| 1 | ~30-40 seconds | - |
| 10 | ~1-2 minutes | 10/min |
| 100 | ~10-12 minutes | 10/min |
| 1,000 | ~1.5-2 hours | 10/min |
| 3,282 | ~5-6 hours | 10/min |

## ✅ Success Indicators

**Look for:**
- ✅ `Ingredients fixed: X amounts added`
- ✅ `Success rate: >95%`
- ✅ Backup and log files created
- ✅ No fatal errors

**Warning signs:**
- ⚠️ `Failed: X` (high failure count)
- ⚠️ Multiple rate limit retries
- ⚠️ Invalid JSON responses
- ⚠️ Database connection errors

## 🔄 Rollback Process

```bash
# 1. List available backups
ls -lh tmp/recipe-backup-*.json

# 2. Rollback latest
npx tsx scripts/rollback-recipe-cleanup.ts --latest

# 3. OR rollback specific timestamp
npx tsx scripts/rollback-recipe-cleanup.ts 2025-10-15T10-30-00

# 4. Verify in database
pnpm db:studio
```

## 🎬 Recommended Workflow

### First Time Use

1. **Test small** (5 recipes)
   ```bash
   pnpm cleanup:content:test
   ```

2. **Test random** (10 recipes)
   ```bash
   pnpm cleanup:content:sample
   ```

3. **Review output** - Check transformations look good

4. **Pilot run** (100 recipes)
   ```bash
   npx tsx scripts/cleanup-recipe-content.ts --limit=100 --execute
   ```

5. **Verify manually** - Check 10-20 random recipes in DB

6. **Full run** (all recipes)
   ```bash
   pnpm cleanup:content
   ```

### If Issues Found

1. **Stop the script** (Ctrl+C if running)

2. **Review logs**
   ```bash
   cat tmp/recipe-cleanup-log-*.json | jq '.errors'
   ```

3. **Rollback if needed**
   ```bash
   pnpm cleanup:rollback -- --latest
   ```

4. **Fix issues** - Adjust script if needed

5. **Retry** - Run again

## 🛠️ Troubleshooting

| Issue | Solution |
|-------|----------|
| Rate limits | Wait and retry, script handles automatically |
| Invalid JSON | Check logs, skip problematic recipes |
| Network errors | Check internet, verify API key |
| Out of memory | Use `--limit` to process smaller batches |
| DB connection | Verify `DATABASE_URL` in `.env.local` |

## 📞 Need Help?

1. Check full guide: `docs/guides/RECIPE_CONTENT_CLEANUP_GUIDE.md`
2. Review test results: `docs/reference/CLEANUP_TEST_RESULTS.md`
3. Check logs: `tmp/recipe-cleanup-log-*.json`
4. Project docs: `CLAUDE.md`

## 🎯 Key Points

- ✅ **Always test first** - Use dry run mode
- ✅ **Backups are automatic** - Created before any changes
- ✅ **Rollback available** - Easy to undo changes
- ✅ **Free to use** - Gemini Flash model is FREE
- ✅ **Safe to run** - Comprehensive error handling

---

**Quick Start**: Run `pnpm cleanup:content:test` to try it now!
