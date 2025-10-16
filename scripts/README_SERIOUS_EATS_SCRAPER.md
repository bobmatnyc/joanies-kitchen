# Serious Eats Top 50 Recipe Scraper

Production-ready Python script to scrape iconic Serious Eats recipes and transform them to Joanie's Kitchen database schema.

## 🎯 Overview

This scraper extracts 50 curated recipes from Serious Eats using the `recipe-scrapers` library (no LLM cost). It includes robust error handling, rate limiting, validation, and outputs database-ready JSON.

**Cost**: $0 (uses recipe-scrapers library, not LLM parsing)

## 📋 Features

- ✅ Curated list of 50 iconic recipes (Kenji, Daniel Gritzer, Stella Parks)
- ✅ Recipe-scrapers integration (Schema.org JSON-LD parsing)
- ✅ Rate limiting (2 seconds between requests)
- ✅ Error handling with retries (3 attempts, exponential backoff)
- ✅ Progress logging with emoji indicators
- ✅ Quality validation (ingredients, instructions, images)
- ✅ Database-ready output (matches Drizzle schema)
- ✅ Detailed logging (success and error logs)

## 🚀 Quick Start

### Prerequisites

```bash
# Ensure virtual environment is activated
source venv/bin/activate  # or venv\Scripts\activate on Windows

# Verify recipe-scrapers is installed
pip list | grep recipe-scrapers
```

### Run Scraper

```bash
# From project root
python scripts/ingest-serious-eats-top50.py
```

### Expected Output

```
================================================================================
SERIOUS EATS TOP 50 RECIPE SCRAPER
================================================================================
ℹ️  Output directory: /path/to/data/recipes/incoming/serious-eats
ℹ️  Log file: /path/to/tmp/serious-eats-scraping-log-20251016_123456.txt
✅ Loaded 50 recipe URLs

================================================================================
STARTING SCRAPING
================================================================================
[1/50] Processing: https://www.seriouseats.com/foolproof-pan-pizza-recipe
✅ Scraped: Foolproof Pan Pizza Recipe
ℹ️  Rate limiting: waiting 2s...

[2/50] Processing: https://www.seriouseats.com/...
...

================================================================================
SUMMARY
================================================================================
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

📁 Output files:
  - Raw data: data/recipes/incoming/serious-eats/top50-raw.json
  - Transformed: data/recipes/incoming/serious-eats/top50-transformed.json
  - Log: tmp/serious-eats-scraping-log-20251016_123456.txt
  - Errors: tmp/serious-eats-errors-20251016_123456.txt

✅ Ready for database import!
```

## 📁 Files

### Input
- **`scripts/serious-eats-top50-urls.json`** - Curated list of 50 recipe URLs with metadata

### Output
- **`data/recipes/incoming/serious-eats/top50-raw.json`** - Raw scraped data from recipe-scrapers
- **`data/recipes/incoming/serious-eats/top50-transformed.json`** - Database-ready JSON (matches Drizzle schema)
- **`tmp/serious-eats-scraping-log-[timestamp].txt`** - Detailed execution log
- **`tmp/serious-eats-errors-[timestamp].txt`** - Error-only log for debugging

## 🗄️ Database Schema Mapping

The script transforms raw scraped data to match `src/lib/db/schema.ts`:

```typescript
// Raw scraper output → Database schema
{
  id: UUID (generated)
  user_id: "system"                           // System recipes
  name: scraper.title()
  description: scraper.description()
  ingredients: JSON.stringify(scraper.ingredients())  // Array of strings
  instructions: scraper.instructions()        // Plain text (not array)
  prep_time: scraper.prep_time()              // Minutes
  cook_time: scraper.cook_time()              // Minutes
  servings: parse_int(scraper.yields())       // Parsed from yields
  difficulty: null                            // Not provided by scraper
  cuisine: scraper.cuisine()
  tags: JSON.stringify([category])            // Array from category
  images: JSON.stringify([scraper.image()])   // Array with single image
  is_ai_generated: false
  is_public: true
  is_system_recipe: true
  nutrition_info: null                        // Not consistently available
  source: recipe_url
  created_at: now()
  updated_at: now()
}
```

