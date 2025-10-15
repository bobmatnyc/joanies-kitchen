/**
 * Fix Ingredient Amounts Script - Batch Processing with Smart Rate Limiting
 *
 * This script handles OpenRouter rate limits gracefully by:
 * - Using exponential backoff (up to 5 minutes wait)
 * - Processing in batches
 * - Saving progress after each recipe
 * - Can resume from where it stopped
 * - Uses whatever model is available
 *
 * Models tried in order (until one works):
 * 1. google/gemini-2.0-flash-exp:free (FREE)
 * 2. anthropic/claude-3.5-haiku-20241022 (cheap OpenRouter credits)
 * 3. anthropic/claude-3-haiku (cheap OpenRouter credits)
 * 4. amazon/nova-lite-v1 (very cheap)
 *
 * Usage:
 *   pnpm fix:amounts:batch              # Fix all recipes with smart batching
 *   pnpm fix:amounts:batch:dry-run      # Test without updating DB
 *   pnpm fix:amounts:batch:test         # Test on 10 recipes
 */

import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';

interface ProcessStats {
  total: number;
  processed: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: Array<{ recipeId: string; recipeName: string; error: string }>;
  startTime: number;
  lastProcessedId?: string;
}

const PROGRESS_FILE = path.join(process.cwd(), 'tmp', 'ingredient-amounts-progress.json');
const MODELS_TO_TRY = [
  'google/gemini-2.0-flash-exp:free',
  'anthropic/claude-3.5-haiku-20241022',
  'anthropic/claude-3-haiku',
  'amazon/nova-lite-v1',
];

/**
 * Ensure tmp directory exists
 */
function ensureTmpDir() {
  const tmpDir = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }
}

/**
 * Save progress to file
 */
function saveProgress(stats: ProcessStats) {
  ensureTmpDir();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(stats, null, 2));
}

/**
 * Load progress from file
 */
function loadProgress(): ProcessStats | null {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      const data = fs.readFileSync(PROGRESS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.warn('Could not load progress file, starting fresh');
  }
  return null;
}

/**
 * Check if an ingredient has an amount specified
 */
function hasAmount(ingredient: string): boolean {
  const trimmed = ingredient.trim();
  return /^[\d½¼¾⅓⅔⅛⅜⅝⅞]|^(a |an |one |two |three |some |few |several )/i.test(trimmed);
}

/**
 * Try multiple models until one works
 */
async function addAmountsToIngredients(
  recipeName: string,
  ingredients: string[],
  servings?: number
): Promise<string[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable is not set');
  }

  const openrouter = new OpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3004',
      'X-Title': 'Recipe Manager - Ingredient Amounts Fixer (Batch)',
    },
  });

  const servingsContext = servings ? `\nServings: ${servings}` : '';

  const prompt = `You are a professional chef. Add realistic standard cooking amounts to these ingredients.

Recipe: ${recipeName}${servingsContext}

Ingredients (no amounts):
${ingredients.map((ing, i) => `${i + 1}. ${ing}`).join('\n')}

INSTRUCTIONS:
1. Add realistic amounts using standard US measurements
2. Consider the recipe name and servings
3. Use proper terminology (diced, minced, chopped)
4. Be specific (e.g., "2 cups all-purpose flour")

Examples:
- "flour" → "2 cups all-purpose flour"
- "chicken" → "1 lb chicken breast, diced"
- "garlic" → "3 cloves garlic, minced"

Return ONLY valid JSON:
{"ingredients": ["ingredient with amount 1", "ingredient with amount 2", ...]}`;

  // Try each model in order
  for (const model of MODELS_TO_TRY) {
    let lastError: Error | null = null;

    // Try each model with retries
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        const response = await openrouter.chat.completions.create({
          model,
          messages: [
            {
              role: 'system',
              content: 'You are a professional chef. Respond with valid JSON only.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3,
          max_tokens: 2000,
        });

        // Success! Parse and return
        const content = response?.choices[0]?.message?.content;
        if (!content) {
          throw new Error('No response from LLM');
        }

        // Clean up response
        let cleanContent = content.trim();
        if (cleanContent.startsWith('```json')) {
          cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanContent.startsWith('```')) {
          cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }

        const result = JSON.parse(cleanContent);

        if (!result.ingredients || !Array.isArray(result.ingredients)) {
          throw new Error('Invalid response format');
        }

        if (result.ingredients.length !== ingredients.length) {
          console.warn(`  ⚠️  Expected ${ingredients.length} ingredients, got ${result.ingredients.length}`);
        }

        console.log(`  ✓ Used model: ${model}`);
        return result.ingredients;

      } catch (error: any) {
        lastError = error;

        // Rate limit - use exponential backoff
        if (error.status === 429) {
          if (attempt < 5) {
            // Exponential backoff: 30s, 60s, 120s, 300s (5 min)
            const waitSeconds = Math.min(30 * Math.pow(2, attempt - 1), 300);
            console.log(`  ⏳ Rate limit with ${model}, waiting ${waitSeconds}s (attempt ${attempt}/5)...`);
            await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));
            continue;
          }
          // If exhausted retries for this model, try next model
          console.log(`  ⏭️  Rate limit exhausted for ${model}, trying next model...`);
          break;
        }

        // Server error - quick retry
        if (error.status >= 500 && error.status < 600 && attempt < 3) {
          const waitSeconds = 10;
          console.log(`  ⏳ Server error, retrying in ${waitSeconds}s...`);
          await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));
          continue;
        }

        // Other error - don't retry this model
        console.error(`  ✗ Error with ${model}:`, error.message);
        break;
      }
    }
  }

  // All models failed
  throw new Error('All models failed or are rate-limited');
}

