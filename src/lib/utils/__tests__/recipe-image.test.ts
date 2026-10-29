// #94: resolver contract for recipe display images.
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/utils/recipe-placeholders', () => ({
  getPlaceholderImage: () => '/placeholder.jpg',
}));

import { resolveRecipeImage, toUsableImageUrl } from '../recipe-image';

const FALLBACK = 'https://cdn.example.com/legacy.jpg';

describe('resolveRecipeImage', () => {
  it.each([
    ['malformed JSON', '[not json'],
    ['empty string', ''],
    ['empty array', '[]'],
    ['object JSON', '{"foo":1}'],
    ['array of empty strings', '["", "  "]'],
    ['array of non-strings', '[1, null, true, {"foo":1}]'],
    ['non-http scheme', '["data:image/png;base64,AAA", "javascript:alert(1)"]'],
    ['bare relative path', '["images/foo.jpg"]'],
    ['non-string number', 42],
    ['non-string object', { url: 5 }],
    ['null', null],
  ])('falls back to image_url for %s images', (_label, images) => {
    expect(() => resolveRecipeImage({ images, image_url: FALLBACK })).not.toThrow();
    expect(resolveRecipeImage({ images, image_url: FALLBACK })).toBe(FALLBACK);
  });

  it('returns the first usable http(s) URL, skipping unusable entries', () => {
    const images = JSON.stringify([
      {},
      '',
      'https://a.example.com/x.jpg',
      'https://b.example.com/y.jpg',
    ]);
    expect(resolveRecipeImage({ images, image_url: FALLBACK })).toBe('https://a.example.com/x.jpg');
  });

  it('ranks a valid https image_url above a root-relative images entry', () => {
    expect(
      resolveRecipeImage({ images: '["/x.jpg"]', image_url: 'https://cdn.example.com/u.jpg' })
    ).toBe('https://cdn.example.com/u.jpg');
  });

  it('ranks an https images entry above an earlier root-relative entry', () => {
    expect(resolveRecipeImage({ images: '["/local.jpg","https://cdn.example.com/a.jpg"]' })).toBe(
      'https://cdn.example.com/a.jpg'
    );
  });

  it('accepts root-relative paths', () => {
    expect(resolveRecipeImage({ images: '["/images/r.jpg"]' })).toBe('/images/r.jpg');
  });

  it('accepts object entries with a url field', () => {
    expect(resolveRecipeImage({ images: '[{"url":"https://a.example.com/o.jpg"}]' })).toBe(
      'https://a.example.com/o.jpg'
    );
  });

  it('returns the placeholder when neither images nor image_url is usable', () => {
    expect(resolveRecipeImage({ images: '[{}]', image_url: '' })).toBe('/placeholder.jpg');
    expect(resolveRecipeImage({ images: 'oops', image_url: 'not a url', tags: '{bad' })).toBe(
      '/placeholder.jpg'
    );
  });
});

describe('toUsableImageUrl', () => {
  it.each([
    ['https://x.example.com/a.jpg', 'https://x.example.com/a.jpg'],
    ['  http://x.example.com/a.jpg ', 'http://x.example.com/a.jpg'],
    ['//cdn.example.com/a.jpg', 'https://cdn.example.com/a.jpg'],
    ['/a.jpg', '/a.jpg'],
    ['/', null],
    ['https://', null],
    ['ftp://x/a.jpg', null],
    [undefined, null],
  ])('%s -> %s', (input, expected) => {
    expect(toUsableImageUrl(input)).toBe(expected);
  });
});
