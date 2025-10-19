#!/usr/bin/env tsx

/**
 * TheMealDB Recipe Import Script
 *
 * Imports recipes from TheMealDB API (https://themealdb.com)
 *
 * Features:
 * - API-based extraction (no scraping needed)
 * - Progress tracking with resume capability
 * - Rate limiting (1 second between requests)
 * - Pilot mode: Extract 10 recipes for validation
 * - Full mode: Extract all ~280 recipes
 * - Category-specific extraction support
 *
 * Usage:
 *   tsx scripts/import-themealdb.ts              # Full extraction
 *   tsx scripts/import-themealdb.ts --pilot      # Pilot mode (10 recipes)
 *   tsx scripts/import-themealdb.ts --category=Chicken  # Specific category
 *   tsx scripts/import-themealdb.ts --max=50     # Limit to 50 recipes
 *
 * License: EDUCATIONAL_USE (personal/non-commercial use as per TheMealDB terms)
 * Attribution: TheMealDB (https://themealdb.com)
 */

import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import { recipes, recipeSources } from '../src/lib/db/schema';
import { ImportProgressTracker } from './lib/import-progress';
import { transformTheMealDBRecipe } from './lib/recipe-transformers';
import { TheMealDBClient } from './lib/themealdb-client';

// Load environment variables
config({ path: '.env.local' });

// System user ID for imported recipes
const SYSTEM_USER_ID = 'system';

// Command line arguments
const args = process.argv.slice(2);
const isPilot = args.includes('--pilot');
const categoryFilter = args.find((arg) => arg.startsWith('--category='))?.split('=')[1];
const maxRecipes = isPilot
  ? 10
  : parseInt(args.find((arg) => arg.startsWith('--max='))?.split('=')[1] || '1000');

/**
 * Main import function
 */
