#!/usr/bin/env tsx
/**
 * Rollback Recipe Cleanup Script
 *
 * Restores recipes from a backup file created by cleanup-recipe-content.ts
 *
 * Usage:
 *   npx tsx scripts/rollback-recipe-cleanup.ts <timestamp>
 *   npx tsx scripts/rollback-recipe-cleanup.ts 2025-10-15T10-30-00
 *
 * Or use latest backup:
 *   npx tsx scripts/rollback-recipe-cleanup.ts --latest
 */

import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs/promises';
import path from 'path';

interface RollbackStats {
  total: number;
  restored: number;
  notFound: number;
  failed: number;
  errors: Array<{ recipeId: string; recipeName: string; error: string }>;
}

/**
 * Find backup file by timestamp or latest
 */
async function findBackupFile(identifier: string): Promise<string | null> {
  const tmpDir = path.join(process.cwd(), 'tmp');

  try {
    await fs.access(tmpDir);
  } catch {
    console.error('❌ No tmp directory found. No backups available.');
    return null;
  }

  if (identifier === '--latest') {
    // Find the most recent backup
    const files = await fs.readdir(tmpDir);
    const backupFiles = files
      .filter(f => f.startsWith('recipe-backup-') && f.endsWith('.json'))
      .sort()
      .reverse();

    if (backupFiles.length === 0) {
      console.error('❌ No backup files found in tmp directory');
      return null;
    }

    return path.join(tmpDir, backupFiles[0]);
  }

  // Find by timestamp
  const backupPath = path.join(tmpDir, `recipe-backup-${identifier}.json`);

  try {
    await fs.access(backupPath);
    return backupPath;
  } catch {
    console.error(`❌ Backup file not found: ${backupPath}`);
    console.error('\nAvailable backups:');

    const files = await fs.readdir(tmpDir);
    const backupFiles = files.filter(f => f.startsWith('recipe-backup-') && f.endsWith('.json'));

    if (backupFiles.length === 0) {
      console.error('  (none)');
    } else {
      backupFiles.forEach(f => {
        const timestamp = f.replace('recipe-backup-', '').replace('.json', '');
        console.error(`  - ${timestamp}`);
      });
    }

    return null;
  }
}

/**
 * Rollback recipes from backup
 */
async function rollbackRecipes(backupPath: string) {
  console.log('🔄 Recipe Cleanup Rollback Script');
  console.log('==================================\n');
  console.log(`Backup file: ${backupPath}\n`);

  const stats: RollbackStats = {
    total: 0,
    restored: 0,
    notFound: 0,
    failed: 0,
    errors: [],
  };

  try {
    // Load backup
    const backupData = await fs.readFile(backupPath, 'utf-8');
    const backupRecipes = JSON.parse(backupData);

    if (!Array.isArray(backupRecipes)) {
      throw new Error('Invalid backup file format: expected array of recipes');
    }

    stats.total = backupRecipes.length;
    console.log(`📦 Loaded ${stats.total.toLocaleString()} recipes from backup\n`);
    console.log('⚠️  LIVE MODE: Database will be updated!');
    console.log('Starting in 5 seconds... (Ctrl+C to cancel)\n');

    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('━'.repeat(80) + '\n');

    // Restore each recipe
    for (const recipe of backupRecipes) {
      const progress = `[${stats.restored + stats.notFound + stats.failed + 1}/${stats.total}]`;

      console.log(`${progress} Restoring: ${recipe.name}`);
      console.log(`  ID: ${recipe.id}`);

      try {
        // Check if recipe exists
        const existing = await db
          .select()
          .from(recipes)
          .where(eq(recipes.id, recipe.id))
          .limit(1);

        if (existing.length === 0) {
          console.log(`  ⚠️  Recipe not found in database (may have been deleted)`);
          stats.notFound++;
          continue;
        }

        // Restore recipe data
        await db.update(recipes)
          .set({
            name: recipe.name,
            description: recipe.description,
            ingredients: recipe.ingredients,
            instructions: recipe.instructions,
            prepTime: recipe.prepTime,
            cookTime: recipe.cookTime,
            servings: recipe.servings,
            difficulty: recipe.difficulty,
            cuisine: recipe.cuisine,
            tags: recipe.tags,
            images: recipe.images,
            nutritionInfo: recipe.nutritionInfo,
            // Keep current updatedAt to track when rollback occurred
            updatedAt: new Date(),
          })
          .where(eq(recipes.id, recipe.id));

        console.log(`  ✅ Restored successfully`);
        stats.restored++;

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`  ✗ Failed to restore: ${errorMessage}`);
        stats.failed++;
        stats.errors.push({
          recipeId: recipe.id,
          recipeName: recipe.name,
          error: errorMessage,
        });
      }

      console.log();
    }

    console.log('━'.repeat(80) + '\n');
    console.log('✅ Rollback complete!\n');
    console.log('📊 Summary:');
    console.log('========');
    console.log(`  Total in backup: ${stats.total.toLocaleString()}`);
    console.log(`  Successfully restored: ${stats.restored.toLocaleString()}`);
    console.log(`  Not found (deleted): ${stats.notFound.toLocaleString()}`);
    console.log(`  Failed: ${stats.failed.toLocaleString()}`);

    if (stats.errors.length > 0) {
      console.log(`\n⚠️  Errors (${stats.errors.length}):`);
      stats.errors.forEach(({ recipeName, error }) => {
        console.log(`  - ${recipeName}: ${error}`);
      });
    }

    const successRate = stats.total > 0
      ? ((stats.restored / stats.total) * 100).toFixed(1)
      : 0;

    console.log(`\n✨ Success rate: ${successRate}%`);

    if (stats.restored > 0) {
      console.log(`\n💾 Database restored with ${stats.restored.toLocaleString()} recipes from backup`);
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

// Parse CLI arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('❌ Error: No timestamp or --latest provided\n');
  console.error('Usage:');
  console.error('  npx tsx scripts/rollback-recipe-cleanup.ts <timestamp>');
  console.error('  npx tsx scripts/rollback-recipe-cleanup.ts 2025-10-15T10-30-00');
  console.error('  npx tsx scripts/rollback-recipe-cleanup.ts --latest\n');
  process.exit(1);
}

const identifier = args[0];

// Find and rollback
findBackupFile(identifier)
  .then(backupPath => {
    if (!backupPath) {
      process.exit(1);
    }
    return rollbackRecipes(backupPath);
  })
  .then(() => {
    console.log('\n✅ Rollback completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Rollback failed:', error);
    process.exit(1);
  });
