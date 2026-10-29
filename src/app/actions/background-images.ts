'use server';

import manifest from '@/generated/background-images.json';
import { type BackgroundImagesResult, toBackgroundImagesResult } from '@/lib/background-images';

/**
 * Why: #38 — the Vercel function bundle has no public/ dir, so a runtime
 * readdir of public/backgrounds returned an empty list in production.
 * What: returns /backgrounds/ URLs from the build-time manifest written by
 * `scripts/generate-background-manifest.ts` (runs in `prebuild`).
 * Test: `returns the background URLs when public/ is absent from the function bundle`
 */
export async function getBackgroundImages(): Promise<BackgroundImagesResult> {
  const result = toBackgroundImagesResult(manifest);
  if (!result.success) console.error('[getBackgroundImages]', result.error);
  return result;
}
