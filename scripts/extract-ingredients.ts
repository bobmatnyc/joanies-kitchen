#!/usr/bin/env tsx
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

/**
 * Ingredient Extraction and Normalization Script
 *
 * Extracts structured ingredient data from all recipes in the database using LLM-based parsing.
 * Creates normalized ingredient entries with deduplication and categorization.
 *
 * Features:
 * - LLM-powered extraction (Claude Sonnet 4.5 via OpenRouter)
 * - Batch processing with rate limiting
 * - Progress tracking and resume capability
 * - Ingredient deduplication and normalization
 * - Category classification
 * - Comprehensive error handling
 * - Dry-run mode for testing
 *
 * Usage:
 *   npx tsx scripts/extract-ingredients.ts              # Dry run (default)
 *   npx tsx scripts/extract-ingredients.ts --execute    # Apply changes to DB
 *   npx tsx scripts/extract-ingredients.ts --limit=10   # Test on 10 recipes
 *   npx tsx scripts/extract-ingredients.ts --resume     # Resume from last checkpoint
 *
 * Database Tables Created:
 * - ingredients: Normalized ingredient master list
 * - recipe_ingredients: Many-to-many relationship with amounts/units
 *
 * Note: This script will create the required database tables if they don't exist.
 *
 * Estimated runtime: 2-3 hours for 3,276 recipes
 * Estimated cost: ~$5-10 (using Claude Sonnet 4.5)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import OpenAI from 'openai';
import { db } from '@/lib/db';

// ============================================================================
// CONFIGURATION
// ============================================================================

const BATCH_SIZE = 10; // Process 10 recipes at a time
const DELAY_MS = 1000; // 1 second delay between batches
const CHECKPOINT_INTERVAL = 50; // Save progress every 50 recipes
const MODEL = 'anthropic/claude-sonnet-4.5'; // Claude Sonnet 4.5 for best accuracy

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface ExtractedIngredient {
  name: string; // Normalized name (lowercase)
  display_name: string; // Properly capitalized
  amount: string; // Quantity (e.g., "2", "1/2", "1-2")
  unit: string; // Measurement unit (e.g., "cup", "tablespoon", "lb")
  preparation: string; // Preparation method (e.g., "chopped", "minced")
  category: IngredientCategory;
}

type IngredientCategory =
  | 'vegetables'
  | 'fruits'
  | 'proteins'
  | 'dairy'
  | 'grains'
  | 'spices'
  | 'herbs'
  | 'condiments'
  | 'oils'
  | 'sweeteners'
  | 'nuts'
  | 'other';

interface ProcessingOptions {
  dryRun: boolean;
  limit?: number;
  resume: boolean;
}

interface ProcessingStats {
  total: number;
  processed: number;
  ingredientsExtracted: number;
  uniqueIngredients: number;
  recipeIngredientsCreated: number;
  skipped: number;
  failed: number;
  errors: Array<{ recipeId: string; recipeName: string; error: string }>;
}

interface Checkpoint {
  timestamp: string;
  lastProcessedId: string;
  stats: ProcessingStats;
}

interface NormalizedIngredient {
  id: string;
  name: string;
  display_name: string;
  category: IngredientCategory;
  is_common: boolean;
  usage_count: number;
  aliases: string[];
}

// ============================================================================
// DATABASE SCHEMA INITIALIZATION
// ============================================================================

/**
 * Create required database tables if they don't exist
 */
async function initializeTables() {
  console.log('📊 Checking database schema...\n');

  try {
    // Create ingredients table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ingredients (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        name TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        category TEXT NOT NULL,
        is_common BOOLEAN DEFAULT false,
        usage_count INTEGER DEFAULT 0,
        aliases TEXT, -- JSON array of alternative names
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create recipe_ingredients join table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS recipe_ingredients (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
        ingredient_id TEXT NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
        amount TEXT,
        unit TEXT,
        preparation TEXT,
        position INTEGER, -- Order in recipe
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(recipe_id, ingredient_id, position)
      )
    `);

    // Create indexes for performance (Neon requires separate statements)
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ingredients_name ON ingredients(name)`);
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_ingredients_category ON ingredients(category)`
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_ingredients_is_common ON ingredients(is_common)`
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id)`
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_ingredient ON recipe_ingredients(ingredient_id)`
    );

    console.log('✅ Database schema ready\n');
  } catch (error) {
    console.error('❌ Failed to initialize database schema:', error);
    throw error;
  }
}

// ============================================================================
// LLM EXTRACTION
// ============================================================================

/**
 * Create OpenRouter client
 */