/**
 * Main function to fix all recipe amounts with batch processing
 */
async function fixAllRecipeAmounts(options: { dryRun?: boolean; limit?: number; resume?: boolean } = {}) {
  const { dryRun = false, limit, resume = true } = options;

  console.log('🔧 Recipe Ingredient Amounts Fixer (Batch Processing)\n');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no database updates)' : 'LIVE (will update database)'}`);
  console.log(`Limit: ${limit ? `${limit} recipes` : 'All recipes'}`);
  console.log(`Resume: ${resume ? 'Yes (will continue from last position)' : 'No (start fresh)'}`);
  console.log(`Models: ${MODELS_TO_TRY.join(', ')}`);
  console.log(`Strategy: Try each model with exponential backoff up to 5 minutes\n`);

  // Load or create stats
  let stats: ProcessStats;
  if (resume) {
    const savedStats = loadProgress();
    if (savedStats) {
      stats = savedStats;
      stats.startTime = Date.now(); // Reset start time for this session
      console.log(`📂 Resuming from previous session...`);
      console.log(`   Already processed: ${stats.processed}/${stats.total}`);
      console.log(`   Last processed ID: ${stats.lastProcessedId}\n`);
    } else {
      stats = {
        total: 0,
        processed: 0,
        updated: 0,
        skipped: 0,
        failed: 0,
        errors: [],
        startTime: Date.now(),
      };
    }
  } else {
    stats = {
      total: 0,
      processed: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
      startTime: Date.now(),
    };
  }

  console.log('Starting in 3 seconds...\n');
  await new Promise(resolve => setTimeout(resolve, 3000));

  try {
    // Fetch all recipes
    let allRecipes = await db.select().from(recipes);

    if (limit) {
      allRecipes = allRecipes.slice(0, limit);
    }

    stats.total = allRecipes.length;

    // Filter out already processed recipes if resuming
    if (resume && stats.lastProcessedId) {
      const lastIndex = allRecipes.findIndex(r => r.id === stats.lastProcessedId);
      if (lastIndex >= 0) {
        allRecipes = allRecipes.slice(lastIndex + 1);
        console.log(`📂 Skipping ${lastIndex + 1} already processed recipes\n`);
      }
    }

    console.log(`📊 Found ${allRecipes.length} recipes to process\n`);
    console.log('━'.repeat(80) + '\n');

    for (const recipe of allRecipes) {
      stats.processed++;
      const progress = `[${stats.processed}/${stats.total}]`;

      console.log(`${progress} Processing: ${recipe.name}`);
      console.log(`  ID: ${recipe.id}`);

      try {
        // Parse ingredients
        let ingredients: string[];
        try {
          ingredients = JSON.parse(recipe.ingredients as string);
          if (!Array.isArray(ingredients)) {
            throw new Error('Ingredients is not an array');
          }
        } catch (error) {
          console.log(`  ✗ Invalid ingredients format, skipping\n`);
          stats.skipped++;
          stats.lastProcessedId = recipe.id;
          saveProgress(stats);
          continue;
        }

        // Check if amounts already present
        const ingredientsWithoutAmounts = ingredients.filter(ing => !hasAmount(ing));

        if (ingredientsWithoutAmounts.length === 0) {
          console.log(`  ✓ Already has amounts, skipping\n`);
          stats.skipped++;
          stats.lastProcessedId = recipe.id;
          saveProgress(stats);
          continue;
        }

        console.log(`  📝 Missing amounts: ${ingredientsWithoutAmounts.length}/${ingredients.length}`);
        console.log(`  🤖 Requesting LLM enhancement...`);

        // Add amounts using LLM
        const withAmounts = await addAmountsToIngredients(
          recipe.name,
          ingredients,
          recipe.servings || undefined
        );

        // Show before/after examples
        console.log(`  📋 Sample transformations:`);
        const sampleCount = Math.min(3, ingredients.length);
        for (let i = 0; i < sampleCount; i++) {
          console.log(`     Before: "${ingredients[i]}"`);
          console.log(`     After:  "${withAmounts[i]}"`);
        }

        // Update database (unless dry run)
        if (!dryRun) {
          await db.update(recipes)
            .set({
              ingredients: JSON.stringify(withAmounts),
              updatedAt: new Date()
            })
            .where(eq(recipes.id, recipe.id));

          console.log(`  ✅ Updated in database`);
        } else {
          console.log(`  ✓ Would update in database (dry run)`);
        }

        stats.updated++;
        stats.lastProcessedId = recipe.id;
        saveProgress(stats);

        // Calculate ETA
        const elapsed = Date.now() - stats.startTime;
        const avgTimePerRecipe = elapsed / stats.processed;
        const remaining = stats.total - stats.processed;
        const etaMs = avgTimePerRecipe * remaining;
        const etaMinutes = Math.ceil(etaMs / 60000);

        console.log(`  ⏱️  ETA: ~${etaMinutes} minutes remaining`);
        console.log();

        // Conservative rate limit - wait 3 seconds between requests
        await new Promise(resolve => setTimeout(resolve, 3000));

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`  ✗ Failed: ${errorMessage}\n`);

        stats.failed++;
        stats.errors.push({
          recipeId: recipe.id,
          recipeName: recipe.name,
          error: errorMessage,
        });
        stats.lastProcessedId = recipe.id;
        saveProgress(stats);

        // If all models failed, wait longer before continuing
        if (errorMessage.includes('All models failed')) {
          console.log('  ⏸️  All models exhausted, waiting 5 minutes before continuing...\n');
          await new Promise(resolve => setTimeout(resolve, 300000)); // 5 minutes
        }
      }
    }

    // Calculate final stats
    const totalTime = Date.now() - stats.startTime;
    const totalMinutes = Math.ceil(totalTime / 60000);
    const avgTimePerRecipe = totalTime / stats.processed;
    const avgSeconds = (avgTimePerRecipe / 1000).toFixed(1);

    console.log('━'.repeat(80) + '\n');
    console.log('✅ Processing complete!\n');
    console.log('📊 Final Statistics:');
    console.log(`  Total recipes: ${stats.total}`);
    console.log(`  Processed: ${stats.processed}`);
    console.log(`  Updated: ${stats.updated} ${dryRun ? '(dry run)' : ''}`);
    console.log(`  Skipped: ${stats.skipped}`);
    console.log(`  Failed: ${stats.failed}`);
    console.log(`  Total time: ${totalMinutes} minutes`);
    console.log(`  Average: ${avgSeconds}s per recipe`);

    if (stats.errors.length > 0) {
      console.log('\n⚠️  Errors:');
      stats.errors.slice(0, 10).forEach(({ recipeName, error }) => {
        console.log(`  - ${recipeName}: ${error}`);
      });
      if (stats.errors.length > 10) {
        console.log(`  ... and ${stats.errors.length - 10} more errors`);
      }
    }

    const successRate = stats.total > 0
      ? ((stats.updated + stats.skipped) / stats.total * 100).toFixed(1)
      : 0;

    console.log(`\n✨ Success rate: ${successRate}%`);

    // Clean up progress file if complete
    if (stats.processed >= stats.total && fs.existsSync(PROGRESS_FILE)) {
      fs.unlinkSync(PROGRESS_FILE);
      console.log('🧹 Progress file cleaned up');
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    console.log('\n💾 Progress saved. Run again with resume=true to continue.');
    saveProgress(stats);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const noResume = args.includes('--no-resume');
const limitArg = args.find(arg => arg.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;

// Run the script
fixAllRecipeAmounts({ dryRun, limit, resume: !noResume })
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
