#!/usr/bin/env tsx

/**
 * One-time recipe scraper
 * Usage: tsx scripts/scrape-once.ts [weeksAgo] [maxRecipes]
 */

import { crawlWeeklyRecipes } from '@/app/actions/recipe-crawl';

async function main() {
  const weeksAgo = Number(process.argv[2]) || 0;
  const maxRecipes = Number(process.argv[3]) || 10;

  console.log(`Scraping recipes from ${weeksAgo} weeks ago (max: ${maxRecipes})...`);

  const result = await crawlWeeklyRecipes(weeksAgo, {
    maxResults: maxRecipes,
    autoApprove: true,
  });

  console.log('\nResults:', {
    discovered: result.stats.searched,
    stored: result.stats.stored,
    failed: result.stats.failed,
  });

  if (result.stats.stored > 0) {
    console.log('\nStored recipes:');
    result.recipes
      .filter((r) => r.status === 'stored')
      .forEach((r) => console.log(`  ✓ ${r.name}`));
  }
}

main();
