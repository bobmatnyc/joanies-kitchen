#!/usr/bin/env node

/**
 * Standalone Recipe Scraper
 *
 * Calls the recipe-manager API to trigger scraping.
 * Runs independently from Next.js server actions.
 */

interface ScraperConfig {
  weeksToScrape: number[];
  maxRecipesPerWeek: number;
  intervalMinutes: number;
  autoApprove: boolean;
  apiUrl: string;
}

const DEFAULT_CONFIG: ScraperConfig = {
  weeksToScrape: [0, 1, 2, 3, 4],
  maxRecipesPerWeek: 5,
  intervalMinutes: 60,
  autoApprove: true,
  apiUrl: 'http://localhost:3001',
};

let totalScraped = 0;
let totalStored = 0;
let totalFailed = 0;
let isRunning = false;

async function callScrapeAPI(weeksAgo: number, options: { maxResults: number; autoApprove: boolean }): Promise<any> {
  const url = `${DEFAULT_CONFIG.apiUrl}/api/recipes/scrape`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      weeksAgo,
      maxResults: options.maxResults,
      autoApprove: options.autoApprove,
    }),
  });

  if (!response.ok) {
    throw new Error(`API call failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

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
        const result = await callScrapeAPI(weeksAgo, {
          maxResults: config.maxRecipesPerWeek,
          autoApprove: config.autoApprove,
        });

        totalScraped += result.stats?.searched || 0;
        totalStored += result.stats?.stored || 0;
        totalFailed += result.stats?.failed || 0;

        console.log(`[Scraper] Week ${weeksAgo} results:`, {
          searched: result.stats?.searched || 0,
          stored: result.stats?.stored || 0,
          failed: result.stats?.failed || 0,
        });

        // Log stored recipes
        if (result.stats?.stored > 0 && result.recipes) {
          const storedRecipes = result.recipes.filter((r: any) => r.status === 'stored');
          storedRecipes.forEach((recipe: any) => {
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
    apiUrl: config.apiUrl,
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
const config: ScraperConfig = {
  weeksToScrape: process.env.SCRAPER_WEEKS
    ? process.env.SCRAPER_WEEKS.split(',').map(Number)
    : DEFAULT_CONFIG.weeksToScrape,
  maxRecipesPerWeek: Number(process.env.SCRAPER_MAX_RECIPES) || DEFAULT_CONFIG.maxRecipesPerWeek,
  intervalMinutes: Number(process.env.SCRAPER_INTERVAL_MIN) || DEFAULT_CONFIG.intervalMinutes,
  autoApprove: process.env.SCRAPER_AUTO_APPROVE !== 'false',
  apiUrl: process.env.SCRAPER_API_URL || DEFAULT_CONFIG.apiUrl,
};

startContinuousScraping(config);
