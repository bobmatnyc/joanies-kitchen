/**
 * Create Full Ingredient Backup
 *
 * Creates a comprehensive backup of all ingredient-related tables
 * before running consolidation fixes.
 *
 * Usage: tsx scripts/create-ingredient-backup.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
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

async function createBackup(): Promise<void> {
  console.log('💾 Creating comprehensive ingredient backup...\n');

  // Fetch all data
  console.log('   Fetching ingredients...');
  const ingredientsData = await db.select().from(ingredients);

  console.log('   Fetching recipe_ingredients...');
  const recipeIngredientsData = await db.select().from(recipeIngredients);

  console.log('   Fetching ingredient_statistics...');
  const ingredientStatisticsData = await db.select().from(ingredientStatistics);

  console.log('   Creating backup object...');
  const backup: BackupData = {
    timestamp: new Date().toISOString(),
    ingredients: ingredientsData,
    recipe_ingredients: recipeIngredientsData,
    ingredient_statistics: ingredientStatisticsData,
    counts: {
      ingredients: ingredientsData.length,
      recipe_ingredients: recipeIngredientsData.length,
      ingredient_statistics: ingredientStatisticsData.length,
    },
  };

  // Save backup
  const tmpDir = path.join(process.cwd(), 'tmp');
  const backupPath = path.join(tmpDir, `ingredient-full-backup-${Date.now()}.json`);

  console.log('   Writing backup file...');
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));

  console.log('\n✅ Backup created successfully!\n');
  console.log('📊 Backup Summary:');
  console.log(`   - Ingredients: ${backup.counts.ingredients}`);
  console.log(`   - Recipe Ingredients: ${backup.counts.recipe_ingredients}`);
  console.log(`   - Ingredient Statistics: ${backup.counts.ingredient_statistics}\n`);
  console.log(`📁 Backup saved to: ${backupPath}\n`);
}

async function main() {
  try {
    await createBackup();
    await cleanup();
  } catch (error) {
    console.error('❌ Error creating backup:', error);
    await cleanup();
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { createBackup };
