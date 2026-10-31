import { describe, expect, it } from 'vitest';
import {
  DEFAULT_OG_IMAGE_ALT,
  DEFAULT_OG_IMAGE_PATH,
  DEFAULT_OG_IMAGE_SIZE,
  socialImages,
} from '@/lib/default-og-image';

describe('#256 socialImages', () => {
  it('keeps the page image, with no width or height', () => {
    const out = socialImages({ url: 'https://example.com/a.jpg', alt: 'A' });
    expect(out.openGraph).toEqual([{ url: 'https://example.com/a.jpg', alt: 'A' }]);
    expect(out.twitter).toEqual(['https://example.com/a.jpg']);
  });

  it.each([undefined, null])('falls back to the generated default for %s', (none) => {
    const out = socialImages(none);
    expect(out.openGraph).toEqual([
      { url: DEFAULT_OG_IMAGE_PATH, ...DEFAULT_OG_IMAGE_SIZE, alt: DEFAULT_OG_IMAGE_ALT },
    ]);
    expect(out.twitter).toEqual(['/opengraph-image']);
  });
});
