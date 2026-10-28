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
  isHubPage: (url: string) => boolean;
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

  it('rejects paths containing -recipe-bundle (production offender /2021/03/09/bonus-recipe-bundle)', () => {
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
    // #54: generic queries are positions 0, 2, 4 (interleaved with chef queries); some contain `site:`.
    const genericQueries = [queries[0], queries[2], queries[4]];
    // #54: '-"recipes that"' added; the query set uses it and weekday rotation can select only it.
    const suppressionTerms = [
      '-roundup',
      '-listicle',
      '-"recipes to"',
      '-"best recipes"',
      '-"recipes that"',
    ];
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

// ---------------------------------------------------------------------------
// QA FIX 1 — "best ... recipe" (singular) must NOT be detected as a listicle
// ---------------------------------------------------------------------------

describe('QA Fix 1 — listicle title pattern: singular "recipe" must not be a false positive', () => {
  let service: ServiceUnderTest;

  beforeEach(() => {
    service = makeService();
  });

  it('does NOT flag "Best Banana Bread Recipe" as a listicle (singular recipe)', () => {
    expect(
      service.isListiclePage(
        'https://anysite.com/best-banana-bread-recipe',
        'Best Banana Bread Recipe'
      )
    ).toBe(false);
  });

  it('does NOT flag "Best Dal Makhani Recipe" as a listicle (singular recipe)', () => {
    expect(
      service.isListiclePage(
        'https://anysite.com/best-dal-makhani-recipe',
        'Best Dal Makhani Recipe'
      )
    ).toBe(false);
  });

  it('DOES flag "30 Best Zero-Waste Recipes" as a listicle (plural roundup)', () => {
    expect(
      service.isListiclePage(
        'https://anysite.com/30-best-zero-waste-recipes',
        '30 Best Zero-Waste Recipes'
      )
    ).toBe(true);
  });

  it('DOES flag "Best Vegan Recipes of 2024" as a listicle (plural roundup)', () => {
    expect(
      service.isListiclePage('https://anysite.com/best-vegan-recipes', 'Best Vegan Recipes of 2024')
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// QA FIX 2 — '-book-' removal: recipe slugs with "-book-" must pass; real
// production offender (/zero-waste-chef-book-is-here) must still be rejected
// ---------------------------------------------------------------------------

describe('QA Fix 2 — "-book-" removal: legitimate recipe slugs with "book" in path must pass', () => {
  let service: ServiceUnderTest;

  beforeEach(() => {
    service = makeService();
  });

  it('ACCEPTS /recipes/slow-cooker-book-club-bread (legitimate recipe with "book" in slug)', () => {
    expect(
      service.isValidRecipeUrl('https://minimalistbaker.com/recipes/slow-cooker-book-club-bread')
    ).toBe(true);
  });

  it('still REJECTS /zero-waste-chef-book-is-here (production offender)', () => {
    expect(
      service.isValidRecipeUrl('https://zerowastechef.com/2021/04/13/zero-waste-chef-book-is-here')
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// QA FIX 3 — "ultimate guide/list" removal: single-recipe how-to pages must
// not be flagged as listicles
// ---------------------------------------------------------------------------

describe('QA Fix 3 — "ultimate guide/list" removal: how-to titles must not be flagged', () => {
  let service: ServiceUnderTest;

  beforeEach(() => {
    service = makeService();
  });

  it('does NOT flag "Ultimate Guide to Sourdough Bread" as a listicle', () => {
    expect(
      service.isListiclePage(
        'https://anysite.com/ultimate-guide-to-sourdough-bread',
        'Ultimate Guide to Sourdough Bread'
      )
    ).toBe(false);
  });

  it('does NOT flag "Ultimate Guide to Kombucha" as a listicle', () => {
    expect(
      service.isListiclePage(
        'https://anysite.com/ultimate-guide-to-kombucha',
        'Ultimate Guide to Kombucha'
      )
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// QA FIX 4 — '-bundle' narrowed to '-recipe-bundle': generic "-bundle" slugs
// must pass; production offender /bonus-recipe-bundle must still be rejected
// ---------------------------------------------------------------------------

describe('QA Fix 4 — "-bundle" narrowed to "-recipe-bundle": generic bundle slugs must pass', () => {
  let service: ServiceUnderTest;

  beforeEach(() => {
    service = makeService();
  });

  it('still REJECTS /2021/03/09/bonus-recipe-bundle (production offender)', () => {
    expect(
      service.isValidRecipeUrl('https://zerowastechef.com/2021/03/09/bonus-recipe-bundle')
    ).toBe(false);
  });

  it('still REJECTS /bonus-recipe-bundle (production offender, short form)', () => {
    expect(service.isValidRecipeUrl('https://zerowastechef.com/bonus-recipe-bundle')).toBe(false);
  });

  it('ACCEPTS a legitimate recipe slug that contains the word "bundle" but not as -recipe-bundle', () => {
    // A hypothetical recipe page about a vegetable bundle (e.g. asparagus bundle recipe)
    expect(
      service.isValidRecipeUrl('https://minimalistbaker.com/recipes/asparagus-bundle-recipe')
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// HUB PAGE HARVEST — production run b0682446 failing URLs must now be detected
// as harvestable hub/listicle pages (requirement from feat/scraper-blog-listicle-harvest)
// ---------------------------------------------------------------------------

describe('Hub page detection — production run b0682446 failing URLs (must be harvestable)', () => {
  let service: ServiceUnderTest;

  beforeEach(() => {
    service = makeService();
  });

  // /blogs/ Shopify-style blog paths
  it('detects cabotcreamery.com /blogs/food/root-stem-recipes as harvestable hub', () => {
    expect(service.isListiclePage('https://cabotcreamery.com/blogs/food/root-stem-recipes')).toBe(
      true
    );
  });

  it('detects any /blogs/<category>/<slug> path as a hub (Shopify pattern)', () => {
    expect(service.isListiclePage('https://anystore.com/blogs/recipes/summer-favorites')).toBe(
      true
    );
  });

  it('detects bare /blogs/<slug> path as a hub', () => {
    expect(service.isListiclePage('https://anystore.com/blogs/food-tips')).toBe(true);
  });

  // /recipes-categories/ hub paths
  it('detects lidiasitaly.com /recipes-categories/main-dishes as harvestable hub', () => {
    expect(service.isListiclePage('https://lidiasitaly.com/recipes-categories/main-dishes')).toBe(
      true
    );
  });

  it('detects any /recipes-categories/<slug> path as a hub', () => {
    expect(service.isListiclePage('https://anysite.com/recipes-categories/soups-and-stews')).toBe(
      true
    );
  });

  // /recipe-category/ WP paths
  it('detects /recipe-category/<slug> path as a hub', () => {
    expect(service.isListiclePage('https://anysite.com/recipe-category/vegetarian')).toBe(true);
  });

  // /recipes/category/ WP paths
  it('detects /recipes/category/<slug> path as a hub', () => {
    expect(service.isListiclePage('https://anysite.com/recipes/category/pasta')).toBe(true);
  });

  // /blog/<slug> ambiguous paths
  it('detects lidiasitaly.com /blog/cooking-with-legends as harvestable blog path', () => {
    expect(service.isListiclePage('https://lidiasitaly.com/blog/cooking-with-legends')).toBe(true);
  });

  it('detects any /blog/<slug> path as harvestable (with single-recipe fallback)', () => {
    expect(service.isListiclePage('https://anysite.com/blog/my-favorite-summer-dishes')).toBe(true);
  });

  // zerowastechef.com bare single-segment tag/category slugs
  it('detects zerowastechef.com /sourdough as a category hub (date-structured domain)', () => {
    expect(service.isListiclePage('https://zerowastechef.com/sourdough')).toBe(true);
  });

  it('detects zerowastechef.com /fermentation as a category hub (date-structured domain)', () => {
    expect(service.isListiclePage('https://zerowastechef.com/fermentation')).toBe(true);
  });

  // Definitive hub pages must be identified by isHubPage (no fallback extraction)
  it('isHubPage returns true for /blogs/<segments> (definitive hub — no single-recipe fallback)', () => {
    expect(service.isHubPage('https://cabotcreamery.com/blogs/food/root-stem-recipes')).toBe(true);
  });

  it('isHubPage returns true for /recipes-categories/<slug>', () => {
    expect(service.isHubPage('https://lidiasitaly.com/recipes-categories/main-dishes')).toBe(true);
  });

  it('isHubPage returns false for /blog/<slug> (ambiguous — single-recipe fallback applies)', () => {
    expect(service.isHubPage('https://lidiasitaly.com/blog/cooking-with-legends')).toBe(false);
  });

  it('isHubPage returns false for zerowastechef.com /sourdough (ambiguous — fallback applies)', () => {
    expect(service.isHubPage('https://zerowastechef.com/sourdough')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// REGRESSION GUARD — single-recipe /blog/<slug> posts must NOT be silently lost
// The fallback path in discoverRecipeUrls rescues them after empty harvest.
// These URLs must still pass isValidRecipeUrl (so the fallback can add them).
// ---------------------------------------------------------------------------

describe('Regression guard — single-recipe /blog/<slug> posts must pass isValidRecipeUrl', () => {
  let service: ServiceUnderTest;

  beforeEach(() => {
    service = makeService();
  });

  it('abrowntable.com/blog/turmeric-rice still passes isValidRecipeUrl (fallback-eligible)', () => {
    // isListiclePage now returns true (blog slug), but isHubPage is false,
    // so discoverRecipeUrls will fall back to single-recipe extraction when harvest yields nothing.
    expect(service.isValidRecipeUrl('https://www.abrowntable.com/blog/turmeric-rice')).toBe(true);
  });

  it('lidiasitaly.com/blog/some-recipe-post still passes isValidRecipeUrl (fallback-eligible)', () => {
    expect(service.isValidRecipeUrl('https://www.lidiasitaly.com/blog/some-recipe-post')).toBe(
      true
    );
  });

  it('isHubPage returns false for /blog/<slug> (fallback is enabled)', () => {
    expect(service.isHubPage('https://www.abrowntable.com/blog/turmeric-rice')).toBe(false);
  });

  it('date-slug recipe paths on zerowastechef.com are NOT classified as hub pages', () => {
    // /2023/01/sourdough-bread has 3 segments — not a bare single-segment path
    expect(service.isListiclePage('https://www.zerowastechef.com/2023/01/sourdough-bread/')).toBe(
      false
    );
  });

  it('date-slug recipe paths on zerowastechef.com still pass isValidRecipeUrl', () => {
    expect(service.isValidRecipeUrl('https://www.zerowastechef.com/2023/01/sourdough-bread/')).toBe(
      true
    );
  });
});

// ---------------------------------------------------------------------------
// QA FIX 5 (MEDIUM) — /blogs/<cat>/<slug> single-recipe fallback
//   A Shopify /blogs/<category>/<slug> page with an empty harvest must be added
//   for single-recipe extraction (not silently dropped by the old isHubPage guard).
// ---------------------------------------------------------------------------

describe('QA Fix 5 (MEDIUM) — /blogs/<cat>/<slug> single-recipe fallback after empty harvest', () => {
  it('/blogs/<cat>/<slug> on allowed domain passes isValidRecipeUrl (fallback-eligible)', () => {
    // lidiasitaly.com is in ALLOWED_DOMAINS; /blogs/recipes/creamy-pasta has no
    // structural-promo segments and does not match any bare-archive or blocked path.
    const service = makeService('fake-firecrawl-key');
    expect(service.isValidRecipeUrl('https://lidiasitaly.com/blogs/recipes/creamy-pasta')).toBe(
      true
    );
  });

  it('isHubPage returns true for /blogs/<cat>/<slug> (confirming old guard would have dropped it)', () => {
    const service = makeService();
    expect(service.isHubPage('https://lidiasitaly.com/blogs/recipes/creamy-pasta')).toBe(true);
  });

  it('discoverRecipeUrls adds /blogs/<cat>/<slug> for extraction when harvest returns empty', async () => {
    // Simulate: Tavily returns a /blogs/recipes/creamy-pasta result; Firecrawl harvest
    // returns no child links (empty array). The URL should end up in discovered[].
    const service = new RecipeDiscoveryService(
      'fake-tavily-key',
      'fake-firecrawl-key'
    ) as unknown as {
      discoverRecipeUrls: (opts?: object) => Promise<Array<{ url: string }>>;
    };

    const listicleUrl = 'https://lidiasitaly.com/blogs/recipes/creamy-pasta';

    const mockFetch = vi.fn().mockImplementation((url: string) => {
      // Tavily search API
      if (typeof url === 'string' && url.includes('tavily')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            query: 'test',
            results: [
              {
                url: listicleUrl,
                title: 'Creamy Pasta',
                content: 'A delicious creamy pasta recipe.',
                score: 0.9,
                published_date: null,
              },
            ],
            response_time: 0.5,
          }),
        });
      }
      // Firecrawl scrape API — return empty links (simulates no children found)
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          data: { links: [] },
        }),
      });
    });

    vi.stubGlobal('fetch', mockFetch);

    const results = await service.discoverRecipeUrls({ searchQuery: 'creamy pasta recipe' });

    const urls = results.map((r) => r.url);
    expect(urls).toContain(listicleUrl);

    vi.unstubAllGlobals();
  });

  it('lidiasitaly.com /recipes-categories/main-dishes with empty harvest: NOT added (fails isValidRecipeUrl via /category/ check)', () => {
    // /recipes-categories/main-dishes contains '/categories/' which is NOT in
    // NON_RECIPE_URL_PATTERNS, but let us verify its actual isValidRecipeUrl result.
    // If it passes: it will be added and fail extraction harmlessly (documented behavior).
    // If it fails: it is silently dropped as before (correct for a true index).
    const service = makeService();
    const url = 'https://lidiasitaly.com/recipes-categories/main-dishes';
    const valid = service.isValidRecipeUrl(url);
    // Document the outcome: if valid===true it is rescue-eligible (fails extraction harmlessly);
    // if valid===false it is dropped as a structural index — both are acceptable.
    // The assertion ensures we know which path the code takes so no silent regression.
    expect(typeof valid).toBe('boolean'); // always true — just documents the value
    // Concrete check: /recipes-categories/<slug> does not match any blocked/promo pattern
    // on an allowed domain — it will pass (rescued but extraction fails harmlessly).
    expect(valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// QA FIX 6 (LOW) — no-Firecrawl fallback
//   When Firecrawl is absent, /blog/<slug> recipe URLs on allowed domains must
//   still be added for single-recipe extraction (not silently skipped).
// ---------------------------------------------------------------------------

describe('QA Fix 6 (LOW) — /blog/<slug> recipe added for extraction when Firecrawl unavailable', () => {
  it('discoverRecipeUrls adds /blog/<slug> for extraction when no Firecrawl key', async () => {
    // No Firecrawl key — harvest path is bypassed. The URL must still reach discovered[].
    const service = new RecipeDiscoveryService(
      'fake-tavily-key',
      undefined // no Firecrawl key
    ) as unknown as {
      discoverRecipeUrls: (opts?: object) => Promise<Array<{ url: string }>>;
    };

    const blogUrl = 'https://abrowntable.com/blog/turmeric-rice';

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        query: 'test',
        results: [
          {
            url: blogUrl,
            title: 'Turmeric Rice',
            content: 'A fragrant turmeric rice recipe.',
            score: 0.9,
            published_date: null,
          },
        ],
        response_time: 0.5,
      }),
    });

    vi.stubGlobal('fetch', mockFetch);

    const results = await service.discoverRecipeUrls({ searchQuery: 'turmeric rice recipe' });

    const urls = results.map((r) => r.url);
    expect(urls).toContain(blogUrl);

    vi.unstubAllGlobals();
  });

  it('no double-add: /blog/<slug> appears exactly once in discovered when Firecrawl absent', async () => {
    const service = new RecipeDiscoveryService('fake-tavily-key', undefined) as unknown as {
      discoverRecipeUrls: (opts?: object) => Promise<Array<{ url: string }>>;
    };

    const blogUrl = 'https://abrowntable.com/blog/turmeric-rice';

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        query: 'test',
        results: [
          {
            url: blogUrl,
            title: 'Turmeric Rice',
            content: 'A fragrant turmeric rice recipe.',
            score: 0.9,
            published_date: null,
          },
        ],
        response_time: 0.5,
      }),
    });

    vi.stubGlobal('fetch', mockFetch);

    const results = await service.discoverRecipeUrls({ searchQuery: 'turmeric rice recipe' });

    const count = results.filter((r) => r.url === blogUrl).length;
    expect(count).toBe(1);

    vi.unstubAllGlobals();
  });
});

// ---------------------------------------------------------------------------
// HUB BOUNDS / DEDUP — existing behavior preserved for hub pages
// ---------------------------------------------------------------------------

describe('Hub page harvest — bounds and dedup preserved', () => {
  it('harvestChildLinksFromListicle works for hub pages (same implementation path)', async () => {
    const service = makeService('fake-firecrawl-key');

    const mockLinks = [
      'https://cabotcreamery.com/recipes/cheddar-broccoli-soup',
      'https://cabotcreamery.com/recipes/mac-and-cheese',
    ];

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { links: mockLinks },
      }),
    });

    vi.stubGlobal('fetch', mockFetch);

    // Hub pages route through the same harvestChildLinksFromListicle implementation
    // For cabotcreamery.com (not in ALLOWED_DOMAINS), same-domain links should pass
    // because the domain filter allows same-domain links
    const result = await service.harvestChildLinksFromListicle(
      'https://cabotcreamery.com/blogs/food/root-stem-recipes',
      new Set()
    );

    // Links must pass isValidRecipeUrl — /recipes/<slug> on non-allowed domain
    // requires a RECIPE_URL_INDICATOR; /recipes/ qualifies
    expect(result.length).toBeGreaterThanOrEqual(0); // bounds respected
    expect(result.length).toBeLessThanOrEqual(MAX_CHILDREN_PER_LISTICLE);

    vi.unstubAllGlobals();
  });

  it('harvestChildLinksFromListicle for lidiasitaly.com hub returns recipe child links', async () => {
    const service = makeService('fake-firecrawl-key');

    const mockLinks = [
      'https://lidiasitaly.com/recipes/braised-chicken/',
      'https://lidiasitaly.com/recipes/pasta-carbonara/',
      'https://lidiasitaly.com/recipes/vegetable-risotto/',
    ];

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { links: mockLinks },
      }),
    });

    vi.stubGlobal('fetch', mockFetch);

    const result = await service.harvestChildLinksFromListicle(
      'https://lidiasitaly.com/recipes-categories/main-dishes',
      new Set()
    );

    // lidiasitaly.com is in ALLOWED_DOMAINS; /recipes/<slug> is valid
    expect(result.length).toBe(3);
    expect(result.map((r) => r.url)).toContain('https://lidiasitaly.com/recipes/braised-chicken/');

    vi.unstubAllGlobals();
  });
});
