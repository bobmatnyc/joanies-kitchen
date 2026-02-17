import * as fs from 'node:fs';
import * as path from 'node:path';
import { db } from '@/lib/db';
import { slideshowPhotos } from '@/lib/db/schema';

/**
 * Seed slideshow photos from a log file or manual URLs
 *
 * Usage:
 *   pnpm tsx scripts/seed-slideshow-photos.ts [log-file-path]
 *
 * If no log file is provided, you'll need to manually update the PHOTO_URLS array
 */

// Manual photo URLs - UPDATE THESE with your Vercel Blob URLs
const PHOTO_URLS: string[] = [
  // Example format:
  // 'https://your-blob-storage.vercel-storage.com/slideshow/01-abc123.jpg',
  // 'https://your-blob-storage.vercel-storage.com/slideshow/02-def456.jpg',
  // Add all 33 URLs here...
];

async function seedFromLogFile(logFilePath: string) {
  console.log(`Reading URLs from: ${logFilePath}`);

  const logContent = fs.readFileSync(logFilePath, 'utf-8');
  const urls = logContent
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('http'))
    .filter((url) => url.includes('/slideshow/'));

  console.log(`Found ${urls.length} slideshow photo URLs`);

  if (urls.length === 0) {
    console.error('No slideshow URLs found in log file');
    process.exit(1);
  }

  return urls;
}

async function seedFromManualUrls() {
  if (PHOTO_URLS.length === 0) {
    console.error(
      'No URLs provided. Please update PHOTO_URLS in this script or provide a log file.'
    );
    process.exit(1);
  }

  console.log(`Using ${PHOTO_URLS.length} manually configured URLs`);
  return PHOTO_URLS;
}

async function main() {
  console.log('Starting slideshow photos seed...\n');

  try {
    // Determine source of URLs
    let urls: string[];
    const logFilePath = process.argv[2];

    if (logFilePath) {
      if (!fs.existsSync(logFilePath)) {
        console.error(`Log file not found: ${logFilePath}`);
        process.exit(1);
      }
      urls = await seedFromLogFile(logFilePath);
    } else {
      urls = await seedFromManualUrls();
    }

    // Check if photos already exist
    const existingPhotos = await db.select().from(slideshowPhotos);
    if (existingPhotos.length > 0) {
      console.log(`\nFound ${existingPhotos.length} existing photos.`);
      console.log('Do you want to:');
      console.log('1. Skip seeding (photos already exist)');
      console.log('2. Delete existing and re-seed');
      console.log('3. Add new photos (append to existing)');
      console.log('\nPlease run with appropriate flag or manually clean database first.');

      // For safety, exit without doing anything
      console.log('\nExiting without changes. To proceed:');
      console.log('- Delete existing photos manually, or');
      console.log('- Modify this script to handle existing photos');
      process.exit(0);
    }

    // Insert photos
    console.log(`\nInserting ${urls.length} photos...`);

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      const displayOrder = i + 1;
      const filename = path.basename(url);

      await db.insert(slideshowPhotos).values({
        image_url: url,
        caption: `Photo ${displayOrder}`, // Generic caption, can be updated later
        display_order: displayOrder,
        is_active: true,
      });

      console.log(`  ✓ Added photo ${displayOrder}: ${filename}`);
    }

    console.log(`\n✅ Successfully seeded ${urls.length} slideshow photos!`);
    console.log('\nNext steps:');
    console.log('1. Visit /admin to manage photos and update captions');
    console.log('2. Visit /about/photos to see the slideshow');
  } catch (error) {
    console.error('Error seeding photos:', error);
    process.exit(1);
  }

  process.exit(0);
}

main();
