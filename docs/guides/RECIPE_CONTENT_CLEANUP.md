# Recipe Content Cleanup Guide

Comprehensive system for detecting and fixing content quality issues in recipes using regex patterns and local LLM processing.

## Quick Start

### 1. Detect Issues

```bash
# Run detection scan (generates report)
pnpm cleanup:detect

# Run with verbose output (see all issues during scan)
pnpm cleanup:detect:verbose
```

**Output**: Creates `tmp/recipe-content-issues.json` with detailed issue report.

### 2. Review Report

The detection script generates a comprehensive report showing:
- Total recipes scanned
- Recipes with issues (count and percentage)
- Issues by severity (high/medium/low)
- Issues by type (top 10 most common)
- Sample affected recipes with examples

### 3. Clean Up Issues

**Prerequisites**: Install and run Ollama with llama3.2 model:

```bash
# Install Ollama (if not already installed)
# macOS: brew install ollama
# Or download from: https://ollama.ai

# Start Ollama service
ollama serve

# Pull required model (in another terminal)
ollama pull llama3.2
```

**Run cleanup**:

```bash
# Dry run (preview changes without applying)
pnpm cleanup:llm:dry-run

# Apply changes to all recipes with issues
pnpm cleanup:llm

# Clean up specific recipe by ID
pnpm cleanup:llm:recipe=<recipe-uuid>

# Regex-only cleanup (skip LLM processing)
pnpm cleanup:llm:regex-only
```

## Issue Types Detected

### 🔴 High Severity Issues

#### Missing Spaces After Numbers
- **Pattern**: `2cups`, `500g`, `1tablespoon`
- **Fix**: Add space between number and unit → `2 cups`, `500 g`, `1 tablespoon`
- **Impact**: Affects readability and parsing

#### Missing Spaces After Fractions
- **Pattern**: `½teaspoon`, `¼cup`
- **Fix**: Add space → `½ teaspoon`, `¼ cup`

