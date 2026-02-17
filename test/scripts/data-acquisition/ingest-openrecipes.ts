#!/usr/bin/env tsx

/**
 * OpenRecipes Recipe Ingestion Pipeline
 *
 * Ingests OpenRecipes dataset from GitHub into the database
 * with AI quality evaluation and embedding generation.
 *
 * OpenRecipes Dataset:
 * - Repository: https://github.com/openrecipes/openrecipes
 * - Format: schema.org/Recipe JSON markup
 * - Size: 200K+ recipes from multiple sources
 * - Sources: AllRecipes, Food Network, Epicurious, BBC Good Food, etc.
 *
 * Features:
 * - schema.org/Recipe format parsing
 * - ISO 8601 duration parsing (PT30M = 30 minutes)
 * - Flexible instruction parsing (HowToStep, string, array)
 * - Multiple image format handling (string, array, ImageObject)
 * - AI quality evaluation (0-5 rating)
 * - Embedding generation for semantic search
 * - Duplicate detection by name and URL
 * - Quality filtering (minimum required fields)
 * - Batch processing with rate limiting
 * - Source detection from filenames and URLs
 * - Comprehensive error handling and logging
 *
 * Usage:
 *   tsx scripts/data-acquisition/ingest-openrecipes.ts [batch-size] [max-recipes]
 *   tsx scripts/data-acquisition/ingest-openrecipes.ts --limit 1000
 *   tsx scripts/data-acquisition/ingest-openrecipes.ts --file allrecipes.json
 *
 * Examples:
 *   tsx scripts/data-acquisition/ingest-openrecipes.ts                    # All files, 500 per batch
 *   tsx scripts/data-acquisition/ingest-openrecipes.ts 250               # 250 per batch
 *   tsx scripts/data-acquisition/ingest-openrecipes.ts --limit 2000      # First 2000 recipes
 *   tsx scripts/data-acquisition/ingest-openrecipes.ts --file sample.json # Specific file only
 */

import fs from 'node:fs';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { generateEmbedding } from '../@/lib/ai/embeddings';
import { evaluateRecipeQuality } from '../@/lib/ai/recipe-quality-evaluator';
import { db } from '../@/lib/db';
import { recipeEmbeddings, recipes } from '../@/lib/db/schema';

// Constants
const DATA_DIR = path.join(process.cwd(), 'data/recipes/incoming/openrecipes');
const LOG_DIR = path.join(DATA_DIR, 'logs');
const SYSTEM_USER_ID = 'system_imported';
const DEFAULT_BATCH_SIZE = 500;
const RATE_LIMIT_DELAY_MS = 500;

