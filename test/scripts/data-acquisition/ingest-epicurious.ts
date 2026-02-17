#!/usr/bin/env tsx

/**
 * Epicurious Recipe Ingestion Pipeline
 *
 * Ingests Epicurious recipes from Kaggle dataset into the database
 * with AI quality evaluation and embedding generation.
 *
 * Features:
 * - JSON parsing with malformed entry handling
 * - Flexible ingredient/direction parsing (string or array)
 * - AI quality evaluation (0-5 rating)
 * - Embedding generation for semantic search
 * - Duplicate detection by name and source
 * - Batch processing with rate limiting (500 recipes at a time)
 * - Cuisine detection from categories
 * - Difficulty estimation from complexity
 * - Comprehensive error handling and logging
 * - Progress tracking and statistics
 *
 * Dataset: Epicurious - Recipes with Rating and Nutrition
 * Source: https://www.kaggle.com/datasets/hugodarwood/epirecipes
 *
 * Usage:
 *   tsx scripts/data-acquisition/ingest-epicurious.ts [batch-size] [max-recipes]
 *
 * Examples:
 *   tsx scripts/data-acquisition/ingest-epicurious.ts          # Default: 500 recipes per batch
 *   tsx scripts/data-acquisition/ingest-epicurious.ts 250      # 250 recipes per batch
 *   tsx scripts/data-acquisition/ingest-epicurious.ts 500 2000 # 500 per batch, max 2000 total
 *   tsx scripts/data-acquisition/ingest-epicurious.ts --limit 1000 # First 1000 recipes only
 */

import fs from 'node:fs';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { db } from '../@/lib/db';
import { recipeEmbeddings, recipes } from '../@/lib/db/schema';
import { evaluateRecipeQuality } from '../lib/recipe-quality-evaluator-script';

// Constants
const DATA_DIR = path.join(process.cwd(), 'data/recipes/incoming/epicurious');
const JSON_FILE = 'full_format_recipes.json'; // Updated: actual filename from Kaggle
const LOG_DIR = path.join(DATA_DIR, 'logs');
const SYSTEM_USER_ID = 'system_imported';
const DEFAULT_BATCH_SIZE = 500; // Smaller than Food.com due to longer content
const RATE_LIMIT_DELAY_MS = 500; // Delay between recipes to avoid API rate limits

