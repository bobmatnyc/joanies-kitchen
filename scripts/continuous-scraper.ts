#!/usr/bin/env tsx

/**
 * Continuous Recipe Scraper
 *
 * Automatically discovers and imports recipes from various weeks.
 * Runs continuously with intelligent scheduling.
 */

import { crawlWeeklyRecipes } from '../src/app/actions/recipe-crawl';

interface ScraperConfig {
  weeksToScrape: number[];      // Which weeks to scrape (0-52)
  maxRecipesPerWeek: number;    // Max recipes to get per week
  intervalMinutes: number;       // How often to run (in minutes)
  autoApprove: boolean;         // Auto-approve recipes
  cuisines?: string[];          // Optional cuisine filters
}

const DEFAULT_CONFIG: ScraperConfig = {
  weeksToScrape: [0, 1, 2, 3, 4], // Current week through 4 weeks ago
  maxRecipesPerWeek: 5,
  intervalMinutes: 60,            // Run every hour
  autoApprove: true,
  cuisines: undefined,            // No filter, get all cuisines
};

let isRunning = false;
let totalScraped = 0;
let totalStored = 0;
let totalFailed = 0;

async function scrapeRecipes(config: ScraperConfig = DEFAULT_CONFIG) {
  if (isRunning) {
    console.log('[Scraper] Already running, skipping this iteration');
    return;
  }

  isRunning = true;
  const startTime = Date.now();

  console.log('\n' + '='.repeat(60));
  console.log('[Scraper] Starting recipe scraping cycle');
  console.log('[Scraper] Time:', new Date().toLocaleString());
  console.log('='.repeat(60) + '\n');

  try {
    for (const weeksAgo of config.weeksToScrape) {
      console.log(`\n[Scraper] Processing week ${weeksAgo} (${weeksAgo === 0 ? 'current week' : weeksAgo + ' weeks ago'})...`);

      try {
        const result = await crawlWeeklyRecipes(weeksAgo, {
          maxResults: config.maxRecipesPerWeek,
          autoApprove: config.autoApprove,
          cuisine: config.cuisines ? config.cuisines[Math.floor(Math.random() * config.cuisines.length)] : undefined,
        });

        totalScraped += result.stats.searched;
        totalStored += result.stats.stored;
        totalFailed += result.stats.failed;

        console.log(`[Scraper] Week ${weeksAgo} results:`, {
          searched: result.stats.searched,
          stored: result.stats.stored,
          failed: result.stats.failed,
        });

        // Log stored recipes
        if (result.stats.stored > 0) {
          const storedRecipes = result.recipes.filter(r => r.status === 'stored');
          storedRecipes.forEach(recipe => {
            console.log(`  ✓ Stored: "${recipe.name}"`);
          });
        }

        // Wait between weeks to avoid rate limiting
        if (weeksAgo !== config.weeksToScrape[config.weeksToScrape.length - 1]) {
          console.log('[Scraper] Waiting 10 seconds before next week...');
          await new Promise(resolve => setTimeout(resolve, 10000));
        }

      } catch (error) {
        console.error(`[Scraper] Error processing week ${weeksAgo}:`, error);
        totalFailed++;
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n' + '='.repeat(60));
    console.log('[Scraper] Cycle complete!');
    console.log('[Scraper] Duration:', duration, 'seconds');
    console.log('[Scraper] Session totals:', {
      totalScraped,
      totalStored,
      totalFailed,
    });
    console.log('[Scraper] Success rate:', ((totalStored / Math.max(totalScraped, 1)) * 100).toFixed(1) + '%');
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('[Scraper] Fatal error:', error);
  } finally {
    isRunning = false;
  }
}

async function startContinuousScraping(config: ScraperConfig = DEFAULT_CONFIG) {
  console.log('[Scraper] Continuous recipe scraper started');
  console.log('[Scraper] Configuration:', {
    weeksToScrape: config.weeksToScrape,
    maxRecipesPerWeek: config.maxRecipesPerWeek,
    intervalMinutes: config.intervalMinutes,
    autoApprove: config.autoApprove,
  });

  // Run immediately on start
  await scrapeRecipes(config);

  // Then run on interval
  setInterval(() => {
    scrapeRecipes(config);
  }, config.intervalMinutes * 60 * 1000);

  console.log(`[Scraper] Next scrape in ${config.intervalMinutes} minutes`);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Scraper] Received SIGINT, shutting down gracefully...');
  console.log('[Scraper] Final totals:', { totalScraped, totalStored, totalFailed });
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[Scraper] Received SIGTERM, shutting down gracefully...');
  console.log('[Scraper] Final totals:', { totalScraped, totalStored, totalFailed });
  process.exit(0);
});

// Start the scraper
if (require.main === module) {
  // Allow configuration via environment variables
  const config: ScraperConfig = {
    weeksToScrape: process.env.SCRAPER_WEEKS
      ? process.env.SCRAPER_WEEKS.split(',').map(Number)
      : DEFAULT_CONFIG.weeksToScrape,
    maxRecipesPerWeek: Number(process.env.SCRAPER_MAX_RECIPES) || DEFAULT_CONFIG.maxRecipesPerWeek,
    intervalMinutes: Number(process.env.SCRAPER_INTERVAL_MIN) || DEFAULT_CONFIG.intervalMinutes,
    autoApprove: process.env.SCRAPER_AUTO_APPROVE !== 'false',
    cuisines: process.env.SCRAPER_CUISINES?.split(','),
  };

  startContinuousScraping(config);
}

export { scrapeRecipes, startContinuousScraping };
