#!/usr/bin/env tsx

/**
 * Open Recipe DB Importer
 *
 * Imports recipes from Open Recipe DB dataset
 * - Community-driven database with 10,000+ recipes
 * - Quality filtering (score >= 70)
 * - Progress tracking with resume capability
 *
 * Dataset: https://github.com/somecoding/openrecipedb
 * License: ODbL + Database Contents License
 */

import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { recipes } from '../src/lib/db/schema';
import { ImportProgressTracker } from './lib/import-progress';
import {
  transformOpenRecipeDBRecipe,
  calculateQualityScore,
  type OpenRecipeDBRecipe,
} from './lib/recipe-transformers';
import { eq } from 'drizzle-orm';
import * as fs from 'fs/promises';
import * as path from 'path';

// Load environment variables
config({ path: '.env.local' });

// System user ID for imported recipes
const SYSTEM_USER_ID = 'system';

// Quality threshold (0-100 scale)
const QUALITY_THRESHOLD = 70;

// Dataset file path (user must download and place in tmp/)
const DATASET_PATH = path.join(process.cwd(), 'tmp', 'openrecipedb-recipes.json');

/**
 * Load recipes from dataset file
 */
async function loadDataset(): Promise<OpenRecipeDBRecipe[]> {
  try {
    const data = await fs.readFile(DATASET_PATH, 'utf-8');
    const recipes = JSON.parse(data);

    if (!Array.isArray(recipes)) {
      throw new Error('Dataset is not an array');
    }

    return recipes;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.error('\n❌ Dataset file not found!');
      console.error('\nPlease download the Open Recipe DB dataset:');
      console.error('1. Visit: https://github.com/somecoding/openrecipedb');
      console.error('2. Download the recipes JSON file');
      console.error(`3. Place it at: ${DATASET_PATH}`);
      console.error('\nAlternatively, use the API or PostgreSQL dump from the repository.\n');
    }
    throw error;
  }
}

/**
 * Main import function
 */
async function importOpenRecipeDB() {
  console.log('🚀 Open Recipe DB Importer\n');
  console.log(`Quality threshold: ${QUALITY_THRESHOLD}/100\n`);

  // Initialize database
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const client = postgres(connectionString);
  const db = drizzle(client);

  // Initialize progress tracker
  const tracker = new ImportProgressTracker('open-recipe-db');
  await tracker.loadProgress();

  try {
    // Load dataset
    console.log('📂 Loading dataset...');
    const allRecipes = await loadDataset();
    console.log(`✅ Loaded ${allRecipes.length} recipes from dataset\n`);

    // Filter by quality
    console.log('🔍 Filtering by quality...');
    const qualityRecipes: Array<{
      recipe: OpenRecipeDBRecipe;
      score: number;
    }> = [];

    for (const recipe of allRecipes) {
      const score = calculateQualityScore(recipe);
      if (score >= QUALITY_THRESHOLD) {
        qualityRecipes.push({ recipe, score });
      }
    }

    console.log(`✅ ${qualityRecipes.length} recipes passed quality filter`);
    console.log(
      `❌ ${allRecipes.length - qualityRecipes.length} recipes filtered out (low quality)\n`
    );

    // Sort by quality score (highest first)
    qualityRecipes.sort((a, b) => b.score - a.score);

    tracker.setTotal(qualityRecipes.length);
    console.log(`📈 Current progress: ${tracker.getStatusString()}\n`);

    // Import recipes
    console.log('📥 Starting import...\n');

    for (let i = 0; i < qualityRecipes.length; i++) {
      const { recipe, score } = qualityRecipes[i];
      const recipeId = recipe.id || `recipe-${i}`;

      // Skip if already imported
      if (tracker.shouldSkip(recipeId)) {
        console.log(
          `⏭️  [${i + 1}/${qualityRecipes.length}] Skipping "${recipe.name}" (already imported)`
        );
        continue;
      }

      try {
        // Transform recipe
        const recipeData = transformOpenRecipeDBRecipe(recipe, SYSTEM_USER_ID, QUALITY_THRESHOLD);

        if (!recipeData) {
          // Should not happen since we pre-filtered, but check anyway
          tracker.markSkipped(recipeId);
          console.log(
            `⏭️  [${i + 1}/${qualityRecipes.length}] Skipping "${recipe.name}" (quality too low)`
          );
          continue;
        }

        // Check if recipe already exists by slug
        const existingRecipe = await db
          .select()
          .from(recipes)
          .where(eq(recipes.slug, recipeData.slug))
          .limit(1);

        if (existingRecipe.length > 0) {
          tracker.markSkipped(recipeId);
          console.log(
            `⏭️  [${i + 1}/${qualityRecipes.length}] Skipping "${recipe.name}" (already exists)`
          );
          continue;
        }

        // Insert into database
        await db.insert(recipes).values(recipeData);

        tracker.markImported(recipeId);
        console.log(
          `✅ [${i + 1}/${qualityRecipes.length}] Imported: "${recipe.name}" (score: ${score}/100)`
        );
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        tracker.markFailed(recipeId, errorMsg);
        console.error(
          `❌ [${i + 1}/${qualityRecipes.length}] Failed to import "${recipe.name}":`,
          errorMsg
        );
      }

      // Small delay to avoid overwhelming database
      if ((i + 1) % 100 === 0) {
        console.log(`\n💤 Processed ${i + 1} recipes, taking a short break...\n`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    // Mark as complete
    await tracker.markComplete();
    tracker.printSummary();

    console.log('✅ Import complete!\n');
  } catch (error) {
    console.error('\n❌ Import failed:', error);
    await tracker.cleanup();
    process.exit(1);
  } finally {
    await tracker.cleanup();
    await client.end();
  }
}

// Run importer
importOpenRecipeDB().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
