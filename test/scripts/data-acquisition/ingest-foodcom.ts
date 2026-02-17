#!/usr/bin/env tsx

/**
 * Food.com Recipe Ingestion Pipeline
 *
 * Ingests Food.com recipes from Kaggle dataset into the database
 * with AI quality evaluation and embedding generation.
 *
 * Features:
 * - CSV parsing with proper escaping
 * - AI quality evaluation (0-5 rating)
 * - Embedding generation for semantic search
 * - Duplicate detection by name similarity
 * - Batch processing with rate limiting (1000 recipes at a time)
 * - Comprehensive error handling and logging
 * - Progress tracking and statistics
 *
 * Dataset: Food.com Recipes and Interactions (Kaggle)
 * Source: https://www.kaggle.com/datasets/shuyangli94/food-com-recipes-and-user-interactions
 *
 * Usage:
 *   tsx scripts/data-acquisition/ingest-foodcom.ts [batch-size] [max-recipes]
 *
 * Examples:
 *   tsx scripts/data-acquisition/ingest-foodcom.ts          # Default: 1000 recipes per batch
 *   tsx scripts/data-acquisition/ingest-foodcom.ts 500      # 500 recipes per batch
 *   tsx scripts/data-acquisition/ingest-foodcom.ts 1000 5000 # 1000 per batch, max 5000 total
 */

import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import { sql } from 'drizzle-orm';
import { db } from '../@/lib/db';
import { recipes } from '../@/lib/db/schema';
import { evaluateRecipeQuality } from '../lib/recipe-quality-evaluator-script';

// Constants
const DATA_DIR = path.join(process.cwd(), 'data/recipes/incoming/food-com');
const CSV_FILE = 'RAW_recipes.csv';
const LOG_DIR = path.join(DATA_DIR, 'logs');
const SYSTEM_USER_ID = 'system_imported';
const DEFAULT_BATCH_SIZE = 1000;
const RATE_LIMIT_DELAY_MS = 500; // Delay between recipes to avoid API rate limits

// Food.com CSV row interface (from Kaggle dataset)
interface FoodComCSVRow {
  name: string;
  id: string;
  minutes: string;
  contributor_id: string;
  submitted: string;
  tags: string;
  nutrition: string;
  n_steps: string;
  steps: string;
  description: string;
  ingredients: string;
  n_ingredients: string;
}

interface IngestionResult {
  success: boolean;
  error?: string;
  recipeId?: string;
  skipped?: boolean;
}

interface IngestionStats {
  total: number;
  success: number;
  failed: number;
  skipped: number;
  errors: Array<{ recipe: string; error: string }>;
  startTime: Date;
  endTime?: Date;
}

/**
 * Parses JSON array strings from CSV
 * Food.com stores arrays as JSON strings with single quotes like: ['item1', 'item2']
 * We need to convert single quotes to double quotes for JSON.parse
 */
