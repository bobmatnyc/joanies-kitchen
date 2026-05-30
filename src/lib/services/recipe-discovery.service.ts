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
 * - Non-recipe URL classifier: excludes index/archive/promo/roundup pages pre-extraction
 * - Listicle detection + child-link harvesting: roundup pages yield individual recipe links
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
 * Queries are phrased to surface specific single-recipe pages rather than
 * roundups/listicles. Use "recipe for" or specific dish names to bias Tavily
 * toward individual recipe pages.
 */
const ZERO_WASTE_QUERIES = [
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
 * URL patterns that always indicate non-recipe pages to skip.
 * Checked before allowed-domain logic so they are excluded everywhere.
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
  '/article/',
];

/**
 * Path segments that identify non-recipe structural/promo pages.
 * Applies to ALL domains (including allowed ones).
 */
const NON_RECIPE_PATH_SEGMENTS = [
  'recipe-index',
  'recipe-list',
  'recipe-archive',
  'cookbook',
  'book',
  'shop',
  'subscribe',
  'newsletter',
  'gift',
  'bundle',
  'press',
  'media',
  'events',
  'classes',
  'workshops',
  'index',
];

/**
 * URL path substrings (non-segment) for clearly-non-recipe pages.
 * Note: '-cookbook' catches compound slugs like /zero-waste-chef-cookbook.
 * Note: '-book-is-here' catches the specific production offender
 *   /zero-waste-chef-book-is-here (book promo page).
 *   The former '-book-' entry was removed — it was too broad and would reject
 *   legitimate recipe slugs like /recipes/slow-cooker-book-club-bread.
 * Note: '-recipe-bundle' catches /bonus-recipe-bundle and
 *   /2021/03/09/bonus-recipe-bundle without colliding with generic '-bundle'
 *   slugs that may legitimately appear in recipe names.
 */
const NON_RECIPE_PATH_SUBSTRINGS = [
  'recipe-index',
  '/cookbook',
  '-cookbook',
  '/the-book',
  '/buy-the-book',
  '-book-is-here',
  '/shop/',
  '/shop?',
  '/subscribe',
  '/gift',
  '-recipe-bundle',
  '/bonus-',
  '/promo',
  '/landing',
  '/press',
];

/**
 * Title and URL patterns that indicate a listicle / roundup page.
 * These pages contain LINKS to recipes rather than being a single recipe.
 */
const LISTICLE_TITLE_PATTERNS: RegExp[] = [
  /\b\d+\s+(?:easy\s+|quick\s+|healthy\s+|vegan\s+|simple\s+)?recipes?\b/i,
  /\brecipes\s+(?:to|that|for|you|we)\b/i,
  // PLURAL-ONLY: "best ... recipes" (plural) signals a roundup; singular "recipe" is fine.
  // Changed from /\bbest\s+.{0,30}recipes?\b/i — the ? caused false positives on
  // single-recipe titles like "Best Banana Bread Recipe".
  /\bbest\s+.{0,30}\brecipes\b/i,
  /\btop\s+\d+\s+recipes?\b/i,
  /\broundup\b/i,
  /\brecipe\s+roundup\b/i,
  /\bweekly\s+menu\b/i,
  /\bmeal\s+plan\b/i,
  /\bfavorite\s+recipes?\b/i,
  /\bcollection\s+of\s+recipes?\b/i,
  /\brecipes?\s+collection\b/i,
  // NOTE: /\bultimate\s+(?:guide|list)\b/i was removed — it flagged legitimate
  // single-recipe how-to pages like "Ultimate Guide to Sourdough Bread".
  /\b(?:dietitian|nutritionist)-approved\s+recipes?\b/i,
];

const LISTICLE_URL_PATTERNS: RegExp[] = [
  /\/\d+-(?:\w+-)*recipes(?:[-/]|$)/i,
  /\/(?:best|top|easy|healthy|quick|vegan)-\w+-recipes(?:[-/]|$)/i,
  /\/recipes-(?:to|that|for|you)\b/i,
  /\/roundup\b/i,
  /\/recipe-roundup\b/i,
  /\/\d+-sustainable/i,
  /\/\d+-zero-waste/i,
  /\/\d+-dietitian/i,
  /\/blog\/\w+-recipes?(?:[-/]|$)/i,
];

