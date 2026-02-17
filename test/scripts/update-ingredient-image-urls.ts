#!/usr/bin/env tsx

/**
 * Update Ingredient Image URLs to Vercel Blob Storage
 *
 * This script updates all ingredient image URLs in the database to use the new
 * Vercel Blob Storage URLs after migration.
 *
 * Usage: pnpm tsx scripts/update-ingredient-image-urls.ts
 */

import { db } from '@/lib/db';
import { ingredients } from '@/lib/db/ingredients-schema';
import { eq, or, like, sql } from 'drizzle-orm';
import { readFileSync } from 'fs';
import { join } from 'path';

// Migration result type
type MigrationResult = {
  originalPath: string;
  blobUrl: string;
  size: number;
  success: boolean;
  category: string;
};

// Processing statistics
type Stats = {
  totalProcessed: number;
  totalUpdated: number;
  totalSkipped: number;
  totalErrors: number;
  errors: Array<{ filename: string; error: string }>;
};

/**
 * Extract filename from path (e.g., "public/images/ingredients/tomato.png" -> "tomato")
 */
function extractFilename(path: string): string {
  const parts = path.split('/');
  const filenameWithExt = parts[parts.length - 1];
  return filenameWithExt.replace(/\.(png|jpg|jpeg|webp)$/i, '');
}

/**
 * Normalize ingredient name for matching
 * Converts "Green Onion" -> "green_onion" for comparison
 */
function normalizeForMatch(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special chars except dash and underscore
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/-+/g, '_') // Replace dashes with underscores
    .replace(/_+/g, '_'); // Collapse multiple underscores
}

/**
 * Find migration results file
 */
function findMigrationFile(): string {
  const tmpDir = join(process.cwd(), 'tmp');
  const fs = require('fs');
  const files = fs.readdirSync(tmpDir).filter((f: string) => f.startsWith('migration-results-ingredients-'));

  if (files.length === 0) {
    throw new Error('No migration results file found in tmp/');
  }

  // Use the most recent file
  files.sort().reverse();
  return join(tmpDir, files[0]);
}

/**
 * Load migration results from JSON file
 */
function loadMigrationResults(filePath: string): MigrationResult[] {
  console.log(`📂 Loading migration results from: ${filePath}\n`);
  const content = readFileSync(filePath, 'utf-8');
  const results = JSON.parse(content);

  if (!Array.isArray(results)) {
    throw new Error('Migration results file does not contain an array');
  }

  // Filter only successful migrations
  return results.filter((r: MigrationResult) => r.success === true);
}

/**
 * Update ingredient image URL in batches
 */
