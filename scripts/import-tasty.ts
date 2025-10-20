#!/usr/bin/env tsx

/**
 * Tasty Recipe Import Script (RapidAPI)
 *
 * Imports recipes from BuzzFeed's Tasty API via RapidAPI
 * API Documentation: https://rapidapi.com/apidojo/api/tasty
 *
 * Features:
 * - Progress tracking with resume capability
 * - Rate limiting (1 second between requests for free tier)
 * - Pilot mode: Extract 10 recipes for validation
 * - Full mode: Extract up to 5,000 recipes (limited by API quota)
 * - Video URL extraction (Tasty's unique feature)
 * - Duplicate detection by slug
 * - Error handling and logging
 *
 * Usage:
 *   tsx scripts/import-tasty.ts              # Full extraction (500 recipes with free tier)
 *   tsx scripts/import-tasty.ts --pilot      # Pilot mode (10 recipes)
 *   tsx scripts/import-tasty.ts --max=50     # Limit to 50 recipes
 *   tsx scripts/import-tasty.ts --tag=under_30_minutes  # Filter by tag
 *
 * API Pricing:
 * - Free tier: 500 requests/month
 * - Pro tier: $9.99/month for 10,000 requests/month
 *
 * License: FAIR_USE (BuzzFeed Tasty content used under fair use doctrine)
 * Attribution: Tasty by BuzzFeed (https://tasty.co)
 */

import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import { recipes, recipeSources } from '../src/lib/db/schema';
import { ImportProgressTracker } from './lib/import-progress';
import { transformTastyRecipe } from './lib/recipe-transformers';
import { TastyClient } from './lib/tasty-client';

// Load environment variables
config({ path: '.env.local' });

// System user ID for imported recipes
const SYSTEM_USER_ID = 'system';

// Command line arguments
const args = process.argv.slice(2);
const isPilot = args.includes('--pilot');
const tagFilter = args.find((arg) => arg.startsWith('--tag='))?.split('=')[1];
const maxRecipes = isPilot
  ? 10
  : parseInt(args.find((arg) => arg.startsWith('--max='))?.split('=')[1] || '500');

/**
 * Main import function
 */
