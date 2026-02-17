#!/usr/bin/env tsx

/**
 * Remove Low-Quality Recipes
 *
 * Removes recipes with system_rating < 2.0 (Poor quality)
 * These recipes have critical issues that make them unusable.
 *
 * Features:
 * - Dry-run mode (default) - shows what would be removed
 * - Backup creation before removal
 * - Comprehensive logging
 * - Cascading deletes (embeddings, ratings, flags)
 *
 * Usage:
 *   npx tsx scripts/remove-low-quality-recipes.ts              # Dry run
 *   npx tsx scripts/remove-low-quality-recipes.ts --execute    # Execute removal
 *   npx tsx scripts/remove-low-quality-recipes.ts --threshold=2.5  # Custom threshold
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';

interface RemovalOptions {
  dryRun: boolean;
  threshold: number;
}

interface RemovalStats {
  total: number;
  removed: number;
  failed: number;
  errors: Array<{ recipeId: string; recipeName: string; error: string }>;
}

/**
 * Generate timestamp for filenames
 */
function getTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
}

/**
 * Save backup data to file
 */
async function saveBackup(recipesToRemove: any[], timestamp: string): Promise<string> {
  const tmpDir = path.join(process.cwd(), 'tmp');
  await fs.mkdir(tmpDir, { recursive: true });

  const backupPath = path.join(tmpDir, `low-quality-recipes-backup-${timestamp}.json`);
  await fs.writeFile(backupPath, JSON.stringify(recipesToRemove, null, 2));

  return backupPath;
}

/**
 * Save removal log to file
 */
async function saveLog(
  stats: RemovalStats,
  recipesRemoved: any[],
  timestamp: string
): Promise<string> {
  const tmpDir = path.join(process.cwd(), 'tmp');
  await fs.mkdir(tmpDir, { recursive: true });

  const logPath = path.join(tmpDir, `recipe-removal-log-${timestamp}.json`);
  const logData = {
    timestamp,
    stats,
    recipesRemoved: recipesRemoved.map((r) => ({
      id: r.id,
      name: r.name,
      rating: r.system_rating,
      reason: r.system_rating_reason,
      source: r.source,
    })),
  };

  await fs.writeFile(logPath, JSON.stringify(logData, null, 2));

  return logPath;
}

/**
 * Main removal function
 */
