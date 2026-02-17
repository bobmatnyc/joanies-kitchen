#!/usr/bin/env tsx
/**
 * Migrate Recipe Images to Vercel Blob Storage
 *
 * This script migrates recipe images from external URLs to Vercel Blob storage.
 * This ensures images work in production and provides better performance.
 *
 * Features:
 * - Downloads images from external URLs
 * - Uploads to Vercel Blob with public access
 * - Updates database with new Blob URLs
 * - Handles errors gracefully
 * - Shows progress and statistics
 *
 * Usage:
 *   npx tsx scripts/migrate-images-to-blob.ts [--limit=N] [--dry-run]
 *
 * Options:
 *   --limit=N    Only process N recipes (for testing)
 *   --dry-run    Show what would be done without making changes
 */

// Load environment variables
import 'dotenv/config';

import { put } from '@vercel/blob';
import { and, eq, isNotNull, not } from 'drizzle-orm';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';

// Parse command line arguments
const args = process.argv.slice(2);
const limitArg = args.find((arg) => arg.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;
const dryRun = args.includes('--dry-run');

interface MigrationStats {
  total: number;
  processed: number;
  uploaded: number;
  skipped: number;
  failed: number;
  errors: Array<{ recipeId: string; recipeName: string; error: string }>;
}

/**
 * Check if URL is already a Blob URL
 */
function isBlobUrl(url: string): boolean {
  return url.includes('blob.vercel-storage.com') || url.includes('vercel.app/api/blob');
}

/**
 * Check if URL is an external image (not local)
 */
function isExternalUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}

/**
 * Generate a safe filename from URL
 */
function generateFilename(url: string, recipeId: string, index: number): string {
  // Extract file extension from URL
  const urlPath = new URL(url).pathname;
  const ext = urlPath.match(/\.(jpg|jpeg|png|webp|gif|avif)$/i)?.[0] || '.jpg';

  // Create safe filename
  return `recipes/${recipeId}-${index}${ext}`;
}

/**
 * Download image from URL
 */
async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Upload image to Vercel Blob
 */
async function uploadToBlob(
  imageBuffer: Buffer,
  filename: string,
  contentType: string
): Promise<string> {
  const blob = await put(filename, imageBuffer, {
    access: 'public',
    contentType,
  });

  return blob.url;
}

/**
 * Migrate images for a single recipe
 */
