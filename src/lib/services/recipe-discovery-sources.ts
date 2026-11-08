/**
 * Recipe discovery sources (#298: moved from recipe-discovery.service.ts).
 *
 * Search queries, the sustainable-chef roster, the domain allow/block lists and
 * the per-run harvest bounds used by RecipeDiscoveryService.
 */

/**
 * Zero-waste focused generic search queries for recipe discovery.
 * Queries are phrased to surface specific single-recipe pages rather than
 * roundups/listicles. Use "recipe for" or specific dish names to bias Tavily
 * toward individual recipe pages.
 */
export const ZERO_WASTE_QUERIES = [
  'site:minimalistbaker.com OR site:budgetbytes.com OR site:food52.com recipe "zero waste" how to make',
  '"recipe for" fridge cleanout scraps wilted vegetable "use up" -"recipes to" -"best recipes"',
  '"recipe for" overripe fruit "use everything" zero waste cooking -roundup -listicle',
  '"recipe for" stale bread leftover rice pantry clearout how to make',
  'site:101cookbooks.com OR site:smittenkitchen.com OR site:cookieandkate.com recipe zero waste',
  '"vegetable scrap" recipe broth stock single "how to make" -"recipes that"',
  '"recipe for" leftover-friendly minimal food waste sustainable cooking',
  '"root to stem" recipe single dish -roundup -"best recipes" -"recipes to"',
  'zero waste kitchen "recipe for" sourdough OR fermentation OR preservation',
  'sustainable recipe seasonal vegetable whole ingredient "how to make"',
  '"recipe for" frugal cooking "use every part" nose to tail -roundup',
  'pantry recipe "cook from scratch" "no waste" single dish how to make',
];

/**
 * Sustainable-chef roster with name to website domain.
 * Used for chef-targeted query generation.
 */
export const CHEF_QUERY_TARGETS: Array<{ name: string; domain: string }> = [
  { name: 'Anne-Marie Bonneau', domain: 'zerowastechef.com' },
  { name: 'Vivian Li', domain: 'omnivorescookbook.com' },
  { name: 'Lidia Bastianich', domain: 'lidiasitaly.com' },
  { name: 'Tamar Adler', domain: 'tamareadler.com' },
  { name: 'Molly Katzen', domain: 'mollykatzen.com' },
  { name: 'Bryant Terry', domain: 'bryant-terry.com' },
  { name: 'Nik Sharma', domain: 'abrowntable.com' },
  { name: 'Cristina Scarpaleggia', domain: 'tuscanvistas.com' },
  { name: 'Joshua McFadden', domain: 'avagenes.com' },
  { name: 'Skye Gyngell', domain: 'springrestaurant.co.uk' },
];

/**
 * Allowed domains — high-quality zero-waste / recipe sources.
 * Includes generic recipe sites AND sustainable-chef owned domains.
 */
export const ALLOWED_DOMAINS = new Set([
  // Generic quality recipe sites
  'minimalistbaker.com',
  'thezerowaster.com',
  'zerowasteliving.com',
  'budgetbytes.com',
  'loveandlemons.com',
  'eatyourbeets.com',
  'cookinglight.com',
  'allrecipes.com',
  'food52.com',
  'smittenkitchen.com',
  '101cookbooks.com',
  'cookieandkate.com',
  'halfbakedharvest.com',
  'deliciouslyella.com',
  'ohsheglows.com',
  // Sustainable-chef owned domains
  'zerowastechef.com',
  'omnivorescookbook.com',
  'lidiasitaly.com',
  'tamareadler.com',
  'mollykatzen.com',
  'bryant-terry.com',
  'abrowntable.com',
  'tuscanvistas.com',
  'avagenes.com',
  'springrestaurant.co.uk',
  'turtlelakerefuge.org',
  'thefermentationschool.com',
  'bluehillfarm.com',
  'chezpanisse.com',
  'greenwave.org',
  'jacquespepin.net',
  'smithanddaughters.com',
]);

/**
 * Blocked domains — paywalled, low-quality, known-blocker, or non-recipe sites.
 *
 * Known-blocker domains (verified against production run failures):
 *   reddit.com, seriouseats.com, lovefoodhatewaste.com, thekitchn.com,
 *   ediblecommunities.com, foodandwine.com
 * These consistently reject extraction (403/paywall/CORS) — waste every run's URL budget.
 */
export const BLOCKED_DOMAINS = new Set([
  // Social / video / shopping
  'pinterest.com',
  'facebook.com',
  'instagram.com',
  'twitter.com',
  'x.com',
  'youtube.com',
  'tiktok.com',
  'amazon.com',
  'walmart.com',
  'target.com',
  // Paywalled news
  'nytimes.com',
  'washingtonpost.com',
  // Paywalled recipe sites
  'bonappetit.com',
  'epicurious.com',
  // Known extraction blockers (verified production failures)
  'reddit.com',
  'seriouseats.com',
  'lovefoodhatewaste.com',
  'thekitchn.com',
  'ediblecommunities.com',
  'foodandwine.com',
]);

/**
 * Harvest bounds — cap children to avoid URL budget explosion.
 * Per listicle: max 10 child links harvested.
 * Per run: max 15 total harvested links across all listicles.
 */
export const MAX_CHILDREN_PER_LISTICLE = 10;
export const MAX_TOTAL_HARVESTED_PER_RUN = 15;
