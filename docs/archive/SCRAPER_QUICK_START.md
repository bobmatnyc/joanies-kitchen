# Recipe Scraper - Quick Start Guide

Get your continuous recipe scraper running in 60 seconds!

## Prerequisites

- PM2 installed (already installed ✓)
- API keys configured in `.env.local`:
  - `PERPLEXITY_API_KEY`
  - `OPENROUTER_API_KEY`

## Installation (One-Time Setup)

Already done! The scraper is configured and ready to use.

## Start Scraping

### 1. Start the Background Scraper

```bash
npm run scraper:start
```

Expected output:
```
[PM2] Applying action restartProcessId on app [recipe-scraper](ids: [ 0 ])
[PM2] [recipe-scraper](0) ✓
```

### 2. View Real-Time Logs

```bash
npm run scraper:logs
```

You should see:
```
[Scraper] Continuous recipe scraper started
[Scraper] Configuration: { weeksToScrape: [0,1,2,3,4], maxRecipesPerWeek: 5, ... }
[Scraper] Starting recipe scraping cycle
[Scraper] Time: 10/14/2025, 8:00:00 PM
```

### 3. Check Status

```bash
npm run scraper:status
```

Should show:
```
┌─────┬────────────────────┬─────────┬─────────┬──────────┬────────┐
│ id  │ name               │ status  │ restart │ uptime   │ cpu    │
├─────┼────────────────────┼─────────┼─────────┼──────────┼────────┤
│ 0   │ recipe-scraper     │ online  │ 0       │ 5m       │ 0%     │
└─────┴────────────────────┴─────────┴─────────┴──────────┴────────┘
```

## Stop Scraping

```bash
npm run scraper:stop
```

## Test Before Running Continuously

Want to test the scraper once before letting it run continuously?

```bash
# Test with current week, up to 10 recipes
npm run scraper:once

# Or test a specific week with custom limit
tsx scripts/scrape-once.ts 0 3
```

This will:
1. Discover recipes from the specified week
2. Extract and validate them
3. Store them in your database
4. Show you the results

## What Happens Next?

The scraper will:
1. **Run immediately** upon start
2. **Process 5 weeks** (current week through 4 weeks ago)
3. **Discover up to 5 recipes per week** (25 total per cycle)
4. **Wait 1 hour** and repeat

Each cycle takes about 5-10 minutes depending on:
- Number of recipes found
- API response times
- Recipe extraction complexity

## Expected Results Per Cycle

Typical output:
```
============================================================
[Scraper] Cycle complete!
[Scraper] Duration: 45.2 seconds
[Scraper] Session totals: { totalScraped: 25, totalStored: 18, totalFailed: 2 }
[Scraper] Success rate: 72.0%
============================================================
```

- **Success rate 60-80%**: Normal (some URLs are paywalled or invalid)
- **Success rate <50%**: Check API keys and network
- **Success rate >80%**: Excellent! 🎉

## Monitoring

### View Logs
```bash
# Real-time logs (Ctrl+C to exit)
npm run scraper:logs

# Last 100 lines
pm2 logs recipe-scraper --lines 100

# Error logs only
pm2 logs recipe-scraper --err
```

### Check Process
```bash
# Status
npm run scraper:status

# Detailed info
pm2 show recipe-scraper

# Resource monitoring
pm2 monit
```

## Troubleshooting

### Scraper won't start
```bash
# Delete existing process and restart
pm2 delete recipe-scraper
npm run scraper:start
```

### API errors
Check your `.env.local` has:
```bash
PERPLEXITY_API_KEY=pplx-xxxxx
OPENROUTER_API_KEY=sk-or-xxxxx
```

### No recipes found
This is normal for older weeks. Try:
```javascript
// In ecosystem.config.js, change to recent weeks only
SCRAPER_WEEKS: '0,1,2',  // Only last 2 weeks
```

## Customization

Edit `ecosystem.config.js` to customize:

```javascript
env: {
  SCRAPER_WEEKS: '0,1,2,3,4',       // Which weeks to scrape
  SCRAPER_MAX_RECIPES: '5',         // Recipes per week
  SCRAPER_INTERVAL_MIN: '60',       // How often (minutes)
  SCRAPER_AUTO_APPROVE: 'true',     // Auto-approve quality recipes
  SCRAPER_CUISINES: 'Italian,Thai', // Optional: specific cuisines only
}
```

After editing, restart:
```bash
npm run scraper:restart
```

## Next Steps

1. **Let it run for a few hours** - Check back and see how many recipes it found
2. **View recipes in your app** - Go to localhost:3001/recipes
3. **Adjust configuration** - Based on results, tweak the settings
4. **Set up monitoring** - Add to your PM2 startup script

## Advanced: Auto-Start on Boot

Want the scraper to start automatically when your machine boots?

```bash
# Save current PM2 process list
pm2 save

# Generate startup script
pm2 startup

# Follow the instructions shown (usually requires sudo)
```

Now the scraper will always be running! 🚀

## Getting Help

- Full documentation: `docs/CONTINUOUS_SCRAPER.md`
- View logs: `npm run scraper:logs`
- Check status: `npm run scraper:status`
- Stop scraper: `npm run scraper:stop`

## Summary of Commands

| Command | Description |
|---------|-------------|
| `npm run scraper:start` | Start background scraper |
| `npm run scraper:stop` | Stop scraper |
| `npm run scraper:restart` | Restart scraper |
| `npm run scraper:logs` | View real-time logs |
| `npm run scraper:status` | Check if running |
| `npm run scraper:once` | Test with one-time scrape |
| `tsx scripts/scrape-once.ts 0 5` | Custom one-time scrape |

---

**Ready?** Start scraping:
```bash
npm run scraper:start
npm run scraper:logs
```