// Epicurious JSON data interface (from Kaggle dataset)
interface EpicuriousRecipe {
  title: string;
  desc?: string;
  date?: string;
  categories?: string[];
  ingredients?: string | string[];
  directions?: string | string[];
  rating?: number;
  calories?: number | string;
  protein?: number | string;
  fat?: number | string;
  sodium?: number | string;
  image?: string;
  [key: string]: any; // Allow additional fields
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
 * Parses ingredients field (can be string or array)
 * Epicurious stores ingredients as either a single string with newlines or an array
 */
function parseIngredients(ingredients: string | string[] | undefined): string[] {
  if (!ingredients) {
    return [];
  }

  // If already an array, clean and return
  if (Array.isArray(ingredients)) {
    return ingredients.map((ing) => ing.trim()).filter((ing) => ing.length > 0);
  }

  // If string, split by newlines
  if (typeof ingredients === 'string') {
    return ingredients
      .split(/\r?\n/)
      .map((ing) => ing.trim())
      .filter((ing) => ing.length > 0);
  }

  return [];
}

/**
 * Parses directions field (can be string or array)
 * Epicurious stores directions as either a single string with newlines or an array
 */
function parseDirections(directions: string | string[] | undefined): string[] {
  if (!directions) {
    return [];
  }

  // If already an array, clean and return
  if (Array.isArray(directions)) {
    return directions.map((dir) => dir.trim()).filter((dir) => dir.length > 0);
  }

  // If string, split by newlines or numbered steps
  if (typeof directions === 'string') {
    // Try splitting by newlines first
    let steps = directions
      .split(/\r?\n/)
      .map((dir) => dir.trim())
      .filter((dir) => dir.length > 0);

    // If we got only 1 step, try splitting by numbered patterns (1., 2., etc.)
    if (steps.length === 1) {
      steps = directions
        .split(/\d+\.\s+/)
        .map((dir) => dir.trim())
        .filter((dir) => dir.length > 0);
    }

    return steps;
  }

  return [];
}

/**
 * Detects cuisine from categories
 * Checks if any category matches known cuisine types
 */
function detectCuisine(categories: string[] | undefined): string | null {
  if (!categories || categories.length === 0) {
    return null;
  }

  const cuisineKeywords: Record<string, string> = {
    italian: 'Italian',
    mexican: 'Mexican',
    chinese: 'Chinese',
    japanese: 'Japanese',
    indian: 'Indian',
    french: 'French',
    thai: 'Thai',
    greek: 'Greek',
    spanish: 'Spanish',
    korean: 'Korean',
    vietnamese: 'Vietnamese',
    mediterranean: 'Mediterranean',
    american: 'American',
    asian: 'Asian',
    'middle eastern': 'Middle Eastern',
    caribbean: 'Caribbean',
    moroccan: 'Moroccan',
    cajun: 'Cajun',
    southern: 'Southern',
  };

  // Check each category against cuisine keywords
  for (const category of categories) {
    const lowerCategory = category.toLowerCase();
    for (const [keyword, cuisineName] of Object.entries(cuisineKeywords)) {
      if (lowerCategory.includes(keyword)) {
        return cuisineName;
      }
    }
  }

  return null;
}

/**
 * Estimates difficulty from recipe complexity
 * Based on ingredient count, instruction count, and categories
 */
function estimateDifficulty(
  ingredients: string[],
  instructions: string[],
  categories: string[] = []
): 'easy' | 'medium' | 'hard' {
  const ingredientCount = ingredients.length;
  const stepCount = instructions.length;

  // Check for difficulty indicators in categories
  const categoriesLower = categories.map((c) => c.toLowerCase());
  if (
    categoriesLower.some(
      (c) => c.includes('quick') || c.includes('easy') || c.includes('weeknight')
    )
  ) {
    return 'easy';
  }
  if (
    categoriesLower.some(
      (c) => c.includes('advanced') || c.includes('complex') || c.includes('chef')
    )
  ) {
    return 'hard';
  }

  // Heuristic based on counts
  if (ingredientCount <= 6 && stepCount <= 5) {
    return 'easy';
  }
  if (ingredientCount <= 12 && stepCount <= 10) {
    return 'medium';
  }
  return 'hard';
}

/**
 * Validates and parses date string
 * Returns null for invalid or missing dates
 */
function validateAndParseDate(dateString: string | undefined | null): Date | null {
  if (!dateString) return null;

  // Reject known invalid values
  if (
    dateString.toLowerCase() === 'approximate' ||
    dateString.toLowerCase() === 'unknown' ||
    dateString.toLowerCase() === 'n/a'
  ) {
    console.warn(`[Parser] Invalid date string: "${dateString}" - using null`);
    return null;
  }

  try {
    const date = new Date(dateString);

    // Check if date is valid
    if (Number.isNaN(date.getTime())) {
      console.warn(`[Parser] Invalid date string: "${dateString}" - parsed to Invalid Date`);
      return null;
    }

    // Sanity check: reject dates too far in past or future
    const year = date.getFullYear();
    if (year < 1900 || year > 2030) {
      console.warn(`[Parser] Date out of reasonable range: ${year} - using null`);
      return null;
    }

    return date;
  } catch (error) {
    console.warn(`[Parser] Failed to parse date: "${dateString}"`, error);
    return null;
  }
}

/**
 * Parses nutrition value (can be number or string)
 */
function parseNutritionValue(value: number | string | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === 'number') {
    return value.toString();
  }

  if (typeof value === 'string') {
    // Remove units and parse
    const cleaned = value.replace(/[^\d.]/g, '');
    const parsed = parseFloat(cleaned);
    return Number.isNaN(parsed) ? null : parsed.toString();
  }

  return null;
}

/**
 * Transforms Epicurious recipe to our database schema
 */
