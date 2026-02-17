#!/usr/bin/env tsx

/**
 * Chef Avatar Optimization Script
 *
 * Optimizes chef avatar images to standard specifications:
 * - Dimensions: 512x512px (1:1 aspect ratio)
 * - Format: JPEG and/or WebP
 * - File Size: Target <100KB
 * - Quality: 85%
 *
 * Usage:
 *   tsx scripts/optimize-chef-avatar.ts <input-path> <chef-slug> [options]
 *
 * Examples:
 *   tsx scripts/optimize-chef-avatar.ts ~/Downloads/kenji.jpg kenji-alt
 *   tsx scripts/optimize-chef-avatar.ts ~/Downloads/chef.png gordon-ramsay --format webp
 *   tsx scripts/optimize-chef-avatar.ts ~/Downloads/photo.jpg julia-child --quality 90
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

interface OptimizeOptions {
  inputPath: string;
  chefSlug: string;
  format?: 'jpg' | 'webp' | 'both';
  quality?: number;
  size?: number;
}

async function optimizeChefAvatar(options: OptimizeOptions): Promise<void> {
  const { inputPath, chefSlug, format = 'both', quality = 85, size = 512 } = options;

  // Validate input file exists
  try {
    await fs.access(inputPath);
  } catch (_error) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  // Ensure output directory exists
  const outputDir = path.join(process.cwd(), 'public', 'chefs', 'avatars');
  await fs.mkdir(outputDir, { recursive: true });

  console.log(`\nOptimizing chef avatar for: ${chefSlug}`);
  console.log(`Input: ${inputPath}`);
  console.log(`Output directory: ${outputDir}`);
  console.log(`Target size: ${size}x${size}px`);
  console.log(`Quality: ${quality}%`);
  console.log(`Format: ${format}\n`);

  // Load and process image
  const image = sharp(inputPath);

  // Get original image metadata
  const metadata = await image.metadata();
  console.log(`Original dimensions: ${metadata.width}x${metadata.height}px`);
  console.log(`Original format: ${metadata.format}`);
  console.log(`Original size: ${((await fs.stat(inputPath)).size / 1024).toFixed(2)}KB\n`);

  // Process JPEG version
  if (format === 'jpg' || format === 'both') {
    const jpgPath = path.join(outputDir, `${chefSlug}.jpg`);

    await image
      .clone()
      .resize(size, size, {
        fit: 'cover',
        position: 'center',
      })
      .jpeg({
        quality,
        progressive: true,
        mozjpeg: true,
      })
      .toFile(jpgPath);

    const jpgStats = await fs.stat(jpgPath);
    const jpgSize = (jpgStats.size / 1024).toFixed(2);
    const sizeStatus = parseFloat(jpgSize) > 100 ? '⚠️ ' : '✓ ';

    console.log(`${sizeStatus}Created ${chefSlug}.jpg (${jpgSize}KB)`);
  }

  // Process WebP version
  if (format === 'webp' || format === 'both') {
    const webpPath = path.join(outputDir, `${chefSlug}.webp`);

    await image
      .clone()
      .resize(size, size, {
        fit: 'cover',
        position: 'center',
      })
      .webp({
        quality,
        effort: 6, // Higher effort = better compression (0-6)
      })
      .toFile(webpPath);

    const webpStats = await fs.stat(webpPath);
    const webpSize = (webpStats.size / 1024).toFixed(2);
    const sizeStatus = parseFloat(webpSize) > 100 ? '⚠️ ' : '✓ ';

    console.log(`${sizeStatus}Created ${chefSlug}.webp (${webpSize}KB)`);
  }

  console.log('\n✓ Avatar optimization complete\n');
}

// Parse command line arguments
function parseArgs(): OptimizeOptions | null {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    return null;
  }

  const [inputPath, chefSlug] = args;

  const options: OptimizeOptions = {
    inputPath,
    chefSlug,
    format: 'both',
    quality: 85,
    size: 512,
  };

  // Parse optional flags
  for (let i = 2; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    if (arg === '--format' && nextArg) {
      if (['jpg', 'webp', 'both'].includes(nextArg)) {
        options.format = nextArg as 'jpg' | 'webp' | 'both';
        i++;
      }
    }

    if (arg === '--quality' && nextArg) {
      const quality = parseInt(nextArg, 10);
      if (!Number.isNaN(quality) && quality >= 1 && quality <= 100) {
        options.quality = quality;
        i++;
      }
    }

    if (arg === '--size' && nextArg) {
      const size = parseInt(nextArg, 10);
      if (!Number.isNaN(size) && size >= 128 && size <= 2048) {
        options.size = size;
        i++;
      }
    }
  }

  return options;
}

// Show usage instructions
function showUsage(): void {
  console.log(`
Chef Avatar Optimization Script

Usage:
  tsx scripts/optimize-chef-avatar.ts <input-path> <chef-slug> [options]

Arguments:
  input-path    Path to source image file
  chef-slug     Slug for the chef (e.g., 'kenji-alt', 'gordon-ramsay')

Options:
  --format <format>   Output format: 'jpg', 'webp', or 'both' (default: both)
  --quality <number>  JPEG/WebP quality: 1-100 (default: 85)
  --size <number>     Output dimensions in pixels (default: 512)

Examples:
  tsx scripts/optimize-chef-avatar.ts ~/Downloads/kenji.jpg kenji-alt
  tsx scripts/optimize-chef-avatar.ts ./chef.png gordon-ramsay --format webp
  tsx scripts/optimize-chef-avatar.ts ./photo.jpg julia-child --quality 90 --size 1024

Output:
  Files are saved to: public/chefs/avatars/

Target Specifications:
  - Dimensions: 512x512px (1:1 aspect ratio)
  - File Size: <100KB (target)
  - Quality: 85% (recommended)
  - Format: JPEG and WebP (for browser compatibility)
`);
}

// Main execution
if (require.main === module) {
  const options = parseArgs();

  if (!options) {
    showUsage();
    process.exit(1);
  }

  optimizeChefAvatar(options).catch((error) => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  });
}

export { optimizeChefAvatar, type OptimizeOptions };