#### HTTP/HTTPS URLs
- **Pattern**: `https://example.com/recipe`, `http://chef-site.com/image.png`
- **Fix**: Remove URLs entirely (they don't belong in recipe content)
- **Common Sources**: Imported recipes with embedded links

#### HTML Tags
- **Pattern**: `<strong>`, `<p>`, `<br/>`, `<img>`
- **Fix**: Remove HTML markup
- **Common Sources**: Imported recipes from web scraping

#### Encoding Issues - Apostrophes
- **Pattern**: `â€™` (should be `'`)
- **Fix**: Replace with proper apostrophe character
- **Example**: `donâ€™t` → `don't`

#### Encoding Issues - Dashes
- **Pattern**: `â€"` (should be `—`)
- **Fix**: Replace with proper em-dash
- **Example**: `5â€"10 minutes` → `5—10 minutes`

#### Encoding Issues - Quotes
- **Pattern**: `â€œ`, `â€` (should be `"`)
- **Fix**: Replace with proper quote marks

### 🟡 Medium Severity Issues

#### Extra Brackets
- **Pattern**: `[ingredient name]`, `[extra-virgin olive oil]`
- **Fix**: Remove brackets → `ingredient name`, `extra-virgin olive oil`
- **Common Sources**: Recipe import artifacts

#### Amazon/Affiliate Links
- **Pattern**: `amzn.to/xyz123`, `amazon.com/product/...`
- **Fix**: Remove affiliate links
- **Why**: No commercial links in recipe content

#### URL Fragments
- **Pattern**: `PH3 OGV` (postal codes/link remnants)
- **Fix**: Remove or LLM contextual cleanup

#### Markdown Bold Formatting
- **Pattern**: `**text**`
- **Fix**: Remove Markdown syntax → `text`

#### Markdown Italic Formatting
- **Pattern**: `__text__`
- **Fix**: Remove Markdown syntax → `text`

#### Markdown Headers
- **Pattern**: `# Header`, `## Subheader`
- **Fix**: Remove header symbols

#### Ellipsis Encoding Issues
- **Pattern**: `â€¦` (should be `...`)
- **Fix**: Replace with proper ellipsis

### 🟢 Low Severity Issues

#### Multiple Consecutive Spaces
- **Pattern**: Multiple spaces between words
- **Fix**: Collapse to single space

#### Trailing Spaces
- **Pattern**: Spaces at end of lines
- **Fix**: Remove trailing whitespace

#### Leading Spaces
- **Pattern**: Spaces at start of lines
- **Fix**: Remove leading whitespace

#### Mixed Bullet Points
- **Pattern**: Inconsistent use of `•`, `-`, `*` bullets
- **Fix**: Standardize bullet style (LLM handles context)

#### Temperature Without Degree Symbol
- **Pattern**: `350 F`, `180 C`, `400 degrees`
- **Fix**: Standardize to `350°F`, `180°C`, `400°F`

#### Checkbox Symbols
- **Pattern**: `▢` (checkbox from imported recipes)
- **Fix**: Remove checkbox symbols

## Detection Script Details

**File**: `scripts/detect-recipe-issues.ts`

### Features

1. **Pattern-Based Detection**: Uses 20+ regex patterns to identify common issues
2. **Severity Classification**: Categorizes issues as high/medium/low priority
3. **Detailed Reporting**: Generates JSON report with full issue inventory
4. **Sample Output**: Shows 5 sample recipes with detected issues
5. **Fast Scanning**: Processes all 4,660+ recipes in seconds

### Output Format

```json
{
  "totalRecipes": 4660,
  "recipesWithIssues": 631,
  "issuesByType": {
    "missing_space_after_number": 83,
    "extra_brackets": 325,
    ...
  },
  "issuesBySeverity": {
    "high": 107,
    "medium": 339,
    "low": 509
  },
  "affectedRecipes": [
    {
      "recipeId": "uuid",
      "recipeName": "Recipe Name",
      "issueType": "missing_space_after_number",
      "severity": "high",
      "location": "ingredients",
      "matches": ["2cups", "500g"],
      "context": "Missing space between number and unit"
    }
  ]
}
```

## Cleanup Script Details

**File**: `scripts/cleanup-recipes-local-llm.ts`

### Two-Phase Cleanup Strategy

#### Phase 1: Regex-Based Fixes (Fast, Deterministic)

Simple pattern replacements:
- Add spaces after numbers/fractions
- Remove brackets, URLs, HTML tags
- Fix encoding issues
- Clean whitespace

**Advantages**:
- Instant execution
- 100% predictable
- No API costs
- Works offline

#### Phase 2: LLM-Based Cleanup (Smart, Context-Aware)

Uses local Ollama LLM for:
- Complex formatting issues
- Contextual cleanup (e.g., when to keep vs. remove parentheses)
- Instruction rewording (preserving meaning)
- Ingredient standardization

**Advantages**:
- Understands context
- Handles edge cases
- Preserves recipe meaning
- No cloud API costs (runs locally)

### Safety Features

1. **Automatic Backup**: Creates timestamped backup before any changes
   - Format: `tmp/recipe-backup-YYYYMMDD.json`
   - Contains full recipe data pre-cleanup

2. **Dry Run Mode**: Preview all changes before applying
   - Shows before/after for every change
   - Displays change counts by type

3. **Single Recipe Testing**: Test cleanup on one recipe first
   - Use `--recipe-id=<uuid>` flag
   - Verify LLM behavior before batch processing

4. **Validation Checks**: Ensures LLM doesn't hallucinate
   - Verifies same number of items returned
   - Falls back to original if LLM output is invalid

### Ollama Configuration

**Default Model**: `llama3.2` (fast, accurate for text cleanup)

**Alternative Models**:
- `qwen2.5`: Better for non-English recipes
- `llama3.1`: More advanced reasoning
- `mistral`: Faster but less accurate

**Change Model**: Edit `OLLAMA_MODEL` constant in `cleanup-recipes-local-llm.ts`

### Performance

- **Regex Phase**: ~100-200 recipes/second
- **LLM Phase**: ~2-5 recipes/second (depends on content length)
- **Estimated Time** (631 affected recipes):
  - Regex only: ~5-10 seconds
  - Regex + LLM: ~3-5 minutes

## Common Workflows

### Workflow 1: Full Cleanup (Recommended)

```bash
# 1. Detect issues
pnpm cleanup:detect

# 2. Review report
cat tmp/recipe-content-issues.json | jq '.issuesByType'

# 3. Test on single recipe
pnpm cleanup:llm:recipe=<recipe-id>

# 4. Dry run to preview all changes
pnpm cleanup:llm:dry-run

# 5. Apply cleanup
pnpm cleanup:llm
```

### Workflow 2: Regex-Only Cleanup (Fast)

For simple fixes without LLM overhead:

```bash
# Detect issues
pnpm cleanup:detect

# Apply regex fixes only
pnpm cleanup:llm:regex-only
```

### Workflow 3: Incremental Cleanup

Process recipes in batches to monitor quality:

```bash
# Get list of affected recipe IDs
cat tmp/recipe-content-issues.json | jq -r '.affectedRecipes[0:10][].recipeId'

# Process each one individually
pnpm cleanup:llm:recipe=<id-1>
pnpm cleanup:llm:recipe=<id-2>
# etc.
```

### Workflow 4: Re-scan After Cleanup

Verify cleanup effectiveness:

```bash
# Run cleanup
pnpm cleanup:llm

# Re-scan for remaining issues
pnpm cleanup:detect

# Check if issue count decreased
cat tmp/recipe-content-issues.json | jq '{total: .totalRecipes, withIssues: .recipesWithIssues}'
```

## Current Status (Latest Scan)

**Scan Date**: October 23, 2025

### Summary Statistics

- **Total Recipes**: 4,660
- **Recipes with Issues**: 631 (13.5%)
- **Total Issues Found**: 955

### Issues by Severity

- 🔴 **High**: 107 issues
  - `missing_space_after_number`: 83
  - `http_urls`: 18
  - `html_tags`: 4
  - `missing_space_fraction`: 2

- 🟡 **Medium**: 339 issues
  - `extra_brackets`: 325
  - `markdown_bold`: 13
  - `markdown_headers`: 1

- 🟢 **Low**: 509 issues
  - `degree_symbol_issues`: 359
  - `multiple_spaces`: 59
  - `leading_spaces`: 44
  - `trailing_spaces`: 41
  - `mixed_bullets`: 6

### Most Common Issues (Top 5)

1. **Temperature formatting** (359): `350 degrees` → `350°F`
2. **Extra brackets** (325): `[olive oil]` → `olive oil`
3. **Missing spaces** (83): `2cups` → `2 cups`
4. **Multiple spaces** (59): Whitespace cleanup
5. **Leading spaces** (44): Indentation cleanup

## Sample Issues Found

### Example 1: Missing Spaces

**Recipe**: No-Waste Tacos de Carnitas With Salsa Verde

**Issues**:
- `8g` → `8 g`
- `60ml` → `60 ml`
- `7kg` → `7 kg`

### Example 2: URLs in Content

**Recipe**: Montasio Cheese Crisps with Potato and Onion Filling - Lidia

**Issues**:
- `https://lidiasitaly.com/recipes/potato-onion-filling/)`
- `https://lidiasitaly.com/wp-content/themes/lidia/img/signature.png)`

**Fix**: Remove URLs entirely

### Example 3: Extra Brackets

**Recipe**: Stuffed Bell Peppers with Quinoa and Black Beans

**Issues**:
- Ingredients contain `[object Object]` artifacts
- Extra brackets around ingredient names

### Example 4: Temperature Formatting

**Recipe**: York Peppermint Patty Brownies

**Issues**:
- `350 degrees` → `350°F`
- Inconsistent temperature formatting

## Troubleshooting

### Ollama Not Available

**Error**: `❌ Ollama is required but not available`

**Solutions**:
1. Install Ollama: `brew install ollama` (macOS)
2. Start service: `ollama serve`
3. Pull model: `ollama pull llama3.2`
4. Verify: `curl http://localhost:11434/api/tags`

### LLM Returning Wrong Number of Items

**Error**: `⚠️ LLM returned X items, expected Y. Using original.`

**Causes**:
- LLM hallucination (added/removed items)
- Parsing error in response

**Solution**:
- Script automatically falls back to original
- No data loss
- Try different model if persistent

### Cleanup Too Slow

**Issue**: LLM phase taking too long

**Solutions**:
1. Use `--llm-only` flag to skip LLM processing
2. Process recipes in smaller batches
3. Use faster model (edit `OLLAMA_MODEL` constant)
4. Upgrade Ollama hardware (more RAM/CPU)

### Changes Not Applied

**Issue**: Dry run completed but database unchanged

**Cause**: Missing `--apply` flag

**Solution**: Use `pnpm cleanup:llm` (includes --apply flag)

## Backup & Recovery

### Automatic Backups

Every cleanup run (with `--apply`) creates automatic backup:
- Location: `tmp/recipe-backup-YYYYMMDD.json`
- Contains: Full recipe data before cleanup
- Format: JSON array of recipe objects

### Manual Restoration

To restore from backup:

```bash
# List backups
ls -lh tmp/recipe-backup-*.json

# Restore specific backup (manual process)
# 1. Review backup file
cat tmp/recipe-backup-20251023.json | jq '.[0]'

# 2. Write restoration script if needed
# (No automatic restoration script yet - manual DB update required)
```

## Integration with Existing Cleanup Scripts

This system complements existing cleanup tools:

- **`cleanup:content`**: General content cleanup (existing)
- **`cleanup:detect`**: NEW - Pattern-based issue detection
- **`cleanup:llm`**: NEW - LLM-powered cleanup
- **`fix:capitalization`**: Ingredient capitalization fixes (existing)
- **`ingredients:normalize`**: Ingredient normalization (existing)

**Recommended Order**:
1. Run `cleanup:detect` to identify issues
2. Run `cleanup:llm` to fix content issues
3. Run `fix:capitalization` for capitalization
4. Run `ingredients:normalize` for ingredient standardization

## Future Enhancements

### Planned Improvements

1. **Custom Regex Patterns**: Allow user-defined patterns via config file
2. **Severity Tuning**: Adjustable severity thresholds
3. **Automatic Restoration**: Script to restore from backup
4. **Incremental Processing**: Resume from last processed recipe
5. **Report Comparison**: Diff reports before/after cleanup
6. **Web UI**: Visual interface for reviewing/approving changes

### Potential LLM Enhancements

1. **Recipe Validation**: Check for logical errors (e.g., "bake for -5 minutes")
2. **Nutritional Estimation**: Auto-calculate missing nutrition info
3. **Ingredient Substitutions**: Suggest alternatives for dietary restrictions
4. **Recipe Standardization**: Normalize cooking terminology

## Related Documentation

- **Project Organization**: `docs/reference/PROJECT_ORGANIZATION.md`
- **Database Schema**: `src/lib/db/schema.ts`
- **Ingredient Consolidation**: `docs/reference/INGREDIENT_CONSOLIDATION.md`
- **Main README**: `README.md`

---

**Last Updated**: October 23, 2025
**Version**: 1.0.0
**Maintainer**: Joanie's Kitchen Team