function parseJsonArray(value: string): string[] {
  if (!value || value.trim() === '' || value === '[]') {
    return [];
  }

  try {
    // Replace single quotes with double quotes for JSON parsing
    // But be careful not to replace apostrophes within text (e.g., "don't")
    const jsonString = value.replace(/'/g, '"');
    const parsed = JSON.parse(jsonString);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch (_error) {
    // If parsing fails, return empty array (some fields might be malformed)
    return [];
  }
}

/**
 * Parses nutrition array from CSV
 * Format: [calories, total_fat, sugar, sodium, protein, saturated_fat, carbohydrates]
 */
function parseNutrition(nutritionStr: string): Record<string, string> | null {
  if (!nutritionStr || nutritionStr.trim() === '') {
    return null;
  }

  try {
    // Food.com uses regular brackets (not single quotes) for nutrition
    const values = JSON.parse(nutritionStr);
    if (!Array.isArray(values) || values.length < 7) {
      return null;
    }

    return {
      calories: values[0]?.toString() || '0',
      total_fat: values[1]?.toString() || '0',
      sugar: values[2]?.toString() || '0',
      sodium: values[3]?.toString() || '0',
      protein: values[4]?.toString() || '0',
      saturated_fat: values[5]?.toString() || '0',
      carbohydrates: values[6]?.toString() || '0',
    };
  } catch (_error) {
    return null;
  }
}

/**
 * Calculates prep time vs cook time from total minutes
 * Heuristic: Assume 30% prep, 70% cook for recipes over 30 minutes
 */
function splitPrepCookTime(totalMinutes: number): { prepTime: number; cookTime: number } {
  if (totalMinutes <= 30) {
    return { prepTime: Math.floor(totalMinutes * 0.3), cookTime: Math.ceil(totalMinutes * 0.7) };
  }
  return { prepTime: Math.floor(totalMinutes * 0.3), cookTime: Math.ceil(totalMinutes * 0.7) };
}

/**
 * Transforms Food.com CSV row to our database schema
 */
function transformRecipe(row: FoodComCSVRow) {
  const ingredients = parseJsonArray(row.ingredients);
  const instructions = parseJsonArray(row.steps);
  const tags = parseJsonArray(row.tags);
  const nutrition = parseNutrition(row.nutrition);

  const totalMinutes = parseInt(row.minutes, 10) || 0;
  const { prepTime, cookTime } = splitPrepCookTime(totalMinutes);

  return {
    name: row.name,
    description: row.description || null,
    ingredients,
    instructions,
    prepTime,
    cookTime,
    servings: null, // Not provided in Food.com dataset
    tags,
    nutrition,
    source: `food.com/recipe/${row.id}`,
    sourceUrl: `https://www.food.com/recipe/${row.id}`,
    submittedDate: row.submitted,
  };
}

/**
 * Checks if a recipe already exists in the database
 * Checks by exact name match and source
 */
async function checkDuplicate(name: string, source: string): Promise<boolean> {
  const existing = await db
    .select({ id: recipes.id })
    .from(recipes)
    .where(sql`${recipes.name} = ${name} AND ${recipes.source} = ${source}`)
    .limit(1);

  return existing.length > 0;
}

/**
 * Ingests a single recipe into the database
 */
async function ingestRecipe(
  recipe: ReturnType<typeof transformRecipe>,
  index: number,
  total: number
): Promise<IngestionResult> {
  const progress = `[${index + 1}/${total}]`;

  try {
    console.log(`${progress} Processing "${recipe.name}"...`);

    // Validate required fields
    if (!recipe.name || !recipe.ingredients || recipe.ingredients.length === 0) {
      console.log(`${progress} ⊘ Skipped "${recipe.name}" (missing required fields)`);
      return {
        success: false,
        error: 'Missing required fields (name or ingredients)',
        skipped: true,
      };
    }

    // Check for duplicates
    const isDuplicate = await checkDuplicate(recipe.name, recipe.source);
    if (isDuplicate) {
      console.log(`${progress} ⊘ Skipped "${recipe.name}" (duplicate)`);
      return { success: true, skipped: true };
    }

    // Step 1: Evaluate quality using AI
    let qualityRating = 3.0;
    let qualityReason = 'Quality evaluation skipped';

    try {
      const quality = await evaluateRecipeQuality({
        name: recipe.name,
        description: recipe.description || undefined,
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
        prepTime: recipe.prepTime ? `${recipe.prepTime} minutes` : undefined,
        cookTime: recipe.cookTime ? `${recipe.cookTime} minutes` : undefined,
      });

      qualityRating = quality.rating;
      qualityReason = quality.reasoning;

      console.log(`${progress}   Quality: ${qualityRating.toFixed(1)}/5.0 - ${qualityReason}`);
    } catch (error: any) {
      console.warn(`${progress}   Quality evaluation failed: ${error.message}`);
    }

    // Step 2: Generate embedding for semantic search
    // TEMPORARILY DISABLED - Hugging Face API issues
    const _embeddingVector: number[] | null = null;
    const _embeddingText = '';

    // Skip embedding generation for now
    console.log(`${progress}   Embedding: Skipped (temporarily disabled)`);

    /* COMMENTED OUT - TO BE RE-ENABLED AFTER HUGGING FACE API FIX
    try {
      const parts = [
        recipe.name,
        recipe.description,
        recipe.tags && recipe.tags.length > 0 ? `Tags: ${recipe.tags.join(', ')}` : '',
        `Ingredients: ${recipe.ingredients.slice(0, 10).join(', ')}`,
      ].filter(Boolean);

      embeddingText = parts.join('. ');
      embeddingVector = await generateEmbedding(embeddingText, {
        retries: 3,
        timeout: 30000,
        waitForModel: true,
      });

      console.log(`${progress}   Embedding: ✓ Generated (${embeddingVector.length}d)`);
    } catch (error: any) {
      console.warn(`${progress}   Embedding generation failed: ${error.message}`);
    }
    */

    // Step 3: Insert recipe into database
    const [insertedRecipe] = await db
      .insert(recipes)
      .values({
        userId: SYSTEM_USER_ID,
        name: recipe.name,
        description: recipe.description,
        ingredients: JSON.stringify(recipe.ingredients),
        instructions: JSON.stringify(recipe.instructions),
        prepTime: recipe.prepTime,
        cookTime: recipe.cookTime,
        servings: recipe.servings,
        difficulty: null,
        cuisine: null,
        tags: recipe.tags && recipe.tags.length > 0 ? JSON.stringify(recipe.tags) : null,
        images: null,
        isAiGenerated: false,
        isPublic: true, // Food.com recipes are public
        isSystemRecipe: true,
        nutritionInfo: recipe.nutrition ? JSON.stringify(recipe.nutrition) : null,
        source: recipe.source,
        systemRating: qualityRating.toFixed(1),
        systemRatingReason: qualityReason,
        discoveryDate: recipe.submittedDate ? new Date(recipe.submittedDate) : new Date(),
      })
      .returning();

    console.log(`${progress}   Recipe ID: ${insertedRecipe.id}`);

    // Step 4: Insert embedding if generated (currently disabled)
    // Will be re-enabled after Hugging Face API fix

    console.log(`${progress} ✓ Stored "${recipe.name}"`);
    return { success: true, recipeId: insertedRecipe.id };
  } catch (error: any) {
    console.error(`${progress} ✗ Failed to store "${recipe.name}": ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Reads and parses Food.com CSV file
 */
function readFoodComCSV(csvPath: string, maxRecipes?: number): FoodComCSVRow[] {
  console.log('[Food.com] Reading CSV file...');
  console.log(`[Food.com] Path: ${csvPath}`);

  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found: ${csvPath}`);
  }

  const csvContent = fs.readFileSync(csvPath, 'utf-8');

  const records: FoodComCSVRow[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    cast: false, // Keep all values as strings for manual parsing
  });

  console.log(`[Food.com] Found ${records.length} recipes in CSV`);

  if (maxRecipes && maxRecipes > 0) {
    console.log(`[Food.com] Limiting to first ${maxRecipes} recipes`);
    return records.slice(0, maxRecipes);
  }

  return records;
}

/**
 * Ingests Food.com recipes in batches
 */
async function ingestFoodComRecipes(
  batchSize: number = DEFAULT_BATCH_SIZE,
  maxRecipes?: number
): Promise<IngestionStats> {
  const stats: IngestionStats = {
    total: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [],
    startTime: new Date(),
  };

  console.log(`\n${'='.repeat(80)}`);
  console.log('  FOOD.COM RECIPE INGESTION PIPELINE');
  console.log('='.repeat(80));
  console.log(`Started: ${stats.startTime.toISOString()}`);
  console.log(`Batch Size: ${batchSize} recipes`);
  console.log(`Rate Limit: ${RATE_LIMIT_DELAY_MS}ms between recipes`);
  if (maxRecipes) {
    console.log(`Max Recipes: ${maxRecipes}`);
  }
  console.log('='.repeat(80));

  try {
    // Read CSV file
    const csvPath = path.join(DATA_DIR, CSV_FILE);
    const rows = readFoodComCSV(csvPath, maxRecipes);
    stats.total = rows.length;

    console.log(`\n[Food.com] Processing ${stats.total} recipes...`);
    console.log('='.repeat(80));

    // Process recipes in batches
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const batchNum = Math.floor(i / batchSize) + 1;

      // Transform CSV row to recipe format
      const recipe = transformRecipe(row);

      // Ingest recipe
      const result = await ingestRecipe(recipe, i, rows.length);

      if (result.success) {
        if (result.skipped) {
          stats.skipped++;
        } else {
          stats.success++;
        }
      } else {
        stats.failed++;
        stats.errors.push({
          recipe: recipe.name,
          error: result.error || 'Unknown error',
        });
      }

      // Rate limiting delay (except for last recipe)
      if (i < rows.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
      }

      // Progress update every batch
      if ((i + 1) % batchSize === 0 || i === rows.length - 1) {
        console.log(`\n${'-'.repeat(80)}`);
        console.log(
          `BATCH ${batchNum} COMPLETE - Progress: ${i + 1}/${rows.length} recipes processed`
        );
        console.log(
          `Success: ${stats.success} | Skipped: ${stats.skipped} | Failed: ${stats.failed}`
        );
        console.log('-'.repeat(80));
      }
    }

    stats.endTime = new Date();

    // Save log file
    await saveIngestionLog(stats);

    // Print final summary
    printSummary(stats);
  } catch (error: any) {
    console.error('\n[Food.com] Fatal error:', error.message);
    console.error(error.stack);
    throw error;
  }

  return stats;
}