async function removeRecipes(options: RemovalOptions) {
  const timestamp = getTimestamp();

  console.log('🗑️  Remove Low-Quality Recipes');
  console.log('================================\n');
  console.log(
    `Mode: ${options.dryRun ? 'DRY RUN (use --execute to apply changes)' : 'EXECUTE (will delete from database)'}`
  );
  console.log(`Threshold: Removing recipes with rating < ${options.threshold}\n`);

  const stats: RemovalStats = {
    total: 0,
    removed: 0,
    failed: 0,
    errors: [],
  };

  try {
    // Fetch low-quality recipes
    console.log('📊 Fetching low-quality recipes...');
    const lowQualityRecipes = await db.execute(sql`
      SELECT
        id,
        name,
        system_rating,
        system_rating_reason,
        source,
        user_id,
        created_at
      FROM recipes
      WHERE system_rating < ${options.threshold}
      ORDER BY system_rating ASC
    `);

    stats.total = lowQualityRecipes.rows.length;

    if (stats.total === 0) {
      console.log('\n✅ No low-quality recipes found. Database is clean!');
      return;
    }

    console.log(`Found ${stats.total} recipes to remove\n`);

    // Save backup
    const backupPath = await saveBackup(lowQualityRecipes.rows, timestamp);
    console.log(`✅ Backup saved to: ${backupPath}\n`);

    // Display sample recipes
    console.log('━'.repeat(80));
    console.log('\n📋 Recipes to be removed:\n');

    const sampleCount = Math.min(10, stats.total);
    for (let i = 0; i < sampleCount; i++) {
      const recipe = lowQualityRecipes.rows[i];
      console.log(`[${i + 1}/${stats.total}] ${recipe.name}`);
      console.log(`    Rating: ${Number(recipe.system_rating).toFixed(1)}/5.0`);
      console.log(`    Reason: ${recipe.system_rating_reason}`);
      console.log(`    Source: ${recipe.source || 'Unknown'}`);
      console.log(`    ID: ${recipe.id}\n`);
    }

    if (stats.total > sampleCount) {
      console.log(`... and ${stats.total - sampleCount} more (see backup file for full list)\n`);
    }

    console.log(`${'━'.repeat(80)}\n`);

    if (!options.dryRun) {
      console.log('⚠️  LIVE MODE: Recipes will be permanently deleted!');
      console.log('⚠️  This will cascade delete embeddings, ratings, and flags.');
      console.log('\nStarting in 5 seconds... (Ctrl+C to cancel)\n');
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    // Remove recipes
    if (!options.dryRun) {
      console.log('🗑️  Removing recipes...\n');

      for (const recipe of lowQualityRecipes.rows) {
        try {
          await db.execute(sql`
            DELETE FROM recipes
            WHERE id = ${recipe.id}
          `);

          stats.removed++;
          console.log(`✓ [${stats.removed}/${stats.total}] Removed: ${recipe.name}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(
            `✗ [${stats.removed}/${stats.total}] Failed: ${recipe.name} - ${errorMessage}`
          );
          stats.failed++;
          stats.errors.push({
            recipeId: recipe.id,
            recipeName: recipe.name,
            error: errorMessage,
          });
        }
      }
    } else {
      console.log('💡 DRY RUN: Would remove the recipes listed above.\n');
      stats.removed = stats.total;
    }

    // Save log
    const logPath = await saveLog(stats, lowQualityRecipes.rows, timestamp);

    console.log(`\n${'━'.repeat(80)}\n`);
    console.log('✅ Removal complete!\n');
    console.log('📊 Summary:');
    console.log('========');
    console.log(`  Total found: ${stats.total.toLocaleString()}`);
    console.log(
      `  Removed: ${stats.removed.toLocaleString()} ${options.dryRun ? '(dry run)' : ''}`
    );
    console.log(`  Failed: ${stats.failed.toLocaleString()}`);

    if (stats.errors.length > 0) {
      console.log(`\n⚠️  Errors (${stats.errors.length}):`);
      stats.errors.slice(0, 5).forEach(({ recipeName, error }) => {
        console.log(`  - ${recipeName}: ${error}`);
      });
      if (stats.errors.length > 5) {
        console.log(`  ... and ${stats.errors.length - 5} more (see log file)`);
      }
    }

    const successRate = stats.total > 0 ? ((stats.removed / stats.total) * 100).toFixed(1) : 0;

    console.log(`\n✨ Success rate: ${successRate}%`);
    console.log(`\n📁 Files created:`);
    console.log(`   Backup: ${backupPath}`);
    console.log(`   Log: ${logPath}`);

    if (options.dryRun) {
      console.log(`\n💡 Next steps:`);
      console.log(`   - Review the recipes above`);
      console.log(`   - Run with --execute to remove recipes`);
    } else {
      console.log(`\n💾 Database updated - ${stats.removed.toLocaleString()} recipes removed`);
      console.log(`\n📈 Impact:`);
      console.log(`   - Freed up database space`);
      console.log(`   - Improved overall recipe quality`);
      console.log(`   - Enhanced user experience`);

      // Get new statistics
      const newStats = await db.execute(sql`
        SELECT
          COUNT(*) as total,
          AVG(system_rating) as avg_rating,
          MIN(system_rating) as min_rating
        FROM recipes
        WHERE system_rating IS NOT NULL
      `);

      const data = newStats.rows[0];
      console.log(`\n📊 New Database Stats:`);
      console.log(`   Total recipes: ${Number(data.total).toLocaleString()}`);
      console.log(`   Average rating: ${Number(data.avg_rating).toFixed(2)}/5.0`);
      console.log(`   Minimum rating: ${Number(data.min_rating).toFixed(1)}/5.0`);
    }
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

// Parse CLI arguments
const args = process.argv.slice(2);
const options: RemovalOptions = {
  dryRun: !args.includes('--execute'),
  threshold: args.find((a) => a.startsWith('--threshold='))?.split('=')[1]
    ? parseFloat(args.find((a) => a.startsWith('--threshold='))?.split('=')[1])
    : 2.0,
};

// Validate threshold
if (Number.isNaN(options.threshold) || options.threshold < 0 || options.threshold > 5) {
  console.error('❌ Invalid threshold. Must be between 0.0 and 5.0');
  process.exit(1);
}

// Run
removeRecipes(options)
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
