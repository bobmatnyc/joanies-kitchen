// @vitest-environment node
/**
 * #171: the site-wide social image. The root metadata pointed at a missing
 * `/og-image.png`; `src/app/opengraph-image.tsx` and `twitter-image.tsx` now generate it,
 * and the root metadata leaves `images` unset so the file convention fills it in.
 */

import { describe, expect, it, vi } from 'vitest';

// The root layout's build-time imports: next/font/local has no loader under vitest, and
// globals.css needs the Tailwind PostCSS pipeline. Only the `metadata` export is under test.
vi.mock('next/font/local', () => ({ default: () => ({ variable: '', className: '' }) }));
vi.mock('@/app/globals.css', () => ({}));

import { metadata } from '@/app/layout';
import * as opengraphImage from '@/app/opengraph-image';
import * as twitterImage from '@/app/twitter-image';

/** Width and height from a PNG's IHDR chunk (bytes 16-23, big-endian). */
function pngSize(bytes: Uint8Array): { width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

describe('site-wide social image (#171)', () => {
  it('root metadata no longer names /og-image.png and leaves images to the file convention', () => {
    expect(JSON.stringify(metadata)).not.toContain('og-image.png');
    expect(metadata.openGraph).not.toHaveProperty('images');
    expect(metadata.twitter).not.toHaveProperty('images');
    expect(metadata.metadataBase).toBeInstanceOf(URL);
  });

  it('opengraph-image exports a 1200x630 PNG size, content type and alt', () => {
    expect(opengraphImage.size).toEqual({ width: 1200, height: 630 });
    expect(opengraphImage.contentType).toBe('image/png');
    expect(opengraphImage.alt).toContain("Joanie's Kitchen");
  });

  it('twitter-image re-exports the same image', () => {
    expect(twitterImage.default).toBe(opengraphImage.default);
    expect(twitterImage.size).toEqual(opengraphImage.size);
    expect(twitterImage.contentType).toBe(opengraphImage.contentType);
    expect(twitterImage.alt).toBe(opengraphImage.alt);
  });

  it('renders a 1200x630 PNG response', async () => {
    const response = await opengraphImage.default();

    expect(response).toBeInstanceOf(Response);
    expect(response.headers.get('content-type')).toBe('image/png');
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(pngSize(bytes)).toEqual({ width: 1200, height: 630 });
  }, 30_000);
});
