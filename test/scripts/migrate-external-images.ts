#!/usr/bin/env tsx
/**
 * External Image Migration Script
 *
 * Migrates all external images (primarily from TheMealDB and Unsplash) to Vercel Blob storage.
 * This eliminates the need for remotePatterns in next.config.ts and improves performance.
 *
 * Usage:
 *   tsx scripts/migrate-external-images.ts [--dry-run] [--limit=10] [--domain=themealdb.com]
 *
 * Options:
 *   --dry-run: Show what would be migrated without actually doing it
 *   --limit: Only migrate N images (useful for testing)
 *   --domain: Only migrate from specific domain
 *   --force: Re-migrate even if already migrated
 */

import { neon } from '@neondatabase/serverless';
import { put } from '@vercel/blob';
import crypto from 'crypto';

const sql = neon(process.env.DATABASE_URL!);

interface MigrationOptions {
  dryRun: boolean;
  limit?: number;
  domain?: string;
  force: boolean;
}

interface Recipe {
  id: string;
  name: string;
  image_url: string | null;
}

// Parse command line arguments
function parseArgs(): MigrationOptions {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes('--dry-run'),
    limit: args.find(a => a.startsWith('--limit='))?.split('=')[1]
      ? parseInt(args.find(a => a.startsWith('--limit='))!.split('=')[1])
      : undefined,
    domain: args.find(a => a.startsWith('--domain='))?.split('=')[1],
    force: args.includes('--force'),
  };
}

// Generate stable filename from URL
function generateFilename(url: string, recipeId: string): string {
  const urlHash = crypto.createHash('md5').update(url).digest('hex').substring(0, 8);
  const extension = url.split('.').pop()?.split('?')[0] || 'jpg';
  return `recipes/${recipeId}-${urlHash}.${extension}`;
}

// Download image from URL
async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// Upload image to Vercel Blob
async function uploadToBlob(buffer: Buffer, filename: string): Promise<string> {
  const blob = await put(filename, buffer, {
    access: 'public',
    addRandomSuffix: false,
  });
  return blob.url;
}

// Get recipes with external images
async function getExternalImages(options: MigrationOptions): Promise<Recipe[]> {
  // Build base query
  let results: Recipe[];

  if (options.domain && options.limit) {
    results = await sql`
      SELECT id, name, image_url
      FROM recipes
      WHERE image_url LIKE 'http%'
        AND image_url NOT LIKE '%vercel-storage.com%'
        AND image_url NOT LIKE '%blob.vercel-app.com%'
        AND image_url LIKE ${'%' + options.domain + '%'}
      ORDER BY created_at DESC
      LIMIT ${options.limit}
    ` as Recipe[];
  } else if (options.domain) {
    results = await sql`
      SELECT id, name, image_url
      FROM recipes
      WHERE image_url LIKE 'http%'
        AND image_url NOT LIKE '%vercel-storage.com%'
        AND image_url NOT LIKE '%blob.vercel-app.com%'
        AND image_url LIKE ${'%' + options.domain + '%'}
      ORDER BY created_at DESC
    ` as Recipe[];
  } else if (options.limit) {
    results = await sql`
      SELECT id, name, image_url
      FROM recipes
      WHERE image_url LIKE 'http%'
        AND image_url NOT LIKE '%vercel-storage.com%'
        AND image_url NOT LIKE '%blob.vercel-app.com%'
      ORDER BY created_at DESC
      LIMIT ${options.limit}
    ` as Recipe[];
  } else {
    results = await sql`
      SELECT id, name, image_url
      FROM recipes
      WHERE image_url LIKE 'http%'
        AND image_url NOT LIKE '%vercel-storage.com%'
        AND image_url NOT LIKE '%blob.vercel-app.com%'
      ORDER BY created_at DESC
    ` as Recipe[];
  }

  return results;
}

// Update recipe with new blob URL
async function updateRecipeImage(recipeId: string, newUrl: string): Promise<void> {
  await sql`
    UPDATE recipes
    SET
      image_url = ${newUrl},
      updated_at = NOW()
    WHERE id = ${recipeId}
  `;
}

// Migrate a single image
async function migrateImage(recipe: Recipe, options: MigrationOptions): Promise<{
  success: boolean;
  oldUrl: string;
  newUrl?: string;
  error?: string;
}> {
  const oldUrl = recipe.image_url!;

  try {
    console.log(`  Downloading: ${oldUrl.substring(0, 80)}...`);

    if (options.dryRun) {
      const filename = generateFilename(oldUrl, recipe.id);
      return {
        success: true,
        oldUrl,
        newUrl: `https://[blob-storage]/${filename}`,
      };
    }

    // Download image
    const buffer = await downloadImage(oldUrl);
    console.log(`  Downloaded: ${(buffer.length / 1024).toFixed(2)} KB`);

    // Upload to Vercel Blob
    const filename = generateFilename(oldUrl, recipe.id);
    const newUrl = await uploadToBlob(buffer, filename);
    console.log(`  Uploaded: ${newUrl}`);

    // Update database
    await updateRecipeImage(recipe.id, newUrl);
    console.log(`  Updated database ✓`);

    return { success: true, oldUrl, newUrl };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`  Error: ${errorMsg}`);
    return { success: false, oldUrl, error: errorMsg };
  }
}

// Main migration function
async function main() {
  const options = parseArgs();

  console.log('🖼️  External Image Migration Script');
  console.log('=====================================\n');

  if (options.dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  // Get recipes with external images
  console.log('📊 Fetching recipes with external images...');
  const recipes = await getExternalImages(options);

  if (recipes.length === 0) {
    console.log('✅ No external images found!');
    return;
  }

  console.log(`Found ${recipes.length} recipes with external images\n`);

  // Show domain breakdown
  const domainCounts = recipes.reduce((acc, r) => {
    if (!r.image_url) return acc;
    const domain = new URL(r.image_url).hostname;
    acc[domain] = (acc[domain] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('Domain breakdown:');
  Object.entries(domainCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([domain, count]) => {
      console.log(`  ${domain}: ${count} images`);
    });
  console.log();

  // Migrate images
  const results = {
    total: recipes.length,
    success: 0,
    failed: 0,
    errors: [] as Array<{ recipe: string; error: string }>,
  };

  console.log(`🚀 Starting migration${options.dryRun ? ' (dry run)' : ''}...\n`);

  for (let i = 0; i < recipes.length; i++) {
    const recipe = recipes[i];
    console.log(`[${i + 1}/${recipes.length}] ${recipe.name}`);

    if (!recipe.image_url) {
      console.log('  Skipped: No image URL');
      continue;
    }

    const result = await migrateImage(recipe, options);

    if (result.success) {
      results.success++;
      console.log(`  ✓ Migrated successfully`);
    } else {
      results.failed++;
      results.errors.push({
        recipe: recipe.name,
        error: result.error || 'Unknown error',
      });
      console.log(`  ✗ Migration failed`);
    }

    console.log(); // Empty line between recipes
  }

  // Summary
  console.log('=====================================');
  console.log('📈 Migration Summary');
  console.log('=====================================');
  console.log(`Total recipes: ${results.total}`);
  console.log(`Successful: ${results.success}`);
  console.log(`Failed: ${results.failed}`);

  if (results.errors.length > 0) {
    console.log('\n❌ Errors:');
    results.errors.forEach(e => {
      console.log(`  ${e.recipe}: ${e.error}`);
    });
  }

  if (options.dryRun) {
    console.log('\n💡 This was a dry run. Run without --dry-run to perform actual migration.');
  } else {
    console.log('\n✅ Migration complete!');
  }
}

// Error handling
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
