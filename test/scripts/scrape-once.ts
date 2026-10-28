#!/usr/bin/env tsx

/**
 * One-time recipe scraper
 * Usage: tsx test/scripts/scrape-once.ts [weeksAgo] [maxRecipes]
 *
 * Records one `recipe_discovery_runs` row (run_type 'local') with a budget,
 * per-URL items and cost events (#6 S2).
 */

import { runRecordedWeeklyCrawl } from '@/lib/services/recorded-weekly-crawl';

async function main() {
  const weeksAgo = Number(process.argv[2]) || 0;
  const maxRecipes = Number(process.argv[3]) || 10;

  console.log(`Scraping recipes from ${weeksAgo} weeks ago (max: ${maxRecipes})...`);

  const run = await runRecordedWeeklyCrawl({
    weeks: [weeksAgo],
    maxResultsPerWeek: maxRecipes,
    autoApprove: true,
    runType: 'local',
  });
  console.log(
    `Run ${run.runId ?? '(untracked)'}: status=${run.status}, cost=$${run.costUsd.toFixed(4)}`
  );
  const result = run.weeks[0];
  if (!result) {
    console.log('No week was crawled:', run.errors);
    return;
  }

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