async function importTastyRecipes() {
  console.log('🍔 Tasty Recipe Import Script (RapidAPI)\n');
  console.log(`Mode: ${isPilot ? 'PILOT (10 recipes)' : 'FULL'}`);
  if (tagFilter) {
    console.log(`Tag filter: ${tagFilter}`);
  }
  console.log(`Max recipes: ${maxRecipes}\n`);

  // Check for required API keys
  const apiKey = process.env.RAPIDAPI_KEY;
  const apiHost = process.env.RAPIDAPI_HOST || 'tasty-api1.p.rapidapi.com';

  if (!apiKey) {
    console.error('❌ RAPIDAPI_KEY not found in environment variables');
    console.log('\nPlease add your RapidAPI key to .env.local:');
    console.log('  RAPIDAPI_KEY=your_rapidapi_key_here');
    console.log('  RAPIDAPI_HOST=tasty-api1.p.rapidapi.com');
    console.log('\nGet your API key from: https://rapidapi.com/apidojo/api/tasty');
    process.exit(1);
  }

  console.log(`🔑 Using API Host: ${apiHost}\n`);

  // Initialize Tasty API client
  const client = new TastyClient(apiKey, apiHost, 1000); // 1 second delay between requests

  // Initialize database
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const pgClient = postgres(connectionString);
  const db = drizzle(pgClient);

  // Initialize progress tracker
  const tracker = new ImportProgressTracker('tasty');
  await tracker.loadProgress();

  try {
    // Step 1: Get or create Tasty recipe source
    console.log('📋 Setting up Tasty recipe source...\n');

    let tastySource = await db
      .select()
      .from(recipeSources)
      .where(eq(recipeSources.slug, 'tasty'))
      .limit(1);

    if (tastySource.length === 0) {
      const [newSource] = await db
        .insert(recipeSources)
        .values({
          name: 'Tasty (BuzzFeed)',
          slug: 'tasty',
          website_url: 'https://tasty.co',
          description:
            'BuzzFeed Tasty - Popular recipe videos and tutorials. Over 5,000 recipes with step-by-step video instructions.',
          is_active: true,
        })
        .returning();

      tastySource = [newSource];
      console.log('  ✅ Created Tasty recipe source\n');
    } else {
      console.log('  ✅ Tasty recipe source already exists\n');
    }

    const sourceId = tastySource[0].id;

    // Step 2: Fetch recipes from API
    console.log('🔍 Discovering recipes from Tasty API...\n');

    const recipesToImport: Array<{
      id: number;
      name: string;
    }> = [];

    // Fetch recipes in batches (API max: 40 per request, we use 20 for safety)
    const batchSize = 20;
    let from = 0;
    let hasMore = true;

    while (hasMore && recipesToImport.length < maxRecipes) {
      console.log(`  📄 Fetching recipes ${from} to ${from + batchSize}...`);

      const searchResults = await client.searchRecipes(
        from,
        Math.min(batchSize, maxRecipes - recipesToImport.length),
        tagFilter
      );

      if (searchResults.results.length === 0) {
        hasMore = false;
        break;
      }

      for (const recipe of searchResults.results) {
        recipesToImport.push({
          id: recipe.id,
          name: recipe.name,
        });

        if (recipesToImport.length >= maxRecipes) {
          hasMore = false;
          break;
        }
      }

      from += batchSize;

      // Check if we've reached the end
      if (searchResults.results.length < batchSize) {
        hasMore = false;
      }
    }

    console.log(`\n  ✅ Discovered ${recipesToImport.length} recipes to import\n`);

    tracker.setTotal(recipesToImport.length);

    // Step 3: Import recipes
    console.log('📥 Starting recipe import...\n');
    let successCount = 0;
    let videoCount = 0;

    for (let i = 0; i < recipesToImport.length; i++) {
      const { id, name } = recipesToImport[i];

      // Skip if already processed
      if (tracker.shouldSkip(id.toString())) {
        console.log(
          `⏭️  [${i + 1}/${recipesToImport.length}] Skipping ${name} (already processed)`
        );
        continue;
      }

      try {
        console.log(`📄 [${i + 1}/${recipesToImport.length}] Importing: ${name}`);

        // Fetch full recipe details
        const recipeData = await client.getRecipeById(id);

        if (!recipeData) {
          tracker.markFailed(id.toString(), 'Recipe not found in API response');
          console.log(`  ❌ Recipe not found\n`);
          continue;
        }

        // Transform recipe to our schema
        const transformedRecipe = transformTastyRecipe(recipeData, SYSTEM_USER_ID);

        // Check if recipe already exists by slug
        const existingRecipe = await db
          .select()
          .from(recipes)
          .where(eq(recipes.slug, transformedRecipe.slug))
          .limit(1);

        if (existingRecipe.length > 0) {
          tracker.markSkipped(id.toString());
          console.log(`  ⏭️  Recipe already exists: "${name}"\n`);
          continue;
        }

        // Check for minimum data quality
        const ingredients = JSON.parse(transformedRecipe.ingredients);
        const instructions = JSON.parse(transformedRecipe.instructions);

        if (ingredients.length === 0 || instructions.length === 0) {
          tracker.markFailed(id.toString(), 'Insufficient recipe data (no ingredients or instructions)');
          console.log(`  ⚠️  Skipped: Insufficient data\n`);
          continue;
        }

        // Insert recipe with source reference
        await db.insert(recipes).values({
          ...transformedRecipe,
          source_id: sourceId,
        });

        tracker.markImported(id.toString());
        successCount++;

        // Track video availability
        if (transformedRecipe.video_url) {
          videoCount++;
          console.log(`  ✅ Imported successfully (with video)`);
        } else {
          console.log(`  ✅ Imported successfully`);
        }

        console.log(`  📊 Progress: ${tracker.getStatusString()}\n`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        tracker.markFailed(id.toString(), errorMsg);
        console.error(`  ❌ Failed to import recipe:`, errorMsg);
        console.log('');
      }
    }

    // Mark as complete
    await tracker.markComplete();
    tracker.printSummary();

    console.log('\n✅ Import complete!\n');
    console.log('📊 Import Statistics:');
    console.log(`  Total imported: ${successCount}`);
    console.log(`  With video URLs: ${videoCount} (${Math.round((videoCount / successCount) * 100)}%)`);
    console.log('');

    if (isPilot) {
      console.log(
        '🎯 Pilot run complete! Review the imported recipes before running full extraction.\n'
      );
      console.log('To run full extraction: pnpm import:tasty\n');
      console.log('Note: Free tier is limited to 500 API requests/month');
      console.log('      Each recipe import uses 1 request\n');
    } else {
      console.log('💡 Next steps:');
      console.log('  - Review imported recipes in the database');
      console.log('  - Test video URLs are working');
      console.log('  - Check data quality (ingredients, instructions)');
      console.log('  - Monitor RapidAPI quota usage\n');
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
importTastyRecipes().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
