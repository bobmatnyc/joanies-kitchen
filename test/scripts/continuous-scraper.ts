#!/usr/bin/env tsx

/**
 * Continuous Recipe Scraper
 *
 * Automatically discovers and imports recipes from various weeks.
 * Runs continuously with intelligent scheduling.
 *
 * Each cycle is one `recipe_discovery_runs` row (run_type 'local') with a
 * budget (SCRAPER_RUN_BUDGET_USD, else CRON_RUN_BUDGET_USD, else the default),
 * per-URL items and cost events (#6 S2).
 */

import { runRecordedWeeklyCrawl } from '@/lib/services/recorded-weekly-crawl';

interface ScraperConfig {
  weeksToScrape: number[]; // Which weeks to scrape (0-52)
  maxRecipesPerWeek: number; // Max recipes to get per week
  intervalMinutes: number; // How often to run (in minutes)
  autoApprove: boolean; // Auto-approve recipes
  cuisines?: string[]; // Optional cuisine filters
}

const DEFAULT_CONFIG: ScraperConfig = {
  weeksToScrape: [0, 1, 2, 3, 4], // Current week through 4 weeks ago
  maxRecipesPerWeek: 5,
  intervalMinutes: 60, // Run every hour
  autoApprove: true,
  cuisines: undefined, // No filter, get all cuisines
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

  console.log(`\n${'='.repeat(60)}`);
  console.log('[Scraper] Starting recipe scraping cycle');
  console.log('[Scraper] Time:', new Date().toLocaleString());
  console.log(`${'='.repeat(60)}\n`);

  try {
    const run = await runRecordedWeeklyCrawl({
      weeks: config.weeksToScrape,
      maxResultsPerWeek: config.maxRecipesPerWeek,
      autoApprove: config.autoApprove,
      pickCuisine: () =>
        config.cuisines
          ? config.cuisines[Math.floor(Math.random() * config.cuisines.length)]
          : undefined,
      runType: 'local',
      budgetUsd: Number(process.env.SCRAPER_RUN_BUDGET_USD) || undefined,
    });

    for (const [i, result] of run.weeks.entries()) {
      totalScraped += result.stats.searched;
      totalStored += result.stats.stored;
      totalFailed += result.stats.failed;

      console.log(`[Scraper] Week ${config.weeksToScrape[i]} results:`, {
        searched: result.stats.searched,
        stored: result.stats.stored,
        failed: result.stats.failed,
      });

      // Log stored recipes
      for (const recipe of result.recipes.filter((r) => r.status === 'stored')) {
        console.log(`  ✓ Stored: "${recipe.name}"`);
      }
    }
    console.log(
      `[Scraper] Run ${run.runId ?? '(untracked)'}: status=${run.status}, cost=$${run.costUsd.toFixed(4)}`
    );
    for (const error of run.errors.filter((e) => e.startsWith('budget exceeded'))) {
      console.warn(`[Scraper] ${error}`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`\n${'='.repeat(60)}`);
    console.log('[Scraper] Cycle complete!');
    console.log('[Scraper] Duration:', duration, 'seconds');
    console.log('[Scraper] Session totals:', {
      totalScraped,
      totalStored,
      totalFailed,
    });
    console.log(
      '[Scraper] Success rate:',
      `${((totalStored / Math.max(totalScraped, 1)) * 100).toFixed(1)}%`
    );
    console.log(`${'='.repeat(60)}\n`);
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
  setInterval(
    () => {
      scrapeRecipes(config);
    },
    config.intervalMinutes * 60 * 1000
  );

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
