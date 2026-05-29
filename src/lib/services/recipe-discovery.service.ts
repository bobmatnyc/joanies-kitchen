/**
 * Recipe Discovery Service
 *
 * Discovers zero-waste recipe URLs using the Tavily Search API.
 * Adapted from aipowerranking TavilySearchService for recipe-specific discovery.
 *
 * Features:
 * - Zero-waste focused search queries
 * - Chef-targeted query generation for sustainable-chef roster
 * - Curated source allowlist for quality sites (including sustainable-chef domains)
 * - Domain blocklist for paywalled/low-quality/known-blocker sites
 * - Rate limiting with exponential backoff
 * - Day-of-week query rotation for diversity
 */

export interface DiscoveredRecipeUrl {
  url: string;
  title: string;
  description: string;
  source: string;
  publishedDate: string | null;
  score: number;
  searchQuery: string;
}

interface TavilyApiResult {
  title: string;
  url: string;
  content: string;
  score: number;
  published_date?: string;
}

interface TavilyApiResponse {
  query: string;
  results: TavilyApiResult[];
  response_time: number;
}

/**
 * Zero-waste focused generic search queries for recipe discovery.
 * Expanded and diversified — avoid hardcoding known-blocker site names.
 */
const ZERO_WASTE_QUERIES = [
  'zero waste recipe minimalistbaker.com OR budgetbytes.com OR food52.com',
  'fridge cleanout recipe scraps wilted vegetable "use up"',
  'overripe fruit recipe "use everything" zero waste cooking',
  'stale bread recipe leftover rice pantry clearout',
  'no waste cooking freezer recipe budget pantry',
  'vegetable scrap recipe use leftover bones stock',
  'leftover friendly recipe minimal food waste sustainable cooking',
  'root to stem cooking recipe reduce food waste',
  'zero waste kitchen recipe sourdough fermentation preservation',
  'sustainable recipe seasonal vegetable whole ingredient',
  'frugal cooking recipe "use every part" nose to tail',
  'cook from the pantry recipe "no waste" ingredients',
];

/**
 * Sustainable-chef roster with name → website domain.
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
const ALLOWED_DOMAINS = new Set([
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
const BLOCKED_DOMAINS = new Set([
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
  'www.seriouseats.com',
  'lovefoodhatewaste.com',
  'thekitchn.com',
  'ediblecommunities.com',
  'foodandwine.com',
]);

/**
 * URL patterns that indicate a recipe page
 */
const RECIPE_URL_INDICATORS = [
  '/recipe/',
  '/recipes/',
  '-recipe',
  '_recipe',
  '/how-to-make',
  '/cooking/',
  '/dish/',
];

/**
 * URL patterns that indicate non-recipe pages to skip
 */
const NON_RECIPE_URL_PATTERNS = [
  '/author/',
  '/by/',
  '/profile/',
  '/bio',
  '/about',
  '/tag/',
  '/category/',
  '/search',
  '/contributor/',
  '/writers/',
  '/staff/',
  '/team/',
  '/news/',
  '/article/', // Generic article pages
];