// OpenRecipes schema.org/Recipe interface
interface OpenRecipe {
  '@context'?: string;
  '@type'?: string;
  name?: string;
  title?: string;
  description?: string;
  recipeIngredient?: string[] | string;
  ingredients?: string[] | string;
  recipeInstructions?: any; // HowToStep, string, or array
  instructions?: any;
  prepTime?: string; // ISO 8601 duration
  cookTime?: string; // ISO 8601 duration
  totalTime?: string; // ISO 8601 duration
  recipeYield?: string | number;
  servings?: string | number;
  recipeCuisine?: string | string[];
  recipeCategory?: string | string[];
  keywords?: string | string[];
  image?: string | string[] | any; // ImageObject or URLs
  url?: string;
  datePublished?: string;
  author?: string | any;
  aggregateRating?: any;
  nutrition?: any;
  [key: string]: any;
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
 * Parses ISO 8601 duration to minutes
 * Examples: "PT30M" = 30 min, "PT1H30M" = 90 min, "P1DT2H" = 1560 min (26 hours)
 */
function parseISO8601Duration(duration: string | undefined): number | null {
  if (!duration || typeof duration !== 'string') return null;

  try {
    // Handle both P and PT formats
    // P1DT2H30M15S = 1 day, 2 hours, 30 minutes, 15 seconds
    // PT1H30M = 1 hour, 30 minutes
    const regex = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
    const match = duration.match(regex);

    if (!match) return null;

    const days = parseInt(match[1] || '0', 10);
    const hours = parseInt(match[2] || '0', 10);
    const minutes = parseInt(match[3] || '0', 10);
    const seconds = parseInt(match[4] || '0', 10);

    // Convert everything to minutes
    const totalMinutes = days * 24 * 60 + hours * 60 + minutes + Math.ceil(seconds / 60);

    return totalMinutes > 0 ? totalMinutes : null;
  } catch (_error) {
    console.warn(`[Parser] Failed to parse ISO 8601 duration: "${duration}"`);
    return null;
  }
}

/**
 * Parses recipe instructions from various schema.org formats
 * Handles: HowToStep objects, HowToSection, string, array
 */
function parseInstructions(instructions: any): string[] {
  if (!instructions) return [];

  // String with newlines
  if (typeof instructions === 'string') {
    return instructions
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  // Array of steps
  if (Array.isArray(instructions)) {
    return instructions
      .map((step) => {
        if (typeof step === 'string') {
          return step.trim();
        }

        // HowToStep object
        if (step['@type'] === 'HowToStep') {
          return step.text || step.itemListElement || step.name || '';
        }

        // HowToSection (contains itemListElement with HowToSteps)
        if (step['@type'] === 'HowToSection') {
          if (Array.isArray(step.itemListElement)) {
            return step.itemListElement
              .map((item: any) => item.text || item.name || '')
              .filter(Boolean)
              .join(' ');
          }
        }

        // Generic object with text property
        if (step.text) {
          return step.text;
        }

        // Last resort: stringify
        return typeof step === 'object' ? JSON.stringify(step) : String(step);
      })
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  // Single HowToStep object
  if (instructions['@type'] === 'HowToStep') {
    const text = instructions.text || instructions.itemListElement || instructions.name || '';
    return text ? [text.trim()] : [];
  }

  // Single HowToSection
  if (instructions['@type'] === 'HowToSection') {
    if (Array.isArray(instructions.itemListElement)) {
      return instructions.itemListElement
        .map((item: any) => item.text || item.name || '')
        .filter(Boolean);
    }
  }

  // Fallback: try to extract text
  if (instructions.text) {
    return [instructions.text];
  }

  console.warn('[Parser] Unknown instruction format:', typeof instructions);
  return [];
}

/**
 * Parses recipe ingredients from various formats
 */
function parseIngredients(ingredients: any): string[] {
  if (!ingredients) return [];

  // Array of strings (most common)
  if (Array.isArray(ingredients)) {
    return ingredients
      .map((ing) => (typeof ing === 'string' ? ing : String(ing)))
      .map((ing) => ing.trim())
      .filter((ing) => ing.length > 0);
  }

  // Single string with newlines
  if (typeof ingredients === 'string') {
    return ingredients
      .split(/\r?\n/)
      .map((ing) => ing.trim())
      .filter((ing) => ing.length > 0);
  }

  return [];
}

/**
 * Parses recipe images from various schema.org formats
 * Handles: string URL, array of URLs, ImageObject, array of ImageObjects
 */
function parseImages(image: any): string[] {
  if (!image) return [];

  // String URL
  if (typeof image === 'string') {
    return [image];
  }

  // Array of URLs or ImageObjects
  if (Array.isArray(image)) {
    return image
      .map((img) => {
        if (typeof img === 'string') {
          return img;
        }
        // ImageObject
        if (img['@type'] === 'ImageObject') {
          return img.url || img.contentUrl || img.thumbnailUrl || '';
        }
        // Generic object with url property
        if (img.url) {
          return img.url;
        }
        return '';
      })
      .filter(Boolean);
  }

  // Single ImageObject
  if (image['@type'] === 'ImageObject') {
    return [image.url || image.contentUrl || image.thumbnailUrl || ''].filter(Boolean);
  }

  // Generic object with url property
  if (image.url) {
    return [image.url];
  }

  return [];
}

/**
 * Parses servings/yield from various formats
 * Examples: "4 servings", "Makes 8", "6-8 people", 4, "4"
 */
function parseServings(recipeYield: any): number | null {
  if (!recipeYield) return null;

  // Number
  if (typeof recipeYield === 'number') {
    return Math.max(1, Math.floor(recipeYield));
  }

  // String: extract first number
  if (typeof recipeYield === 'string') {
    const match = recipeYield.match(/(\d+)/);
    if (match) {
      return Math.max(1, parseInt(match[1], 10));
    }
  }

  return null;
}

/**
 * Detects source from filename or URL
 */
function detectSource(filename: string, url?: string): string {
  if (url) {
    try {
      const hostname = new URL(url).hostname;
      return hostname.replace('www.', '');
    } catch {
      return url;
    }
  }

  // Detect from filename
  const lower = filename.toLowerCase();
  if (lower.includes('allrecipes')) return 'allrecipes.com';
  if (lower.includes('foodnetwork')) return 'foodnetwork.com';
  if (lower.includes('epicurious')) return 'epicurious.com';
  if (lower.includes('bbcgoodfood') || lower.includes('bbc')) return 'bbcgoodfood.com';
  if (lower.includes('recipeland')) return 'recipeland.com';

  return 'openrecipes.org';
}

/**
 * Validates that a recipe has minimum required fields
 */
function isRecipeValid(recipe: OpenRecipe): boolean {
  const name = recipe.name || recipe.title;
  const ingredients = recipe.recipeIngredient || recipe.ingredients;
  const instructions = recipe.recipeInstructions || recipe.instructions;

  return (
    !!name &&
    name.length > 3 &&
    !!ingredients &&
    (Array.isArray(ingredients) ? ingredients.length > 0 : ingredients.length > 10) &&
    !!instructions
  );
}

/**
 * Detects cuisine from recipeCuisine or recipeCategory
 */
function detectCuisine(recipe: OpenRecipe): string | null {
  const cuisineField = recipe.recipeCuisine;

  if (cuisineField) {
    if (typeof cuisineField === 'string') {
      return cuisineField;
    }
    if (Array.isArray(cuisineField) && cuisineField.length > 0) {
      return cuisineField[0];
    }
  }

  // Try recipeCategory as fallback
  const categories = recipe.recipeCategory;
  if (categories) {
    const categoryArray = Array.isArray(categories) ? categories : [categories];

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
    };

    for (const category of categoryArray) {
      const lower = category.toLowerCase();
      for (const [keyword, cuisine] of Object.entries(cuisineKeywords)) {
        if (lower.includes(keyword)) {
          return cuisine;
        }
      }
    }
  }

  return null;
}

/**
 * Estimates difficulty from recipe complexity
 */
function estimateDifficulty(
  ingredients: string[],
  instructions: string[],
  prepTime?: number | null,
  cookTime?: number | null
): 'easy' | 'medium' | 'hard' {
  const ingredientCount = ingredients.length;
  const stepCount = instructions.length;
  const totalTime = (prepTime || 0) + (cookTime || 0);

  // Simple heuristic
  if (ingredientCount <= 6 && stepCount <= 5 && totalTime <= 30) {
    return 'easy';
  }
  if (ingredientCount <= 12 && stepCount <= 10 && totalTime <= 60) {
    return 'medium';
  }
  return 'hard';
}

/**
 * Extracts tags from keywords and categories
 */
function extractTags(recipe: OpenRecipe): string[] {
  const tags: Set<string> = new Set();

  // Add keywords
  if (recipe.keywords) {
    const keywords = Array.isArray(recipe.keywords)
      ? recipe.keywords
      : recipe.keywords.split(/[,;]/);
    keywords.forEach((k) => tags.add(k.trim()));
  }

  // Add categories
  if (recipe.recipeCategory) {
    const categories = Array.isArray(recipe.recipeCategory)
      ? recipe.recipeCategory
      : [recipe.recipeCategory];
    categories.forEach((c) => tags.add(c.trim()));
  }

  return Array.from(tags).filter((t) => t.length > 0);
}

/**
 * Validates and parses date string
 */
function validateAndParseDate(dateString: string | undefined | null): Date | null {
  if (!dateString) return null;

  const invalid = ['approximate', 'unknown', 'n/a'];
  if (invalid.includes(dateString.toLowerCase())) {
    return null;
  }

  try {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return null;

    const year = date.getFullYear();
    if (year < 1900 || year > 2030) return null;

    return date;
  } catch {
    return null;
  }
}

/**
 * Transforms OpenRecipe to our database schema
 */
function transformRecipe(openRecipe: OpenRecipe, filename: string) {
  const name = openRecipe.name || openRecipe.title || 'Untitled Recipe';
  const ingredients = parseIngredients(openRecipe.recipeIngredient || openRecipe.ingredients);
  const instructions = parseInstructions(openRecipe.recipeInstructions || openRecipe.instructions);
  const images = parseImages(openRecipe.image);
  const tags = extractTags(openRecipe);

  const prepTime = parseISO8601Duration(openRecipe.prepTime);
  const cookTime = parseISO8601Duration(openRecipe.cookTime);
  const servings = parseServings(openRecipe.recipeYield || openRecipe.servings);

  const cuisine = detectCuisine(openRecipe);
  const difficulty = estimateDifficulty(ingredients, instructions, prepTime, cookTime);
  const source = detectSource(filename, openRecipe.url);
  const publishedDate = validateAndParseDate(openRecipe.datePublished);

  return {
    name,
    description: openRecipe.description || null,
    ingredients,
    instructions,
    prepTime,
    cookTime,
    servings,
    cuisine,
    difficulty,
    tags,
    images,
    source,
    sourceUrl: openRecipe.url,
    publishedDate,
  };
}

/**
 * Checks if a recipe already exists in the database
 * Checks by name + source, and by source URL if available
 */
async function checkDuplicate(name: string, source: string, sourceUrl?: string): Promise<boolean> {
  // Check by URL first (most reliable)
  if (sourceUrl) {
    const byUrl = await db
      .select({ id: recipes.id })
      .from(recipes)
      .where(sql`${recipes.source} = ${sourceUrl}`)
      .limit(1);

    if (byUrl.length > 0) return true;
  }

  // Check by name + source
  const byName = await db
    .select({ id: recipes.id })
    .from(recipes)
    .where(sql`${recipes.name} = ${name} AND ${recipes.source} = ${source}`)
    .limit(1);

  return byName.length > 0;
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
    if (!recipe.name || recipe.ingredients.length === 0 || recipe.instructions.length === 0) {
      console.log(`${progress} ⊘ Skipped "${recipe.name}" (missing required fields)`);
      return { success: false, error: 'Missing required fields', skipped: true };
    }

    // Check for duplicates
    const isDuplicate = await checkDuplicate(recipe.name, recipe.source, recipe.sourceUrl);
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
        prepTime: recipe.prepTime?.toString(),
        cookTime: recipe.cookTime?.toString(),
        servings: recipe.servings || undefined,
      });