function transformRecipe(epiRecipe: EpicuriousRecipe) {
  const ingredients = parseIngredients(epiRecipe.ingredients);
  const instructions = parseDirections(epiRecipe.directions);
  const categories = epiRecipe.categories || [];

  const cuisine = detectCuisine(categories);
  const difficulty = estimateDifficulty(ingredients, instructions, categories);

  // Build nutrition info
  const nutritionInfo: Record<string, string> | null =
    epiRecipe.calories || epiRecipe.protein || epiRecipe.fat || epiRecipe.sodium
      ? {
          calories: parseNutritionValue(epiRecipe.calories) || '0',
          protein: parseNutritionValue(epiRecipe.protein) || '0',
          fat: parseNutritionValue(epiRecipe.fat) || '0',
          sodium: parseNutritionValue(epiRecipe.sodium) || '0',
        }
      : null;

  // Parse published date
  const publishedDate = validateAndParseDate(epiRecipe.date);

  return {
    name: epiRecipe.title,
    description: epiRecipe.desc || epiRecipe.title || '', // Fallback to title or empty string
    ingredients,
    instructions,
    cuisine,
    difficulty,
    tags: categories,
    nutrition: nutritionInfo,
    rating: epiRecipe.rating,
    imageUrl: epiRecipe.image,
    publishedDate,
    source: 'epicurious.com',
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

    // Validate instructions (important for Epicurious)
    if (!recipe.instructions || recipe.instructions.length === 0) {
      console.log(`${progress} ⊘ Skipped "${recipe.name}" (no instructions)`);
      return {
        success: false,
        error: 'Missing instructions',
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
      });

      qualityRating = quality.rating;
      qualityReason = quality.reasoning;

      console.log(`${progress}   Quality: ${qualityRating.toFixed(1)}/5.0 - ${qualityReason}`);
    } catch (error: any) {
      console.warn(`${progress}   Quality evaluation failed: ${error.message}`);
    }

    // Step 2: Generate embedding for semantic search
    // TEMPORARILY DISABLED - Hugging Face API issues
    const embeddingVector: number[] | null = null;
    const embeddingText = '';

    // Skip embedding generation for now
    console.log(`${progress}   Embedding: Skipped (temporarily disabled)`);

    /* COMMENTED OUT - TO BE RE-ENABLED AFTER HUGGING FACE API FIX
    try {
      const parts = [
        recipe.name,
        recipe.description,
        recipe.cuisine ? `Cuisine: ${recipe.cuisine}` : '',
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
        user_id: SYSTEM_USER_ID,
        name: recipe.name,
        description: recipe.description,
        ingredients: JSON.stringify(recipe.ingredients),
        instructions: JSON.stringify(recipe.instructions),
        prep_time: null, // Not provided in Epicurious dataset
        cook_time: null, // Not provided in Epicurious dataset
        servings: null, // Not provided in Epicurious dataset
        difficulty: recipe.difficulty,
        cuisine: recipe.cuisine,
        tags: recipe.tags && recipe.tags.length > 0 ? JSON.stringify(recipe.tags) : null,
        images: recipe.imageUrl ? JSON.stringify([recipe.imageUrl]) : null,
        is_ai_generated: false,
        is_public: true, // Epicurious recipes are public
        is_system_recipe: true,
        nutrition_info: recipe.nutrition ? JSON.stringify(recipe.nutrition) : null,
        source: recipe.source,
        system_rating: qualityRating.toFixed(1),
        system_rating_reason: qualityReason,
        discovery_date: recipe.publishedDate || new Date(),
        like_count: 0, // Initialize engagement counters
        fork_count: 0,
        collection_count: 0,
      })
      .returning();

    console.log(`${progress}   Recipe ID: ${insertedRecipe.id}`);

    // Step 4: Insert embedding if generated
    if (embeddingVector && insertedRecipe.id) {
      try {
        await db.insert(recipeEmbeddings).values({
          recipeId: insertedRecipe.id,
          embedding: embeddingVector,
          embeddingText,
          modelName: 'sentence-transformers/all-MiniLM-L6-v2',
        });

        console.log(`${progress}   Embedding: ✓ Stored`);
      } catch (error: any) {
        console.warn(`${progress}   Embedding storage failed: ${error.message}`);
        // Don't fail the entire ingestion if embedding storage fails
      }
    }

    console.log(`${progress} ✓ Stored "${recipe.name}"`);
    return { success: true, recipeId: insertedRecipe.id };
  } catch (error: any) {
    console.error(`${progress} ✗ Failed to store "${recipe.name}": ${error.message}`);
    if (error.stack) {
      console.error(`${progress}   Stack trace:`, error.stack.split('\n').slice(0, 3).join('\n'));
    }
    if (error.detail) {
      console.error(`${progress}   Database detail:`, error.detail);
    }
    return { success: false, error: error.message };
  }
}

/**
 * Reads and parses Epicurious JSON file
 */
function readEpicuriousJSON(jsonPath: string, maxRecipes?: number): EpicuriousRecipe[] {
  console.log('[Epicurious] Reading JSON file...');
  console.log(`[Epicurious] Path: ${jsonPath}`);

  if (!fs.existsSync(jsonPath)) {
    throw new Error(`JSON file not found: ${jsonPath}`);
  }

  const jsonContent = fs.readFileSync(jsonPath, 'utf-8');

  let data: any;
  try {
    data = JSON.parse(jsonContent);
  } catch (error: any) {
    throw new Error(`Failed to parse JSON file: ${error.message}`);
  }

  // Handle both array and object formats
  let records: EpicuriousRecipe[] = [];

  if (Array.isArray(data)) {
    records = data;
  } else if (typeof data === 'object') {
    // If data is an object, convert values to array
    records = Object.values(data);
  } else {
    throw new Error(`Unexpected JSON format: ${typeof data}`);
  }

  console.log(`[Epicurious] Found ${records.length} recipes in JSON`);

  if (maxRecipes && maxRecipes > 0) {
    console.log(`[Epicurious] Limiting to first ${maxRecipes} recipes`);
    return records.slice(0, maxRecipes);
  }

  return records;
}

/**
 * Ingests Epicurious recipes in batches
 */
async function ingestEpicuriousRecipes(
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
  console.log('  EPICURIOUS RECIPE INGESTION PIPELINE');
  console.log('='.repeat(80));
  console.log(`Started: ${stats.startTime.toISOString()}`);
  console.log(`Batch Size: ${batchSize} recipes`);
  console.log(`Rate Limit: ${RATE_LIMIT_DELAY_MS}ms between recipes`);
  if (maxRecipes) {
    console.log(`Max Recipes: ${maxRecipes}`);
  }
  console.log('='.repeat(80));

  try {
    // Read JSON file
    const jsonPath = path.join(DATA_DIR, JSON_FILE);
    const epiRecipes = readEpicuriousJSON(jsonPath, maxRecipes);
    stats.total = epiRecipes.length;

    console.log(`\n[Epicurious] Processing ${stats.total} recipes...`);
    console.log('='.repeat(80));

    // Process recipes in batches
    for (let i = 0; i < epiRecipes.length; i++) {
      const epiRecipe = epiRecipes[i];
      const batchNum = Math.floor(i / batchSize) + 1;

      // Skip malformed entries
      if (!epiRecipe || !epiRecipe.title) {
        console.warn(`[${i + 1}/${epiRecipes.length}] ⊘ Skipped malformed entry`);
        stats.skipped++;
        continue;
      }

      // Transform Epicurious recipe to our format
      const recipe = transformRecipe(epiRecipe);

      // Ingest recipe
      const result = await ingestRecipe(recipe, i, epiRecipes.length);

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
      if (i < epiRecipes.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
      }

      // Progress update every batch
      if ((i + 1) % batchSize === 0 || i === epiRecipes.length - 1) {
        console.log(`\n${'-'.repeat(80)}`);
        console.log(
          `BATCH ${batchNum} COMPLETE - Progress: ${i + 1}/${epiRecipes.length} recipes processed`
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
    console.error('\n[Epicurious] Fatal error:', error.message);
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
    console.log(`\n[Epicurious] Log saved: ${logFile}`);
  } catch (error: any) {
    console.warn(`[Epicurious] Failed to save log: ${error.message}`);
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

  // Check for --limit flag
  const limitIndex = args.indexOf('--limit');
  let maxRecipes: number | undefined;
  if (limitIndex !== -1 && args[limitIndex + 1]) {
    maxRecipes = parseInt(args[limitIndex + 1], 10);
    args.splice(limitIndex, 2); // Remove --limit and value from args
  }

  const batchSize = args[0] ? parseInt(args[0], 10) : DEFAULT_BATCH_SIZE;
  if (!maxRecipes && args[1]) {
    maxRecipes = parseInt(args[1], 10);
  }

  console.log('\n[Epicurious] Starting ingestion...');
  if (args.length === 0 && !maxRecipes) {
    console.log('[Epicurious] Usage: tsx ingest-epicurious.ts [batch-size] [max-recipes]');
    console.log('[Epicurious] Usage: tsx ingest-epicurious.ts --limit 1000');
    console.log('[Epicurious] Using defaults: batch-size=500');
  }

  ingestEpicuriousRecipes(batchSize, maxRecipes)
    .then((stats) => {
      process.exit(stats.failed > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
