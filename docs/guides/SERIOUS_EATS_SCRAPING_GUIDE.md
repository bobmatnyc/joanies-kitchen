# Serious Eats Top 50 Recipe Scraping Guide

Complete guide to scraping iconic Serious Eats recipes and importing them into Joanie's Kitchen.

## 📋 Overview

This guide covers the complete workflow for scraping 50 curated Serious Eats recipes using the `recipe-scrapers` library and importing them as system recipes.

**Cost**: $0 (no LLM parsing, uses Schema.org JSON-LD)
**Success Rate Target**: ≥ 90% (45+ recipes)
**Time**: ~3-5 minutes (2s rate limit between requests)

## 🎯 Recipe Selection

The curated list includes 50 iconic recipes:

- **20 recipes from J. Kenji López-Alt** (The Food Lab)
  - Pizza, burgers, steaks, chicken, pasta
  - Science-based cooking techniques
  - Most-clicked Serious Eats recipes

- **15 recipes from Daniel Gritzer** (Culinary Director)
  - Classic dishes: pasta, ramen, bread
  - Professional techniques
  - International cuisines

- **15 recipes from Stella Parks** (BraveTart)
  - American desserts and baking
  - Cookies, cakes, brownies, pies
  - Better-than-store-bought classics

## 🚀 Quick Start

### 1. Test the Scraper (3 recipes)

```bash
# Activate virtual environment
source venv/bin/activate

# Run test with first 3 recipes
python scripts/test-serious-eats-scraper.py
```

**Expected Output**:
```
✅ Scraped successfully: 3/3
✅ Validated successfully: 3/3
🎉 All test recipes scraped successfully!
```

### 2. Run Full Scraper (50 recipes)

```bash
# Run production scraper
python scripts/ingest-serious-eats-top50.py
```

**Expected Duration**: ~3-5 minutes (2s between requests)

**Output Files**:
- `data/recipes/incoming/serious-eats/top50-raw.json` - Raw scraped data
- `data/recipes/incoming/serious-eats/top50-transformed.json` - Database-ready JSON
- `tmp/serious-eats-scraping-log-[timestamp].txt` - Detailed log
- `tmp/serious-eats-errors-[timestamp].txt` - Error log

### 3. Import to Database

```bash
# Import recipes to PostgreSQL
npx tsx scripts/import-serious-eats-recipes.ts
```

**Expected Output**:
```
✅ Successfully inserted: 48/50
📊 Recipe Statistics:
   - With images: 48
   - With prep time: 45
   - With cook time: 46
   - With servings: 47
```

### 4. Verify Import

```bash
# Open Drizzle Studio
pnpm db:studio

# Filter recipes:
# is_system_recipe = true
# Expected: 50 new system recipes
```

## 📁 File Structure

```
recipe-manager/
├── scripts/
│   ├── serious-eats-top50-urls.json          # Curated recipe URLs
│   ├── ingest-serious-eats-top50.py          # Production scraper
│   ├── test-serious-eats-scraper.py          # Quick test (3 recipes)
│   ├── import-serious-eats-recipes.ts        # Database import
│   └── README_SERIOUS_EATS_SCRAPER.md        # Detailed docs
├── data/recipes/incoming/serious-eats/
│   ├── top50-raw.json                        # Raw scraped data
│   └── top50-transformed.json                # Database-ready JSON
├── tmp/
│   ├── serious-eats-scraping-log-*.txt       # Execution logs
│   └── serious-eats-errors-*.txt             # Error logs
└── docs/guides/
    └── SERIOUS_EATS_SCRAPING_GUIDE.md        # This file
```

## 🗄️ Database Schema Mapping

### Raw Scraper Output → Database Schema

```python
# recipe-scrapers extraction
{
  "title": "Foolproof Pan Pizza",
  "author": "J. Kenji López-Alt",
  "description": "A thick-crust pizza...",
  "ingredients": ["2 cups flour", "1 tsp salt", ...],
  "instructions": "Step 1: Mix flour...",
  "prep_time": 25,         # minutes
  "cook_time": 20,         # minutes
  "yields": "8 servings",
  "image": "https://...",
  "category": "Pizza",
  "cuisine": "Italian-American"
}

# Transformed to database schema
{
  "id": "uuid",
  "user_id": "system",
  "name": "Foolproof Pan Pizza",
  "description": "A thick-crust pizza...",
  "ingredients": "[\"2 cups flour\", \"1 tsp salt\", ...]",  # JSON array
  "instructions": "Step 1: Mix flour...",                   # Plain text
  "prep_time": 25,
  "cook_time": 20,
  "servings": 8,           # Parsed from "8 servings"
  "cuisine": "Italian-American",
  "tags": "[\"Pizza\"]",   # JSON array from category
  "images": "[\"https://...\"]",  # JSON array
  "is_public": true,
  "is_system_recipe": true,
  "source": "https://www.seriouseats.com/foolproof-pan-pizza-recipe"
}
```

