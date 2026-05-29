/**
 * Unit tests for RecipeDiscoveryService
 *
 * Covers:
 * - Domain blocklist filtering (including known-blocker domains)
 * - Allowed-domain acceptance
 * - Chef-targeted + rotating query generation
 * - URL validation helpers
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CHEF_QUERY_TARGETS, RecipeDiscoveryService } from '../recipe-discovery.service';

// ---------------------------------------------------------------------------
// Helpers — access private methods via casting (unit-test only)
// Using `unknown` cast + structural type to avoid TS intersection-with-private error.
// ---------------------------------------------------------------------------

interface ServiceUnderTest {
  isValidRecipeUrl: (url: string) => boolean;
  getRotatingQueries: () => string[];
  extractDomain: (url: string) => string;
  isConfigured: () => boolean;
}

function makeService(): ServiceUnderTest {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new RecipeDiscoveryService('fake-key') as unknown as ServiceUnderTest;
}

// ---------------------------------------------------------------------------
// Blocklist filtering
// ---------------------------------------------------------------------------

describe('RecipeDiscoveryService — domain blocklist', () => {
  let service: ServiceUnderTest;

  beforeEach(() => {
    service = makeService();
  });

  it('blocks reddit.com (known extraction rejector)', () => {
    expect(service.isValidRecipeUrl('https://www.reddit.com/r/cooking/comments/abc123')).toBe(
      false
    );
    expect(service.isValidRecipeUrl('https://reddit.com/r/zerowaste/comments/xyz')).toBe(false);
  });

  it('blocks seriouseats.com (known extraction rejector)', () => {
    expect(service.isValidRecipeUrl('https://www.seriouseats.com/recipe/carbonara')).toBe(false);
    expect(service.isValidRecipeUrl('https://seriouseats.com/pasta-recipe')).toBe(false);
  });

  it('blocks lovefoodhatewaste.com (known extraction rejector)', () => {
    expect(service.isValidRecipeUrl('https://lovefoodhatewaste.com/recipe/soup')).toBe(false);
  });

  it('blocks thekitchn.com (known extraction rejector)', () => {
    expect(service.isValidRecipeUrl('https://www.thekitchn.com/recipe/chicken-soup')).toBe(false);
  });

  it('blocks ediblecommunities.com (known extraction rejector)', () => {
    expect(service.isValidRecipeUrl('https://ediblecommunities.com/recipes/salad')).toBe(false);
  });

  it('blocks foodandwine.com (known extraction rejector)', () => {
    expect(service.isValidRecipeUrl('https://www.foodandwine.com/recipes/pasta')).toBe(false);
  });

  it('blocks pinterest.com', () => {
    expect(service.isValidRecipeUrl('https://www.pinterest.com/pin/12345')).toBe(false);
  });

  it('blocks nytimes.com', () => {
    // Use www.nytimes.com — hostname strip removes "www." leaving "nytimes.com"
    expect(service.isValidRecipeUrl('https://www.nytimes.com/recipes/apple-pie')).toBe(false);
  });

  it('blocks bonappetit.com (paywalled)', () => {
    expect(service.isValidRecipeUrl('https://www.bonappetit.com/recipe/pasta-primavera')).toBe(
      false
    );
  });

  it('blocks epicurious.com (paywalled)', () => {
    expect(service.isValidRecipeUrl('https://www.epicurious.com/recipes/roast-chicken')).toBe(
      false
    );
  });
});

// ---------------------------------------------------------------------------
// Allowed-domain acceptance
// ---------------------------------------------------------------------------

describe('RecipeDiscoveryService — allowed domains', () => {
  let service: ServiceUnderTest;

  beforeEach(() => {
    service = makeService();
  });

  it('accepts zerowastechef.com recipe pages', () => {
    expect(service.isValidRecipeUrl('https://www.zerowastechef.com/2023/01/sourdough-bread/')).toBe(
      true
    );
  });

  it('accepts omnivorescookbook.com recipe pages', () => {
    expect(service.isValidRecipeUrl('https://omnivorescookbook.com/mapo-tofu/')).toBe(true);
  });

  it('accepts lidiasitaly.com recipe pages', () => {
    expect(service.isValidRecipeUrl('https://www.lidiasitaly.com/recipes/braised-chicken/')).toBe(
      true
    );
  });

  it('accepts abrowntable.com recipe pages', () => {
    expect(service.isValidRecipeUrl('https://www.abrowntable.com/blog/turmeric-rice')).toBe(true);
  });

  it('accepts minimalistbaker.com recipe pages', () => {
    expect(
      service.isValidRecipeUrl('https://minimalistbaker.com/1-bowl-banana-oat-pancakes/')
    ).toBe(true);
  });

  it('rejects /about pages even on allowed domains', () => {
    expect(service.isValidRecipeUrl('https://zerowastechef.com/about')).toBe(false);
  });

  it('rejects /contact pages even on allowed domains', () => {
    expect(service.isValidRecipeUrl('https://minimalistbaker.com/contact')).toBe(false);
  });

  it('rejects /privacy pages even on allowed domains', () => {
    expect(service.isValidRecipeUrl('https://omnivorescookbook.com/privacy')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Non-recipe URL patterns (author/profile pages)
// ---------------------------------------------------------------------------

describe('RecipeDiscoveryService — non-recipe URL filtering', () => {
  let service: ServiceUnderTest;

  beforeEach(() => {
    service = makeService();
  });

  it('rejects /author/ pages on unknown domains with recipe indicator', () => {
    // Non-allowed domain — checks both recipe indicator and non-recipe pattern
    expect(service.isValidRecipeUrl('https://somerecipesite.com/author/jane-doe')).toBe(false);
  });

  it('rejects /category/ pages', () => {
    expect(service.isValidRecipeUrl('https://foodblog.com/category/pasta-recipes')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Chef-targeted query generation
// ---------------------------------------------------------------------------

describe('RecipeDiscoveryService — rotating query generation', () => {
  let service: ServiceUnderTest;

  beforeEach(() => {
    service = makeService();
  });

  it('returns exactly 5 queries per call', () => {
    const queries = service.getRotatingQueries();
    expect(queries).toHaveLength(5);
  });

  it('includes at least one chef-targeted query using site: syntax', () => {
    const queries: string[] = service.getRotatingQueries();
    const chefQueries = queries.filter((q: string) => q.includes('site:'));
    expect(chefQueries.length).toBeGreaterThanOrEqual(1);
  });

  it('chef queries include chef name in quotes', () => {
    const queries: string[] = service.getRotatingQueries();
    const chefQueries = queries.filter((q: string) => q.includes('site:'));
    for (const q of chefQueries) {
      // Should be: "Chef Name" recipe site:domain
      expect(q).toMatch(/^"[^"]+"\s+recipe\s+site:/);
    }
  });

  it('produces different first query on different days', () => {
    // Simulate different days by spying on Date.getDay()
    const spy = vi.spyOn(Date.prototype, 'getDay');

    spy.mockReturnValue(0);
    const mondayQueries = service.getRotatingQueries();

    spy.mockReturnValue(3);
    const thursdayQueries = service.getRotatingQueries();

    // At least the generic queries should differ (different rotation offset)
    expect(mondayQueries[0]).not.toBe(thursdayQueries[0]);

    spy.mockRestore();
  });

  it('all generated queries are non-empty strings', () => {
    const queries: string[] = service.getRotatingQueries();
    for (const q of queries) {
      expect(typeof q).toBe('string');
      expect(q.trim().length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// CHEF_QUERY_TARGETS completeness
// ---------------------------------------------------------------------------

describe('CHEF_QUERY_TARGETS', () => {
  it('includes zerowastechef.com for Anne-Marie Bonneau', () => {
    const target = CHEF_QUERY_TARGETS.find((c) => c.domain === 'zerowastechef.com');
    expect(target).toBeDefined();
    expect(target?.name).toContain('Bonneau');
  });

  it('includes lidiasitaly.com for Lidia Bastianich', () => {
    const target = CHEF_QUERY_TARGETS.find((c) => c.domain === 'lidiasitaly.com');
    expect(target).toBeDefined();
    expect(target?.name).toContain('Bastianich');
  });

  it('includes abrowntable.com for Nik Sharma', () => {
    const target = CHEF_QUERY_TARGETS.find((c) => c.domain === 'abrowntable.com');
    expect(target).toBeDefined();
    expect(target?.name).toContain('Sharma');
  });

  it('has at least 8 chef targets', () => {
    expect(CHEF_QUERY_TARGETS.length).toBeGreaterThanOrEqual(8);
  });

  it('every target has non-empty name and domain', () => {
    CHEF_QUERY_TARGETS.forEach(({ name, domain }) => {
      expect(name.trim().length).toBeGreaterThan(0);
      expect(domain.trim().length).toBeGreaterThan(0);
    });
  });
});

// ---------------------------------------------------------------------------
// extractDomain helper
// ---------------------------------------------------------------------------

describe('RecipeDiscoveryService — extractDomain', () => {
  let service: ServiceUnderTest;

  beforeEach(() => {
    service = makeService();
  });

  it('strips www. prefix', () => {
    expect(service.extractDomain('https://www.zerowastechef.com/recipe')).toBe('zerowastechef.com');
  });

  it('handles URLs without www', () => {
    expect(service.extractDomain('https://minimalistbaker.com/pancakes')).toBe(
      'minimalistbaker.com'
    );
  });

  it('returns unknown for invalid URLs', () => {
    expect(service.extractDomain('not-a-url')).toBe('unknown');
  });
});