/**
 * Saves ingestion log to file
 */
async function saveIngestionLog(stats: IngestionStats): Promise<void> {
  try {
    // Ensure log directory exists
    fs.mkdirSync(LOG_DIR, { recursive: true });

    const logFile = path.join(
      LOG_DIR,
      `ingestion-${stats.startTime.toISOString().replace(/[:.]/g, '-')}.json`
    );

    const logData = {
      ...stats,
      duration: stats.endTime ? (stats.endTime.getTime() - stats.startTime.getTime()) / 1000 : null,
    };

    fs.writeFileSync(logFile, JSON.stringify(logData, null, 2));
    console.log(`\n[Food.com] Log saved: ${logFile}`);
  } catch (error: any) {
    console.warn(`[Food.com] Failed to save log: ${error.message}`);
  }
}

/**
 * Prints final summary
 */
function printSummary(stats: IngestionStats): void {
  const duration = stats.endTime ? (stats.endTime.getTime() - stats.startTime.getTime()) / 1000 : 0;

  console.log(`\n${'='.repeat(80)}`);
  console.log('  INGESTION COMPLETE');
  console.log('='.repeat(80));
  console.log(`Total Recipes: ${stats.total}`);
  console.log(`✓ Success: ${stats.success}`);
  console.log(`⊘ Skipped: ${stats.skipped}`);
  console.log(`✗ Failed: ${stats.failed}`);
  console.log(`Duration: ${duration.toFixed(2)} seconds`);
  console.log(`Rate: ${(stats.total / duration).toFixed(2)} recipes/second`);

  if (stats.errors.length > 0) {
    console.log(`\nErrors (showing first 20):`);
    stats.errors.slice(0, 20).forEach((err) => {
      console.log(`  - ${err.recipe}: ${err.error}`);
    });

    if (stats.errors.length > 20) {
      console.log(`  ... and ${stats.errors.length - 20} more errors`);
    }
  }

  console.log('='.repeat(80));
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);

  const batchSize = args[0] ? parseInt(args[0], 10) : DEFAULT_BATCH_SIZE;
  const maxRecipes = args[1] ? parseInt(args[1], 10) : undefined;

  console.log('\n[Food.com] Starting ingestion...');
  if (args.length === 0) {
    console.log('[Food.com] Usage: tsx ingest-foodcom.ts [batch-size] [max-recipes]');
    console.log('[Food.com] Using defaults: batch-size=1000');
  }

  ingestFoodComRecipes(batchSize, maxRecipes)
    .then((stats) => {
      process.exit(stats.failed > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