### Key Transformations

1. **Ingredients**: Array of strings → JSON string
2. **Instructions**: Plain text (not array)
3. **Servings**: Parsed from yields ("8 servings" → 8)
4. **Tags**: Category converted to JSON array
5. **Images**: Single image URL → JSON array with one element
6. **User ID**: Always "system" for system recipes
7. **System Recipe**: Always true

## ✅ Quality Validation

Each recipe is validated for:

### Required Fields
- ✅ Name present and non-empty
- ✅ Ingredients array not empty
- ✅ Instructions not empty (minimum 50 characters)
- ✅ At least one image URL
- ✅ Source URL present

### Data Quality
- ✅ Valid JSON for ingredients/tags/images
- ✅ Instructions meaningful length
- ✅ Servings parsed correctly from yields
- ✅ Times in minutes (if available)

### Common Issues & Resolutions

| Issue | Resolution |
|-------|------------|
| No ingredients | Flag for manual review |
| Instructions too short | Flag but include |
| Missing image | Flag but include |
| Missing prep/cook time | Acceptable (nullable) |
| Missing servings | Acceptable (nullable) |

Recipes with validation issues are flagged in `_validation_issues` but still included in output.

## 🔧 Configuration

### Rate Limiting

```python
# scripts/ingest-serious-eats-top50.py
RATE_LIMIT_SECONDS = 2      # Wait time between requests
MAX_RETRIES = 3             # Number of retry attempts
RETRY_BACKOFF = 2           # Exponential backoff multiplier
```

**Recommended Settings**:
- Normal: 2 seconds (respectful, fast)
- Conservative: 3-5 seconds (safer if blocked)
- Aggressive: 1 second (not recommended)

### Error Handling

```python
# Automatic retries with exponential backoff
# Attempt 1: Immediate
# Attempt 2: Wait 2 seconds
# Attempt 3: Wait 4 seconds
# After 3 failures: Skip recipe, log error
```

## 📊 Expected Results

### Success Metrics

| Metric | Target | Typical |
|--------|--------|---------|
| Scrape Success Rate | ≥ 90% | 95-98% |
| Validation Pass Rate | ≥ 90% | 95-100% |
| With Images | ≥ 95% | 100% |
| With Prep Time | ≥ 80% | 90-95% |
| With Cook Time | ≥ 80% | 90-95% |
| With Servings | ≥ 80% | 95-98% |

### Sample Output

```
📊 Scraping Results:
  ✅ Successful: 48/50 (96.0%)
  ❌ Failed: 2/50

📊 Validation Results:
  ✅ Valid: 47/48

📊 Quality Checks:
  With images: 48/48
  With prep time: 45/48
  With cook time: 46/48
  With servings: 47/48

🎉 SUCCESS! Scraping complete with 90%+ success rate
```

## 🔍 Troubleshooting

### Common Issues

#### 1. Virtual Environment Not Activated

**Symptom**: `ModuleNotFoundError: No module named 'recipe_scrapers'`

**Solution**:
```bash
source venv/bin/activate
pip list | grep recipe-scrapers
```

#### 2. 404 Errors (Recipe Not Found)

**Symptom**: Multiple 404 errors in log

**Solution**:
1. Check error log: `cat tmp/serious-eats-errors-*.txt`
2. Update URLs in `scripts/serious-eats-top50-urls.json`
3. Find replacement recipes on Serious Eats
4. Rerun scraper

#### 3. Rate Limiting / Blocked

**Symptom**: Multiple connection errors or timeouts

**Solution**:
```python
# Increase rate limit in ingest-serious-eats-top50.py
RATE_LIMIT_SECONDS = 5  # More conservative
```

Run during off-peak hours (late night, early morning).

#### 4. Low Success Rate (< 90%)

**Symptom**: Many failed scrapes

**Diagnosis**:
```bash
# Check error log for patterns
cat tmp/serious-eats-errors-*.txt

# Common patterns:
# - Network errors: Check internet connection
# - 404s: Update URLs
# - Timeouts: Increase rate limit
# - Parser failures: Update recipe-scrapers
```

