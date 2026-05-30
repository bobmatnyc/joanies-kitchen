/**
 * E2E dry-run: harvest child recipe links from hub pages (NO DB writes).
 *
 * Tests the new hub/blog listicle detection added in feat/scraper-blog-listicle-harvest.
 * Verifies:
 *  1. URL classification (no Firecrawl key needed)
 *  2. Live harvest from real hub pages (requires FIRECRAWL_API_KEY in env)
 *
 * Usage:
 *   FIRECRAWL_API_KEY=fc-... npx tsx scripts/e2e-hub-harvest-dryrun.ts
 *
 * Safety:
 *   - NO database writes
 *   - NO production (ep-jolly-snow) access
 *   - Read-only Firecrawl scrape only
 */

import { RecipeDiscoveryService } from '../src/lib/services/recipe-discovery.service';

const HUB_URLS_TO_TEST = [
  'https://cabotcreamery.com/blogs/food/root-stem-recipes',
  'https://lidiasitaly.com/recipes-categories/main-dishes',
  'https://lidiasitaly.com/blog/cooking-with-legends',
  'https://zerowastechef.com/sourdough',
];

const SINGLE_RECIPE_URLS_TO_VERIFY_NOT_HUB = [
  'https://www.abrowntable.com/blog/turmeric-rice',
  'https://www.zerowastechef.com/2023/01/sourdough-bread/',
  'https://www.lidiasitaly.com/recipes/braised-chicken/',
];

async function main() {
  const firecrawlKey = process.env.FIRECRAWL_API_KEY ?? '';
  const service = new RecipeDiscoveryService('fake-tavily-key', firecrawlKey);

  console.log('=== URL Classification (no Firecrawl key needed) ===\n');

  console.log('Hub pages (should be classified as harvestable):');
  for (const url of HUB_URLS_TO_TEST) {
    const isListicle = service.isListiclePage(url);
    const isHub = service.isHubPage(url);
    const status = isListicle ? '✓ HARVESTABLE' : '✗ NOT DETECTED';
    const hubLabel = isHub ? ' [definitive hub]' : ' [blog/ambiguous — fallback applies]';
    console.log(`  ${status}${hubLabel}: ${url}`);
  }

  console.log('\nSingle-recipe pages (should NOT be definitive hubs):');
  for (const url of SINGLE_RECIPE_URLS_TO_VERIFY_NOT_HUB) {
    const isHub = service.isHubPage(url);
    const isValidRecipe = service.isValidRecipeUrl(url);
    const hubStatus = isHub ? '✗ WRONGLY CLASSIFIED AS HUB' : '✓ not a hub';
    const recipeStatus = isValidRecipe ? '✓ valid recipe URL (fallback eligible)' : '✗ invalid recipe URL';
    console.log(`  ${hubStatus} | ${recipeStatus}: ${url}`);
  }

  if (!firecrawlKey) {
    console.log('\n=== Live Harvest (SKIPPED — FIRECRAWL_API_KEY not set) ===');
    console.log('Set FIRECRAWL_API_KEY env var to run live harvest.');
    return;
  }

  console.log('\n=== Live Harvest (dry-run, NO DB writes) ===\n');

  const liveHubUrls = [
    'https://cabotcreamery.com/blogs/food/root-stem-recipes',
    'https://lidiasitaly.com/recipes-categories/main-dishes',
  ];

  for (const hubUrl of liveHubUrls) {
    console.log(`Harvesting: ${hubUrl}`);
    const seenUrls = new Set<string>();
    const children = await service.harvestChildLinksFromListicle(hubUrl, seenUrls);

    if (children.length === 0) {
      console.log(`  No child recipe links found (Firecrawl may have blocked or page has no links)`);
    } else {
      console.log(`  Found ${children.length} child recipe links:`);
      for (const child of children) {
        console.log(`    - ${child.url}`);
      }
    }
    console.log();
  }
}

main().catch((err) => {
  console.error('E2E dry-run failed:', err);
  process.exit(1);
});