/**
 * URL patterns that identify DEFINITIVE hub/category/index pages — structural
 * pages that aggregate child recipe links and are never themselves single recipes.
 * These are routed through harvestChildLinksFromListicle with NO fallback to
 * single-recipe extraction.
 *
 * Covered shapes:
 *   /blogs/<segment(s)>       — Shopify-style blog category/roundup paths
 *                               (e.g. cabotcreamery.com/blogs/food/root-stem-recipes)
 *   /recipes-categories/<slug> — recipe category hub (e.g. lidiasitaly.com/recipes-categories/main-dishes)
 *   /recipe-category/<slug>   — alternate WP category path
 *   /recipes/category/<slug>  — WP-style recipes category
 */
const HUB_URL_PATTERNS: RegExp[] = [
  // /blogs/<segment(s)> — any /blogs/ path with at least one slug segment
  /\/blogs\/[^/]+(?:\/[^/]+)*/i,
  // /recipes-categories/<slug>
  /\/recipes-categories\/[^/]+/i,
  // /recipe-category/<slug>
  /\/recipe-category\/[^/]+/i,
  // /recipes/category/<slug>
  /\/recipes\/category\/[^/]+/i,
];

/**
 * URL patterns for /blog/<slug> paths — these are "ambiguous" pages that may be
 * either a single recipe post OR a blog roundup/index. Attempt harvest first;
 * if no child recipe links are found, fall back to single-recipe extraction.
 * Matches a /blog/ segment followed by exactly one slug (not /blog/ bare or
 * date-nested paths that already have recipe context).
 */
const BLOG_SLUG_PATTERN = /^\/blog\/([^/]+)\/?$/i;

/**
 * Domains where recipe pages are published under date-based URL paths
 * (e.g. /YYYY/MM/DD/slug or /YYYY/MM/slug). On these domains, a bare
 * single-segment path (e.g. /sourdough, /fermentation) is a category/tag
 * index page, NOT a single recipe — it should be harvested for child links.
 */
const DATE_STRUCTURED_RECIPE_DOMAINS = new Set(['zerowastechef.com']);

/**
 * Harvest bounds — cap children to avoid URL budget explosion.
 * Per listicle: max 10 child links harvested.
 * Per run: max 15 total harvested links across all listicles.
 */
export const MAX_CHILDREN_PER_LISTICLE = 10;
export const MAX_TOTAL_HARVESTED_PER_RUN = 15;

export class RecipeDiscoveryService {
  private readonly apiKey: string;
  private readonly firecrawlApiKey: string;
  private readonly baseUrl = 'https://api.tavily.com/search';
  private readonly retryDelayMs = 1000;
  private readonly maxRetries = 3;

  constructor(apiKey?: string, firecrawlApiKey?: string) {
    this.apiKey = apiKey || process.env.TAVILY_API_KEY || '';
    this.firecrawlApiKey = firecrawlApiKey || process.env.FIRECRAWL_API_KEY || '';

    if (!this.apiKey) {
      console.warn('[RecipeDiscovery] No TAVILY_API_KEY configured. Service will not function.');
    }
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Classify a URL as a listicle/roundup/hub page that should be harvested
   * for child recipe links rather than extracted as a single recipe.
   *
   * Returns true for:
   * - Classic listicle URL patterns (e.g. /20-vegan-recipes)
   * - Definitive structural hub pages (HUB_URL_PATTERNS): /blogs/<segments>,
   *   /recipes-categories/<slug>, /recipe-category/<slug>
   * - Ambiguous /blog/<slug> paths (may be roundup OR single recipe — see
   *   discoverRecipeUrls fallback logic for the distinction)
   * - Bare single-segment paths on date-structured domains (e.g. zerowastechef.com/sourdough)
   * - Title-based listicle patterns (e.g. "30 sustainable recipes")
   */
  isListiclePage(url: string, title?: string): boolean {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return false;
    }

    const pathname = parsed.pathname.toLowerCase();
    const hostname = parsed.hostname.toLowerCase().replace('www.', '');

    if (LISTICLE_URL_PATTERNS.some((p) => p.test(pathname))) return true;
    if (HUB_URL_PATTERNS.some((p) => p.test(pathname))) return true;
    if (BLOG_SLUG_PATTERN.test(pathname)) return true;

    // Bare single-segment paths on date-structured domains are category/tag hubs
    if (DATE_STRUCTURED_RECIPE_DOMAINS.has(hostname) && this.isBareSingleSegmentPath(pathname))
      return true;

    if (title && LISTICLE_TITLE_PATTERNS.some((p) => p.test(title))) return true;

    return false;
  }

  /**
   * Returns true if pathname has exactly one non-empty segment with no date structure.
   * e.g. /sourdough → true; /2023/01/sourdough → false; /recipes/soup → false
   */
  private isBareSingleSegmentPath(pathname: string): boolean {
    const segments = pathname.replace(/\/$/, '').split('/').filter(Boolean);
    if (segments.length !== 1) return false;
    // Exclude if the segment looks like a year (date-based path start)
    if (/^\d{4}$/.test(segments[0])) return false;
    return true;
  }