      qualityRating = quality.rating;
      qualityReason = quality.reasoning;

      console.log(`${progress}   Quality: ${qualityRating.toFixed(1)}/5.0 - ${qualityReason}`);
    } catch (error: any) {
      console.warn(`${progress}   Quality evaluation failed: ${error.message}`);
    }

    // Step 2: Generate embedding for semantic search
    let embeddingVector: number[] | null = null;
    let embeddingText = '';

    try {
      const parts = [
        recipe.name,
        recipe.description,
        recipe.cuisine ? `Cuisine: ${recipe.cuisine}` : '',
        recipe.tags.length > 0 ? `Tags: ${recipe.tags.join(', ')}` : '',
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
        difficulty: recipe.difficulty,
        cuisine: recipe.cuisine,
        tags: recipe.tags.length > 0 ? JSON.stringify(recipe.tags) : null,
        images: recipe.images.length > 0 ? JSON.stringify(recipe.images) : null,
        isAiGenerated: false,
        isPublic: true,
        isSystemRecipe: true,
        nutritionInfo: null,
        source: recipe.sourceUrl || recipe.source,
        systemRating: qualityRating.toFixed(1),
        systemRatingReason: qualityReason,
        discoveryDate: recipe.publishedDate || new Date(),
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
      }
    }

    console.log(`${progress} ✓ Stored "${recipe.name}"`);
    return { success: true, recipeId: insertedRecipe.id };
  } catch (error: any) {
    console.error(`${progress} ✗ Failed to store "${recipe.name}": ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Reads and parses OpenRecipes JSON file
 */
function readOpenRecipesJSON(jsonPath: string, maxRecipes?: number): OpenRecipe[] {
  console.log('[OpenRecipes] Reading JSON file...');
  console.log(`[OpenRecipes] Path: ${jsonPath}`);

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

  let records: OpenRecipe[] = [];

  if (Array.isArray(data)) {
    records = data;
  } else if (typeof data === 'object') {
    records = Object.values(data);
  } else {
    throw new Error(`Unexpected JSON format: ${typeof data}`);
  }

  // Filter out invalid recipes
  const validRecords = records.filter(isRecipeValid);
  const filteredCount = records.length - validRecords.length;

  console.log(`[OpenRecipes] Found ${records.length} recipes in JSON`);
  console.log(`[OpenRecipes] Filtered ${filteredCount} invalid recipes`);
  console.log(`[OpenRecipes] Valid recipes: ${validRecords.length}`);

  if (maxRecipes && maxRecipes > 0) {
    console.log(`[OpenRecipes] Limiting to first ${maxRecipes} recipes`);
    return validRecords.slice(0, maxRecipes);
  }

  return validRecords;
}

/**
 * Ingests OpenRecipes in batches
 */
async function ingestOpenRecipes(
  batchSize: number = DEFAULT_BATCH_SIZE,
  maxRecipes?: number,
  specificFile?: string
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
  console.log('  OPENRECIPES RECIPE INGESTION PIPELINE');
  console.log('='.repeat(80));
  console.log(`Started: ${stats.startTime.toISOString()}`);
  console.log(`Batch Size: ${batchSize} recipes`);
  console.log(`Rate Limit: ${RATE_LIMIT_DELAY_MS}ms between recipes`);
  if (maxRecipes) {
    console.log(`Max Recipes: ${maxRecipes}`);
  }
  console.log('='.repeat(80));

  try {
    // Determine which files to process
    let filesToProcess: string[] = [];

    if (specificFile) {
      filesToProcess = [specificFile];
    } else {
      // Find all JSON files in data directory
      const allFiles = fs.readdirSync(DATA_DIR);
      filesToProcess = allFiles.filter((f) => f.endsWith('.json') && f !== 'metadata.json');
    }

    console.log(`\n[OpenRecipes] Files to process: ${filesToProcess.length}`);
    filesToProcess.forEach((f) => console.log(`  - ${f}`));
    console.log('='.repeat(80));

    // Process each file
    for (const filename of filesToProcess) {
      const jsonPath = path.join(DATA_DIR, filename);

      console.log(`\n[OpenRecipes] Processing file: ${filename}`);
      console.log('-'.repeat(80));

      const openRecipes = readOpenRecipesJSON(
        jsonPath,
        maxRecipes ? maxRecipes - stats.total : undefined
      );

      stats.total += openRecipes.length;

      console.log(`[OpenRecipes] Ingesting ${openRecipes.length} recipes from ${filename}...`);
      console.log('='.repeat(80));

      // Process recipes in batches
      for (let i = 0; i < openRecipes.length; i++) {
        const openRecipe = openRecipes[i];
        const batchNum = Math.floor(i / batchSize) + 1;

        // Transform recipe
        const recipe = transformRecipe(openRecipe, filename);

        // Ingest recipe
        const result = await ingestRecipe(recipe, i, openRecipes.length);

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

        // Rate limiting delay
        if (i < openRecipes.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
        }

        // Progress update every batch
        if ((i + 1) % batchSize === 0 || i === openRecipes.length - 1) {
          console.log(`\n${'-'.repeat(80)}`);
          console.log(
            `BATCH ${batchNum} COMPLETE - Progress: ${i + 1}/${openRecipes.length} recipes processed`
          );
          console.log(
            `Success: ${stats.success} | Skipped: ${stats.skipped} | Failed: ${stats.failed}`
          );
          console.log('-'.repeat(80));
        }
      }

      // Check if we've reached max recipes
      if (maxRecipes && stats.total >= maxRecipes) {
        console.log(`\n[OpenRecipes] Reached max recipes limit (${maxRecipes})`);
        break;
      }
    }

    stats.endTime = new Date();

    // Save log file
    await saveIngestionLog(stats);

    // Print final summary
    printSummary(stats);
  } catch (error: any) {
    console.error('\n[OpenRecipes] Fatal error:', error.message);
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
    console.log(`\n[OpenRecipes] Log saved: ${logFile}`);
  } catch (error: any) {
    console.warn(`[OpenRecipes] Failed to save log: ${error.message}`);
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

  // Parse arguments
  const limitIndex = args.indexOf('--limit');
  let maxRecipes: number | undefined;
  if (limitIndex !== -1 && args[limitIndex + 1]) {
    maxRecipes = parseInt(args[limitIndex + 1], 10);
    args.splice(limitIndex, 2);
  }

  const fileIndex = args.indexOf('--file');
  let specificFile: string | undefined;
  if (fileIndex !== -1 && args[fileIndex + 1]) {
    specificFile = args[fileIndex + 1];
    args.splice(fileIndex, 2);
  }

  const batchSize = args[0] ? parseInt(args[0], 10) : DEFAULT_BATCH_SIZE;
  if (!maxRecipes && args[1]) {
    maxRecipes = parseInt(args[1], 10);
  }

  console.log('\n[OpenRecipes] Starting ingestion...');
  if (args.length === 0 && !maxRecipes && !specificFile) {
    console.log('[OpenRecipes] Usage: tsx ingest-openrecipes.ts [batch-size] [max-recipes]');
    console.log('[OpenRecipes] Usage: tsx ingest-openrecipes.ts --limit 1000');
    console.log('[OpenRecipes] Usage: tsx ingest-openrecipes.ts --file allrecipes.json');
    console.log('[OpenRecipes] Using defaults: batch-size=500, all files');
  }

  ingestOpenRecipes(batchSize, maxRecipes, specificFile)
    .then((stats) => {
      process.exit(stats.failed > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
