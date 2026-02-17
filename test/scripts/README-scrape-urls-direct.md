# Direct URL Scraping Script

## Overview

`scrape-urls-direct.ts` reads URLs directly from a file and scrapes them using Firecrawl. It automatically determines which chef owns each recipe by matching URL domains to chef websites in the database.

## Features

- ✅ **Direct URL scraping** - No SerpAPI search required
- ✅ **Automatic chef matching** - Matches URL domains to chef websites
- ✅ **Reuses all parsing logic** - Imports functions from `scrape-chef-recipes.ts`
- ✅ **Quality validation** - Ensures recipes meet minimum standards
- ✅ **Duplicate detection** - Checks URL and title similarity
- ✅ **Rate limiting** - 1 second delay between requests
- ✅ **Dry-run mode** - Safe testing without database changes
- ✅ **Progress logging** - Saves detailed logs to `tmp/direct-scraping.log`

## Usage

### 1. Prepare URL file

Create or edit `tmp/chef-urls-to-scrape.txt` with one URL per line:

```
https://www.seriouseats.com/some-recipe
https://ottolenghi.co.uk/pages/recipes/another-recipe
https://www.gordonramsay.com/gr/recipes/beef-wellington/
```

### 2. Run in dry-run mode (preview only)

```bash
pnpm tsx scripts/scrape-urls-direct.ts
```

This will:
- Read all URLs from the file
- Attempt to scrape each one
- Match domains to chefs in the database
- Show what would be inserted
- Save logs to `tmp/direct-scraping.log`

### 3. Run with actual insertion

```bash
APPLY_CHANGES=true pnpm tsx scripts/scrape-urls-direct.ts
```

## How It Works

### Chef Matching

The script matches URL domains to chef websites:

1. Extracts domain from recipe URL (e.g., `www.seriouseats.com`)
2. Queries all active chefs from database
3. Compares URL domain to each chef's website domain
4. If match found, attributes recipe to that chef
5. If no match, skips URL and logs warning

**Example matches:**
- `https://www.seriouseats.com/recipe` → Kenji López-Alt
- `https://ottolenghi.co.uk/pages/recipes/...` → Yotam Ottolenghi
- `https://www.gordonramsay.com/gr/recipes/...` → Gordon Ramsay

### Parsing & Validation

All parsing logic is reused from `scrape-chef-recipes.ts`:
- `extractRecipeData()` - Extracts recipe data from Firecrawl response
- `parseRecipeFromMarkdown()` - Parses markdown content
- `transformToRecipeSchema()` - Converts to database schema
- `validateRecipeQuality()` - Ensures minimum quality standards

**Quality thresholds:**
- Title: Minimum 5 characters
- Ingredients: Minimum 3 items OR
- Instructions: Minimum 2 steps

### Duplicate Detection

The script checks for duplicates by:
1. **Exact URL match** - Checks if URL already exists in `chef_recipes` table
2. **Title similarity** - Checks if similar title exists for same chef (>85% similarity)

## Output

### Console Output

```
======================================================================
DIRECT URL SCRAPING SCRIPT
======================================================================
Mode: ⊛ DRY RUN
URL File: /path/to/tmp/chef-urls-to-scrape.txt
Log File: /path/to/tmp/direct-scraping.log
======================================================================
✓ API keys validated

Found 28 URLs to scrape

======================================================================
Processing URL 1/28: https://www.seriouseats.com/recipe
======================================================================
   ✓ Matched chef: Kenji López-Alt (https://www.seriouseats.com)

📄 Scraping recipe: https://www.seriouseats.com/recipe
   ✓ Successfully scraped: Recipe Title
   ⊛ DRY RUN: Would insert recipe "Recipe Title"
   ✓ Success: Recipe ID dry-run-id

...

======================================================================
FINAL SUMMARY
======================================================================
Total URLs: 28
✓ Successfully scraped: 20
⊘ Skipped (duplicates): 3
⊘ No matching chef: 2
✗ Failed: 3
======================================================================

📄 Logs saved to: /path/to/tmp/direct-scraping.log

⊛ DRY RUN COMPLETE - No changes made to database
   Run with APPLY_CHANGES=true to insert recipes
```

### Log File

All output is saved to `tmp/direct-scraping.log` with timestamps:

```
[2025-10-23T09:13:45.123Z] Found 28 URLs to scrape
[2025-10-23T09:13:45.456Z] Processing URL 1/28: https://...
[2025-10-23T09:13:45.789Z]    ✓ Matched chef: Kenji López-Alt
...
```

## Configuration

Edit the `CONFIG` object in the script to adjust:

```typescript
const CONFIG = {
  URL_FILE: 'tmp/chef-urls-to-scrape.txt',  // Input file path
  LOG_FILE: 'tmp/direct-scraping.log',       // Output log path
  FIRECRAWL_RATE_LIMIT_MS: 1000,            // Delay between requests (ms)
  MIN_INGREDIENTS: 3,                        // Minimum ingredients required
  MIN_INSTRUCTIONS: 2,                       // Minimum instructions required
  MIN_TITLE_LENGTH: 5,                       // Minimum title length
  REQUEST_TIMEOUT_MS: 30000,                 // Firecrawl timeout (ms)
};
```

## Troubleshooting

### No chef found for URL

If you see `⊘ No matching chef found`, the URL's domain doesn't match any chef in the database. Options:

1. Add the chef to the database with the correct website URL
2. Update an existing chef's website URL to match
3. Manually attribute the recipe after scraping

### Firecrawl API errors

- **Rate limiting**: Increase `FIRECRAWL_RATE_LIMIT_MS`
- **Timeouts**: Increase `REQUEST_TIMEOUT_MS`
- **API quota**: Check your Firecrawl account usage

### Recipe validation failures

If recipes fail validation:
- Check if URL is actually a recipe page (not author bio)
- Lower quality thresholds in `CONFIG` if needed
- Review logs to see specific validation failures

## Environment Variables

Required in `.env.local`:

```env
FIRECRAWL_API_KEY=fc-...  # Required for recipe scraping
```

## See Also

- `scrape-chef-recipes.ts` - Full SerpAPI + Firecrawl scraping workflow
- `AUTHENTICATION_GUIDE.md` - Database connection setup
- `PROJECT_ORGANIZATION.md` - File organization standards
