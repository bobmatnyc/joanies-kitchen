import { db } from '../src/lib/db';
import { slideshowPhotos } from '../src/lib/db/schema';

/**
 * Quick script to add a single slideshow photo URL
 *
 * Usage:
 *   pnpm tsx scripts/add-slideshow-url.ts "https://your-blob-url.com/slideshow/01-xyz.jpg" "Optional caption"
 */

async function main() {
  const url = process.argv[2];
  const caption = process.argv[3] || null;

  if (!url) {
    console.error('Error: Please provide a URL');
    console.log('\nUsage:');
    console.log('  pnpm tsx scripts/add-slideshow-url.ts "https://..." "Optional caption"');
    process.exit(1);
  }

  try {
    // Get the current max display_order
    const existingPhotos = await db.select().from(slideshowPhotos);
    const maxOrder =
      existingPhotos.length > 0 ? Math.max(...existingPhotos.map((p) => p.display_order)) : 0;

    // Insert the photo
    const [photo] = await db
      .insert(slideshowPhotos)
      .values({
        image_url: url,
        caption: caption,
        display_order: maxOrder + 1,
        is_active: true,
      })
      .returning();

    console.log(`✅ Added photo #${photo.display_order}`);
    console.log(`   URL: ${photo.image_url}`);
    if (photo.caption) {
      console.log(`   Caption: ${photo.caption}`);
    }
    console.log(`\nTotal photos: ${existingPhotos.length + 1}`);
  } catch (error) {
    console.error('Error adding photo:', error);
    process.exit(1);
  }

  process.exit(0);
}

main();