async function migrateRecipeImages(recipe: any, stats: MigrationStats): Promise<void> {
  const recipeId = recipe.id;
  const recipeName = recipe.name;

  try {
    // Parse images array
    let images: string[] = [];
    try {
      images = recipe.images ? JSON.parse(recipe.images) : [];
    } catch (_e) {
      console.log(`  ⚠️  Invalid images JSON for ${recipeName}`);
      stats.skipped++;
      return;
    }

    if (images.length === 0) {
      stats.skipped++;
      return;
    }

    console.log(`\n📸 Processing: ${recipeName}`);
    console.log(`   ID: ${recipeId}`);
    console.log(`   Images: ${images.length}`);

    const newImages: string[] = [];
    let migratedCount = 0;

    for (let i = 0; i < images.length; i++) {
      const imageUrl = images[i];

      // Skip if already a Blob URL
      if (isBlobUrl(imageUrl)) {
        console.log(`   ${i + 1}. ✓ Already in Blob: ${imageUrl.substring(0, 60)}...`);
        newImages.push(imageUrl);
        continue;
      }

      // Skip if not an external URL (local images)
      if (!isExternalUrl(imageUrl)) {
        console.log(`   ${i + 1}. ⚠️  Local image (skipping): ${imageUrl}`);
        newImages.push(imageUrl);
        continue;
      }

      if (dryRun) {
        console.log(`   ${i + 1}. [DRY RUN] Would upload: ${imageUrl.substring(0, 60)}...`);
        newImages.push(imageUrl);
        continue;
      }

      try {
        console.log(`   ${i + 1}. ⬇️  Downloading: ${imageUrl.substring(0, 60)}...`);
        const imageBuffer = await downloadImage(imageUrl);

        // Determine content type
        const contentType = imageUrl.match(/\.webp$/i)
          ? 'image/webp'
          : imageUrl.match(/\.avif$/i)
            ? 'image/avif'
            : imageUrl.match(/\.png$/i)
              ? 'image/png'
              : imageUrl.match(/\.gif$/i)
                ? 'image/gif'
                : 'image/jpeg';

        console.log(`      ⬆️  Uploading to Blob...`);
        const filename = generateFilename(imageUrl, recipeId, i);
        const blobUrl = await uploadToBlob(imageBuffer, filename, contentType);

        console.log(`      ✅ Uploaded: ${blobUrl.substring(0, 60)}...`);
        newImages.push(blobUrl);
        migratedCount++;
      } catch (error) {
        console.log(`      ❌ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        // Keep original URL on failure
        newImages.push(imageUrl);
        stats.errors.push({
          recipeId,
          recipeName,
          error: `Image ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }

    // Update database if any images were migrated
    if (migratedCount > 0 && !dryRun) {
      await db
        .update(recipes)
        .set({
          images: JSON.stringify(newImages),
          updated_at: new Date(),
        })
        .where(eq(recipes.id, recipeId));

      console.log(`   💾 Database updated with ${migratedCount} new Blob URLs`);
      stats.uploaded++;
    } else if (migratedCount === 0) {
      stats.skipped++;
    }

    stats.processed++;
  } catch (error) {
    console.error(`   ❌ Error processing recipe:`, error);
    stats.failed++;
    stats.errors.push({
      recipeId,
      recipeName,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Main migration function
 */
async function migrateImages() {
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║   📦 RECIPE IMAGES → VERCEL BLOB MIGRATION                        ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');

  // Check for Blob token
  if (!process.env.BLOB_READ_WRITE_TOKEN && !dryRun) {
    console.error('❌ Error: BLOB_READ_WRITE_TOKEN environment variable not found!');
    console.error('   Add it to your .env.local file and try again.\n');
    process.exit(1);
  }

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  if (limit) {
    console.log(`⚙️  Processing limit: ${limit} recipes\n`);
  }

  // Initialize stats
  const stats: MigrationStats = {
    total: 0,
    processed: 0,
    uploaded: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  try {
    // Find recipes with external images
    console.log('🔍 Finding recipes with images...\n');

    let query = db
      .select({
        id: recipes.id,
        name: recipes.name,
        images: recipes.images,
      })
      .from(recipes)
      .where(
        and(isNotNull(recipes.images), not(eq(recipes.images, '[]')), not(eq(recipes.images, '')))
      );

    if (limit) {
      query = query.limit(limit) as typeof query;
    }

    const recipesWithImages = await query;

    stats.total = recipesWithImages.length;

    console.log(`Found ${stats.total} recipes with images\n`);
    console.log('='.repeat(70));

    // Process each recipe
    for (const recipe of recipesWithImages) {
      await migrateRecipeImages(recipe, stats);
    }

    // Print summary
    console.log('\n');
    console.log('═'.repeat(70));
    console.log('MIGRATION SUMMARY');
    console.log('═'.repeat(70));
    console.log(`Total recipes: ${stats.total}`);
    console.log(`Processed: ${stats.processed}`);
    console.log(`✅ Images uploaded to Blob: ${stats.uploaded}`);
    console.log(`⚪ Skipped (no changes needed): ${stats.skipped}`);
    console.log(`❌ Failed: ${stats.failed}`);
    console.log('═'.repeat(70));

    if (stats.errors.length > 0) {
      console.log('\n⚠️  ERRORS ENCOUNTERED:');
      console.log('-'.repeat(70));
      stats.errors.forEach((err, i) => {
        console.log(`${i + 1}. ${err.recipeName} (${err.recipeId})`);
        console.log(`   Error: ${err.error}\n`);
      });
    }

    if (!dryRun && stats.uploaded > 0) {
      console.log('\n✅ Migration complete!');
      console.log('📍 Images are now hosted on Vercel Blob and will work in production.');
    } else if (dryRun) {
      console.log('\n🔍 Dry run complete. Run without --dry-run to perform migration.');
    }
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
migrateImages()
  .then(() => {
    console.log('\n✅ Script completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
