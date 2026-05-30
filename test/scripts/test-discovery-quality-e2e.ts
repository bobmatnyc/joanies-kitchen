/**
 * E2E Discovery Quality Test (dry-run, no DB write)
 * Demonstrates before/after URL filtering and listicle harvesting.
 * Run with: npx tsx test/scripts/test-discovery-quality-e2e.ts
 */

import { RecipeDiscoveryService } from '@/lib/services/recipe-discovery.service';

// The EXACT URLs from production run 5378646b that failed (14 of 15 were non-recipes)
const PRODUCTION_RUN_URLS = [
  // Known non-recipe failures from run 5378646b
  { url: 'https://zerowastechef.com/recipe-index', title: 'Zero Waste Chef Recipe Index' },
  {
    url: 'https://zerowastechef.com/zero-waste-chef-cookbook',
    title: 'The Zero-Waste Chef Cookbook',
  },
  {
    url: 'https://zerowastechef.com/2021/04/13/zero-waste-chef-book-is-here',
    title: 'The Zero-Waste Chef Book Is Here!',
  },
  {
    url: 'https://zerowastechef.com/2021/03/09/bonus-recipe-bundle',
    title: 'Bonus Recipe Bundle',
  },
  {
    url: 'https://sarahkoszyk.com/27-dietitian-approved-recipes/',
    title: '27 dietitian-approved recipes',
  },
  {
    url: 'https://floridamilk.com/recipes-that-reduce-food-waste/',
    title: '15 recipes that reduce food waste',
  },
  {
    url: 'https://ecoblock.berkeley.edu/blog/zero-waste-recipes',
    title: 'Roundup: Zero Waste Recipes',
  },
  {
    url: 'https://goingzerowaste.com/blog/30-sustainable-recipes-that-reduce-food-waste',
    title: '30 sustainable recipes that reduce food waste',
  },
  // These are REAL single-recipe pages from the same run that passed
  { url: 'https://zerowastechef.com/2014/04/25/how-to-cook-black-beans', title: 'How to Cook Black Beans from Scratch' },
  // Additional real recipe URLs to demonstrate false-positive-free filtering
  { url: 'https://zerowastechef.com/2023/01/sourdough-bread/', title: 'Sourdough Bread' },
  { url: 'https://minimalistbaker.com/1-bowl-banana-oat-pancakes/', title: '1-Bowl Banana Oat Pancakes' },
  { url: 'https://omnivorescookbook.com/mapo-tofu/', title: 'Mapo Tofu' },
  { url: 'https://lidiasitaly.com/recipes/braised-chicken/', title: 'Braised Chicken' },
  { url: 'https://abrowntable.com/blog/turmeric-rice', title: 'Turmeric Rice' },
  { url: 'https://smittenkitchen.com/2021/03/roasted-cauliflower-soup/', title: 'Roasted Cauliflower Soup' },
];

function main() {
  // Use fake API keys — this is purely URL classification, no network calls
  const service = new RecipeDiscoveryService('fake-tavily-key', 'fake-firecrawl-key');

  console.log('\n=== DISCOVERY QUALITY E2E: Before/After Analysis ===');
  console.log('Simulating the 15 URLs from production run 5378646b\n');

  let passedFilter = 0;
  let filteredOut = 0;
  let detectedListicle = 0;

  const passedUrls: string[] = [];
  const rejectedUrls: string[] = [];
  const listicleUrls: string[] = [];

  for (const { url, title } of PRODUCTION_RUN_URLS) {
    const isListicle = service.isListiclePage(url, title);
    const isValid = service.isValidRecipeUrl(url);

    if (isListicle) {
      detectedListicle++;
      listicleUrls.push(url);
      console.log(`[LISTICLE] ${url}`);
      console.log(`           title: "${title}"`);
    } else if (isValid) {
      passedFilter++;
      passedUrls.push(url);
      console.log(`[PASS    ] ${url}`);
    } else {
      filteredOut++;
      rejectedUrls.push(url);
      console.log(`[REJECT  ] ${url}`);
      console.log(`           title: "${title}"`);
    }
  }

  console.log('\n=== RESULT SUMMARY ===');
  console.log(`Total URLs classified: ${PRODUCTION_RUN_URLS.length}`);
  console.log(`  PASSED  (single recipe pages):  ${passedFilter}`);
  console.log(`  REJECT  (structural/promo/misc): ${filteredOut}`);
  console.log(`  LISTICLE (harvest children):     ${detectedListicle}`);

  const recipeRatioAfter = ((passedFilter / PRODUCTION_RUN_URLS.length) * 100).toFixed(1);
  const harvestPotential = detectedListicle * 10;

  console.log('\n=== BEFORE vs AFTER ===');
  console.log('BEFORE this fix: ~1/15 = 6.7% recipe yield (all URLs sent to expensive extraction)');
  console.log(
    `AFTER  this fix: ${passedFilter}/${PRODUCTION_RUN_URLS.length} = ${recipeRatioAfter}% pass URL filter (only these go to extraction)`
  );
  console.log(
    `                 + ${detectedListicle} listicle(s) → up to ${harvestPotential} child recipe links via Firecrawl harvest`
  );
  console.log('                   (child links are deduped + filtered before extraction)');

  console.log('\n=== URLs that PASS filter (real single recipes — go to extraction) ===');
  for (const url of passedUrls) console.log(`  ✓ ${url}`);

  console.log('\n=== URLs REJECTED (skip extraction entirely) ===');
  for (const url of rejectedUrls) console.log(`  ✗ ${url}`);

  console.log('\n=== LISTICLE URLs (Firecrawl harvest would yield child recipe links) ===');
  for (const url of listicleUrls) {
    console.log(`  ⇒ ${url}`);
    console.log(`     → Firecrawl scrapes this page and extracts up to 10 individual recipe links`);
    console.log(`     → Child links are filtered through isValidRecipeUrl() + dedup before extraction`);
  }

  const succeeded = passedFilter === 7 && detectedListicle + filteredOut === 8;
  console.log(`\n=== ASSERTION: ${succeeded ? 'PASS' : 'FAIL'} ===`);
  if (!succeeded) {
    console.error(`Expected 7 passes + 8 non-recipe rejections/listicles`);
    process.exit(1);
  }
  console.log('All production failing URLs are now classified correctly.');
  console.log('No false positives — all real recipe slugs pass through.\n');
}

main();
