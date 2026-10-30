/**
 * #172: parseRecipe must hand back only usable image URLs. Rows in prod hold a
 * Postgres array literal (`{"/ai-recipe-images/x.png"}`) or a `data:image/svg+xml`
 * lazy-load placeholder instead of a JSON array of URLs.
 */
import { describe, expect, it } from 'vitest';
import type { Recipe } from '@/lib/db/schema';
import { getRecipeImageUrls, isUsableImageUrl, parsePostgresArrayLiteral } from '../recipe-image';
import { parseRecipe } from '../recipe-utils';

const SVG =
  "data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' width='789' height='338'/%3e";

describe('getRecipeImageUrls (#172)', () => {
  it('keeps a JSON array of URLs unchanged', () => {
    const input = JSON.stringify(['https://a.com/1.jpg', '/img/2.png', '//cdn.x.com/3.png']);
    expect(getRecipeImageUrls(input)).toEqual([
      'https://a.com/1.jpg',
      '/img/2.png',
      'https://cdn.x.com/3.png',
    ]);
  });

  it('converts a Postgres array literal', () => {
    expect(getRecipeImageUrls('{"/ai-recipe-images/x.png"}')).toEqual(['/ai-recipe-images/x.png']);
  });

  it('parses quoted, escaped and unquoted literal elements', () => {
    expect(parsePostgresArrayLiteral('{"a\\"b","c,d",e,NULL}')).toEqual(['a"b', 'c,d', 'e']);
    expect(getRecipeImageUrls('{"https://a.com/1.jpg",/b.png}')).toEqual([
      'https://a.com/1.jpg',
      '/b.png',
    ]);
  });

  it('drops a data:svg placeholder', () => {
    expect(getRecipeImageUrls(JSON.stringify([SVG]))).toEqual([]);
    expect(isUsableImageUrl(SVG)).toBe(false);
  });

  it.each(['1', 'fill', '', '   '])('drops %j', (bad) => {
    expect(getRecipeImageUrls(JSON.stringify([bad]))).toEqual([]);
    expect(isUsableImageUrl(bad)).toBe(false);
  });

  it('keeps only the valid entries of a mixed input', () => {
    const input = JSON.stringify(['1', SVG, 'https://a.com/1.jpg', 'fill', '', '/ok.png']);
    expect(getRecipeImageUrls(input)).toEqual(['https://a.com/1.jpg', '/ok.png']);
  });

  it('returns [] for null and undefined', () => {
    expect(getRecipeImageUrls(null)).toEqual([]);
    expect(getRecipeImageUrls(undefined)).toEqual([]);
  });
});

describe('parseRecipe image fields (#172)', () => {
  const base = { ingredients: '[]', instructions: '[]', tags: null } as unknown as Recipe;

  it('handles the system_imported row shape', () => {
    const row = {
      ...base,
      images: '{"/ai-recipe-images/chili.png"}',
      image_url: '/ai-recipe-images/chili.png',
    } as Recipe;
    const parsed = parseRecipe(row);
    expect(parsed.images).toEqual(['/ai-recipe-images/chili.png']);
    expect(parsed.image_url).toBe('/ai-recipe-images/chili.png');
  });

  it('handles the masterclass placeholder row shape', () => {
    const row = { ...base, images: JSON.stringify([SVG]), image_url: SVG } as Recipe;
    const parsed = parseRecipe(row);
    expect(parsed.images).toEqual([]);
    expect(parsed.image_url).toBeNull();
  });
});