function getOpenRouterClient() {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable is not set');
  }

  return new OpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002',
      'X-Title': 'Recipe Manager - Ingredient Extraction',
    },
  });
}

/**
 * Extract structured ingredient data from recipe using LLM
 */
async function extractIngredientsFromRecipe(
  _recipeId: string,
  recipeName: string,
  ingredientStrings: string[]
): Promise<ExtractedIngredient[]> {
  const client = getOpenRouterClient();

  const prompt = `Extract structured ingredient data from this recipe's ingredient list.

RECIPE: ${recipeName}
INGREDIENTS:
${ingredientStrings.map((ing, i) => `${i + 1}. ${ing}`).join('\n')}

Extract each ingredient with the following structure:
- name: Normalized ingredient name (lowercase, no amounts/units)
- display_name: Properly capitalized ingredient name
- amount: Numeric quantity (e.g., "2", "1/2", "1-2", empty string if none)
- unit: Measurement unit (e.g., "cup", "tablespoon", "lb", "oz", "whole", empty string if none)
- preparation: Preparation method (e.g., "chopped", "minced", "diced", empty string if none)
- category: One of: vegetables, fruits, proteins, dairy, grains, spices, herbs, condiments, oils, sweeteners, nuts, other

IMPORTANT RULES:
1. Normalize ingredient names to their base form (e.g., "red onion" → "onion", "fresh basil" → "basil")
2. Keep brand names and specific varieties if important (e.g., "parmesan cheese", "soy sauce")
3. Extract ALL preparation methods (chopped, diced, minced, sliced, etc.)
4. Preserve amounts exactly as written (including fractions like "1/2" or "½")
5. Use singular form for ingredient names (e.g., "carrot" not "carrots")
6. Extract units accurately (cup, tablespoon, teaspoon, lb, oz, g, kg, etc.)
7. Categorize accurately based on the ingredient's primary use

EXAMPLES:
"2 cups all-purpose flour, sifted" →
  { name: "flour", display_name: "All-Purpose Flour", amount: "2", unit: "cup", preparation: "sifted", category: "grains" }

"1 lb boneless skinless chicken breast, cut into 1-inch pieces" →
  { name: "chicken breast", display_name: "Chicken Breast", amount: "1", unit: "lb", preparation: "boneless skinless, cut into 1-inch pieces", category: "proteins" }

"3 cloves garlic, minced" →
  { name: "garlic", display_name: "Garlic", amount: "3", unit: "clove", preparation: "minced", category: "vegetables" }

"Salt to taste" →
  { name: "salt", display_name: "Salt", amount: "", unit: "", preparation: "to taste", category: "spices" }

"1/2 cup olive oil" →
  { name: "olive oil", display_name: "Olive Oil", amount: "1/2", unit: "cup", preparation: "", category: "oils" }

Return ONLY a valid JSON array of ingredient objects. No markdown, no explanation.

JSON:`;

  let lastError: Error | null = null;

  // Retry logic with exponential backoff
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content:
              'You are a professional recipe data extraction system. Always respond with valid JSON only.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.2, // Low temperature for consistency
        max_tokens: 4000,
      });

      const content = response?.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from LLM');
      }

      // Clean up response - remove markdown if present
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const extracted = JSON.parse(cleanContent);

      // Validate response
      if (!Array.isArray(extracted)) {
        throw new Error('Response is not an array');
      }

      // Validate each ingredient
      for (const ing of extracted) {
        if (!ing.name || !ing.display_name || !ing.category) {
          throw new Error('Missing required fields in ingredient');
        }
      }

      return extracted;
    } catch (error: any) {
      lastError = error;

      // Check for rate limit (429)
      if (error.status === 429) {
        if (attempt < 3) {
          const waitSeconds = attempt * 5; // 5s, 10s, 15s
          console.log(`  ⏳ Rate limit hit, waiting ${waitSeconds}s (attempt ${attempt}/3)...`);
          await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));
          continue;
        }
      }

      // Non-rate-limit error or exhausted retries
      if (attempt === 3) {
        throw error;
      }
    }
  }

  throw lastError || new Error('Failed to extract ingredients');
}

// ============================================================================
// INGREDIENT NORMALIZATION & DEDUPLICATION
// ============================================================================

/**
 * Common ingredient aliases for deduplication
 */
const INGREDIENT_ALIASES: Record<string, string[]> = {
  'green onion': ['scallion', 'spring onion'],
  cilantro: ['coriander leaves', 'chinese parsley'],
  'bell pepper': ['sweet pepper', 'capsicum'],
  eggplant: ['aubergine'],
  zucchini: ['courgette'],
  chickpea: ['garbanzo bean'],
  shrimp: ['prawn'],
  'pork belly': ['bacon', 'pancetta'],
  'ground beef': ['minced beef', 'hamburger'],
  'soy sauce': ['shoyu'],
};