export class RecipeDiscoveryService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.tavily.com/search';
  private readonly retryDelayMs = 1000;
  private readonly maxRetries = 3;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.TAVILY_API_KEY || '';

    if (!this.apiKey) {
      console.warn('[RecipeDiscovery] No TAVILY_API_KEY configured. Service will not function.');
    }
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Discover zero-waste recipe URLs via Tavily Search
   *
   * @param options - Discovery options
   * @returns Array of discovered recipe URLs with metadata
   */
  async discoverRecipeUrls(
    options: { maxResults?: number; searchQuery?: string; allowedDomainsOnly?: boolean } = {}
  ): Promise<DiscoveredRecipeUrl[]> {
    if (!this.apiKey) {
      throw new Error('TAVILY_API_KEY is not configured — cannot discover recipes');
    }

    const { maxResults = 20, searchQuery, allowedDomainsOnly = false } = options;

    const queriesToRun = searchQuery ? [searchQuery] : this.getRotatingQueries();
    const discovered: DiscoveredRecipeUrl[] = [];
    const seenUrls = new Set<string>();

    for (const query of queriesToRun) {
      if (discovered.length >= maxResults) break;

      try {
        console.log(`[RecipeDiscovery] Searching: "${query.substring(0, 80)}..."`);

        const results = await this.executeSearch(query, {
          maxResults: 10,
          searchDepth: 'advanced',
          includeDomains: allowedDomainsOnly ? Array.from(ALLOWED_DOMAINS) : [],
        });

        for (const result of results) {
          if (seenUrls.has(result.url)) continue;
          if (!this.isValidRecipeUrl(result.url)) continue;

          seenUrls.add(result.url);
          discovered.push({ ...result, searchQuery: query });

          if (discovered.length >= maxResults) break;
        }

        // Rate limit: 1s between queries
        if (queriesToRun.indexOf(query) < queriesToRun.length - 1) {
          await this.sleep(1000);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`[RecipeDiscovery] Search failed for query "${query}": ${msg}`);
        // Continue with next query — don't let one failure abort the batch
      }
    }

    console.log(`[RecipeDiscovery] Discovered ${discovered.length} recipe URLs`);
    return discovered;
  }

  /**
   * Execute a single Tavily search with retry logic
   */
  private async executeSearch(
    query: string,
    options: {
      maxResults: number;
      searchDepth: 'basic' | 'advanced';
      includeDomains?: string[];
    }
  ): Promise<Omit<DiscoveredRecipeUrl, 'searchQuery'>[]> {
    const { maxResults, searchDepth, includeDomains = [] } = options;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const requestBody: Record<string, unknown> = {
          api_key: this.apiKey,
          query,
          search_depth: searchDepth,
          max_results: maxResults,
          include_answer: false,
          include_raw_content: false,
          topic: 'general',
        };

        if (includeDomains.length > 0) {
          requestBody.include_domains = includeDomains;
        }

        const response = await fetch(this.baseUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Tavily API error ${response.status}: ${errorText}`);
        }

        const data: TavilyApiResponse = await response.json();

        return data.results
          .filter((r) => this.isValidRecipeUrl(r.url))
          .map((r) => ({
            url: r.url,
            title: r.title || 'Untitled',
            description: r.content?.substring(0, 300) || '',
            source: this.extractDomain(r.url),
            publishedDate: r.published_date || null,
            score: r.score,
          }));
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.maxRetries) {
          const delay = this.retryDelayMs * 2 ** (attempt - 1);
          console.warn(
            `[RecipeDiscovery] Search attempt ${attempt} failed, retrying in ${delay}ms: ${lastError.message}`
          );
          await this.sleep(delay);
        }
      }
    }

    throw lastError ?? new Error('All search attempts failed');
  }

  /**
   * Validate a URL as a likely recipe page
   */
  private isValidRecipeUrl(url: string): boolean {
    let hostname: string;
    let pathname: string;

    try {
      const parsed = new URL(url);
      hostname = parsed.hostname.toLowerCase().replace('www.', '');
      pathname = parsed.pathname.toLowerCase();
    } catch {
      return false; // Invalid URL
    }

    // Reject blocked domains unconditionally
    if (BLOCKED_DOMAINS.has(hostname)) return false;

    // Reject known non-recipe URL patterns
    if (NON_RECIPE_URL_PATTERNS.some((p) => pathname.includes(p))) return false;

    // Accept if from an allowed domain (trusted source)
    if (ALLOWED_DOMAINS.has(hostname)) {
      // Even on trusted domains, skip obvious non-recipe pages
      const skipPaths = ['/about', '/contact', '/privacy', '/terms', '/shop'];
      return !skipPaths.some((p) => pathname.startsWith(p));
    }

    // For other domains, require a recipe indicator in the URL
    return RECIPE_URL_INDICATORS.some((indicator) => pathname.includes(indicator));
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return 'unknown';
    }
  }

  /**
   * Return a rotating subset of queries based on the current day.
   * Interleaves generic zero-waste queries with chef-targeted queries so each
   * daily run surfaces different URLs and covers the sustainable-chef roster.
   *
   * Chef-targeted queries follow the pattern used in scrape-chef-recipes.ts:
   *   "<Chef Name>" recipe site:<chef-domain>
   */
  private getRotatingQueries(): string[] {
    const dayIndex = new Date().getDay(); // 0–6

    // Rotate generic queries starting at day offset
    const genericOffset = dayIndex % ZERO_WASTE_QUERIES.length;
    const rotatedGeneric = [
      ...ZERO_WASTE_QUERIES.slice(genericOffset),
      ...ZERO_WASTE_QUERIES.slice(0, genericOffset),
    ].slice(0, 3); // 3 generic queries per run

    // Rotate chef targets — 2 chefs per day, cycling through the roster
    const chefOffset = (dayIndex * 2) % CHEF_QUERY_TARGETS.length;
    const chefPair = [
      CHEF_QUERY_TARGETS[chefOffset % CHEF_QUERY_TARGETS.length],
      CHEF_QUERY_TARGETS[(chefOffset + 1) % CHEF_QUERY_TARGETS.length],
    ];
    const chefQueries = chefPair.map(({ name, domain }) => `"${name}" recipe site:${domain}`);

    // Interleave: generic, chef, generic, chef, generic
    return [
      rotatedGeneric[0],
      chefQueries[0],
      rotatedGeneric[1],
      chefQueries[1],
      rotatedGeneric[2],
    ];
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton
let _instance: RecipeDiscoveryService | null = null;

export function getRecipeDiscoveryService(): RecipeDiscoveryService {
  if (!_instance) {
    _instance = new RecipeDiscoveryService();
  }
  return _instance;
}