**Solution**:
```bash
# Update recipe-scrapers
pip install --upgrade recipe-scrapers

# Retry failed recipes only
# (manually edit serious-eats-top50-urls.json to include only failed URLs)
python scripts/ingest-serious-eats-top50.py
```

#### 5. Database Import Fails

**Symptom**: Error during `import-serious-eats-recipes.ts`

**Solution**:
```bash
# Verify database connection
pnpm db:studio

# Check transformed JSON is valid
cat data/recipes/incoming/serious-eats/top50-transformed.json | jq '.[0]'

# Verify schema matches
cat src/lib/db/schema.ts | grep "export const recipes"
```

## 🎯 Best Practices

### Pre-Run Checklist

- [ ] Virtual environment activated
- [ ] `recipe-scrapers` installed (v15.9.0+)
- [ ] Database connection verified (`pnpm db:studio`)
- [ ] Internet connection stable
- [ ] Sufficient disk space for logs and JSON output

### During Run

- [ ] Monitor progress logs
- [ ] Check success rate after 10-15 recipes
- [ ] If many failures, stop and investigate
- [ ] Don't interrupt during scraping (rate limit bypass)

### Post-Run

- [ ] Review error log for patterns
- [ ] Check validation issues
- [ ] Verify JSON output structure
- [ ] Import to database
- [ ] Test recipes on /discover page

## 📈 Performance

### Timing

| Stage | Duration | Notes |
|-------|----------|-------|
| Test (3 recipes) | 10-15 seconds | Quick validation |
| Full scrape (50) | 3-5 minutes | With 2s rate limit |
| Database import | 10-20 seconds | Depends on batch size |
| **Total** | **4-6 minutes** | End-to-end |

### Resource Usage

- **Network**: ~50 HTTP requests (one per recipe)
- **Disk**: ~500KB for JSON output
- **Memory**: < 50MB for scraper
- **CPU**: Minimal (I/O bound)

## 🔐 Security & Ethics

### Respectful Scraping

- ✅ 2-second rate limit (respectful to servers)
- ✅ User agent identifies scraper
- ✅ Uses Schema.org structured data (intended for consumption)
- ✅ No aggressive retries or circumvention
- ✅ Scrapes during off-peak hours when possible

### Data Usage

- ✅ Recipes marked as `is_system_recipe: true`
- ✅ Source URL preserved in `source` field
- ✅ Author attribution in metadata
- ✅ For personal/educational use only

## 🚀 Next Steps

After successful import:

### 1. Verify in Database

```bash
pnpm db:studio
# Filter: is_system_recipe = true
# Expected: 50 recipes
```

### 2. Test on Discover Page

```bash
pnpm dev
# Navigate to: http://localhost:3004/discover
# Verify: Serious Eats recipes appear
```

### 3. Add Embeddings (Optional)

```bash
# Generate embeddings for semantic search
npx tsx scripts/generate-recipe-embeddings.ts
```

### 4. Add Ratings (Optional)

```bash
# Use AI to generate system ratings
npx tsx scripts/rate-system-recipes.ts
```

### 5. Create Collections

Group recipes by:
- Author (Kenji, Daniel, Stella)
- Category (Pizza, Desserts, etc.)
- Difficulty
- Cuisine

## 📚 Related Documentation

- **recipe-scrapers**: https://github.com/hhursev/recipe-scrapers
- **Schema.org Recipe**: https://schema.org/Recipe
- **Serious Eats**: https://www.seriouseats.com
- **Drizzle ORM**: https://orm.drizzle.team/docs

## 🎓 Learning Points

### Why recipe-scrapers Works

Serious Eats uses Schema.org JSON-LD structured data:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Recipe",
  "name": "Foolproof Pan Pizza",
  "author": {"@type": "Person", "name": "J. Kenji López-Alt"},
  "recipeIngredient": ["2 cups flour", ...],
  "recipeInstructions": [...]
}
</script>
```

recipe-scrapers extracts this structured data reliably.

### Alternative Approaches (Not Used)

- ❌ **HTML parsing**: Fragile, breaks with layout changes
- ❌ **LLM parsing**: Expensive ($0.10+ per recipe)
- ❌ **API scraping**: Serious Eats doesn't have public API
- ✅ **Schema.org**: Reliable, free, intended for consumption

## 📝 Changelog

### Version 1.0.0 (2025-10-16)

- ✅ Initial release
- ✅ 50 curated recipe URLs
- ✅ Production scraper with error handling
- ✅ Database import script
- ✅ Comprehensive documentation

---

**Last Updated**: 2025-10-16
**Author**: Joanie's Kitchen Team
**Version**: 1.0.0