/**
 * Find or create an ingredient in the database
 */
async function findOrCreateIngredient(
  extracted: ExtractedIngredient,
  dryRun: boolean
): Promise<string> {
  const normalizedName = extracted.name.toLowerCase().trim();

  // Check if ingredient already exists
  const existing = await db.execute<{ id: string }>(sql`
    SELECT id FROM ingredients WHERE name = ${normalizedName} LIMIT 1
  `);

  if (existing.rows.length > 0) {
    // Update usage count
    if (!dryRun) {
      await db.execute(sql`
        UPDATE ingredients
        SET usage_count = usage_count + 1,
            updated_at = NOW()
        WHERE id = ${existing.rows[0].id}
      `);
    }
    return existing.rows[0].id;
  }

  // Check aliases
  for (const [canonical, aliases] of Object.entries(INGREDIENT_ALIASES)) {
    if (aliases.includes(normalizedName)) {
      const aliasMatch = await db.execute<{ id: string }>(sql`
        SELECT id FROM ingredients WHERE name = ${canonical} LIMIT 1
      `);
      if (aliasMatch.rows.length > 0) {
        if (!dryRun) {
          await db.execute(sql`
            UPDATE ingredients
            SET usage_count = usage_count + 1,
                updated_at = NOW()
            WHERE id = ${aliasMatch.rows[0].id}
          `);
        }
        return aliasMatch.rows[0].id;
      }
    }
  }

  // Create new ingredient
  if (dryRun) {
    return `dry-run-${normalizedName}`;
  }

  const result = await db.execute<{ id: string }>(sql`
    INSERT INTO ingredients (name, display_name, category, aliases)
    VALUES (
      ${normalizedName},
      ${extracted.display_name},
      ${extracted.category},
      ${JSON.stringify(INGREDIENT_ALIASES[normalizedName] || [])}
    )
    RETURNING id
  `);

  return result.rows[0].id;
}

/**
 * Create recipe-ingredient relationship
 */
async function createRecipeIngredient(
  recipeId: string,
  ingredientId: string,
  extracted: ExtractedIngredient,
  position: number,
  dryRun: boolean
): Promise<void> {
  if (dryRun) {
    return;
  }

  await db.execute(sql`
    INSERT INTO recipe_ingredients (recipe_id, ingredient_id, amount, unit, preparation, position)
    VALUES (
      ${recipeId},
      ${ingredientId},
      ${extracted.amount || null},
      ${extracted.unit || null},
      ${extracted.preparation || null},
      ${position}
    )
    ON CONFLICT (recipe_id, ingredient_id, position) DO UPDATE
    SET amount = EXCLUDED.amount,
        unit = EXCLUDED.unit,
        preparation = EXCLUDED.preparation
  `);
}

// ============================================================================
// PROGRESS TRACKING
// ============================================================================

function getTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
}

async function saveCheckpoint(checkpoint: Checkpoint): Promise<void> {
  const tmpDir = path.join(process.cwd(), 'tmp');
  await fs.mkdir(tmpDir, { recursive: true });

  const checkpointPath = path.join(tmpDir, 'ingredient-extraction-checkpoint.json');
  await fs.writeFile(checkpointPath, JSON.stringify(checkpoint, null, 2));
}