## 🔍 Quality Validation

Each recipe is validated for:

1. **Required Fields**:
   - ✅ Name present
   - ✅ Ingredients array not empty
   - ✅ Instructions not empty (min 50 chars)
   - ✅ At least one image
   - ✅ Source URL present

2. **Quality Checks**:
   - Valid JSON for ingredients/tags/images
   - Instructions length > 50 characters
   - Image URL accessible

Recipes with validation issues are flagged in the output but still included.

## 🛠️ Configuration

Edit these constants in `ingest-serious-eats-top50.py`:

```python
RATE_LIMIT_SECONDS = 2      # Wait time between requests
MAX_RETRIES = 3             # Number of retry attempts
RETRY_BACKOFF = 2           # Exponential backoff multiplier
```

## 📊 Recipe Distribution

The curated list includes:

- **20 recipes from J. Kenji López-Alt** (Food Lab recipes):
  - Pizza, burgers, steaks, chicken, pasta, vegetables
  - Scientific approach to cooking

- **15 recipes from Daniel Gritzer** (Culinary Director):
  - French fries, pasta, ramen, bread, classic dishes
  - Professional techniques

- **15 recipes from Stella Parks** (BraveTart):
  - Cookies, cakes, brownies, pies, classic American desserts
  - Pastry wizard recipes

## 🔧 Troubleshooting

### Script Fails to Start

```bash
# Activate virtual environment
source venv/bin/activate

# Reinstall dependencies
pip install recipe-scrapers
```

### 404 Errors

Some recipe URLs may have changed. Edit `serious-eats-top50-urls.json` to:
- Remove broken URLs
- Add replacement URLs from Serious Eats

### Rate Limiting Issues

If you get blocked by Serious Eats:
- Increase `RATE_LIMIT_SECONDS` to 3-5 seconds
- Run script at off-peak hours
- Use a VPN if necessary

### Low Success Rate (< 90%)

Check error log for patterns:
```bash
# View errors
cat tmp/serious-eats-errors-[timestamp].txt

# Common issues:
# - Network timeouts: Retry later
# - 404s: Update URLs in serious-eats-top50-urls.json
# - Parser failures: May need recipe-scrapers update
```

## 📈 Next Steps

After successful scraping:

1. **Review Output**:
   ```bash
   # Check transformed data
   cat data/recipes/incoming/serious-eats/top50-transformed.json | jq '.[0]'
   ```

2. **Import to Database**:
   ```typescript
   // Create TypeScript import script
   // Read top50-transformed.json
   // Insert into recipes table using Drizzle
   ```

3. **Verify Import**:
   ```bash
   # Check system recipes count
   pnpm db:studio
   # Filter: is_system_recipe = true
   # Expected: 50 new recipes
   ```

## 🎓 Learning Resources

- **recipe-scrapers docs**: https://github.com/hhursev/recipe-scrapers
- **Schema.org Recipe**: https://schema.org/Recipe
- **Serious Eats**: https://www.seriouseats.com

## 📝 Notes

- **No LLM parsing**: Uses structured data (Schema.org JSON-LD)
- **Zero cost**: No API calls, just HTTP requests
- **Respectful scraping**: 2-second rate limit, user agent included
- **Error resilient**: Continues on failures, logs all errors
- **Production ready**: Used for initial system recipe seeding

## 🤝 Contributing

To add more recipes:

1. Edit `serious-eats-top50-urls.json`
2. Add new recipe objects:
   ```json
   {
     "url": "https://www.seriouseats.com/recipe-slug",
     "author": "Author Name",
     "category": "Category",
     "notes": "Why this recipe is iconic"
   }
   ```
3. Run scraper
4. Review validation results

## 📄 License

Part of Joanie's Kitchen recipe management system.

---

**Last Updated**: 2025-10-16
**Author**: Joanie's Kitchen Team
**Version**: 1.0.0