  /**
   * Returns true for DEFINITIVE structural hub/category pages — these are never
   * single recipe pages and have no fallback to single-recipe extraction.
   * Subset of isListiclePage() — only the structural HUB_URL_PATTERNS.
   *
   * Contrast with /blog/<slug> paths (matched by BLOG_SLUG_PATTERN) which are
   * "ambiguous" and DO have a single-recipe fallback in discoverRecipeUrls.
   */
  isHubPage(url: string): boolean {
    let pathname: string;
    try {
      pathname = new URL(url).pathname.toLowerCase();
    } catch {
      return false;
    }
    return HUB_URL_PATTERNS.some((p) => p.test(pathname));
  }

  /**
   * Harvest individual recipe links from a listicle/roundup page using Firecrawl.
   * Returns up to MAX_CHILDREN_PER_LISTICLE child URLs that pass isValidRecipeUrl().
   * Returns empty array if Firecrawl is not configured or scraping fails.
   *
   * Design constraints:
   * - Harvested URLs are NOT themselves re-harvested (no recursion)
   * - Results are capped at MAX_CHILDREN_PER_LISTICLE per call
   * - Caller caps total across the run at MAX_TOTAL_HARVESTED_PER_RUN
   */
  async harvestChildLinksFromListicle(
    listicleUrl: string,
    seenUrls: Set<string>
  ): Promise<DiscoveredRecipeUrl[]> {
    if (!this.firecrawlApiKey) {
      console.warn('[RecipeDiscovery] Cannot harvest listicle links — FIRECRAWL_API_KEY not set');
      return [];
    }

    try {
      console.log(`[RecipeDiscovery] Harvesting child links from listicle: ${listicleUrl}`);

      const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.firecrawlApiKey}`,
        },
        body: JSON.stringify({
          url: listicleUrl,
          formats: ['links'],
          onlyMainContent: true,
        }),
        signal: AbortSignal.timeout(20000),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`[RecipeDiscovery] Firecrawl scrape failed (${response.status}): ${errText}`);
        return [];
      }

      const data = (await response.json()) as {
        success?: boolean;
        data?: {
          links?: string[];
        };
      };

      const links: string[] = data?.data?.links ?? [];
      if (links.length === 0) {
        console.log(`[RecipeDiscovery] No links extracted from listicle: ${listicleUrl}`);
        return [];
      }

      const listicleDomain = this.extractDomain(listicleUrl);
      const harvested: DiscoveredRecipeUrl[] = [];

      for (const link of links) {
        if (harvested.length >= MAX_CHILDREN_PER_LISTICLE) break;
        if (seenUrls.has(link)) continue;

        // Must pass full validity check AND must not itself be a listicle (no recursion)
        if (!this.isValidRecipeUrl(link)) continue;
        if (this.isListiclePage(link)) continue;

        // Prefer same-domain links or known-allowed domains
        const linkDomain = this.extractDomain(link);
        if (linkDomain !== listicleDomain && !ALLOWED_DOMAINS.has(linkDomain)) continue;

        harvested.push({
          url: link,
          title: '',
          description: `Harvested from listicle: ${listicleUrl}`,
          source: linkDomain,
          publishedDate: null,
          score: 0.5,
          searchQuery: `harvested:${listicleUrl}`,
        });
        seenUrls.add(link);
      }

      console.log(
        `[RecipeDiscovery] Harvested ${harvested.length} child links from: ${listicleUrl}`
      );
      return harvested;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`[RecipeDiscovery] Failed to harvest from listicle ${listicleUrl}: ${msg}`);
      return [];
    }
  }

  /**
   * Discover zero-waste recipe URLs via Tavily Search
   *
   * Enhancement over previous version:
   * - Stronger isValidRecipeUrl() pre-filters non-recipe URLs
   * - Listicle/roundup pages are detected and their child recipe links are harvested
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
    let totalHarvested = 0;

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

          // Check if this is a listicle/roundup/hub — harvest children instead
          if (this.isListiclePage(result.url, result.title)) {
            console.log(
              `[RecipeDiscovery] Detected listicle/hub, harvesting child links: ${result.url}`
            );

            if (totalHarvested < MAX_TOTAL_HARVESTED_PER_RUN && this.firecrawlApiKey) {
              const children = await this.harvestChildLinksFromListicle(result.url, seenUrls);
              if (children.length > 0) {
                for (const child of children) {
                  if (totalHarvested >= MAX_TOTAL_HARVESTED_PER_RUN) break;
                  discovered.push({ ...child, searchQuery: query });
                  totalHarvested++;
                  if (discovered.length >= maxResults) break;
                }
              } else if (!this.isHubPage(result.url) && this.isValidRecipeUrl(result.url)) {
                // Fallback: a /blog/<slug> page yielded no children — it may be a single
                // recipe post. Attempt extraction on the page itself if it passes URL
                // validation (hub-only structural pages are never single recipes).
                console.log(
                  `[RecipeDiscovery] Blog page yielded no children, falling back to single-recipe extraction: ${result.url}`
                );
                seenUrls.add(result.url);
                discovered.push({ ...result, searchQuery: query });
                if (discovered.length >= maxResults) break;
              }
            } else {
              console.log(
                `[RecipeDiscovery] Harvest cap reached or no Firecrawl key — skipping listicle`
              );
            }
            seenUrls.add(result.url);
            continue;
          }

          // Normal single-recipe URL flow
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

        // Pass through listicle/hub pages (they are handled by discoverRecipeUrls),
        // filtering only truly invalid URLs (blocked domains, promo pages, etc.)
        // that are neither valid recipe pages NOR harvestable hub/listicle pages.
        return data.results
          .filter((r) => this.isListiclePage(r.url, r.title) || this.isValidRecipeUrl(r.url))
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
   * Validate a URL as a likely single-recipe page.
   *
   * Rejects:
   * - Blocked domains (paywalled, known-blockers)
   * - Standard non-recipe path patterns (/author/, /tag/, etc.)
   * - Non-recipe structural/promo paths on ANY domain
   * - Bare archive pages (/recipes, /blog with no slug)
   *
   * Accepts:
   * - Any specific slug on an allowed domain
   * - Non-allowed domains only if they contain a RECIPE_URL_INDICATOR
   */
  isValidRecipeUrl(url: string): boolean {
    let hostname: string;
    let pathname: string;

    try {
      const parsed = new URL(url);
      hostname = parsed.hostname.toLowerCase().replace('www.', '');
      pathname = parsed.pathname.toLowerCase();
    } catch {
      return false;
    }

    // Reject blocked domains unconditionally
    if (BLOCKED_DOMAINS.has(hostname)) return false;

    // Reject known non-recipe URL path patterns (author, tag, category, etc.)
    if (NON_RECIPE_URL_PATTERNS.some((p) => pathname.includes(p))) return false;

    // Reject structural/promo paths on any domain — these are never single recipes
    if (this.hasNonRecipePathSegment(pathname)) return false;
    if (NON_RECIPE_PATH_SUBSTRINGS.some((p) => pathname.includes(p))) return false;

    // Reject bare /recipes or /blog archive pages (no specific slug)
    if (this.isBareArchivePage(pathname)) return false;

    // Accept if from an allowed domain (trusted source)
    if (ALLOWED_DOMAINS.has(hostname)) {
      const skipPaths = ['/about', '/contact', '/privacy', '/terms', '/shop'];
      return !skipPaths.some((p) => pathname.startsWith(p));
    }

    // For other domains, require a recipe indicator in the URL
    return RECIPE_URL_INDICATORS.some((indicator) => pathname.includes(indicator));
  }

  /**
   * Check if any path segment matches a non-recipe segment.
   */
  private hasNonRecipePathSegment(pathname: string): boolean {
    const segments = pathname.split('/').filter(Boolean);
    return segments.some((seg) => NON_RECIPE_PATH_SEGMENTS.includes(seg));
  }

  /**
   * Detect bare archive pages with no specific recipe slug.
   * Does NOT reject paths like /recipes/my-great-dish or /blog/2021/01/soup.
   */
  private isBareArchivePage(pathname: string): boolean {
    const normalized = pathname.replace(/\/$/, '');
    // Empty path (homepage) is never a recipe
    if (normalized === '' || normalized === '/') return true;
    const bareArchivePaths = ['/recipes', '/blog', '/recipe', '/cooking'];
    return bareArchivePaths.includes(normalized);
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
   * Interleaves generic zero-waste queries with chef-targeted queries.
   * Chef queries use "recipe site:" framing to bias toward specific dish pages.
   */
  private getRotatingQueries(): string[] {
    const dayIndex = new Date().getDay(); // 0-6

    const genericOffset = dayIndex % ZERO_WASTE_QUERIES.length;
    const rotatedGeneric = [
      ...ZERO_WASTE_QUERIES.slice(genericOffset),
      ...ZERO_WASTE_QUERIES.slice(0, genericOffset),
    ].slice(0, 3);

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
