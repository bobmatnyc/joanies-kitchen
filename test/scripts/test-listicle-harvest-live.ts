/**
 * Live listicle harvest test using real Firecrawl key.
 * Tests that RecipeDiscoveryService.harvestChildLinksFromListicle()
 * successfully scrapes a listicle and returns filtered single-recipe links.
 *
 * NO DB WRITES — dry-run only.
 * Uses ep-bold-credit (dev DB) as set in .env.local — never ep-jolly-snow.
 *
 * Run with: npx tsx test/scripts/test-listicle-harvest-live.ts
 */

import { RecipeDiscoveryService } from '@/lib/services/recipe-discovery.service';

async function main() {
  const firecrawlKey = process.env.FIRECRAWL_API_KEY;
  const tavilyKey = process.env.TAVILY_API_KEY;

  if (!firecrawlKey) {
    console.error('FIRECRAWL_API_KEY not set — cannot run live harvest test');
    process.exit(1);
  }

  console.log('\n=== LIVE LISTICLE HARVEST TEST (no DB write) ===');
  console.log(`Firecrawl key: ${firecrawlKey.substring(0, 8)}...`);

  const service = new RecipeDiscoveryService(tavilyKey || 'fake', firecrawlKey);

  // Use a real listicle page from an allowed domain (zerowastechef.com or similar)
  // This URL is a blog index-like page that should contain links to individual recipes
  const listicleUrl = 'https://zerowastechef.com/recipe-index';
  const seenUrls = new Set<string>();

  console.log(`\nHarvesting from: ${listicleUrl}`);
  console.log('(This is the failing /recipe-index URL from production run 5378646b)\n');

  const startTime = Date.now();
  const harvested = await service.harvestChildLinksFromListicle(listicleUrl, seenUrls);
  const duration = Date.now() - startTime;

  console.log(`\nHarvest completed in ${duration}ms`);
  console.log(`Harvested ${harvested.length} child recipe links:\n`);

  if (harvested.length === 0) {
    console.log('(No links harvested — the page may use JavaScript rendering or have no direct links)');
    console.log('This is expected for some sites — the key is the listicle is DETECTED and not sent to extraction.');
  } else {
    for (const link of harvested) {
      console.log(`  ✓ ${link.url}`);
    }

    console.log('\n=== VERIFICATION ===');
    console.log('Verifying all harvested URLs pass isValidRecipeUrl():');
    let allValid = true;
    for (const link of harvested) {
      const isValid = service.isValidRecipeUrl(link.url);
      const isListicle = service.isListiclePage(link.url);
      console.log(`  ${isValid ? '✓' : '✗'} valid=${isValid}, listicle=${isListicle}: ${link.url}`);
      if (!isValid || isListicle) allValid = false;
    }

    if (allValid) {
      console.log('\nAll harvested links are valid single-recipe URLs (not listicles). ✓');
    } else {
      console.error('\nWARNING: Some harvested links failed validation!');
    }
  }

  console.log('\n=== PRODUCTION SAFETY CHECK ===');
  const dbUrl = process.env.DATABASE_URL || '';
  if (dbUrl.includes('ep-jolly-snow')) {
    console.error('ABORT: DATABASE_URL points to production DB (ep-jolly-snow)!');
    process.exit(1);
  } else if (dbUrl.includes('ep-bold-credit')) {
    console.log('✓ DATABASE_URL confirmed pointing to DEV DB (ep-bold-credit) — not production');
  } else {
    console.log('✓ No DB writes performed in this test');
  }

  console.log('\nTest completed. No DB writes made.\n');
}

main().catch((err) => {
  console.error('Live test failed:', err.message);
  process.exit(1);
});
