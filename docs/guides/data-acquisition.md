# Recipe Data Acquisition

This guide covers how to acquire recipe data from various external sources for ingestion into the Recipe Manager database.

## Overview

The data acquisition pipeline supports multiple sources:

1. **TheMealDB** (Free API) - Curated recipes with images
2. **Food.com via Kaggle** - Large-scale recipe dataset
3. **Custom ingestion** - Import recipes from JSON files

## Directory Structure

```
data/
  recipes/
    incoming/           # Downloaded raw data
      themealdb/       # TheMealDB API downloads
      food-com/        # Food.com dataset
    processed/         # Successfully ingested recipes
    failed/            # Failed ingestion attempts
```

## TheMealDB (Free API)

TheMealDB provides a free API with ~600 recipes across various cuisines.

### Quick Start

```bash
# Download all recipes (A-Z, ~600 recipes, ~2-3 minutes)
pnpm data:themealdb

# Download sample (50 recipes from A, B, C)
pnpm data:themealdb:sample
```

### What It Does

- Fetches recipes by first letter (A-Z search)
- Retrieves full recipe details including:
  - Name, description, category, cuisine
  - Ingredients with measurements
  - Step-by-step instructions
  - Images, video URLs, source URLs
- Saves to `data/recipes/incoming/themealdb/recipes-{timestamp}.json`
- Expected output: 250-300 recipes

### Features

- **Retry Logic**: Automatic retries with exponential backoff
- **Rate Limiting**: Conservative 200ms delay between requests (5/sec)
- **Error Handling**: Continues on failures, reports at end
- **Progress Tracking**: Real-time console output

### Output Format

Each recipe includes:

```json
{
  "id": "52772",
  "name": "Teriyaki Chicken Casserole",
  "description": "Chicken dish from Japanese cuisine",
  "ingredients": [
    "3/4 cup soy sauce",
    "1/2 cup water",
    "1/4 cup brown sugar"
  ],
  "instructions": [
    "Preheat oven to 350° F.",
    "Combine soy sauce, water, brown sugar and garlic powder."
  ],
  "category": "Chicken",
  "cuisine": "Japanese",
  "tags": ["Meat", "Casserole"],
  "images": ["https://www.themealdb.com/images/media/meals/wvpsxx1468256321.jpg"],
  "videoUrl": "https://www.youtube.com/watch?v=4aZr5hZXP_s",
  "source": "TheMealDB",
  "sourceUrl": "https://www.themealdb.com/meal/52772"
}
```

### CLI Options

```bash
# Download specific number of recipes
tsx scripts/data-acquisition/crawl-themealdb.ts 100

# Download recipes for specific letters
tsx scripts/data-acquisition/crawl-themealdb.ts 50 abc

# Download all (default)
tsx scripts/data-acquisition/crawl-themealdb.ts
```

### API Limitations

- **Free Tier**: 100 requests per second (we use 5/sec to be safe)
- **Search Method**: By first letter only (A-Z)
- **No Authentication**: No API key required
- **Dataset Size**: ~600 recipes total

## Food.com Dataset (Kaggle)

Large-scale recipe dataset from Food.com with 500,000+ recipes.

### Setup

```bash
# One-time setup: Configure Kaggle API credentials
pnpm data:setup

# Download dataset (~2GB)
pnpm data:food-com
```

### Requirements

- Kaggle account and API token
- See `scripts/data-acquisition/setup-kaggle.ts` for details

## Recipe Ingestion

After downloading recipes, ingest them into the database:

```bash
# Ingest all downloaded recipes
pnpm data:ingest

# Ingest specific source
pnpm data:ingest themealdb
```

### Ingestion Process

1. **Reads** recipes from `incoming/` directory
2. **Validates** recipe format and data quality
3. **Transforms** to database schema format
4. **Inserts** into database as system recipes
5. **Moves** processed files to `processed/` directory
6. **Logs** failures to `failed/` directory

### Deduplication

The ingestion pipeline automatically:
- Checks for existing recipes by external ID
- Skips duplicates to prevent re-importing
- Reports duplicate count in summary

## Complete Pipeline

Run the entire acquisition and ingestion pipeline:

```bash
# Download from all sources and ingest
pnpm data:acquire-all
```

This will:
1. Download TheMealDB recipes
2. Download Food.com dataset (if configured)
3. Ingest all downloaded recipes
4. Generate summary report

## Monitoring

### Progress Tracking

All scripts provide real-time console output:

```
[TheMealDB] === Fetching meals starting with 'A' ===
[TheMealDB] Found 24 meals for 'a'
[TheMealDB]   ✓ Apple Frangipan Tart (13 ingredients, 9 steps)
[TheMealDB]   ✓ Apple & Blackberry Crumble (9 ingredients, 6 steps)
```

### Error Handling

Errors are logged but don't stop the process:

```
[TheMealDB]   ✗ Error fetching meal 52772: HTTP 500
[TheMealDB] Error fetching letter 'z': Network timeout
```

### Summary Reports

Each script provides a final summary:

```
============================================================
[TheMealDB] ✓ Crawl complete!
[TheMealDB] Saved 267 recipes to:
[TheMealDB] /path/to/data/recipes/incoming/themealdb/recipes-1234567890.json
============================================================
```

## Troubleshooting

### TheMealDB Issues

**Problem**: Rate limit errors (HTTP 429)
```bash
# Solution: Increase RATE_LIMIT_MS in crawl-themealdb.ts
# Default is 200ms (5 req/sec), try 500ms (2 req/sec)
```

**Problem**: Network timeouts
```bash
# Solution: Retry with the same command
# Failed letters are skipped, successful ones continue
```

**Problem**: No recipes downloaded
```bash
# Check API status: https://www.themealdb.com/api.php
# Verify internet connection
# Check output directory permissions
```

### Ingestion Issues

**Problem**: Validation errors
```bash
# Check logs in data/recipes/failed/
# Review recipe format in incoming JSON files
```

**Problem**: Database connection errors
```bash
# Verify DATABASE_URL in .env.local
# Test connection: pnpm db:studio
```

## Best Practices

1. **Start Small**: Use `pnpm data:themealdb:sample` to test pipeline
2. **Check Output**: Review JSON files in `incoming/` before ingestion
3. **Monitor Progress**: Watch console output for errors
4. **Clean Up**: Archive or delete processed files periodically
5. **Backup**: Keep original downloads in case re-ingestion needed

## File Locations

- **Scripts**: `scripts/data-acquisition/`
- **Configuration**: `package.json` (npm scripts)
- **Data Directory**: `data/recipes/`
- **Parsers**: `scripts/data-acquisition/parsers/`

## API Documentation

- **TheMealDB API**: https://www.themealdb.com/api.php
- **Food.com Dataset**: https://www.kaggle.com/datasets/shuyangli94/food-com-recipes-and-user-interactions

## Support

For issues or questions:
1. Check this documentation
2. Review console error messages
3. Check script source code in `scripts/data-acquisition/`
4. Verify environment configuration

---

**Last Updated**: 2025-10-14
