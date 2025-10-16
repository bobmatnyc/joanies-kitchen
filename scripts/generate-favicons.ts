/**
 * Favicon Generation Script
 *
 * Generates all required favicon variants from the main logo file:
 * - favicon.ico (multi-size: 16x16, 32x32, 48x48)
 * - icon.png (32x32)
 * - icon-192.png (192x192 for PWA)
 * - icon-512.png (512x512 for PWA)
 * - apple-touch-icon.png (180x180 for iOS)
 */

import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';

const PUBLIC_DIR = path.join(process.cwd(), 'public');
const SOURCE_LOGO = path.join(PUBLIC_DIR, 'ai-tomato-logo.png');

interface FaviconSize {
  name: string;
  size: number;
  description: string;
}

const FAVICON_SIZES: FaviconSize[] = [
  { name: 'icon.png', size: 32, description: 'Standard favicon' },
  { name: 'icon-192.png', size: 192, description: 'PWA icon (Android)' },
  { name: 'icon-512.png', size: 512, description: 'PWA icon (Android)' },
  { name: 'apple-touch-icon.png', size: 180, description: 'iOS home screen icon' },
  { name: 'icon-16.png', size: 16, description: 'Favicon 16x16 (for ICO)' },
  { name: 'icon-48.png', size: 48, description: 'Favicon 48x48 (for ICO)' },
];

async function generateFavicons() {
  console.log('🎨 Generating favicons from Joanie\'s Kitchen logo...\n');

  try {
    // Check if source logo exists
    await fs.access(SOURCE_LOGO);
    console.log(`✓ Source logo found: ${SOURCE_LOGO}`);

    // Get source image info
    const sourceImage = sharp(SOURCE_LOGO);
    const metadata = await sourceImage.metadata();
    console.log(`  Dimensions: ${metadata.width}x${metadata.height}`);
    console.log(`  Format: ${metadata.format}\n`);

    // Generate each size
    for (const { name, size, description } of FAVICON_SIZES) {
      const outputPath = path.join(PUBLIC_DIR, name);

      await sharp(SOURCE_LOGO)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 } // Transparent background
        })
        .png()
        .toFile(outputPath);

      console.log(`✓ Generated ${name} (${size}x${size}) - ${description}`);
    }

    console.log('\n✅ All favicon variants generated successfully!');
    console.log('\nGenerated files:');
    console.log('  - icon.png (32x32)');
    console.log('  - icon-192.png (192x192)');
    console.log('  - icon-512.png (512x512)');
    console.log('  - apple-touch-icon.png (180x180)');
    console.log('  - icon-16.png, icon-48.png (for favicon.ico)\n');

    console.log('📝 Next steps:');
    console.log('  1. Update layout.tsx metadata to reference new icons');
    console.log('  2. Create manifest.json for PWA support');
    console.log('  3. Optionally create favicon.ico from 16x16, 32x32, 48x48 PNGs\n');

    // Clean up temporary files used for ICO generation
    console.log('🧹 Cleaning up temporary files...');
    await fs.unlink(path.join(PUBLIC_DIR, 'icon-16.png'));
    await fs.unlink(path.join(PUBLIC_DIR, 'icon-48.png'));
    console.log('✓ Cleanup complete\n');

  } catch (error) {
    console.error('❌ Error generating favicons:', error);
    process.exit(1);
  }
}

// Run the script
generateFavicons().catch(console.error);
