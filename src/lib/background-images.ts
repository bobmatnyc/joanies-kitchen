export type BackgroundImagesResult =
  | { success: true; data: string[] }
  | { success: false; error: string };

/**
 * Why: #38 — an empty list hid a missing-directory failure as success.
 * What: maps manifest file names to /backgrounds/ URLs; an empty list is an error.
 * Test: `reports an empty image list as an error, not success:true with no data`
 */
export function toBackgroundImagesResult(files: readonly string[]): BackgroundImagesResult {
  if (files.length === 0) {
    return {
      success: false,
      error: 'No background images in manifest; run `pnpm generate:backgrounds`',
    };
  }
  return { success: true, data: files.map((file) => `/backgrounds/${file}`) };
}