async function importTheMealDBRecipes() {
  console.log('🍽️  TheMealDB Recipe Import Script\n');
  console.log(`Mode: ${isPilot ? 'PILOT (10 recipes)' : 'FULL'}`);
  if (categoryFilter) {
    console.log(`Category filter: ${categoryFilter}`);
  }
  console.log(`Max recipes: ${maxRecipes}\n`);

  // Initialize TheMealDB API client
  const apiKey = process.env.THEMEALDB_API_KEY || '1'; // Default to test key
  console.log(
    `🔑 Using API key: ${apiKey === '1' ? 'Free test key' : 'Premium key'}\n`
  );

  const client = new TheMealDBClient(apiKey);

  // Initialize database
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const pgClient = postgres(connectionString);
  const db = drizzle(pgClient);

  // Initialize progress tracker
  const tracker = new ImportProgressTracker('themealdb');
  await tracker.loadProgress();

  try {
    // Step 1: Get or create TheMealDB recipe source
    console.log('📋 Setting up TheMealDB recipe source...\n');

    let mealdbSource = await db
      .select()
      .from(recipeSources)
      .where(eq(recipeSources.slug, 'themealdb'))
      .limit(1);

    if (mealdbSource.length === 0) {
      const [newSource] = await db
        .insert(recipeSources)
        .values({
          name: 'TheMealDB',
          slug: 'themealdb',
          website_url: 'https://www.themealdb.com',
          description:
            'Free recipe API with ~280 recipes. Educational use only. Data sourced from TheMealDB community.',
          is_active: true,
        })
        .returning();

      mealdbSource = [newSource];
      console.log('  ✅ Created TheMealDB recipe source\n');
    } else {
      console.log('  ✅ TheMealDB recipe source already exists\n');
    }

    const sourceId = mealdbSource[0].id;

    // Step 2: Fetch categories
    console.log('📚 Fetching categories from TheMealDB...\n');
    const allCategories = await client.getCategories();

    // Filter categories if specified
    const categories = categoryFilter
      ? allCategories.filter(
          (c) => c.strCategory.toLowerCase() === categoryFilter.toLowerCase()
        )
      : allCategories;

    if (categories.length === 0) {
      throw new Error(
        `No categories found${categoryFilter ? ` for filter: ${categoryFilter}` : ''}`
      );
    }

    console.log(`  Found ${categories.length} categories:`);
    categories.forEach((cat) => {
      console.log(`    - ${cat.strCategory}`);
    });
    console.log('');

    // Step 3: Collect all recipe IDs by category
    console.log('🔍 Discovering recipe IDs...\n');
    const recipesToImport: Array<{
      category: string;
      id: string;
      name: string;
      thumbnail: string;
    }> = [];

    for (const category of categories) {
      console.log(`  📂 ${category.strCategory}...`);
      const recipeSummaries = await client.getRecipesByCategory(category.strCategory);
      console.log(`     Found ${recipeSummaries.length} recipes`);

      for (const summary of recipeSummaries) {
        recipesToImport.push({
          category: category.strCategory,
          id: summary.idMeal,
          name: summary.strMeal,
          thumbnail: summary.strMealThumb,
        });

        // Stop if we've reached max
        if (recipesToImport.length >= maxRecipes) {
          break;
        }
      }

      if (recipesToImport.length >= maxRecipes) {
        break;
      }
    }

    console.log(`\n  ✅ Discovered ${recipesToImport.length} recipes to import\n`);

    tracker.setTotal(recipesToImport.length);

    // Step 4: Import recipes
    console.log('📥 Starting recipe import...\n');
    let successCount = 0;

    for (let i = 0; i < recipesToImport.length; i++) {
      const { category, id, name } = recipesToImport[i];

      // Skip if already processed
      if (tracker.shouldSkip(id)) {
        console.log(
          `⏭️  [${i + 1}/${recipesToImport.length}] Skipping ${name} (already processed)`
        );
        continue;
      }

      try {
        console.log(
          `📄 [${successCount + 1}/${recipesToImport.length}] Importing: ${name} (${category})`
        );

        // Fetch full recipe details
        const recipeData = await client.getRecipeById(id);

        if (!recipeData) {
          tracker.markFailed(id, 'Recipe not found in API response');
          console.log(`  ❌ Recipe not found\n`);
          continue;
        }

        // Check if recipe already exists by slug
        const transformedRecipe = transformTheMealDBRecipe(recipeData, SYSTEM_USER_ID);
        const existingRecipe = await db
          .select()
          .from(recipes)
          .where(eq(recipes.slug, transformedRecipe.slug))
          .limit(1);

        if (existingRecipe.length > 0) {
          tracker.markSkipped(id);
          console.log(`  ⏭️  Recipe already exists: "${name}"\n`);
          continue;
        }

        // Insert recipe with source reference
        await db.insert(recipes).values({
          ...transformedRecipe,
          source_id: sourceId,
        });

        tracker.markImported(id);
        successCount++;

        console.log(`  ✅ Imported successfully`);
        console.log(
          `  📊 Progress: ${tracker.getStatusString()}\n`
        );
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        tracker.markFailed(id, errorMsg);
        console.error(`  ❌ Failed to import recipe:`, errorMsg);
        console.log('');
      }
    }

    // Mark as complete
    await tracker.markComplete();
    tracker.printSummary();

    console.log('\n✅ Import complete!\n');

    if (isPilot) {
      console.log(
        '🎯 Pilot run complete! Review the imported recipes before running full extraction.\n'
      );
      console.log('To run full extraction: pnpm import:themealdb\n');
    }

    // Show recipe distribution by category
    if (successCount > 0) {
      console.log('📊 Recipe Distribution by Category:\n');
      const categoryCount = new Map<string, number>();

      for (const recipe of recipesToImport.slice(0, successCount)) {
        categoryCount.set(recipe.category, (categoryCount.get(recipe.category) || 0) + 1);
      }

      const sortedCategories = Array.from(categoryCount.entries()).sort(
        (a, b) => b[1] - a[1]
      );

      sortedCategories.forEach(([category, count]) => {
        console.log(`  ${category}: ${count} recipes`);
      });
      console.log('');
    }
  } catch (error) {
    console.error('\n❌ Import failed:', error);
    await tracker.cleanup();
    process.exit(1);
  } finally {
    await tracker.cleanup();
    await pgClient.end();
  }
}

// Run import
importTheMealDBRecipes().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
