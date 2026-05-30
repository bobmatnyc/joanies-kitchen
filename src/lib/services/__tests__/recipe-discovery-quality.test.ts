/**
 * Unit tests for RecipeDiscoveryService — Discovery Quality improvements
 *
 * Covers:
 * - Non-recipe URL classifier (requirement 1)
 *   - Exact failing URLs from production run 5378646b are rejected
 *   - Real single-recipe slugs are accepted
 * - Listicle/roundup detection (requirement 2)
 *   - Title-based and URL-based patterns
 *   - Failing URLs from production run detected as listicles
 * - Child-link harvest bounding + dedup (requirement 2)
 *   - MAX_CHILDREN_PER_LISTICLE respected
 *   - MAX_TOTAL_HARVESTED_PER_RUN respected
 *   - seenUrls deduplication works
 *   - Harvested children are not themselves re-harvestable as listicles
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_CHILDREN_PER_LISTICLE,
  MAX_TOTAL_HARVESTED_PER_RUN,
  RecipeDiscoveryService,
} from '../recipe-discovery.service';

// ---------------------------------------------------------------------------
// Helpers — access private/protected methods via type assertion
// ---------------------------------------------------------------------------

interface ServiceUnderTest {
  isValidRecipeUrl: (url: string) => boolean;
  isListiclePage: (url: string, title?: string) => boolean;
  harvestChildLinksFromListicle: (
    url: string,
    seenUrls: Set<string>
  ) => Promise<Array<{ url: string; description: string; searchQuery: string }>>;
  getRotatingQueries: () => string[];
  extractDomain: (url: string) => string;
}

function makeService(firecrawlKey?: string): ServiceUnderTest {
  return new RecipeDiscoveryService('fake-key', firecrawlKey) as unknown as ServiceUnderTest;
}

// ---------------------------------------------------------------------------
// 1. NON-RECIPE URL CLASSIFIER
//    Production run 5378646b failing URLs must be filtered OUT
// ---------------------------------------------------------------------------

describe('Non-recipe URL classifier — production failure URLs (must be rejected)', () => {
  let service: ServiceUnderTest;

  beforeEach(() => {
    service = makeService();
  });

  // Recipe-index / landing pages
  it('rejects zerowastechef.com/recipe-index', () => {
    expect(service.isValidRecipeUrl('https://zerowastechef.com/recipe-index')).toBe(false);
  });

  it('rejects zerowastechef.com/zero-waste-chef-cookbook', () => {
    expect(service.isValidRecipeUrl('https://zerowastechef.com/zero-waste-chef-cookbook')).toBe(
      false
    );
  });

  it('rejects zerowastechef.com book promo page', () => {
    expect(
      service.isValidRecipeUrl('https://zerowastechef.com/2021/04/13/zero-waste-chef-book-is-here')
    ).toBe(false);
  });

  it('rejects zerowastechef.com/2021/03/09/bonus-recipe-bundle', () => {
    expect(
      service.isValidRecipeUrl('https://zerowastechef.com/2021/03/09/bonus-recipe-bundle')
    ).toBe(false);
  });

  it('rejects bare /recipes path (archive/index page)', () => {
    expect(service.isValidRecipeUrl('https://zerowastechef.com/recipes')).toBe(false);
  });

  it('rejects bare /recipes/ path with trailing slash', () => {
    expect(service.isValidRecipeUrl('https://zerowastechef.com/recipes/')).toBe(false);
  });

  it('rejects /shop path on any domain', () => {
    expect(service.isValidRecipeUrl('https://zerowastechef.com/shop')).toBe(false);
    expect(service.isValidRecipeUrl('https://minimalistbaker.com/shop')).toBe(false);
  });

  it('rejects /cookbook segment on any domain', () => {
    expect(service.isValidRecipeUrl('https://zerowastechef.com/cookbook')).toBe(false);
    expect(service.isValidRecipeUrl('https://anysite.com/cookbook/buy-now')).toBe(false);
  });

  it('rejects /subscribe path on any domain', () => {
    expect(service.isValidRecipeUrl('https://zerowastechef.com/subscribe')).toBe(false);
  });

  it('rejects paths containing /bundle', () => {
    expect(
      service.isValidRecipeUrl('https://zerowastechef.com/2021/03/09/bonus-recipe-bundle')
    ).toBe(false);
  });

  it('rejects paths containing /bonus-', () => {
    expect(service.isValidRecipeUrl('https://zerowastechef.com/bonus-recipe-bundle')).toBe(false);
  });

  it('rejects bare /blog archive page', () => {
    expect(service.isValidRecipeUrl('https://zerowastechef.com/blog')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. NON-RECIPE CLASSIFIER — real single-recipe slugs MUST pass (no false positives)
// ---------------------------------------------------------------------------

describe('Non-recipe URL classifier — real recipe slugs (must be accepted)', () => {
  let service: ServiceUnderTest;

  beforeEach(() => {
    service = makeService();
  });

  it('accepts zerowastechef.com/2014/04/25/how-to-cook-black-beans', () => {
    expect(
      service.isValidRecipeUrl('https://zerowastechef.com/2014/04/25/how-to-cook-black-beans')
    ).toBe(true);
  });

  it('accepts zerowastechef.com/2023/01/sourdough-bread/', () => {
    expect(service.isValidRecipeUrl('https://www.zerowastechef.com/2023/01/sourdough-bread/')).toBe(
      true
    );
  });

  it('accepts zerowastechef.com/2022/05/10/fermented-hot-sauce', () => {
    expect(
      service.isValidRecipeUrl('https://zerowastechef.com/2022/05/10/fermented-hot-sauce')
    ).toBe(true);
  });

  it('accepts minimalistbaker.com/1-bowl-banana-oat-pancakes/', () => {
    expect(
      service.isValidRecipeUrl('https://minimalistbaker.com/1-bowl-banana-oat-pancakes/')
    ).toBe(true);
  });

  it('accepts omnivorescookbook.com/mapo-tofu/', () => {
    expect(service.isValidRecipeUrl('https://omnivorescookbook.com/mapo-tofu/')).toBe(true);
  });

  it('accepts lidiasitaly.com/recipes/braised-chicken/', () => {
    expect(service.isValidRecipeUrl('https://www.lidiasitaly.com/recipes/braised-chicken/')).toBe(
      true
    );
  });

  it('accepts abrowntable.com/blog/turmeric-rice (specific slug under /blog/)', () => {
    // /blog/turmeric-rice has a specific slug — not a bare /blog archive
    expect(service.isValidRecipeUrl('https://www.abrowntable.com/blog/turmeric-rice')).toBe(true);
  });

  it('accepts date-slug paths on allowed domains', () => {
    expect(
      service.isValidRecipeUrl('https://smittenkitchen.com/2021/03/roasted-cauliflower-soup/')
    ).toBe(true);
  });

  it('accepts /recipe/ path on non-allowed domains', () => {
    expect(service.isValidRecipeUrl('https://somecookingsite.com/recipe/lemon-chicken-pasta')).toBe(
      true
    );
  });

  it('accepts -recipe slug on non-allowed domains', () => {
    expect(service.isValidRecipeUrl('https://anotherfoodblog.com/lemon-chicken-recipe')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. LISTICLE / ROUNDUP DETECTION
//    Production run 5378646b failing listicle URLs must be detected
// ---------------------------------------------------------------------------

describe('Listicle/roundup detection — production failure URLs (must be detected as listicles)', () => {
  let service: ServiceUnderTest;

  beforeEach(() => {
    service = makeService();
  });

  it('detects "30 sustainable recipes that reduce food waste" by title', () => {
    expect(
      service.isListiclePage(
        'https://goingzerowaste.com/blog/sustainable-recipes',
        '30 sustainable recipes that reduce food waste'
      )
    ).toBe(true);
  });

  it('detects "27 dietitian-approved recipes" by title', () => {
    expect(
      service.isListiclePage(
        'https://sarahkoszyk.com/dietitian-recipes',
        '27 dietitian-approved recipes for zero waste cooking'
      )
    ).toBe(true);
  });

  it('detects URL pattern /blog/27-dietitian-approved-recipes', () => {
    expect(
      service.isListiclePage('https://sarahkoszyk.com/blog/27-dietitian-approved-recipes')
    ).toBe(true);
  });

  it('detects URL pattern /30-sustainable-recipes', () => {
    expect(
      service.isListiclePage(
        'https://goingzerowaste.com/blog/30-sustainable-recipes-that-reduce-food-waste'
      )
    ).toBe(true);
  });

  it('detects floridamilk.com listicle URL', () => {
    expect(
      service.isListiclePage(
        'https://floridamilk.com/recipes/20-zero-waste-recipes',
        '20 zero waste recipes you need to try'
      )
    ).toBe(true);
  });

  it('detects ecoblock.berkeley.edu blog roundup', () => {
    expect(
      service.isListiclePage(
        'https://ecoblock.berkeley.edu/blog/zero-waste-recipes',
        'Best zero waste recipes roundup'
      )
    ).toBe(true);
  });

  it('detects title containing "roundup"', () => {
    expect(
      service.isListiclePage('https://anysite.com/post', 'Recipe Roundup: Fall Favorites')
    ).toBe(true);
  });

  it('detects title "best vegan recipes"', () => {
    expect(
      service.isListiclePage('https://anysite.com/best-vegan-recipes', 'Best Vegan Recipes of 2024')
    ).toBe(true);
  });

  it('detects URL /best-vegan-recipes/', () => {
    expect(service.isListiclePage('https://anysite.com/best-vegan-recipes/')).toBe(true);
  });

  it('detects title "top 10 recipes"', () => {
    expect(
      service.isListiclePage('https://anysite.com/top-recipes', 'Top 10 recipes for summer')
    ).toBe(true);
  });

  it('detects "recipes to make with leftovers" by title', () => {
    expect(
      service.isListiclePage(
        'https://anysite.com/blog/leftovers',
        '15 recipes to make with leftovers'
      )
    ).toBe(true);
  });

  it('detects "recipes that reduce waste" title pattern', () => {
    expect(
      service.isListiclePage('https://anysite.com/waste-recipes', '12 recipes that reduce waste')
    ).toBe(true);
  });
});

describe('Listicle detection — false positive guard (single recipes must NOT be detected)', () => {
  let service: ServiceUnderTest;

  beforeEach(() => {
    service = makeService();
  });

  it('does NOT flag a single recipe URL as listicle', () => {
    expect(
      service.isListiclePage(
        'https://zerowastechef.com/2014/04/25/how-to-cook-black-beans',
        'How to Cook Black Beans from Scratch'
      )
    ).toBe(false);
  });

  it('does NOT flag date-slug recipe page as listicle', () => {
    expect(
      service.isListiclePage(
        'https://minimalistbaker.com/1-bowl-banana-oat-pancakes/',
        '1-Bowl Banana Oat Pancakes'
      )
    ).toBe(false);
  });

  it('does NOT flag "recipe" in title without number as listicle', () => {
    expect(
      service.isListiclePage(
        'https://cookieandkate.com/simple-granola-recipe/',
        'Simple Granola Recipe'
      )
    ).toBe(false);
  });

  it('does NOT flag "quick recipe" title as listicle (no number before "recipes")', () => {
    expect(
      service.isListiclePage(
        'https://budgetbytes.com/quick-pasta-recipe',
        'A Quick Pasta Recipe for Weeknights'
      )
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. CHILD-LINK HARVEST — bounding and dedup logic
// ---------------------------------------------------------------------------

describe('Child-link harvest bounding and dedup', () => {
  it('exports correct cap constants', () => {
    expect(MAX_CHILDREN_PER_LISTICLE).toBe(10);
    expect(MAX_TOTAL_HARVESTED_PER_RUN).toBe(15);
  });

  it('harvestChildLinksFromListicle returns empty array when no Firecrawl key', async () => {
    const service = makeService(undefined); // no firecrawl key
    const result = await service.harvestChildLinksFromListicle(
      'https://example.com/20-recipes',
      new Set()
    );
    expect(result).toEqual([]);
  });

  it('harvestChildLinksFromListicle deduplicates against seenUrls', async () => {
    const service = makeService('fake-firecrawl-key');

    // Mock fetch to return fake links
    const mockLinks = [
      'https://zerowastechef.com/2021/01/roasted-chickpeas',
      'https://zerowastechef.com/2021/02/lemon-pasta',
      'https://zerowastechef.com/2021/03/veggie-soup',
    ];

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { links: mockLinks },
      }),
    });

    vi.stubGlobal('fetch', mockFetch);

    const seenUrls = new Set(['https://zerowastechef.com/2021/01/roasted-chickpeas']);
    const result = await service.harvestChildLinksFromListicle(
      'https://zerowastechef.com/20-recipes',
      seenUrls
    );

    // First URL was already seen — should only get 2 results
    expect(result.length).toBe(2);
    expect(result.map((r) => r.url)).not.toContain(
      'https://zerowastechef.com/2021/01/roasted-chickpeas'
    );

    vi.unstubAllGlobals();
  });

  it('harvestChildLinksFromListicle respects MAX_CHILDREN_PER_LISTICLE cap', async () => {
    const service = makeService('fake-firecrawl-key');

    // Generate more links than the cap
    const manyLinks = Array.from({ length: MAX_CHILDREN_PER_LISTICLE + 5 }, (_, i) => ({
      url: `https://zerowastechef.com/recipe-${i}`,
      valid: true,
    })).map((_, i) => `https://zerowastechef.com/2021/01/recipe-slug-${i}`);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { links: manyLinks },
      }),
    });

    vi.stubGlobal('fetch', mockFetch);

    const result = await service.harvestChildLinksFromListicle(
      'https://zerowastechef.com/20-recipes',
      new Set()
    );

    expect(result.length).toBeLessThanOrEqual(MAX_CHILDREN_PER_LISTICLE);

    vi.unstubAllGlobals();
  });

  it('harvestChildLinksFromListicle filters out non-recipe child links', async () => {
    const service = makeService('fake-firecrawl-key');

    const mixedLinks = [
      'https://zerowastechef.com/2021/01/black-bean-soup', // valid recipe
      'https://zerowastechef.com/recipe-index', // non-recipe (index)
      'https://zerowastechef.com/cookbook', // non-recipe (promo)
      'https://zerowastechef.com/2021/02/sourdough-crackers', // valid recipe
      'https://reddit.com/r/zerowaste', // blocked domain
    ];

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { links: mixedLinks },
      }),
    });

    vi.stubGlobal('fetch', mockFetch);

    const result = await service.harvestChildLinksFromListicle(
      'https://zerowastechef.com/15-waste-recipes',
      new Set()
    );

    const resultUrls = result.map((r) => r.url);
    expect(resultUrls).toContain('https://zerowastechef.com/2021/01/black-bean-soup');
    expect(resultUrls).toContain('https://zerowastechef.com/2021/02/sourdough-crackers');
    expect(resultUrls).not.toContain('https://zerowastechef.com/recipe-index');
    expect(resultUrls).not.toContain('https://zerowastechef.com/cookbook');
    expect(resultUrls).not.toContain('https://reddit.com/r/zerowaste');

    vi.unstubAllGlobals();
  });

  it('harvestChildLinksFromListicle does not harvest listicle children as listicles (no recursion)', async () => {
    const service = makeService('fake-firecrawl-key');

    // Child link is itself a listicle — should be filtered out
    const links = [
      'https://zerowastechef.com/2021/01/real-recipe-page', // valid
      'https://zerowastechef.com/blog/30-zero-waste-recipes', // this is itself a listicle
    ];

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { links },
      }),
    });

    vi.stubGlobal('fetch', mockFetch);

    const result = await service.harvestChildLinksFromListicle(
      'https://zerowastechef.com/20-best-recipes',
      new Set()
    );

    const resultUrls = result.map((r) => r.url);
    expect(resultUrls).toContain('https://zerowastechef.com/2021/01/real-recipe-page');
    expect(resultUrls).not.toContain('https://zerowastechef.com/blog/30-zero-waste-recipes');

    vi.unstubAllGlobals();
  });

  it('harvestChildLinksFromListicle returns empty on Firecrawl HTTP error', async () => {
    const service = makeService('fake-firecrawl-key');

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'Rate limit exceeded',
    });

    vi.stubGlobal('fetch', mockFetch);

    const result = await service.harvestChildLinksFromListicle(
      'https://zerowastechef.com/20-recipes',
      new Set()
    );

    expect(result).toEqual([]);

    vi.unstubAllGlobals();
  });

  it('harvestChildLinksFromListicle returns empty on fetch exception', async () => {
    const service = makeService('fake-firecrawl-key');

    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));

    vi.stubGlobal('fetch', mockFetch);

    const result = await service.harvestChildLinksFromListicle(
      'https://zerowastechef.com/20-recipes',
      new Set()
    );

    expect(result).toEqual([]);

    vi.unstubAllGlobals();
  });

  it('harvested children have correct metadata (searchQuery prefixed with "harvested:")', async () => {
    const service = makeService('fake-firecrawl-key');

    const listicleUrl = 'https://zerowastechef.com/20-best-zero-waste-recipes';

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          links: ['https://zerowastechef.com/2021/01/real-recipe'],
        },
      }),
    });

    vi.stubGlobal('fetch', mockFetch);

    const result = await service.harvestChildLinksFromListicle(listicleUrl, new Set());

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].searchQuery).toBe(`harvested:${listicleUrl}`);
    expect(result[0].description).toContain(listicleUrl);

    vi.unstubAllGlobals();
  });
});

// ---------------------------------------------------------------------------
// 5. QUERY TUNING — rotating queries bias toward single-recipe pages
// ---------------------------------------------------------------------------

describe('Tavily query tuning — single-recipe bias', () => {
  let service: ServiceUnderTest;

  beforeEach(() => {
    service = makeService();
  });

  it('generic queries contain "recipe for" or "how to make" for single-recipe bias', () => {
    const queries = service.getRotatingQueries();
    // At least the generic queries (non-site:) should contain bias terms
    const genericQueries = queries.filter((q) => !q.includes('site:'));
    const biasTerms = [
      '"recipe for"',
      'how to make',
      'site:minimalistbaker',
      'site:budgetbytes',
      'site:food52',
      'site:101cookbooks',
      'site:smittenkitchen',
    ];
    const biasedCount = genericQueries.filter((q) =>
      biasTerms.some((term) => q.includes(term))
    ).length;
    expect(biasedCount).toBeGreaterThanOrEqual(1);
  });

  it('generic queries include exclusion terms to suppress roundups', () => {
    const queries = service.getRotatingQueries();
    const genericQueries = queries.filter((q) => !q.includes('site:'));
    const suppressionTerms = ['-roundup', '-listicle', '-"recipes to"', '-"best recipes"'];
    const suppressedCount = genericQueries.filter((q) =>
      suppressionTerms.some((term) => q.includes(term))
    ).length;
    // At least some queries should have exclusion terms
    expect(suppressedCount).toBeGreaterThanOrEqual(1);
  });

  it('chef queries use site: syntax targeting specific domains', () => {
    const queries = service.getRotatingQueries();
    const chefQueries = queries.filter((q) => q.includes('site:'));
    expect(chefQueries.length).toBeGreaterThanOrEqual(2);
    for (const q of chefQueries) {
      expect(q).toMatch(/site:\w+\.\w+/);
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Integration: existing tests still pass (regression guard)
// ---------------------------------------------------------------------------

describe('Regression — existing blocklist behavior preserved', () => {
  let service: ServiceUnderTest;

  beforeEach(() => {
    service = makeService();
  });

  it('still blocks reddit.com', () => {
    expect(service.isValidRecipeUrl('https://www.reddit.com/r/cooking/comments/abc123')).toBe(
      false
    );
  });

  it('still blocks seriouseats.com', () => {
    expect(service.isValidRecipeUrl('https://www.seriouseats.com/recipe/carbonara')).toBe(false);
  });

  it('still accepts zerowastechef.com recipe pages', () => {
    expect(service.isValidRecipeUrl('https://www.zerowastechef.com/2023/01/sourdough-bread/')).toBe(
      true
    );
  });

  it('still rejects /about pages on allowed domains', () => {
    expect(service.isValidRecipeUrl('https://zerowastechef.com/about')).toBe(false);
  });

  it('still rejects /contact pages on allowed domains', () => {
    expect(service.isValidRecipeUrl('https://minimalistbaker.com/contact')).toBe(false);
  });
});
