/**
 * Generate AI Tomato Logo and Favicons
 *
 * This script converts the SVG tomato logo to PNG format
 * and generates all required favicon sizes.
 */

import sharp from 'sharp';
import { readFileSync } from 'fs';
import { join } from 'path';

const PUBLIC_DIR = join(process.cwd(), 'public');
const SVG_PATH = join(PUBLIC_DIR, 'ai-tomato-logo.svg');

async function generateTomatoLogos() {
  console.log('🍅 Generating AI Tomato Logo and Favicons...\n');

  // Read SVG source
  const svgBuffer = readFileSync(SVG_PATH);

  // Generate main logo (1024x1024)
  console.log('Creating main logo (1024x1024)...');
  await sharp(svgBuffer)
    .resize(1024, 1024)
    .png()
    .toFile(join(PUBLIC_DIR, 'ai-tomato-logo.png'));
  console.log('✅ ai-tomato-logo.png created');

  // Generate favicon (32x32)
  console.log('Creating favicon (32x32)...');
  await sharp(svgBuffer)
    .resize(32, 32)
    .png()
    .toFile(join(PUBLIC_DIR, 'icon.png'));
  console.log('✅ icon.png created');

  // Generate PWA icon (192x192)
  console.log('Creating PWA icon (192x192)...');
  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile(join(PUBLIC_DIR, 'icon-192.png'));
  console.log('✅ icon-192.png created');

  // Generate PWA icon (512x512)
  console.log('Creating PWA icon (512x512)...');
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(join(PUBLIC_DIR, 'icon-512.png'));
  console.log('✅ icon-512.png created');

  // Generate Apple touch icon (180x180)
  console.log('Creating Apple touch icon (180x180)...');
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(join(PUBLIC_DIR, 'apple-touch-icon.png'));
  console.log('✅ apple-touch-icon.png created');

  console.log('\n✨ All AI Tomato logos and favicons generated successfully!');
  console.log('\nGenerated files:');
  console.log('  - ai-tomato-logo.png (1024x1024) - Main logo');
  console.log('  - icon.png (32x32) - Browser favicon');
  console.log('  - icon-192.png (192x192) - PWA icon');
  console.log('  - icon-512.png (512x512) - PWA icon');
  console.log('  - apple-touch-icon.png (180x180) - iOS home screen');
}

generateTomatoLogos().catch((error) => {
  console.error('❌ Error generating logos:', error);
  process.exit(1);
});
