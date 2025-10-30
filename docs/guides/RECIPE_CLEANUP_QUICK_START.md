# Recipe Content Cleanup - Quick Start Guide

Fast reference for running the recipe content cleanup system.

---

## Prerequisites

### Install Ollama (for LLM cleanup)

```bash
# macOS
brew install ollama

# Or download from: https://ollama.ai

# Start Ollama service
ollama serve

# Pull model (in another terminal)
ollama pull llama3.2
```

---

## Quick Commands

### 1. Detect Issues

```bash
# Scan all recipes for content issues
pnpm cleanup:detect

# Verbose output (shows all issues)
pnpm cleanup:detect:verbose
```

**Output**: `tmp/recipe-content-issues.json`

### 2. Review Report

```bash
# Summary stats
cat tmp/recipe-content-issues.json | jq '{total: .totalRecipes, withIssues: .recipesWithIssues, issuesByType: .issuesByType}'

# List affected recipe IDs
cat tmp/recipe-content-issues.json | jq -r '.affectedRecipes[].recipeId' | head -10
```

### 3. Test Single Recipe

```bash
# Dry-run on one recipe
pnpm cleanup:llm:recipe=<recipe-uuid>
```

### 4. Preview All Changes

```bash
# Dry-run (no database changes)
pnpm cleanup:llm:dry-run
```

### 5. Apply Cleanup

```bash
# Full cleanup (regex + LLM)
pnpm cleanup:llm

# Regex-only (faster, no LLM)
pnpm cleanup:llm:regex-only
```

---

## Current Status (Latest Scan)

- **Total Recipes**: 4,660
- **Recipes with Issues**: 631 (13.5%)
- **Total Issues**: 955

### Top Issues Found

1. **Temperature formatting**: 359 recipes (e.g., `350 degrees` → `350°F`)
2. **Extra brackets**: 325 recipes (e.g., `[olive oil]` → `olive oil`)
3. **Missing spaces**: 83 recipes (e.g., `2cups` → `2 cups`)
4. **URLs in content**: 18 recipes (removed)
5. **Whitespace**: 144 recipes (multiple/trailing/leading spaces)

---

## Common Workflows

### Full Cleanup (Recommended)

```bash
# 1. Scan
pnpm cleanup:detect

# 2. Test one
pnpm cleanup:llm:recipe=<id>

# 3. Preview all
pnpm cleanup:llm:dry-run

# 4. Apply
pnpm cleanup:llm

# 5. Verify
pnpm cleanup:detect
```

### Fast Regex-Only Cleanup

```bash
# Detect
pnpm cleanup:detect

# Apply regex fixes only (no LLM)
pnpm cleanup:llm:regex-only

# Verify
pnpm cleanup:detect
```

---

## Safety Features

- ✅ **Automatic Backup**: Created before any changes (`tmp/recipe-backup-YYYYMMDD.json`)
- ✅ **Dry-Run Mode**: Preview all changes first
- ✅ **Validation**: LLM output checked before applying
- ✅ **Fallback**: Original content used if LLM fails

---

## Issue Types Detected

### 🔴 High Severity (107 issues)
- Missing spaces after numbers: `2cups` → `2 cups`
- HTTP/HTTPS URLs: Removed entirely
- HTML tags: `<tag>` → Removed
- Encoding issues: `â€™` → `'`

### 🟡 Medium Severity (339 issues)
- Extra brackets: `[ingredient]` → `ingredient`
- Markdown formatting: `**bold**` → `bold`
- Amazon links: Removed

### 🟢 Low Severity (509 issues)
- Temperature formatting: `350 degrees` → `350°F`
- Multiple spaces: Collapsed to single
- Trailing/leading spaces: Removed

---

## Troubleshooting

### Ollama Not Running

```bash
# Start Ollama
ollama serve

# Verify model installed
ollama list

# Pull model if needed
ollama pull llama3.2
```

### Check Script Status

```bash
# Verify scripts exist
ls -lh scripts/detect-recipe-issues.ts
ls -lh scripts/cleanup-recipes-local-llm.ts

# Check report exists
ls -lh tmp/recipe-content-issues.json
```

### View Backup Files

```bash
# List backups
ls -lh tmp/recipe-backup-*.json

# View backup (first recipe)
cat tmp/recipe-backup-20251023.json | jq '.[0]'
```

---

## Documentation

- **Full Guide**: `docs/guides/RECIPE_CONTENT_CLEANUP.md`
- **Summary**: `tmp/RECIPE_CLEANUP_SUMMARY.md`
- **Report**: `tmp/recipe-content-issues.json`

---

**Quick Reference Card** | Created: October 23, 2025
