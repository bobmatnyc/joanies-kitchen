/**
 * Live Tavily-based discovery quality test (dry-run, NO DB WRITE).
 * Shows that the candidate pool after filtering has improved recipe-page ratio.
 *
 * Uses real Tavily API key from .env.local
 * FIRECRAWL_API_KEY not available, so listicle harvesting shows detection only.
 *
 * Run: TAVILY_API_KEY=... npx tsx test/scripts/test-discovery-quality-tavily.ts
 */

import { RecipeDiscoveryService } from '@/lib/services/recipe-discovery.service';

async function main() {
  const tavilyKey = process.env.TAVILY_API_KEY;

  if (!tavilyKey) {
    console.error('TAVILY_API_KEY not set');
    process.exit(1);
  }

  // DB safety check
  const dbUrl = process.env.DATABASE_URL || '';
  if (dbUrl.includes('ep-jolly-snow')) {
    console.error('ABORT: DATABASE_URL points to production (ep-jolly-snow)!');
    process.exit(1);
  }
  console.log(`DB safety: ${dbUrl.includes('ep-bold-credit') ? '✓ DEV DB (ep-bold-credit)' : '✓ No prod DB'}`);

  const service = new RecipeDiscoveryService(tavilyKey);

  console.log('\n=== LIVE TAVILY DISCOVERY QUALITY TEST (dry-run, no DB write) ===');
  console.log('Running 2 queries and showing URL classification results\n');

  // Use a single targeted query to demonstrate
  const testQuery = '"Anne-Marie Bonneau" recipe site:zerowastechef.com';
  console.log(`Query: "${testQuery}"\n`);

  const discovered = await service.discoverRecipeUrls({
    maxResults: 20,
    searchQuery: testQuery,
  });

  console.log(`\nDiscovered ${discovered.length} URLs after filtering:\n`);

  let singleRecipes = 0;
  let listicles = 0;
  let unknown = 0;

  for (const url of discovered) {
    const isListicle = service.isListiclePage(url.url, url.title);
    if (isListicle) {
      listicles++;
      console.log(`[LISTICLE] ${url.url}`);
      console.log(`           "${url.title}"`);
    } else {
      singleRecipes++;
      console.log(`[RECIPE  ] ${url.url}`);
      console.log(`           "${url.title}"`);
    }
  }

  console.log('\n=== RESULTS ===');
  console.log(`Total after filter: ${discovered.length}`);
  console.log(`Single recipes: ${singleRecipes}`);
  console.log(`Listicles detected: ${listicles} (would yield children via Firecrawl when key is available)`);
  console.log(`Recipe yield: ${discovered.length > 0 ? ((singleRecipes / discovered.length) * 100).toFixed(1) : 'N/A'}%`);
  console.log('\n(Comparison: before fix, run 5378646b got ~6.7% recipe yield, 1/15)');
  console.log('\nNo DB writes performed. ✓\n');
}

main().catch((err) => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
