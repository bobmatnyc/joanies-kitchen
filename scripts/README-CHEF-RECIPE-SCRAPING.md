# Chef Recipe Scraping Script

Comprehensive automation script for discovering and scraping recipes from famous chefs using SerpAPI and Firecrawl.

## Features

- **SerpAPI Integration**: Intelligent Google search to find recipe URLs
- **Firecrawl Scraping**: Advanced content extraction with schema.org support
- **Database Integration**: Automatic insertion into `recipes` and `chef_recipes` tables
- **Progress Tracking**: Resume support with persistent state
- **Dry-Run Mode**: Preview operations before making changes
- **Rate Limiting**: Respects API quotas (1s SerpAPI, 2s Firecrawl)
- **Duplicate Detection**: URL matching and title similarity detection
- **Quality Validation**: Ensures minimum recipe quality standards
- **Error Handling**: Comprehensive error recovery and retry logic

## Prerequisites

### API Keys Required

1. **SerpAPI** (https://serpapi.com)
   - Sign up for free account
   - Get API key from dashboard
   - Add to `.env.local`: `SERPAPI_API_KEY=your_key_here`

2. **Firecrawl** (https://firecrawl.dev)
   - Sign up for account
   - Get API key from dashboard
   - Add to `.env.local`: `FIRECRAWL_API_KEY=your_key_here`

### Environment Setup

```bash
# .env.local (these should already be set)
SERPAPI_API_KEY=your_serpapi_key
FIRECRAWL_API_KEY=your_firecrawl_key
DATABASE_URL=your_postgresql_connection_string

# Optional: Set to 'true' to actually insert into database
APPLY_CHANGES=false  # Default: dry-run mode
```

### Database Requirements

The script requires these tables to exist:
- `chefs` - Chef profiles
- `recipes` - Recipe data
- `chef_recipes` - Many-to-many relationship linking chefs to recipes
- `scraping_jobs` - (Optional) Scraping operation tracking

These should already be created if you've run the chef schema migrations.

## Usage

### 1. Dry Run (Preview Only)

Test the script without making database changes:

```bash
pnpm chef:scrape:recipes
# OR
pnpm tsx scripts/scrape-chef-recipes.ts
```

This will:
- Find recipe URLs for all active chefs
- Scrape recipe content
- Show what would be inserted
- Save progress to `tmp/chef-recipe-scraping-progress.json`
- **NOT** insert anything into the database

### 2. Live Execution

Actually insert recipes into database:

```bash
pnpm chef:scrape:recipes:apply
# OR
APPLY_CHANGES=true pnpm tsx scripts/scrape-chef-recipes.ts
```

### 3. Resume from Checkpoint

If the script stops (error, ctrl-c, etc.), resume where you left off:

```bash
pnpm chef:scrape:recipes:resume
# OR
APPLY_CHANGES=true pnpm tsx scripts/scrape-chef-recipes.ts --resume
```

### 4. Single Chef

Process only one specific chef:

```bash
pnpm tsx scripts/scrape-chef-recipes.ts --chef=kenji-lopez-alt
# OR
APPLY_CHANGES=true pnpm tsx scripts/scrape-chef-recipes.ts --chef=gordon-ramsay
```

## How It Works

### Search Strategy

For each chef, the script builds intelligent search queries:

1. **Chef's Website** (if available)
   - `{chef name} recipes site:{chef.website}`
   - `{chef name} best recipes site:{chef.website}`

2. **General Search**
   - `{chef name} signature recipes`
   - `{chef name} famous recipes`
   - `{chef name} best recipes`

3. **Specialty-Based** (if chef has specialties)
   - `{chef name} {specialty} recipe`

### URL Filtering

The script filters URLs to focus on actual recipes:

**Included**: URLs containing recipe-related keywords:
- recipe, recipes, cooking, dish, food, kitchen

**Excluded**: Known non-recipe domains:
- pinterest.com, facebook.com, instagram.com
- twitter.com, youtube.com
- amazon.com, walmart.com, target.com

### Content Extraction

Firecrawl extracts structured data using multiple methods:

1. **schema.org Recipe markup** (preferred)
   - Uses JSON-LD structured data
   - Most reliable extraction

2. **Fallback parsing**
   - HTML content analysis
   - Markdown extraction

Extracted fields:
- Title/Name
- Description
- Ingredients (array)
- Instructions (array)
- Prep/Cook time (ISO 8601 or minutes)
- Servings
- Cuisine
- Category
- Keywords/Tags
- Image URL
- Nutrition info

### Quality Validation

Recipes must pass these checks:

- **Title**: Minimum 5 characters
- **Content**: At least 3 ingredients OR 2 instructions
- **Valid Data**: Non-empty arrays, valid JSON

### Duplicate Detection

Two-stage duplicate checking:

1. **URL Match**: Exact match on `chef_recipes.original_url`
2. **Title Similarity**: Levenshtein distance >85% match

If a duplicate is detected, the recipe is skipped.

### Database Insertion

When `APPLY_CHANGES=true`, the script:

1. Inserts recipe into `recipes` table
   - Sets `user_id = 'system'`
   - Sets `is_system_recipe = true`
   - Sets `is_public = true`
   - Sets `chef_id` to link to chef
   - Stores original URL in `source` field

2. Creates link in `chef_recipes` table
   - Links `chef_id` to `recipe_id`
   - Stores `original_url`
   - Records `scraped_at` timestamp

3. Updates chef's `recipe_count`
   - Increments count by 1
   - Updates `updated_at` timestamp

## Configuration

Edit `CONFIG` object in script to customize:

```typescript
const CONFIG = {
  // Rate limiting (milliseconds)
  SERPAPI_RATE_LIMIT_MS: 1000,      // 1 second between searches
  FIRECRAWL_RATE_LIMIT_MS: 2000,    // 2 seconds between scrapes

  // Scraping limits
  MAX_RECIPES_PER_CHEF: 5,           // Max recipes to scrape per chef
  MAX_RETRIES: 2,                    // Retry attempts for failed requests
  REQUEST_TIMEOUT_MS: 30000,         // 30 second timeout

  // Quality thresholds
  MIN_INGREDIENTS: 3,                // Minimum ingredient count
  MIN_INSTRUCTIONS: 2,               // Minimum instruction steps
  MIN_TITLE_LENGTH: 5,               // Minimum title length
};
```

## Progress Tracking

Progress is saved to: `tmp/chef-recipe-scraping-progress.json`

Structure:
```json
{
  "lastProcessedChef": "chef-slug",
  "processedChefs": ["chef-1", "chef-2"],
  "failedChefs": ["chef-3"],
  "scrapedRecipes": [
    {
      "chef": "chef-slug",
      "recipeUrl": "https://...",
      "recipeId": "uuid",
      "status": "success|failed|skipped",
      "reason": "error message or skip reason"
    }
  ],
  "timestamp": "2025-10-22T...",
  "stats": {
    "totalChefs": 10,
    "totalRecipes": 50,
    "successfulRecipes": 42,
    "failedRecipes": 5,
    "skippedRecipes": 3
  }
}
```

## Output Examples

### Dry Run Output

```
======================================================================
CHEF RECIPE SCRAPING SCRIPT
======================================================================
Mode: ⊛ DRY RUN
Resume: No
Max recipes per chef: 5
======================================================================
✓ API keys validated

📋 Querying all active chefs...

Found 15 chef(s) to process

======================================================================
📚 SCRAPING RECIPES FOR: Kenji López-Alt
======================================================================
   Slug: kenji-lopez-alt
   Website: https://www.seriouseats.com
   Specialties: science, technique, asian
   Current Recipe Count: 0

🔍 Searching for Kenji López-Alt recipes...
   Query: "Kenji López-Alt recipes site:seriouseats.com"
   ✓ Found: The Food Lab's Ultimate Extra-Crispy Fried Chicken
   ✓ Found: Perfect Grilled Steaks
   ✓ Found: Halal Cart-Style Chicken and Rice
   📊 Found 3 unique recipe URLs

📄 Scraping recipe: https://www.seriouseats.com/crispy-fried-chicken
   ✓ Successfully scraped: The Food Lab's Ultimate Extra-Crispy Fried Chicken
   ⊛ DRY RUN: Would insert recipe "The Food Lab's Ultimate Extra-Crispy Fried Chicken"

📄 Scraping recipe: https://www.seriouseats.com/perfect-grilled-steaks
   ✓ Successfully scraped: Perfect Grilled Steaks
   ⊛ DRY RUN: Would insert recipe "Perfect Grilled Steaks"

📊 CHEF SUMMARY:
   ✓ Success: 3
   ⊘ Skipped (duplicates): 0
   ✗ Failed: 0

======================================================================
FINAL SUMMARY
======================================================================
Chefs processed: 15/15
Total recipes found: 75
✓ Successfully scraped: 68
⊘ Skipped (duplicates): 5
✗ Failed: 2
Failed chefs: 1

📄 Progress saved to: /path/to/tmp/chef-recipe-scraping-progress.json
======================================================================

⊛ DRY RUN COMPLETE - No changes made to database
   Run with APPLY_CHANGES=true to insert recipes
```

## Error Handling

The script handles various error scenarios:

1. **Missing API Keys**: Exits with clear error message
2. **Network Errors**: Retries with exponential backoff
3. **Parsing Errors**: Logs error, skips recipe, continues
4. **Database Errors**: Logs error, saves progress, continues
5. **Rate Limit Errors**: Waits and retries
6. **Timeout Errors**: Skips recipe after timeout

All errors are logged with context and saved to progress file.

## Troubleshooting

### "No recipe URLs found"

**Possible causes:**
- Chef has no website or limited online presence
- Search queries too specific
- Chef's website blocks crawlers

**Solutions:**
- Try with `--chef=specific-chef` to debug single chef
- Check chef's website field in database
- Adjust search queries in `buildSearchQueries()`

### "Scraping failed"

**Possible causes:**
- Website blocks Firecrawl
- No schema.org markup
- Invalid HTML structure

**Solutions:**
- Check Firecrawl dashboard for quota
- Test URL manually: `curl -I <url>`
- Add custom extraction logic for specific sites

### "Duplicate detected"

**Expected behavior** - the script detected:
- Exact URL match in database, OR
- Title similarity >85% for same chef

This is a **good thing** - it prevents duplicate recipes.

### "Validation failed"

**Possible causes:**
- Recipe data incomplete
- Non-recipe page scraped (e.g., article, blog post)
- Parsing error

**Solutions:**
- Lower quality thresholds in `CONFIG`
- Add custom validation for specific chef sites
- Manually inspect failed URLs

## Performance

### API Quotas

**SerpAPI**:
- Free tier: 100 searches/month
- Paid tier: Starting at $50/month (5,000 searches)

**Firecrawl**:
- Free tier: 500 pages/month
- Paid tier: Starting at $29/month (3,000 pages)

### Processing Time

Approximate times:
- **Per Recipe**: 3-5 seconds (including rate limits)
- **Per Chef** (5 recipes): 15-25 seconds
- **10 Chefs**: 2.5-4 minutes
- **50 Chefs**: 12-20 minutes

### Database Impact

Minimal - inserts are batched and optimized:
- 1 recipe insert
- 1 chef_recipes link insert
- 1 chef update (recipe_count)

Total: ~3 queries per recipe

## Best Practices

1. **Always dry-run first**: Test with new chefs before live execution
2. **Monitor API quotas**: Check SerpAPI/Firecrawl dashboards
3. **Resume on errors**: Use `--resume` flag to continue after interruptions
4. **Single chef testing**: Use `--chef=slug` to test individual chefs
5. **Review progress file**: Check `tmp/chef-recipe-scraping-progress.json` regularly
6. **Adjust limits**: Modify `MAX_RECIPES_PER_CHEF` based on chef quality

## Advanced Usage

### Custom Search Queries

Edit `buildSearchQueries()` function to add custom search strategies:

```typescript
function buildSearchQueries(chef: any): string[] {
  const queries: string[] = [];

  // Your custom queries
  queries.push(`${chef.name} award winning recipes`);
  queries.push(`best ${chef.name} cookbook recipes`);

  return queries;
}
```

### Custom Validation

Edit `validateRecipeQuality()` to add custom checks:

```typescript
function validateRecipeQuality(recipe: ScrapedRecipe): boolean {
  // Custom validation
  if (recipe.cook_time && recipe.cook_time > 480) {
    console.log('⊘ Recipe too long (>8 hours)');
    return false;
  }

  return true;
}
```

### Domain Whitelisting

Prefer specific domains by editing search queries:

```typescript
// Only search chef's own site
queries.push(`${chef.name} recipes site:${domain}`);

// Or specific food sites
queries.push(`${chef.name} recipes site:bonappetit.com OR site:foodandwine.com`);
```

## Maintenance

### Monitoring

Check these regularly:
1. Progress file: `tmp/chef-recipe-scraping-progress.json`
2. Database: `SELECT chef_id, COUNT(*) FROM chef_recipes GROUP BY chef_id;`
3. Failed chefs: Review `failedChefs` array in progress file

### Cleanup

```bash
# Remove progress file to start fresh
rm tmp/chef-recipe-scraping-progress.json

# Check for orphaned chef_recipes
pnpm tsx -e "
import { db } from './src/lib/db';
import { chefRecipes, recipes } from './src/lib/db/schema';
import { notInArray } from 'drizzle-orm';

const allRecipeIds = await db.select({ id: recipes.id }).from(recipes);
const orphaned = await db.select().from(chefRecipes)
  .where(notInArray(chefRecipes.recipe_id, allRecipeIds.map(r => r.id)));

console.log('Orphaned links:', orphaned.length);
"
```

## Future Enhancements

Potential improvements:

- [ ] Multi-threading for parallel scraping
- [ ] Chef prioritization by tier/popularity
- [ ] Automatic image download and storage
- [ ] Recipe categorization (breakfast, dinner, etc.)
- [ ] Nutrition data extraction
- [ ] Video URL extraction
- [ ] Webhook notifications on completion
- [ ] Slack/Discord integration for monitoring
- [ ] Automatic retry on rate limit errors
- [ ] Chef-specific extraction rules

## Support

For issues or questions:

1. Check this README
2. Review progress file for errors
3. Test with single chef: `--chef=slug`
4. Enable verbose logging (add to script)
5. Check API dashboards for quota/errors

## License

Part of Joanie's Kitchen project.
