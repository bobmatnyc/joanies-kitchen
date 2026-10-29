import { readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getBackgroundImages } from '@/app/actions/background-images';
import { toBackgroundImagesResult } from '@/lib/background-images';

describe('getBackgroundImages (#38)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns the background URLs when public/ is absent from the function bundle', async () => {
    // #38: a Vercel function runs from a cwd whose bundle carries no public/ dir.
    vi.spyOn(process, 'cwd').mockReturnValue(path.join(tmpdir(), 'no-public-dir-38'));
    const result = await getBackgroundImages();
    expect(result.success).toBe(true);
    expect(result.success && result.data).toContain('/backgrounds/01-textured.png');
  });

  it('reports an empty image list as an error, not success:true with no data', () => {
    expect(toBackgroundImagesResult([])).toEqual({
      success: false,
      error: expect.stringContaining('No background images'),
    });
  });

  it('keeps the generated manifest in sync with public/backgrounds', async () => {
    const dir = path.join(process.cwd(), 'public', 'backgrounds');
    const onDisk = readdirSync(dir)
      .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
      .sort()
      .map((f) => `/backgrounds/${f}`);
    const result = await getBackgroundImages();
    expect(result.success && result.data).toEqual(onDisk);
  });
});
