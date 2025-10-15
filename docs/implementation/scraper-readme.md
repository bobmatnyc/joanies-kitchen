# Continuous Recipe Scraper System

A fully automated background system for discovering and importing recipes into your Recipe Manager database.

## Overview

The continuous scraper system automatically:
- Discovers new recipes from various weeks using Perplexity AI
- Extracts recipe data from web pages using AI
- Validates recipe quality
- Stores recipes with AI-generated ratings
- Generates embeddings for semantic search
- Runs continuously in the background using PM2

## Features

- **Continuous Operation**: Runs 24/7 in the background
- **Intelligent Scheduling**: Configurable intervals (default: hourly)
- **Multi-Week Discovery**: Scrapes current week through 4 weeks ago
- **Auto-Approval**: Optional automatic approval of quality recipes
- **Quality Ratings**: AI-generated ratings (1-5 stars) for each recipe
- **Semantic Search**: Automatic embedding generation
- **Rate Limiting**: Built-in delays to respect API limits
- **Error Handling**: Graceful failure handling with detailed logging
- **Resource Management**: Automatic memory management and restart
- **Process Management**: Full PM2 integration

## Quick Start

```bash
# Start the background scraper
npm run scraper:start

# View real-time logs
npm run scraper:logs

# Check status
npm run scraper:status

# Stop scraper
npm run scraper:stop
```

See [SCRAPER_QUICK_START.md](docs/SCRAPER_QUICK_START.md) for detailed setup instructions.

## Architecture

### Components

1. **Continuous Scraper** (`scripts/continuous-scraper.ts`)
   - Main background process
   - Manages scraping cycles
   - Handles scheduling and intervals
   - Tracks statistics

2. **One-Time Scraper** (`scripts/scrape-once.ts`)
   - Manual testing tool
   - Single scraping run
   - Useful for testing configuration

3. **PM2 Configuration** (`ecosystem.config.js`)
   - Process management
   - Auto-restart on failure
   - Log file management
   - Environment configuration

4. **Recipe Crawl Pipeline** (`src/app/actions/recipe-crawl.ts`)
   - Core scraping logic
   - Web page extraction
   - Recipe validation
   - Database storage

### Data Flow

```
Perplexity AI Discovery
        ↓
Web Page Fetching
        ↓
AI Recipe Extraction (Claude Haiku)
        ↓
Quality Validation
        ↓
AI Quality Rating (Claude Haiku)
        ↓
Embedding Generation
        ↓
Database Storage
        ↓
Logs & Statistics
```

## Configuration

### Environment Variables

Set in `ecosystem.config.js`:

| Variable | Default | Description |
|----------|---------|-------------|
| `SCRAPER_WEEKS` | `0,1,2,3,4` | Weeks to scrape (comma-separated) |
| `SCRAPER_MAX_RECIPES` | `5` | Max recipes per week |
| `SCRAPER_INTERVAL_MIN` | `60` | Minutes between cycles |
| `SCRAPER_AUTO_APPROVE` | `true` | Auto-approve quality recipes |
| `SCRAPER_CUISINES` | `undefined` | Filter by cuisine (optional) |

### Example Configurations

#### High-Volume Scraping
```javascript
env: {
  SCRAPER_WEEKS: '0,1,2,3,4,5,6,7',
  SCRAPER_MAX_RECIPES: '10',
  SCRAPER_INTERVAL_MIN: '30',
  SCRAPER_AUTO_APPROVE: 'true',
}
```

#### Conservative Scraping
```javascript
env: {
  SCRAPER_WEEKS: '0,1',
  SCRAPER_MAX_RECIPES: '3',
  SCRAPER_INTERVAL_MIN: '120',
  SCRAPER_AUTO_APPROVE: 'true',
}
```

#### Cuisine-Specific
```javascript
env: {
  SCRAPER_WEEKS: '0,1,2',
  SCRAPER_MAX_RECIPES: '5',
  SCRAPER_INTERVAL_MIN: '60',
  SCRAPER_AUTO_APPROVE: 'true',
  SCRAPER_CUISINES: 'Italian,Japanese,Thai,Indian',
}
```

## Commands

### NPM Scripts

