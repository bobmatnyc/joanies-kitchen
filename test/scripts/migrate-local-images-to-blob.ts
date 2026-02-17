#!/usr/bin/env tsx
/**
 * Migrate LOCAL images from public/images/ to Vercel Blob Storage
 *
 * Usage:
 *   pnpm tsx scripts/migrate-local-images-to-blob.ts --category=backgrounds --dry-run
 *   pnpm tsx scripts/migrate-local-images-to-blob.ts --category=backgrounds
 *   pnpm tsx scripts/migrate-local-images-to-blob.ts --category=all
 *
 * Categories: backgrounds, chefs, tools, recipes, ingredients, all
 */

import { put } from '@vercel/blob';
import { glob } from 'glob';
import fs from 'fs/promises';
import path from 'path';

// ============================================================================
// Types
// ============================================================================

interface MigrationResult {
  originalPath: string;
  blobUrl: string;
  size: number;
  success: boolean;
  error?: string;
  category: string;
}

interface MigrationStats {
  total: number;
  successful: number;
  failed: number;
  totalSize: number;
  duration: number;
}

// ============================================================================
// Configuration
// ============================================================================

const CATEGORIES = {
  backgrounds: {
    pattern: 'public/images/backgrounds/**/*.{png,jpg,jpeg}',
    blobPrefix: 'backgrounds',
    priority: 1,
  },
  chefs: {
    pattern: 'public/images/chefs/**/*.{png,jpg,jpeg}',
    blobPrefix: 'chefs',
    priority: 2,
  },
  tools: {
    pattern: 'public/images/tools/**/*.{png,jpg,jpeg}',
    blobPrefix: 'tools',
    priority: 3,
  },
  recipes: {
    pattern: 'public/images/recipes/**/*.{png,jpg,jpeg}',
    blobPrefix: 'recipes',
    priority: 4,
  },
  ingredients: {
    pattern: 'public/images/ingredients/**/*.{png,jpg,jpeg}',
    blobPrefix: 'ingredients',
    priority: 5,
  },
} as const;

type CategoryName = keyof typeof CATEGORIES;

const BATCH_SIZE = 50; // Upload 50 images at a time
const DELAY_MS = 100; // Delay between uploads (rate limiting)

// ============================================================================
// Core Upload Functions
// ============================================================================

/**
 * Upload a single image to Vercel Blob
 */
async function uploadImage(
  filePath: string,
  dryRun: boolean = false
): Promise<{ url: string; size: number }> {
  const fileBuffer = await fs.readFile(filePath);
  const relativePath = filePath.replace('public/images/', '');

  if (dryRun) {
    return {
      url: `https://example.blob.vercel-storage.com/${relativePath}`,
      size: fileBuffer.length,
    };
  }

  const blob = await put(relativePath, fileBuffer, {
    access: 'public',
    addRandomSuffix: false,
  });

  return {
    url: blob.url,
    size: fileBuffer.length,
  };
}

/**
 * Upload a batch of images with progress tracking
 */
async function uploadBatch(
  files: string[],
  category: string,
  dryRun: boolean
): Promise<MigrationResult[]> {
  const results: MigrationResult[] = [];

  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    const fileName = path.basename(filePath);

    try {
      const { url, size } = await uploadImage(filePath, dryRun);

      results.push({
        originalPath: filePath,
        blobUrl: url,
        size,
        success: true,
        category,
      });

      process.stdout.write(`\r   ⬆️  ${i + 1}/${files.length}: ${fileName}${' '.repeat(30)}`);

      // Rate limiting
      if (!dryRun && i < files.length - 1) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }

    } catch (error: any) {
      results.push({
        originalPath: filePath,
        blobUrl: '',
        size: 0,
        success: false,
        error: error.message,
        category,
      });
    }
  }

  process.stdout.write('\r' + ' '.repeat(80) + '\r');
  return results;
}

// ============================================================================
// Category Migration
// ============================================================================

async function migrateCategory(
  categoryName: CategoryName,
  dryRun: boolean
): Promise<MigrationStats> {
  const category = CATEGORIES[categoryName];
  console.log(`\n🚀 Migrating ${categoryName}...`);

  const startTime = Date.now();
  const allFiles = await glob(category.pattern);

  console.log(`   Found: ${allFiles.length} files`);

  if (allFiles.length === 0) {
    return { total: 0, successful: 0, failed: 0, totalSize: 0, duration: 0 };
  }

  const allResults: MigrationResult[] = [];

  for (let i = 0; i < allFiles.length; i += BATCH_SIZE) {
    const batch = allFiles.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(allFiles.length / BATCH_SIZE);

    console.log(`\n   📦 Batch ${batchNum}/${totalBatches} (${batch.length} files)`);

    const results = await uploadBatch(batch, categoryName, dryRun);
    allResults.push(...results);
  }

  // Save results
  const filename = `tmp/migration-results-${categoryName}-${Date.now()}.json`;
  await fs.writeFile(filename, JSON.stringify(allResults, null, 2));
  console.log(`\n   📄 Results saved to: ${filename}`);

  const duration = Date.now() - startTime;
  return {
    total: allResults.length,
    successful: allResults.filter(r => r.success).length,
    failed: allResults.filter(r => !r.success).length,
    totalSize: allResults.reduce((sum, r) => sum + r.size, 0),
    duration,
  };
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const categoryArg = args.find(a => a.startsWith('--category='))?.split('=')[1];
  const dryRun = args.includes('--dry-run');

  if (!categoryArg) {
    console.error('❌ Usage: --category=<name> [--dry-run]');
    console.log('\nCategories:', Object.keys(CATEGORIES).join(', '), 'all');
    process.exit(1);
  }

  console.log('🎨 Vercel Blob Image Migration');
  console.log('================================\n');
  if (dryRun) console.log('⚠️  DRY RUN MODE\n');

  const startTime = Date.now();
  const allStats: Record<string, MigrationStats> = {};

  if (categoryArg === 'all') {
    const sorted = Object.entries(CATEGORIES)
      .sort((a, b) => a[1].priority - b[1].priority)
      .map(([name]) => name as CategoryName);

    for (const cat of sorted) {
      allStats[cat] = await migrateCategory(cat, dryRun);
    }
  } else {
    if (!(categoryArg in CATEGORIES)) {
      console.error(`❌ Invalid category: ${categoryArg}`);
      process.exit(1);
    }
    allStats[categoryArg] = await migrateCategory(categoryArg as CategoryName, dryRun);
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  for (const [name, stats] of Object.entries(allStats)) {
    const sizeMB = (stats.totalSize / 1024 / 1024).toFixed(2);
    console.log(`\n📊 ${name}:`);
    console.log(`   Success: ${stats.successful}/${stats.total}`);
    console.log(`   Size:    ${sizeMB} MB`);
  }

  console.log('\n✨ Migration complete!\n');
}

main().catch(console.error);
