import { readdirSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/index.js';
import { ingredients } from '@/lib/db/ingredients-schema.js';

const IMAGES_DIR = 'public/images/ingredients';
const BASE_URL = '/images/ingredients';
const CHECK_INTERVAL_MS = 30000; // Check every 30 seconds
const BATCH_SIZE = 10; // Process 10 images at a time

interface ImageUpdate {
  ingredientName: string;
  imageUrl: string;
  filePath: string;
}

const processedFiles = new Set<string>();
let totalSynced = 0;
let lastCheckTime = Date.now();

/**
 * Get list of all PNG files in the images directory
 */
function getGeneratedImages(): string[] {
  try {
    const files = readdirSync(IMAGES_DIR);
    return files.filter((f) => f.endsWith('.png'));
  } catch (_error) {
    console.log(`⚠️  Images directory not ready yet: ${IMAGES_DIR}`);
    return [];
  }
}

/**
 * Convert filename to ingredient name (reverse of slugify)
 */
function filenameToIngredientName(filename: string): string {
  // Remove .png extension
  const nameWithoutExt = filename.replace('.png', '');

  // Replace underscores with spaces and capitalize
  return nameWithoutExt
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Update ingredient image URL in database
 */
async function updateIngredientImage(
  ingredientName: string,
  imageUrl: string,
  filename: string
): Promise<boolean> {
  try {
    // Strategy 1: Try exact name match (slug format)
    const slugName = ingredientName.toLowerCase().replace(/\s+/g, '-');
    let result = await db
      .update(ingredients)
      .set({ image_url: imageUrl })
      .where(eq(ingredients.name, slugName))
      .returning({ id: ingredients.id, name: ingredients.name });

    if (result.length > 0) {
      return true;
    }

    // Strategy 2: Try exact display_name match
    result = await db
      .update(ingredients)
      .set({ image_url: imageUrl })
      .where(eq(ingredients.display_name, ingredientName))
      .returning({ id: ingredients.id, name: ingredients.name });

    if (result.length > 0) {
      return true;
    }

    // Strategy 3: Try matching by the original filename (without .png)
    const fileSlug = filename.replace('.png', '');
    result = await db
      .update(ingredients)
      .set({ image_url: imageUrl })
      .where(eq(ingredients.name, fileSlug))
      .returning({ id: ingredients.id, name: ingredients.name });

    if (result.length > 0) {
      return true;
    }

    console.log(`  ⚠️  No ingredient found for: ${ingredientName} (${fileSlug})`);
    return false;
  } catch (error) {
    console.error(`  ❌ Error updating ${ingredientName}:`, error);
    return false;
  }
}

/**
 * Process new images in batches
 */
async function processNewImages(): Promise<number> {
  const allImages = getGeneratedImages();
  const newImages = allImages.filter((f) => !processedFiles.has(f));

  if (newImages.length === 0) {
    return 0;
  }

  console.log(`\n📸 Found ${newImages.length} new image(s) to sync...`);

  // Process in batches
  const batch = newImages.slice(0, BATCH_SIZE);
  let synced = 0;

  for (const filename of batch) {
    const ingredientName = filenameToIngredientName(filename);
    const imageUrl = `${BASE_URL}/${filename}`;

    console.log(`  → Syncing: ${ingredientName}`);

    const success = await updateIngredientImage(ingredientName, imageUrl, filename);

    if (success) {
      processedFiles.add(filename);
      synced++;
      totalSynced++;
    }
  }

  return synced;
}

/**
 * Display progress summary
 */
function displayProgress() {
  const allImages = getGeneratedImages();
  const totalGenerated = allImages.length;
  const percentSynced =
    totalGenerated > 0 ? ((totalSynced / totalGenerated) * 100).toFixed(1) : '0.0';

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 IMAGE SYNC PROGRESS`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Generated:  ${totalGenerated.toLocaleString()} images`);
  console.log(`Synced:     ${totalSynced.toLocaleString()} images (${percentSynced}%)`);
  console.log(`Pending:    ${(totalGenerated - totalSynced).toLocaleString()} images`);
  console.log(`${'='.repeat(60)}\n`);
}

/**
 * Main sync loop
 */
async function main() {
  console.log('🚀 Starting ingredient image sync service...\n');
  console.log(`📁 Watching: ${IMAGES_DIR}`);
  console.log(`🔄 Check interval: ${CHECK_INTERVAL_MS / 1000}s`);
  console.log(`📦 Batch size: ${BATCH_SIZE} images\n`);

  // Initial scan - mark existing images as processed if they already have URLs
  console.log('📋 Performing initial scan...');
  const existingImages = getGeneratedImages();
  console.log(`   Found ${existingImages.length} existing images\n`);

  // Main loop
  let iteration = 0;
  while (true) {
    iteration++;

    try {
      const synced = await processNewImages();

      if (synced > 0) {
        console.log(`✅ Synced ${synced} image(s) to database`);
        displayProgress();
      } else {
        const elapsed = Math.floor((Date.now() - lastCheckTime) / 1000);
        process.stdout.write(
          `\r⏳ Waiting for new images... (checked ${iteration} times, last: ${elapsed}s ago)`
        );
      }

      lastCheckTime = Date.now();

      // Wait before next check
      await new Promise((resolve) => setTimeout(resolve, CHECK_INTERVAL_MS));
    } catch (error) {
      console.error('\n❌ Error in sync loop:', error);
      console.log('🔄 Retrying in 30 seconds...\n');
      await new Promise((resolve) => setTimeout(resolve, 30000));
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down image sync service...');
  displayProgress();
  console.log('👋 Goodbye!\n');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Shutting down image sync service...');
  displayProgress();
  console.log('👋 Goodbye!\n');
  process.exit(0);
});

main().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