| Command | Description |
|---------|-------------|
| `npm run scraper:start` | Start background scraper |
| `npm run scraper:stop` | Stop background scraper |
| `npm run scraper:restart` | Restart background scraper |
| `npm run scraper:logs` | View real-time logs |
| `npm run scraper:status` | Check scraper status |
| `npm run scraper:once` | Run one-time scrape |

### Direct PM2 Commands

```bash
# View logs
pm2 logs recipe-scraper

# Monitor resources
pm2 monit

# Show detailed info
pm2 show recipe-scraper

# Restart with new config
pm2 restart recipe-scraper --update-env

# Delete process
pm2 delete recipe-scraper

# Save process list
pm2 save
```

### One-Time Scraping

```bash
# Scrape current week (default: 10 recipes)
npm run scraper:once

# Scrape specific week with custom limit
tsx scripts/scrape-once.ts 2 5    # 2 weeks ago, max 5 recipes
tsx scripts/scrape-once.ts 0 20   # Current week, max 20 recipes
```

## Monitoring

### Log Files

Logs are written to:
- `logs/scraper-out.log` - Standard output (success messages)
- `logs/scraper-error.log` - Error output (failures)

### Real-Time Monitoring

```bash
# View logs in real-time
npm run scraper:logs

# View only errors
pm2 logs recipe-scraper --err

# View last 100 lines
pm2 logs recipe-scraper --lines 100

# Clear logs
pm2 flush recipe-scraper
```

### Performance Metrics

View scraper statistics:
```bash
pm2 show recipe-scraper
```

Shows:
- Uptime
- Memory usage
- CPU usage
- Restart count
- Status

## Expected Results

### Typical Cycle Output

```
============================================================
[Scraper] Starting recipe scraping cycle
[Scraper] Time: 10/14/2025, 8:00:00 PM
============================================================

[Scraper] Processing week 0 (current week)...
  ✓ Stored: "Creamy Pumpkin Soup with Sage"
  ✓ Stored: "Thai Green Curry with Chicken"
  ✓ Stored: "Classic Margherita Pizza"
[Scraper] Week 0 results: { searched: 5, stored: 3, failed: 2 }

[Scraper] Processing week 1 (1 weeks ago)...
  ✓ Stored: "Homemade Pasta Carbonara"
  ✓ Stored: "Greek Salad with Feta"
[Scraper] Week 1 results: { searched: 5, stored: 2, failed: 3 }

[... continues for all weeks ...]

============================================================
[Scraper] Cycle complete!
[Scraper] Duration: 45.2 seconds
[Scraper] Session totals: { totalScraped: 25, totalStored: 18, totalFailed: 7 }
[Scraper] Success rate: 72.0%
============================================================

[Scraper] Next scrape in 60 minutes
```

### Success Rate Expectations

- **70-80%**: Excellent - Normal success rate
- **60-70%**: Good - Some URLs may be paywalled or invalid
- **50-60%**: Fair - Check API limits and network
- **<50%**: Poor - Investigate API keys and configuration

### Recipes Per Hour

With default configuration (5 weeks × 5 recipes, hourly):
- **Attempted**: ~25 recipes/hour
- **Stored**: ~15-20 recipes/hour (depending on success rate)
- **Daily**: ~360-480 recipes/day

## Troubleshooting

### Scraper Won't Start

```bash
# Check PM2 status
pm2 status

# View error logs
pm2 logs recipe-scraper --err

# Delete and restart
pm2 delete recipe-scraper
npm run scraper:start
```

### Low Success Rate

1. **Check API keys** in `.env.local`:
   ```bash
   cat .env.local | grep -E "(PERPLEXITY|OPENROUTER)"
   ```

2. **Check rate limits**:
   - Perplexity: 20 requests/minute (free tier)
   - OpenRouter: Varies by model

3. **Reduce load**:
   ```javascript
   env: {
     SCRAPER_MAX_RECIPES: '3',        // Fewer recipes
     SCRAPER_INTERVAL_MIN: '120',     // Less frequent
   }
   ```

### Memory Issues

```bash
# View memory usage
pm2 show recipe-scraper

# If high, increase restart threshold in ecosystem.config.js
max_memory_restart: '1G',  // Instead of '500M'
```

### API Errors

Common errors and solutions:

| Error | Solution |
|-------|----------|
| `API key not found` | Add keys to `.env.local` |
| `Rate limit exceeded` | Increase `SCRAPER_INTERVAL_MIN` |
| `Invalid response` | Check API provider status |
| `Network error` | Check internet connection |