async function updateIngredientImageUrls() {
  const stats: Stats = {
    totalProcessed: 0,
    totalUpdated: 0,
    totalSkipped: 0,
    totalErrors: 0,
    errors: [],
  };

  try {
    // Load migration results
    const migrationFile = findMigrationFile();
    const migrationResults = loadMigrationResults(migrationFile);

    console.log(`✅ Loaded ${migrationResults.length} successful migrations\n`);
    console.log('🔄 Starting database updates...\n');

    const BATCH_SIZE = 50;
    const batches = Math.ceil(migrationResults.length / BATCH_SIZE);

    // Process in batches
    for (let batchIdx = 0; batchIdx < batches; batchIdx++) {
      const start = batchIdx * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, migrationResults.length);
      const batch = migrationResults.slice(start, end);

      console.log(`📦 Processing batch ${batchIdx + 1}/${batches} (${start + 1}-${end}/${migrationResults.length})`);

      // Process each item in the batch
      for (const result of batch) {
        stats.totalProcessed++;
        const filename = extractFilename(result.originalPath);
        const normalizedFilename = normalizeForMatch(filename);

        try {
          // Find ingredient by:
          // 1. Exact filename match in image_url
          // 2. Normalized name match (e.g., "green_onion" matches "Green Onion")
          // 3. Display name contains filename
          const matchingIngredients = await db
            .select()
            .from(ingredients)
            .where(
              or(
                like(ingredients.image_url, `%${filename}%`),
                sql`LOWER(REPLACE(REPLACE(REPLACE(${ingredients.name}, ' ', '_'), '-', '_'), '__', '_')) = ${normalizedFilename}`,
                sql`LOWER(REPLACE(REPLACE(REPLACE(${ingredients.display_name}, ' ', '_'), '-', '_'), '__', '_')) = ${normalizedFilename}`
              )
            )
            .limit(5); // Limit to prevent runaway queries

          if (matchingIngredients.length === 0) {
            stats.totalSkipped++;
            console.log(`  ⏭️  Skipped: ${filename} (no matching ingredient found)`);
            continue;
          }

          if (matchingIngredients.length > 1) {
            // Multiple matches - try to find the best one
            const exactMatch = matchingIngredients.find(
              (ing) => normalizeForMatch(ing.name) === normalizedFilename
            );
            const ingredient = exactMatch || matchingIngredients[0];

            // Update the best match
            await db
              .update(ingredients)
              .set({
                image_url: result.blobUrl,
                updated_at: new Date(),
              })
              .where(eq(ingredients.id, ingredient.id));

            stats.totalUpdated++;
            console.log(`  ✅ Updated: ${ingredient.display_name || ingredient.name} (${matchingIngredients.length} matches, used best)`);
          } else {
            // Single match - perfect!
            const ingredient = matchingIngredients[0];

            await db
              .update(ingredients)
              .set({
                image_url: result.blobUrl,
                updated_at: new Date(),
              })
              .where(eq(ingredients.id, ingredient.id));

            stats.totalUpdated++;
            console.log(`  ✅ Updated: ${ingredient.display_name || ingredient.name}`);
          }
        } catch (error) {
          stats.totalErrors++;
          const errorMsg = error instanceof Error ? error.message : String(error);
          stats.errors.push({ filename, error: errorMsg });
          console.error(`  ❌ Error updating ${filename}: ${errorMsg}`);
        }
      }

      // Progress indicator
      const progress = ((end / migrationResults.length) * 100).toFixed(1);
      console.log(`📊 Progress: ${stats.totalUpdated} updated, ${stats.totalSkipped} skipped, ${stats.totalErrors} errors (${progress}%)\n`);

      // Small delay between batches to avoid overwhelming the database
      if (batchIdx < batches - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    throw error;
  }

  return stats;
}

/**
 * Print summary report
 */
function printSummary(stats: Stats) {
  console.log('\n' + '='.repeat(60));
  console.log('📊 MIGRATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Processed:  ${stats.totalProcessed}`);
  console.log(`Total Updated:    ${stats.totalUpdated} ✅`);
  console.log(`Total Skipped:    ${stats.totalSkipped} ⏭️`);
  console.log(`Total Errors:     ${stats.totalErrors} ❌`);
  console.log('='.repeat(60));

  if (stats.totalErrors > 0) {
    console.log('\n⚠️  ERRORS ENCOUNTERED:');
    stats.errors.forEach(({ filename, error }) => {
      console.log(`  - ${filename}: ${error}`);
    });
  }

  // Calculate success rate
  const successRate = ((stats.totalUpdated / stats.totalProcessed) * 100).toFixed(1);
  console.log(`\n✅ Success Rate: ${successRate}%`);

  if (stats.totalSkipped > 0) {
    console.log(`\nℹ️  ${stats.totalSkipped} ingredients were skipped (no matching database entry found)`);
    console.log('   This is expected for ingredients that were in files but not in the database.');
  }

  console.log('\n✨ Migration complete!\n');
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Starting Ingredient Image URL Migration\n');

  try {
    const stats = await updateIngredientImageUrls();
    printSummary(stats);

    // Exit successfully
    process.exit(0);
  } catch (error) {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  }
}

// Run the script
main();
