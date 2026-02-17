#!/usr/bin/env tsx

/**
 * Master Recipe Data Acquisition Script
 *
 * Orchestrates the entire recipe acquisition pipeline:
 * 1. Check prerequisites (Kaggle API, etc.)
 * 2. Download recipes from multiple sources
 * 3. Parse and standardize recipe data
 * 4. Ingest into database with AI evaluation
 *
 * Usage:
 *   npm run data:acquire-all              # All sources
 *   npm run data:acquire-all -- themealdb # Specific source only
 */

import fs from 'node:fs';
import path from 'node:path';
import { crawlTheMealDB } from './crawl-themealdb';
import { downloadFoodCom } from './download-food-com';
import { ingestBatch } from './ingest-recipes';
import { parseFoodComRecipes } from './parsers/food-com-parser';
import { checkKaggleSetup } from './setup-kaggle';

interface AcquisitionOptions {
  sources?: string[]; // Specific sources to acquire (themealdb, foodcom, epicurious)
  skipDownload?: boolean; // Skip download, use existing files
  skipIngest?: boolean; // Only download, don't ingest
  batchSize?: number; // Ingestion batch size
  maxRecipes?: number; // Limit number of recipes (for testing)
}

/**
 * Acquires recipes from TheMealDB
 */
async function acquireTheMealDB(options: AcquisitionOptions) {
  console.log(`\n${'='.repeat(60)}`);
  console.log('  THEMEALDB ACQUISITION');
  console.log('='.repeat(60));

  const recipesPath = path.join(process.cwd(), 'data/recipes/incoming/themealdb/recipes.json');

  // Download phase
  if (!options.skipDownload) {
    console.log('\n[Step 1] Crawling TheMealDB API...');
    const result = await crawlTheMealDB();

    if (!result.success) {
      console.error('✗ TheMealDB crawl failed');
      return { success: false, error: 'TheMealDB crawl failed' };
    }

    console.log(`✓ Downloaded ${result.count} recipes`);
  } else {
    console.log('\n[Step 1] Skipping download (using existing files)');
  }

  // Ingestion phase
  if (!options.skipIngest) {
    console.log('\n[Step 2] Ingesting recipes...');

    if (!fs.existsSync(recipesPath)) {
      console.error(`✗ Recipes file not found: ${recipesPath}`);
      return { success: false, error: 'File not found' };
    }

    const recipesJson = JSON.parse(fs.readFileSync(recipesPath, 'utf-8'));
    let recipes = recipesJson;

    // Apply recipe limit if specified
    if (options.maxRecipes && options.maxRecipes > 0) {
      console.log(`[Limit] Using first ${options.maxRecipes} recipes`);
      recipes = recipes.slice(0, options.maxRecipes);
    }

    const stats = await ingestBatch(recipes, options.batchSize || 10);

    return {
      success: stats.failed === 0,
      count: stats.success,
      failed: stats.failed,
    };
  }

  return { success: true };
}

/**
 * Acquires recipes from Food.com
 */
async function acquireFoodCom(options: AcquisitionOptions) {
  console.log(`\n${'='.repeat(60)}`);
  console.log('  FOOD.COM ACQUISITION');
  console.log('='.repeat(60));

  // Download phase
  if (!options.skipDownload) {
    console.log('\n[Step 1] Downloading from Kaggle...');

    // Check Kaggle setup first
    if (!checkKaggleSetup()) {
      console.error('✗ Kaggle API not configured');
      console.log('\nRun: npm run data:setup');
      return { success: false, error: 'Kaggle not configured' };
    }

    const result = await downloadFoodCom();

    if (!result.success) {
      console.error('✗ Food.com download failed');
      return { success: false, error: result.error };
    }

    console.log(`✓ Downloaded files: ${result.files?.join(', ')}`);
  } else {
    console.log('\n[Step 1] Skipping download (using existing files)');
  }

  // Parse phase
  if (!options.skipIngest) {
    console.log('\n[Step 2] Parsing CSV files...');

    const csvPath = path.join(process.cwd(), 'data/recipes/incoming/food-com/RAW_recipes.csv');

    if (!fs.existsSync(csvPath)) {
      console.error(`✗ CSV file not found: ${csvPath}`);
      console.log('Available files:', fs.readdirSync(path.dirname(csvPath)));
      return { success: false, error: 'CSV not found' };
    }

    let recipes = parseFoodComRecipes(csvPath);

    // Apply recipe limit if specified
    if (options.maxRecipes && options.maxRecipes > 0) {
      console.log(`[Limit] Using first ${options.maxRecipes} recipes`);
      recipes = recipes.slice(0, options.maxRecipes);
    }

    console.log(`✓ Parsed ${recipes.length} recipes`);

    // Ingestion phase
    console.log('\n[Step 3] Ingesting recipes...');
    const stats = await ingestBatch(recipes, options.batchSize || 10);

    return {
      success: stats.failed === 0,
      count: stats.success,
      failed: stats.failed,
    };
  }

  return { success: true };
}

/**
 * Main acquisition function
 */
async function acquireAll(options: AcquisitionOptions = {}) {
  console.log(`\n${'█'.repeat(60)}`);
  console.log('  RECIPE DATA ACQUISITION PIPELINE');
  console.log('█'.repeat(60));

  const sources = options.sources || ['themealdb', 'foodcom'];
  const results: Record<string, any> = {};

  // Process each source
  for (const source of sources) {
    switch (source.toLowerCase()) {
      case 'themealdb':
        results.themealdb = await acquireTheMealDB(options);
        break;

      case 'foodcom':
        results.foodcom = await acquireFoodCom(options);
        break;

      default:
        console.warn(`Unknown source: ${source}`);
    }

    // Add delay between sources
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Final summary
  console.log(`\n${'█'.repeat(60)}`);
  console.log('  ACQUISITION SUMMARY');
  console.log('█'.repeat(60));

  for (const [source, result] of Object.entries(results)) {
    const status = result.success ? '✓' : '✗';
    console.log(`${status} ${source.toUpperCase()}: ${result.count || 0} recipes`);

    if (result.failed > 0) {
      console.log(`  Failed: ${result.failed}`);
    }
  }

  console.log('█'.repeat(60));

  return results;
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);

  const options: AcquisitionOptions = {
    sources: args.length > 0 ? args : undefined,
    skipDownload: process.env.SKIP_DOWNLOAD === 'true',
    skipIngest: process.env.SKIP_INGEST === 'true',
    batchSize: process.env.BATCH_SIZE ? parseInt(process.env.BATCH_SIZE, 10) : 10,
    maxRecipes: process.env.MAX_RECIPES ? parseInt(process.env.MAX_RECIPES, 10) : undefined,
  };

  console.log('[Options]', options);

  acquireAll(options)
    .then((results) => {
      const hasFailures = Object.values(results).some((r: any) => !r.success);
      process.exit(hasFailures ? 1 : 0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { acquireAll, acquireTheMealDB, acquireFoodCom };
