import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { DEFAULT_OG_IMAGE_ALT, DEFAULT_OG_IMAGE_SIZE } from '@/lib/default-og-image';
import { SITE_NAME } from '@/lib/site-title';

/**
 * #171: the site-wide Open Graph image. The root metadata pointed at a missing
 * `/og-image.png`, so every page without its own image served a 404 preview.
 *
 * Node runtime (the default) with the logo read from `public/` on disk. The route takes
 * no params, so Next prerenders it once at build time, where `process.cwd()` is the
 * project root. Node's `fetch` cannot read the `file:` URL that the edge-style
 * `fetch(new URL(..., import.meta.url))` pattern produces, so that pattern would not run
 * under vitest. The text uses `next/og`'s bundled default font; nothing is fetched.
 * Test: `src/app/__tests__/opengraph-image.test.ts`
 */

export const alt = DEFAULT_OG_IMAGE_ALT;
export const size = { ...DEFAULT_OG_IMAGE_SIZE };
export const contentType = 'image/png';

const LOGO_PATH = join(process.cwd(), 'public', 'joanies-kitchen-logo.png');

// Brand colours from src/app/globals.css (--jk-linen, --jk-olive, --jk-clay).
const LINEN = '#faf5ee';
const OLIVE = '#5b6049';
const CLAY = '#b46945';

export default async function OpengraphImage(): Promise<ImageResponse> {
  const logo = await readFile(LOGO_PATH);
  const logoSrc = `data:image/png;base64,${logo.toString('base64')}`;

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 48,
        backgroundColor: LINEN,
        borderBottom: `24px solid ${OLIVE}`,
      }}
    >
      {/* biome-ignore lint/performance/noImgElement: ImageResponse renders plain JSX, not next/image */}
      <img src={logoSrc} alt="" width={360} height={360} />
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 88, fontWeight: 700, color: OLIVE }}>{SITE_NAME}</div>
        <div style={{ fontSize: 40, color: CLAY, marginTop: 12 }}>
          Cook from your fridge. Waste nothing.
        </div>
      </div>
    </div>,
    { ...size }
  );
}