## Advanced Usage

### Multiple Scrapers

Run multiple scraper instances for different purposes:

```javascript
// In ecosystem.config.js
apps: [
  // ... existing apps ...
  {
    name: 'recipe-scraper-italian',
    script: './scripts/continuous-scraper.ts',
    interpreter: 'tsx',
    env: {
      SCRAPER_WEEKS: '0,1,2',
      SCRAPER_MAX_RECIPES: '3',
      SCRAPER_INTERVAL_MIN: '120',
      SCRAPER_CUISINES: 'Italian',
    },
    error_file: './logs/scraper-italian-error.log',
    out_file: './logs/scraper-italian-out.log',
  },
  {
    name: 'recipe-scraper-asian',
    script: './scripts/continuous-scraper.ts',
    interpreter: 'tsx',
    env: {
      SCRAPER_WEEKS: '0,1,2',
      SCRAPER_MAX_RECIPES: '3',
      SCRAPER_INTERVAL_MIN: '120',
      SCRAPER_CUISINES: 'Japanese,Thai,Chinese,Korean',
    },
    error_file: './logs/scraper-asian-error.log',
    out_file: './logs/scraper-asian-out.log',
  },
]
```

Start all scrapers:
```bash
pm2 start ecosystem.config.js
```

### Auto-Start on Boot

Set up PM2 to start scrapers automatically:

```bash
# Save current process list
pm2 save

# Generate startup script (follow instructions)
pm2 startup

# On macOS, you may need to use launchctl
pm2 startup launchctl
```

### Programmatic Usage

Import and use in your own scripts:

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

## Best Practices

1. **Start Small**: Begin with 2-3 weeks and low recipe counts
2. **Monitor Early**: Watch logs for first few cycles
3. **Adjust Gradually**: Increase load based on success rate
4. **Check Costs**: Monitor API usage on provider dashboards
5. **Regular Cleanup**: Remove duplicate or low-quality recipes
6. **Database Maintenance**: Monitor database size and performance

## Performance

### Resource Usage

- **Memory**: 200-300MB typical, 500MB max
- **CPU**: <5% typical (mostly idle waiting for APIs)
- **Network**: ~1-2 MB/cycle (API calls + web pages)
- **Disk**: ~100KB/recipe (including images as URLs)

### Timing

- **Discovery**: ~5-10 seconds per week
- **Extraction**: ~3-5 seconds per recipe
- **Validation**: <1 second per recipe
- **Storage**: ~2-3 seconds per recipe (with embedding)
- **Total**: ~30-60 seconds per cycle (5 weeks, 25 recipes)

## Database Impact

All scraped recipes are stored with:
- Full recipe data (name, ingredients, instructions)
- Week/year metadata (discoveryWeek, discoveryYear)
- AI quality rating (systemRating, systemRatingReason)
- Embeddings for semantic search (in recipe_embeddings table)
- System recipe flag (isSystemRecipe: true)

## Security

- API keys read from `.env.local` (not committed)
- All recipes marked as system recipes
- No user authentication required (server-side only)
- Rate limiting prevents API abuse
- Error handling prevents crashes

## Future Enhancements

Potential improvements:
- [ ] Web dashboard for monitoring
- [ ] Email/Slack notifications
- [ ] Duplicate detection before storage
- [ ] Smart scheduling based on peak times
- [ ] Multi-source scraping (beyond Perplexity)
- [ ] Recipe approval queue UI
- [ ] Automatic cuisine classification
- [ ] Image optimization and storage
- [ ] Nutrition data extraction
- [ ] User preference learning

## Documentation

- [Quick Start Guide](docs/SCRAPER_QUICK_START.md) - Get started in 60 seconds
- [Full Documentation](docs/CONTINUOUS_SCRAPER.md) - Comprehensive guide
- [Recipe Crawl Pipeline](src/app/actions/recipe-crawl.ts) - Core implementation

## Support

For issues or questions:
1. Check logs: `npm run scraper:logs`
2. View status: `npm run scraper:status`
3. Review documentation
4. Check API provider status pages

## License

Same as Recipe Manager project.

---

**Ready to start scraping?**

```bash
npm run scraper:start
npm run scraper:logs
```

Happy scraping! 🍳
