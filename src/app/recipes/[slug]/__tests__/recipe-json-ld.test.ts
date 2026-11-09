/**
 * Tdb: show recipe source (Bob 2026-11-09) — JSON-LD author, publisher and isBasedOn.
 */
import { describe, expect, it } from 'vitest';
import { buildRecipeJsonLd } from '@/lib/recipes/recipe-json-ld';
import { type RecipeSourceInput, resolveRecipeSource } from '@/lib/recipes/recipe-source';

const BASE = 'https://joanies.kitchen';
const RECIPE = { id: 'r1', slug: 'soup', name: 'Soup', ingredients: [], instructions: [] };
const PUBLISHER = { '@type': 'Organization', name: "Joanie's Kitchen", url: BASE };

function jsonLd(input: Partial<RecipeSourceInput>, authorProfile: object | null = null) {
  const source = resolveRecipeSource({
    source: null,
    isSystemRecipe: true,
    isAiGenerated: false,
    ...input,
  });
  return buildRecipeJsonLd({ recipe: RECIPE, baseUrl: BASE, totalTime: 0, authorProfile, source });
}

describe('buildRecipeJsonLd source fields', () => {
  it('a known chef is the Person author; the original URL is isBasedOn', () => {
    const ld = jsonLd({
      source: 'system',
      chef: { slug: 'dan-barber', name: 'Dan Barber', display_name: null },
      chefOriginalUrl: 'https://bluehill.com/r/1',
    });
    expect(ld.author).toEqual({
      '@type': 'Person',
      name: 'Dan Barber',
      url: `${BASE}/chef/dan-barber`,
    });
    expect(ld.publisher).toEqual(PUBLISHER);
    expect(ld.isBasedOn).toBe('https://bluehill.com/r/1');
  });

  it('a known site is the Organization author and isBasedOn', () => {
    const ld = jsonLd({ source: 'https://www.epicurious.com/recipes/soup?x=1' });
    expect(ld.author).toEqual({
      '@type': 'Organization',
      name: 'epicurious.com',
      url: 'https://www.epicurious.com',
    });
    expect(ld.publisher).toEqual(PUBLISHER);
    expect(ld.isBasedOn).toBe('https://www.epicurious.com/recipes/soup?x=1');
  });

  it('TheMealDB is the Organization author', () => {
    const ld = jsonLd({
      source: 'TheMealDB (ID: 53028)',
      site: { name: 'TheMealDB', slug: 'themealdb', website_url: 'https://www.themealdb.com' },
    });
    expect(ld.author).toEqual({
      '@type': 'Organization',
      name: 'TheMealDB',
      url: 'https://www.themealdb.com',
    });
    expect(ld.isBasedOn).toBe('https://www.themealdb.com/');
  });

  it("a placeholder source keeps the Joanie's Kitchen author and has no isBasedOn", () => {
    const ld = jsonLd({ source: 'Recipe Manager Team' });
    expect(ld.author).toEqual({ '@type': 'Organization', name: "Joanie's Kitchen" });
    expect(ld.publisher).toEqual(PUBLISHER);
    expect(ld.isBasedOn).toBeUndefined();
  });

  it('a javascript: source is never isBasedOn', () => {
    expect(jsonLd({ source: 'javascript:alert(1)' }).isBasedOn).toBeUndefined();
  });

  it('a user recipe keeps its public-profile author and carries no email', () => {
    const profile = { display_name: 'Joanie', username: 'joanie', email: 'joanie@example.com' };
    const ld = jsonLd(
      {
        isSystemRecipe: false,
        author: { isPublic: true, username: 'joanie', display_name: 'Joanie' },
      },
      profile
    );
    expect(ld.author).toEqual({ '@type': 'Person', name: 'Joanie' });
    expect(ld.publisher).toEqual(PUBLISHER);
    expect(ld.isBasedOn).toBeUndefined();
    const json = JSON.stringify(ld);
    expect(json).not.toContain('joanie@example.com');
    expect(json).not.toMatch(/email/i);
  });
});
