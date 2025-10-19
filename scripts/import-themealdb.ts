#!/usr/bin/env tsx

/**
 * TheMealDB Importer
 *
 * Imports recipes from TheMealDB API (https://www.themealdb.com)
 * - Free API with ~500 curated recipes
 * - Progress tracking with resume capability
 * - Rate limiting: 1 request per second
 */

import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { recipes } from '../src/lib/db/schema';
import { ImportProgressTracker } from './lib/import-progress';
import { transformTheMealDBRecipe, type TheMealDBRecipe } from './lib/recipe-transformers';
import { eq } from 'drizzle-orm';

// Load environment variables
config({ path: '.env.local' });

// System user ID for imported recipes
const SYSTEM_USER_ID = 'system';

// TheMealDB API configuration
const THEMEALDB_API_BASE = 'https://www.themealdb.com/api/json/v1/1';

// Rate limiting: 1 request per second
const RATE_LIMIT_MS = 1000;

// Categories to import
const CATEGORIES = [
  'Beef',
  'Chicken',
  'Dessert',
  'Lamb',
  'Miscellaneous',
  'Pasta',
  'Pork',
  'Seafood',
  'Side',
  'Starter',
  'Vegan',
  'Vegetarian',
  'Breakfast',
  'Goat',
];

/**
 * Fetch all meal IDs from a category
 */
async function fetchMealsByCategory(category: string): Promise<string[]> {
  const url = `${THEMEALDB_API_BASE}/filter.php?c=${encodeURIComponent(category)}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return (data.meals || []).map((meal: { idMeal: string }) => meal.idMeal);
  } catch (error) {
    console.error(`Failed to fetch category ${category}:`, error);
    return [];
  }
}

/**
 * Fetch full recipe details by meal ID
 */
async function fetchMealById(mealId: string): Promise<TheMealDBRecipe | null> {
  const url = `${THEMEALDB_API_BASE}/lookup.php?i=${mealId}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.meals?.[0] || null;
  } catch (error) {
    console.error(`Failed to fetch meal ${mealId}:`, error);
    return null;
  }
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Main import function
 */
async function importTheMealDB() {
  console.log('🚀 TheMealDB Recipe Importer\n');

  // Initialize database
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const client = postgres(connectionString);
  const db = drizzle(client);

  // Initialize progress tracker
  const tracker = new ImportProgressTracker('themealdb');
  await tracker.loadProgress();

  try {
    // Step 1: Fetch all meal IDs from all categories
    console.log('📋 Fetching meal IDs from all categories...\n');

    const allMealIds = new Set<string>();

    for (const category of CATEGORIES) {
      console.log(`  Fetching category: ${category}...`);
      const mealIds = await fetchMealsByCategory(category);
      mealIds.forEach((id) => allMealIds.add(id));
      console.log(`    Found ${mealIds.length} meals in ${category}`);

      // Rate limiting
      await sleep(RATE_LIMIT_MS);
    }

    const mealIdsArray = Array.from(allMealIds);
    tracker.setTotal(mealIdsArray.length);

    console.log(`\n📊 Total unique meals found: ${mealIdsArray.length}`);
    console.log(`📈 Current progress: ${tracker.getStatusString()}\n`);

    // Step 2: Import each meal
    console.log('📥 Starting import...\n');

    for (let i = 0; i < mealIdsArray.length; i++) {
      const mealId = mealIdsArray[i];

      // Skip if already imported
      if (tracker.shouldSkip(mealId)) {
        console.log(`⏭️  [${i + 1}/${mealIdsArray.length}] Skipping ${mealId} (already imported)`);
        continue;
      }

      try {
        // Fetch full recipe details
        const meal = await fetchMealById(mealId);

        if (!meal) {
          tracker.markFailed(mealId, 'Recipe not found or API error');
          console.log(`❌ [${i + 1}/${mealIdsArray.length}] Failed to fetch ${mealId}`);
          await sleep(RATE_LIMIT_MS);
          continue;
        }

        // Check if recipe already exists by slug
        const slug = transformTheMealDBRecipe(meal, SYSTEM_USER_ID).slug;
        const existingRecipe = await db
          .select()
          .from(recipes)
          .where(eq(recipes.slug, slug))
          .limit(1);

        if (existingRecipe.length > 0) {
          tracker.markSkipped(mealId);
          console.log(
            `⏭️  [${i + 1}/${mealIdsArray.length}] Skipping "${meal.strMeal}" (already exists)`
          );
          await sleep(RATE_LIMIT_MS);
          continue;
        }

        // Transform recipe to our schema
        const recipeData = transformTheMealDBRecipe(meal, SYSTEM_USER_ID);

        // Insert into database
        await db.insert(recipes).values(recipeData);

        tracker.markImported(mealId);
        console.log(
          `✅ [${i + 1}/${mealIdsArray.length}] Imported: "${meal.strMeal}" (${meal.strCategory} - ${meal.strArea})`
        );
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        tracker.markFailed(mealId, errorMsg);
        console.error(`❌ [${i + 1}/${mealIdsArray.length}] Failed to import ${mealId}:`, errorMsg);
      }

      // Rate limiting
      await sleep(RATE_LIMIT_MS);
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
importTheMealDB().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
