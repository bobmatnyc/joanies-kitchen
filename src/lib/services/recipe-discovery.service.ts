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

import { assertWithinDailyCap, trackCost } from '@/lib/costs';
import {
  ALLOWED_DOMAINS,
  CHEF_QUERY_TARGETS,
  MAX_CHILDREN_PER_LISTICLE,
  MAX_TOTAL_HARVESTED_PER_RUN,
  ZERO_WASTE_QUERIES,
} from './recipe-discovery-sources';
import * as discoveryUrl from './recipe-discovery-url';

// #298: re-exported so callers keep importing them from this module.
export {
  CHEF_QUERY_TARGETS,
  MAX_CHILDREN_PER_LISTICLE,
  MAX_TOTAL_HARVESTED_PER_RUN,
} from './recipe-discovery-sources';

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

  /** Listicle/roundup/hub check; see `isListiclePage` in ./recipe-discovery-url. */
  isListiclePage(url: string, title?: string): boolean {
    return discoveryUrl.isListiclePage(url, title);
  }

  /** Definitive hub/category page check; see `isHubPage` in ./recipe-discovery-url. */
  isHubPage(url: string): boolean {
    return discoveryUrl.isHubPage(url);
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

      // #57: daily cost ceiling hard stop before the paid call.
      await assertWithinDailyCap();
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
      await trackCost({ provider: 'firecrawl', operation: 'scrape', units: 1 });

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
              } else if (this.isValidRecipeUrl(result.url)) {
                // Fallback: harvest returned no children — the page may be a single
                // recipe (e.g. a Shopify /blogs/<cat>/<slug> single-recipe post, or a
                // /blog/<slug> recipe post). Add it for extraction if it passes URL
                // validation regardless of isHubPage — true structural category indexes
                // that contain no recipe data will simply fail extraction harmlessly, but
                // legitimate single-recipe pages at those URL shapes are rescued.
                console.log(
                  `[RecipeDiscovery] Listicle/hub page yielded no children, falling back to single-recipe extraction: ${result.url}`
                );
                seenUrls.add(result.url);
                discovered.push({ ...result, searchQuery: query });
                if (discovered.length >= maxResults) break;
              }
            } else if (this.isValidRecipeUrl(result.url) && !seenUrls.has(result.url)) {
              // Firecrawl unavailable (no key or harvest cap reached): do not silently drop
              // listicle/hub URLs that also pass isValidRecipeUrl — attempt single-recipe
              // extraction so legitimate single-recipe blog posts are not lost.
              console.log(
                `[RecipeDiscovery] No Firecrawl harvest available — attempting single-recipe extraction: ${result.url}`
              );
              seenUrls.add(result.url);
              discovered.push({ ...result, searchQuery: query });
              if (discovered.length >= maxResults) break;
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
    // #57: daily cost ceiling hard stop before the paid call; outside the retry loop.
    await assertWithinDailyCap();
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
        await trackCost({ provider: 'tavily', operation: `search.${searchDepth}` });

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

  /** Single-recipe URL check; see `isValidRecipeUrl` in ./recipe-discovery-url. */
  isValidRecipeUrl(url: string): boolean {
    return discoveryUrl.isValidRecipeUrl(url);
  }

  private extractDomain(url: string): string {
    return discoveryUrl.extractDomain(url);
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
