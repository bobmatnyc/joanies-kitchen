# Continuous Recipe Scraper

Automatically discovers and imports recipes from various weeks on a continuous basis.

## Quick Start

### Start Background Scraper
```bash
npm run scraper:start
```

### View Logs
```bash
npm run scraper:logs
```

### Stop Scraper
```bash
npm run scraper:stop
```

## Configuration

Edit `ecosystem.config.js` to customize:

- **SCRAPER_WEEKS**: Which weeks to scrape (e.g., "0,1,2,3,4")
- **SCRAPER_MAX_RECIPES**: Max recipes per week (default: 5)
- **SCRAPER_INTERVAL_MIN**: Minutes between scrapes (default: 60)
- **SCRAPER_AUTO_APPROVE**: Auto-approve recipes (default: true)
- **SCRAPER_CUISINES**: Comma-separated cuisine filters (optional)

## How It Works

1. Scraper runs every hour (configurable)
2. Processes weeks 0-4 (current week through 4 weeks ago)
3. Gets up to 5 recipes per week
4. Auto-approves quality recipes
5. Stores with AI-generated ratings
6. Logs all activities to `logs/scraper-*.log`

## Available Commands

### Background Process Management
```bash
# Start the continuous scraper
npm run scraper:start

# Stop the scraper
npm run scraper:stop

# Restart the scraper
npm run scraper:restart

# View real-time logs
npm run scraper:logs

# Check scraper status
npm run scraper:status
```

### One-Time Manual Scraping
```bash
# Scrape current week (up to 10 recipes)
npm run scraper:once

# Scrape specific week with custom limit
tsx scripts/scrape-once.ts 2 5    # 2 weeks ago, max 5 recipes
```

## Monitoring

```bash
# View real-time logs
pm2 logs recipe-scraper

# View status
pm2 status

# View detailed info
pm2 show recipe-scraper

# Monitor resources
pm2 monit
```

## Expected Output

```
============================================================
[Scraper] Starting recipe scraping cycle
[Scraper] Time: 10/14/2025, 8:00:00 PM
============================================================

[Scraper] Processing week 0 (current week)...
  ✓ Stored: "Pumpkin Soup"
  ✓ Stored: "Thai Curry"
[Scraper] Week 0 results: { searched: 5, stored: 2, failed: 0 }

[Scraper] Processing week 1 (1 weeks ago)...
  ✓ Stored: "Italian Pasta"
  ✓ Stored: "Greek Salad"
[Scraper] Week 1 results: { searched: 5, stored: 2, failed: 0 }

============================================================
[Scraper] Cycle complete!
[Scraper] Duration: 45.2 seconds
[Scraper] Session totals: { totalScraped: 25, totalStored: 18, totalFailed: 2 }
[Scraper] Success rate: 72.0%
============================================================

[Scraper] Next scrape in 60 minutes
```

## Customizing Configuration

### Change Scraping Frequency
Edit `ecosystem.config.js`:
```javascript
env: {
  SCRAPER_INTERVAL_MIN: '120',  // Scrape every 2 hours instead of 1 hour
}
```

### Scrape More Recipes Per Week
```javascript
env: {
  SCRAPER_MAX_RECIPES: '10',  // Get up to 10 recipes per week
}
```

### Focus on Specific Cuisines
```javascript
env: {
  SCRAPER_CUISINES: 'Italian,Japanese,Indian',  // Only these cuisines
}
```

### Scrape More Historical Weeks
```javascript
env: {
  SCRAPER_WEEKS: '0,1,2,3,4,5,6,7,8',  // Scrape up to 8 weeks ago
}
```

## Troubleshooting

### No recipes found
- Perplexity may not have recipes for older weeks
- Try reducing the number of weeks or focusing on recent weeks (0-4)

### High failure rate
- Check API keys in `.env.local` (Perplexity, OpenRouter)
- Check rate limits on your API providers
- Reduce `SCRAPER_MAX_RECIPES` to slow down requests

### Memory issues
- Increase `max_memory_restart` in `ecosystem.config.js`
- Reduce `SCRAPER_MAX_RECIPES` or `SCRAPER_WEEKS`

### Scraper won't start
```bash
# Check PM2 status
pm2 status

# View error logs
pm2 logs recipe-scraper --err

# Delete and restart
pm2 delete recipe-scraper
npm run scraper:start
```

### Scraper crashes
```bash
# View error logs
cat logs/scraper-error.log

# Check if PM2 auto-restarted it
pm2 status recipe-scraper
```

## Performance Optimization

### Rate Limiting
The scraper automatically waits:
- 10 seconds between different weeks
- 2 seconds between individual recipes (in recipe-crawl.ts)

### Resource Usage
- Memory: ~200-300MB typical, max 500MB before restart
- CPU: Low (mostly waiting for API responses)
- Network: Moderate (API calls + webpage fetches)

## Log Files

Logs are stored in `/logs/`:
- `scraper-out.log` - Standard output (success messages)
- `scraper-error.log` - Error output (failures and warnings)

Both files are automatically rotated by PM2.

## Integration with Database

All scraped recipes are:
1. Stored in the `recipes` table
2. Tagged with week/year metadata
3. Given AI quality ratings (1-5 stars)
4. Embedded for semantic search
5. Made available as "system recipes" (public)

## Best Practices

1. **Start with small intervals**: Test with a 15-minute interval first
2. **Monitor early**: Watch logs for the first few cycles
3. **Adjust based on results**: If success rate is low, adjust configuration
4. **Check database regularly**: Ensure recipes are being stored correctly
5. **Monitor API costs**: Check OpenRouter and Perplexity usage

## Advanced Usage

### Run Multiple Scrapers
You can run multiple scraper instances with different configurations:

1. Copy `ecosystem.config.js` app definition
2. Change the name (e.g., `recipe-scraper-italian`)
3. Set different environment variables
4. Start both: `pm2 start ecosystem.config.js`

Example:
```javascript
{
  name: 'recipe-scraper-italian',
  script: './scripts/continuous-scraper.ts',
  env: {
    SCRAPER_WEEKS: '0,1,2',
    SCRAPER_MAX_RECIPES: '3',
    SCRAPER_INTERVAL_MIN: '120',
    SCRAPER_CUISINES: 'Italian',
  },
}
```

### Programmatic Usage

You can also import and use the scraper in your own scripts:

```typescript
import { scrapeRecipes, startContinuousScraping } from './scripts/continuous-scraper';

// One-time scrape
await scrapeRecipes({
  weeksToScrape: [0, 1],
  maxRecipesPerWeek: 5,
  intervalMinutes: 60,
  autoApprove: true,
});

// Start continuous scraping
await startContinuousScraping({
  weeksToScrape: [0, 1, 2],
  maxRecipesPerWeek: 3,
  intervalMinutes: 120,
  autoApprove: true,
  cuisines: ['Italian', 'Japanese'],
});
```

## Security Notes

- The scraper runs with the same environment as your Next.js app
- Ensure `.env.local` is not committed to git
- API keys are read from environment variables
- All scraped recipes are marked as "system recipes" (isSystemRecipe: true)

## Future Enhancements

Potential improvements:
- [ ] Web dashboard for monitoring scraper status
- [ ] Email/Slack notifications for failures
- [ ] Duplicate detection before storing
- [ ] Smart scheduling based on peak publishing times
- [ ] Multi-source scraping (beyond Perplexity)
- [ ] Recipe approval queue UI
