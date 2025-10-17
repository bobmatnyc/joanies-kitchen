'use server';

import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * Auto-discover background images from /public/backgrounds/ directory
 * Supports: JPG, JPEG, PNG, WEBP formats
 * Returns sorted list of image URLs
 */
export async function getBackgroundImages(): Promise<
  { success: true; data: string[] } | { success: false; error: string }
> {
  try {
    const backgroundsDir = path.join(process.cwd(), 'public', 'backgrounds');

    // Check if directory exists
    try {
      await fs.access(backgroundsDir);
    } catch {
      console.warn('[getBackgroundImages] /public/backgrounds/ directory does not exist');
      return { success: true, data: [] };
    }

    // Read directory contents
    const files = await fs.readdir(backgroundsDir);

    // Filter for image files (jpg, jpeg, png, webp)
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    const imageFiles = files
      .filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return imageExtensions.includes(ext);
      })
      .sort(); // Alphabetical order

    // Convert to public URLs
    const imageUrls = imageFiles.map((file) => `/backgrounds/${file}`);

    console.log(`[getBackgroundImages] Found ${imageUrls.length} background images`);

    return { success: true, data: imageUrls };
  } catch (error) {
    console.error('[getBackgroundImages] Error:', error);
    return { success: false, error: 'Failed to load background images' };
  }
}
