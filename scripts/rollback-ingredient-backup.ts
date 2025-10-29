/**
 * Rollback Ingredient Database from Backup
 *
 * Restores ingredient-related tables from a backup file.
 * WARNING: This will DELETE all current data and restore from backup.
 *
 * Usage: tsx scripts/rollback-ingredient-backup.ts <backup-file-path>
 */

import * as fs from 'node:fs';
import { sql } from 'drizzle-orm';
import {
  ingredientStatistics,
  ingredients,
  recipeIngredients,
} from '../src/lib/db/ingredients-schema';
import { cleanup, db } from './db-with-transactions';

interface BackupData {
  timestamp: string;
  ingredients: any[];
  recipe_ingredients: any[];
  ingredient_statistics: any[];
  counts: {
    ingredients: number;
    recipe_ingredients: number;
    ingredient_statistics: number;
  };
}

async function rollbackFromBackup(backupPath: string): Promise<void> {
  // Verify backup file exists
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup file not found: ${backupPath}`);
  }

  console.log('🔄 Starting rollback process...\n');
  console.log(`📁 Loading backup from: ${backupPath}\n`);

  // Load backup
  const backup: BackupData = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));

  console.log('📊 Backup Information:');
  console.log(`   - Created: ${backup.timestamp}`);
  console.log(`   - Ingredients: ${backup.counts.ingredients}`);
  console.log(`   - Recipe Ingredients: ${backup.counts.recipe_ingredients}`);
  console.log(`   - Ingredient Statistics: ${backup.counts.ingredient_statistics}\n`);

  // Confirm rollback
  console.log(
    '⚠️  WARNING: This will DELETE all current ingredient data and restore from backup!\n'
  );

  // Execute rollback in transaction
  console.log('🔄 Executing rollback...\n');

  await db.transaction(async (tx) => {
    // Step 1: Delete all current data (in reverse FK order)
    console.log('   Step 1: Deleting current recipe_ingredients...');
    await tx.execute(sql`DELETE FROM recipe_ingredients`);

    console.log('   Step 2: Deleting current ingredient_statistics...');
    await tx.execute(sql`DELETE FROM ingredient_statistics`);

    console.log('   Step 3: Deleting current ingredients...');
    await tx.execute(sql`DELETE FROM ingredients`);

    // Step 2: Restore ingredients
    console.log(`\n   Step 4: Restoring ${backup.ingredients.length} ingredients...`);
    for (const ingredient of backup.ingredients) {
      await tx.insert(ingredients).values(ingredient);
    }

    // Step 3: Restore recipe_ingredients
    console.log(`   Step 5: Restoring ${backup.recipe_ingredients.length} recipe_ingredients...`);
    for (const recipeIngredient of backup.recipe_ingredients) {
      await tx.insert(recipeIngredients).values(recipeIngredient);
    }

    // Step 4: Restore ingredient_statistics
    console.log(
      `   Step 6: Restoring ${backup.ingredient_statistics.length} ingredient_statistics...`
    );
    for (const stat of backup.ingredient_statistics) {
      await tx.insert(ingredientStatistics).values(stat);
    }

    console.log('\n   ✓ All data restored successfully');
  });

  console.log('\n✅ Rollback complete!\n');
  console.log('📊 Restored:');
  console.log(`   - ${backup.counts.ingredients} ingredients`);
  console.log(`   - ${backup.counts.recipe_ingredients} recipe ingredients`);
  console.log(`   - ${backup.counts.ingredient_statistics} ingredient statistics\n`);
}

async function main() {
  const backupPath = process.argv[2];

  if (!backupPath) {
    console.error('❌ Error: Backup file path required!\n');
    console.error('Usage: tsx scripts/rollback-ingredient-backup.ts <backup-file-path>\n');
    console.error(
      'Example: tsx scripts/rollback-ingredient-backup.ts tmp/ingredient-full-backup-1234567890.json\n'
    );
    process.exit(1);
  }

  try {
    await rollbackFromBackup(backupPath);
    await cleanup();
  } catch (error) {
    console.error('❌ Error during rollback:', error);
    await cleanup();
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { rollbackFromBackup };