async function loadCheckpoint(): Promise<Checkpoint | null> {
  const tmpDir = path.join(process.cwd(), 'tmp');
  const checkpointPath = path.join(tmpDir, 'ingredient-extraction-checkpoint.json');

  try {
    const content = await fs.readFile(checkpointPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function saveErrorLog(errors: ProcessingStats['errors'], timestamp: string): Promise<void> {
  const tmpDir = path.join(process.cwd(), 'tmp');
  await fs.mkdir(tmpDir, { recursive: true });

  const logPath = path.join(tmpDir, `ingredient-extraction-errors-${timestamp}.json`);
  await fs.writeFile(logPath, JSON.stringify(errors, null, 2));
}

function formatTimeEstimate(recipesRemaining: number, recipesPerMinute: number): string {
  const minutesRemaining = recipesRemaining / recipesPerMinute;
  const hours = Math.floor(minutesRemaining / 60);
  const minutes = Math.floor(minutesRemaining % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// ============================================================================
// MAIN PROCESSING
// ============================================================================

async function processRecipes(options: ProcessingOptions) {
  const timestamp = getTimestamp();
  let startFromId: string | null = null;

  console.log('🧪 Ingredient Extraction & Normalization Script');
  console.log(`${'='.repeat(80)}\n`);
  console.log(
    `Mode: ${options.dryRun ? 'DRY RUN (use --execute to apply changes)' : 'EXECUTE (will update database)'}`
  );
  console.log(`Model: ${MODEL}\n`);

  const stats: ProcessingStats = {
    total: 0,
    processed: 0,
    ingredientsExtracted: 0,
    uniqueIngredients: 0,
    recipeIngredientsCreated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  // Initialize database tables
  if (!options.dryRun) {
    await initializeTables();
  } else {
    console.log('⚠️  DRY RUN: Skipping database initialization\n');
  }

  // Handle resume
  if (options.resume) {
    const checkpoint = await loadCheckpoint();
    if (checkpoint) {
      startFromId = checkpoint.lastProcessedId;
      Object.assign(stats, checkpoint.stats);
      console.log(`📂 Resuming from checkpoint (last ID: ${startFromId})\n`);
    } else {
      console.log('⚠️  No checkpoint found, starting from beginning\n');
    }
  }

  try {
    // Fetch recipes
    let query = sql`SELECT * FROM recipes ORDER BY id`;
    if (startFromId) {
      query = sql`SELECT * FROM recipes WHERE id > ${startFromId} ORDER BY id`;
    }

    const result = await db.execute(query);
    let allRecipes = result.rows as any[];

    // Apply limit
    if (options.limit) {
      allRecipes = allRecipes.slice(0, options.limit);
    }

    stats.total = allRecipes.length;
    console.log(`Recipes to process: ${stats.total.toLocaleString()}\n`);

    if (!options.dryRun) {
      console.log('⚠️  LIVE MODE: Changes will be saved to database!');
      console.log('Starting in 5 seconds... (Ctrl+C to cancel)\n');
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    console.log(`${'━'.repeat(80)}\n`);

    const startTime = Date.now();
    const batches = Math.ceil(allRecipes.length / BATCH_SIZE);

    for (let batchNum = 0; batchNum < batches; batchNum++) {
      const batchStart = batchNum * BATCH_SIZE;
      const batchEnd = Math.min(batchStart + BATCH_SIZE, allRecipes.length);
      const batch = allRecipes.slice(batchStart, batchEnd);

      console.log(`\nBatch ${batchNum + 1}/${batches}:`);

      for (const recipe of batch) {
        stats.processed++;
        const progress = `[${stats.processed}/${stats.total}]`;

        console.log(`\n${progress} ${recipe.name}`);
        console.log(`  ID: ${recipe.id}`);

        try {
          // Parse ingredients JSON
          let ingredientStrings: string[];
          try {
            ingredientStrings = JSON.parse(recipe.ingredients as string);
            if (!Array.isArray(ingredientStrings)) {
              throw new Error('Ingredients is not an array');
            }
          } catch (_error) {
            console.log(`  ✗ Failed to parse ingredients JSON`);
            stats.skipped++;
            continue;
          }

          if (ingredientStrings.length === 0) {
            console.log(`  ⏭️  No ingredients to process`);
            stats.skipped++;
            continue;
          }

          console.log(`  📋 Extracting ${ingredientStrings.length} ingredients...`);

          // Extract structured data using LLM
          const extracted = await extractIngredientsFromRecipe(
            recipe.id,
            recipe.name,
            ingredientStrings
          );

          console.log(`  ✅ Extracted ${extracted.length} ingredients`);
          stats.ingredientsExtracted += extracted.length;

          // Process each extracted ingredient
          for (let i = 0; i < extracted.length; i++) {
            const ing = extracted[i];

            // Find or create ingredient
            const ingredientId = await findOrCreateIngredient(ing, options.dryRun);

            // Create recipe-ingredient relationship
            await createRecipeIngredient(recipe.id, ingredientId, ing, i, options.dryRun);
            stats.recipeIngredientsCreated++;
          }

          console.log(`  💾 ${options.dryRun ? 'Would save' : 'Saved'} to database`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`  ✗ Error: ${errorMessage}`);
          stats.failed++;
          stats.errors.push({
            recipeId: recipe.id,
            recipeName: recipe.name,
            error: errorMessage,
          });
        }

        // Save checkpoint periodically
        if (stats.processed % CHECKPOINT_INTERVAL === 0) {
          await saveCheckpoint({
            timestamp: new Date().toISOString(),
            lastProcessedId: recipe.id,
            stats,
          });
          console.log(`  💾 Checkpoint saved`);
        }
      }

      // Rate limiting between batches
      if (batchNum < batches - 1) {
        const elapsed = (Date.now() - startTime) / 1000;
        const recipesPerMinute = stats.processed / (elapsed / 60);
        const remaining = stats.total - stats.processed;
        const eta = formatTimeEstimate(remaining, recipesPerMinute);

        console.log(
          `\n⏱️  Progress: ${stats.processed}/${stats.total} (${((stats.processed / stats.total) * 100).toFixed(1)}%)`
        );
        console.log(`   Rate: ${recipesPerMinute.toFixed(1)} recipes/min | ETA: ${eta}`);
        console.log(`   Waiting ${DELAY_MS / 1000} seconds...`);

        await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
      }
    }

    // Calculate unique ingredients
    if (!options.dryRun) {
      const uniqueCount = await db.execute<{ count: number }>(sql`
        SELECT COUNT(*) as count FROM ingredients
      `);
      stats.uniqueIngredients = Number(uniqueCount.rows[0]?.count || 0);
    }

    // Save error log
    if (stats.errors.length > 0) {
      await saveErrorLog(stats.errors, timestamp);
    }

    // Final summary
    console.log(`\n${'━'.repeat(80)}\n`);
    console.log('✅ Processing complete!\n');
    console.log('📊 Summary:');
    console.log('========');
    console.log(`  Total processed: ${stats.processed.toLocaleString()}`);
    console.log(`  Ingredients extracted: ${stats.ingredientsExtracted.toLocaleString()}`);
    console.log(`  Unique ingredients: ${stats.uniqueIngredients.toLocaleString()}`);
    console.log(`  Recipe-ingredient links: ${stats.recipeIngredientsCreated.toLocaleString()}`);
    console.log(`  Skipped: ${stats.skipped.toLocaleString()}`);
    console.log(`  Failed: ${stats.failed.toLocaleString()}`);

    if (stats.errors.length > 0) {
      console.log(`\n⚠️  Errors (${stats.errors.length}):`);
      stats.errors.slice(0, 10).forEach(({ recipeName, error }) => {
        console.log(`  - ${recipeName}: ${error}`);
      });
      if (stats.errors.length > 10) {
        console.log(`  ... and ${stats.errors.length - 10} more (see error log)`);
      }
    }

    const successRate =
      stats.total > 0 ? (((stats.processed - stats.failed) / stats.total) * 100).toFixed(1) : 0;

    console.log(`\n✨ Success rate: ${successRate}%`);

    if (options.dryRun) {
      console.log(`\n💡 Next steps:`);
      console.log(`   - Review the extraction results above`);
      console.log(`   - Run with --execute to save to database`);
    } else {
      console.log(`\n💾 Database updated!`);
      console.log(`   - ${stats.uniqueIngredients} ingredients in master list`);
      console.log(`   - ${stats.recipeIngredientsCreated} recipe-ingredient links created`);

      // Get statistics
      console.log(`\n📈 Top 20 Most Common Ingredients:`);
      const topIngredients = await db.execute<{
        display_name: string;
        usage_count: number;
        category: string;
      }>(sql`
        SELECT display_name, usage_count, category
        FROM ingredients
        ORDER BY usage_count DESC
        LIMIT 20
      `);

      topIngredients.rows.forEach((ing, i) => {
        console.log(
          `   ${i + 1}. ${ing.display_name} (${ing.usage_count} recipes) - ${ing.category}`
        );
      });

      // Category breakdown
      console.log(`\n📊 Category Breakdown:`);
      const categoryStats = await db.execute<{ category: string; count: number }>(sql`
        SELECT category, COUNT(*) as count
        FROM ingredients
        GROUP BY category
        ORDER BY count DESC
      `);

      categoryStats.rows.forEach((cat) => {
        console.log(`   ${cat.category}: ${cat.count}`);
      });

      // Mark common ingredients (used in >50 recipes)
      await db.execute(sql`
        UPDATE ingredients
        SET is_common = true
        WHERE usage_count > 50
      `);

      const commonCount = await db.execute<{ count: number }>(sql`
        SELECT COUNT(*) as count FROM ingredients WHERE is_common = true
      `);
      console.log(
        `\n✅ Marked ${commonCount.rows[0]?.count || 0} ingredients as common (>50 uses)`
      );
    }
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

// ============================================================================
// CLI ENTRY POINT
// ============================================================================

const args = process.argv.slice(2);
const options: ProcessingOptions = {
  dryRun: !args.includes('--execute'),
  limit: args.find((a) => a.startsWith('--limit='))?.split('=')[1]
    ? parseInt(args.find((a) => a.startsWith('--limit='))?.split('=')[1], 10)
    : undefined,
  resume: args.includes('--resume'),
};

processRecipes(options)
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
