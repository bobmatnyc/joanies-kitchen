#!/usr/bin/env tsx

/**
 * Recipe Content Cleanup Script
 *
 * Fixes critical data quality issues across all recipes:
 * - Adds missing ingredient amounts (CRITICAL)
 * - Fixes title capitalization
 * - Improves description grammar and clarity
 *
 * Features:
 * - Dry-run mode (default) - shows changes without saving
 * - Batch processing with rate limiting
 * - Progress tracking and detailed logging
 * - Backup and rollback support
 * - Comprehensive error handling
 *
 * Usage:
 *   npx tsx scripts/cleanup-recipe-content.ts              # Dry run (default)
 *   npx tsx scripts/cleanup-recipe-content.ts --execute    # Apply changes
 *   npx tsx scripts/cleanup-recipe-content.ts --limit=10   # Test on 10 recipes
 *   npx tsx scripts/cleanup-recipe-content.ts --sample     # Test on 10 random recipes
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import OpenAI from 'openai';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';

interface CleanupOptions {
  dryRun: boolean;
  limit?: number;
  sample?: boolean;
}

interface CleanupResult {
  recipeId: string;
  originalName: string;
  newName: string;
  originalDescription: string;
  newDescription: string;
  originalIngredients: string[];
  newIngredients: string[];
  ingredientsFixed: number; // Count of ingredients that gained amounts
  titleChanged: boolean;
  descriptionChanged: boolean;
  success: boolean;
  error?: string;
}

interface ProcessingStats {
  total: number;
  processed: number;
  titlesUpdated: number;
  descriptionsUpdated: number;
  ingredientsFixed: number; // Total count of individual ingredients fixed
  recipesUpdated: number; // Recipes that had any change
  skipped: number;
  failed: number;
  errors: Array<{ recipeId: string; recipeName: string; error: string }>;
}

/**
 * Check if an ingredient has an amount specified
 */
function hasAmount(ingredient: string): boolean {
  const trimmed = ingredient.trim();
  // Check for numbers, fractions, or common amount words
  return /^[\d½¼¾⅓⅔⅛⅜⅝⅞]|^(a |an |one |two |three |some |few |several )/i.test(trimmed);
}

/**
 * Create OpenRouter client
 */
function createOpenRouterClient() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable is not set');
  }

  return new OpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3004',
      'X-Title': 'Recipe Manager - Content Cleanup',
    },
  });
}

/**
 * Clean up a single recipe using LLM
 */
async function cleanupRecipe(openrouter: OpenAI, recipe: any): Promise<CleanupResult> {
  // Parse current ingredients
  let ingredients: string[];
  try {
    ingredients = JSON.parse(recipe.ingredients as string);
    if (!Array.isArray(ingredients)) {
      throw new Error('Ingredients is not an array');
    }
  } catch (_error) {
    return {
      recipeId: recipe.id,
      originalName: recipe.name,
      newName: recipe.name,
      originalDescription: recipe.description || '',
      newDescription: recipe.description || '',
      originalIngredients: [],
      newIngredients: [],
      ingredientsFixed: 0,
      titleChanged: false,
      descriptionChanged: false,
      success: false,
      error: 'Invalid ingredients format',
    };
  }

  // Count ingredients needing amounts
  const _needsAmounts = ingredients.filter((ing) => !hasAmount(ing)).length;

  // Build LLM prompt
  const prompt = `You are a professional recipe editor. Clean up this recipe data:

RECIPE NAME: ${recipe.name}
DESCRIPTION: ${recipe.description || 'No description provided'}
SERVINGS: ${recipe.servings || 4}
CURRENT INGREDIENTS: ${JSON.stringify(ingredients, null, 2)}

TASKS:
1. Fix title capitalization (use Title Case for proper nouns and food items)
   - Examples: "carrot cake" → "Carrot Cake", "thai green curry" → "Thai Green Curry"
   - Keep prepositions lowercase unless first word: "Chicken with Rice" not "Chicken With Rice"

2. Improve description grammar and clarity (keep it concise and appealing)
   - Fix grammar and spelling errors
   - Make it engaging but brief (1-2 sentences ideal)
   - Keep the recipe's character and tone

3. **CRITICAL**: Ensure ALL ingredients have quantities
   - If an ingredient is missing a quantity, infer a reasonable amount for ${recipe.servings || 4} servings
   - Be specific with units (cups, tablespoons, teaspoons, lbs, oz, whole, cloves, etc.)
   - Include preparation notes (minced, diced, chopped, etc.) where appropriate
   - Maintain ingredient order and original intent

Examples of good ingredient formatting:
- "2 cups all-purpose flour, sifted"
- "1 lb boneless skinless chicken breast, cut into 1-inch pieces"
- "3 cloves garlic, minced"
- "1 teaspoon salt"
- "1/2 cup olive oil"
- "2 medium onions, diced"
- "1 tablespoon fresh basil, chopped"

Return ONLY valid JSON (no markdown, no explanation):
{
  "name": "corrected title",
  "description": "improved description",
  "ingredients": ["properly formatted ingredients with amounts"]
}`;

  // Call LLM with retry logic
  let lastError: Error | null = null;
  let response: any = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      response = await openrouter.chat.completions.create({
        model: 'anthropic/claude-3-haiku',
        messages: [
          {
            role: 'system',
            content:
              'You are a professional recipe editor. Always respond with valid JSON only, no markdown formatting.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 3000,
      });

      // Success!
      lastError = null;
      break;
    } catch (error: any) {
      lastError = error;

      // Check for rate limit (429) - less likely with paid model
      if (error.status === 429) {
        if (attempt < 3) {
          const waitSeconds = attempt * 3; // Reduced from 10s to 3s for paid model
          console.log(`  ⏳ Rate limit hit, waiting ${waitSeconds}s (attempt ${attempt}/3)...`);
          await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));
          continue;
        }
      }

      // Non-rate-limit error or exhausted retries
      throw error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  // Parse and validate response
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

  const result = JSON.parse(cleanContent);

  // Validate response structure
  if (
    !result.name ||
    !result.description ||
    !result.ingredients ||
    !Array.isArray(result.ingredients)
  ) {
    throw new Error('Invalid response format: missing required fields');
  }

  if (result.ingredients.length !== ingredients.length) {
    console.warn(
      `  ⚠️  Warning: Expected ${ingredients.length} ingredients, got ${result.ingredients.length}`
    );
  }

  // Count how many ingredients were fixed
  const afterAmounts = result.ingredients.filter((ing: string) => hasAmount(ing)).length;
  const beforeAmounts = ingredients.filter((ing) => hasAmount(ing)).length;
  const ingredientsFixed = afterAmounts - beforeAmounts;

  return {
    recipeId: recipe.id,
    originalName: recipe.name,
    newName: result.name,
    originalDescription: recipe.description || '',
    newDescription: result.description,
    originalIngredients: ingredients,
    newIngredients: result.ingredients,
    ingredientsFixed: Math.max(0, ingredientsFixed),
    titleChanged: recipe.name !== result.name,
    descriptionChanged: (recipe.description || '') !== result.description,
    success: true,
  };
}

/**
 * Generate timestamp for filenames
 */
function getTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
}

/**
 * Save backup data to file
 */
async function saveBackup(recipes: any[], timestamp: string): Promise<string> {
  const tmpDir = path.join(process.cwd(), 'tmp');
  await fs.mkdir(tmpDir, { recursive: true });

  const backupPath = path.join(tmpDir, `recipe-backup-${timestamp}.json`);
  await fs.writeFile(backupPath, JSON.stringify(recipes, null, 2));

  return backupPath;
}

/**
 * Save cleanup log to file
 */
async function saveLog(
  results: CleanupResult[],
  stats: ProcessingStats,
  timestamp: string
): Promise<string> {
  const tmpDir = path.join(process.cwd(), 'tmp');
  await fs.mkdir(tmpDir, { recursive: true });

  const logPath = path.join(tmpDir, `recipe-cleanup-log-${timestamp}.json`);
  const logData = {
    timestamp,
    stats,
    results: results.filter((r) => r.success),
    errors: stats.errors,
  };

  await fs.writeFile(logPath, JSON.stringify(logData, null, 2));

  return logPath;
}

/**
 * Format time estimate
 */
function formatTimeEstimate(recipesRemaining: number, recipesPerMinute: number): string {
  const minutesRemaining = recipesRemaining / recipesPerMinute;
  const hours = Math.floor(minutesRemaining / 60);
  const minutes = Math.floor(minutesRemaining % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Main processing function
 */
async function processRecipes(options: CleanupOptions) {
  const timestamp = getTimestamp();
  const openrouter = createOpenRouterClient();

  console.log('🧹 Recipe Content Cleanup Script');
  console.log('================================\n');
  console.log(
    `Mode: ${options.dryRun ? 'DRY RUN (use --execute to apply changes)' : 'EXECUTE (will update database)'}`
  );
  console.log(`Model: anthropic/claude-3-haiku (PAID - no rate limits)\n`);

  const stats: ProcessingStats = {
    total: 0,
    processed: 0,
    titlesUpdated: 0,
    descriptionsUpdated: 0,
    ingredientsFixed: 0,
    recipesUpdated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  const results: CleanupResult[] = [];

  try {
    // Fetch recipes
    let allRecipes = await db.select().from(recipes);

    // Apply sample mode
    if (options.sample) {
      const shuffled = allRecipes.sort(() => 0.5 - Math.random());
      allRecipes = shuffled.slice(0, 10);
      console.log('Sample mode: Processing 10 random recipes\n');
    }

    // Apply limit
    if (options.limit) {
      allRecipes = allRecipes.slice(0, options.limit);
    }

    stats.total = allRecipes.length;
    console.log(`Recipes to process: ${stats.total.toLocaleString()}\n`);

    // Save backup
    const backupPath = await saveBackup(allRecipes, timestamp);
    console.log(`✅ Backup saved to: ${backupPath}\n`);

    if (!options.dryRun) {
      console.log('⚠️  LIVE MODE: Changes will be saved to database!');
      console.log('Starting in 5 seconds... (Ctrl+C to cancel)\n');
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    console.log(`${'━'.repeat(80)}\n`);

    const startTime = Date.now();
    const batchSize = 10;
    const batches = Math.ceil(allRecipes.length / batchSize);

    for (let batchNum = 0; batchNum < batches; batchNum++) {
      const batchStart = batchNum * batchSize;
      const batchEnd = Math.min(batchStart + batchSize, allRecipes.length);
      const batch = allRecipes.slice(batchStart, batchEnd);

      console.log(`\nProcessing batch ${batchNum + 1}/${batches}...`);

      for (const recipe of batch) {
        stats.processed++;
        const progress = `[${stats.processed}/${stats.total}]`;

        console.log(`\n${progress} ${recipe.name}`);
        console.log(`  ID: ${recipe.id}`);

        try {
          const result = await cleanupRecipe(openrouter, recipe);
          results.push(result);

          if (!result.success) {
            console.log(`  ✗ Failed: ${result.error}`);
            stats.failed++;
            stats.errors.push({
              recipeId: recipe.id,
              recipeName: recipe.name,
              error: result.error || 'Unknown error',
            });
            continue;
          }

          // Display changes
          if (result.titleChanged) {
            console.log(`  📝 Title: "${result.originalName}" → "${result.newName}"`);
            stats.titlesUpdated++;
          }

          if (result.descriptionChanged) {
            console.log(`  📄 Description updated`);
            stats.descriptionsUpdated++;
          }

          if (result.ingredientsFixed > 0) {
            console.log(`  ✅ Ingredients fixed: ${result.ingredientsFixed} amounts added`);
            stats.ingredientsFixed += result.ingredientsFixed;
          }

          // Show sample transformations
          const changedIngredients = result.originalIngredients
            .map((orig, i) => ({
              orig,
              new: result.newIngredients[i],
              changed: orig !== result.newIngredients[i],
            }))
            .filter((item) => item.changed);

          if (changedIngredients.length > 0) {
            const sampleCount = Math.min(2, changedIngredients.length);
            console.log(`  📋 Sample changes (${changedIngredients.length} total):`);
            for (let i = 0; i < sampleCount; i++) {
              console.log(`     Before: "${changedIngredients[i].orig}"`);
              console.log(`     After:  "${changedIngredients[i].new}"`);
            }
          }

          // Update database if not dry run
          if (
            !options.dryRun &&
            (result.titleChanged || result.descriptionChanged || result.ingredientsFixed > 0)
          ) {
            await db
              .update(recipes)
              .set({
                name: result.newName,
                description: result.newDescription,
                ingredients: JSON.stringify(result.newIngredients),
                updatedAt: new Date(),
              })
              .where(eq(recipes.id, recipe.id));

            console.log(`  💾 Updated in database`);
            stats.recipesUpdated++;
          } else if (
            result.titleChanged ||
            result.descriptionChanged ||
            result.ingredientsFixed > 0
          ) {
            console.log(`  ✓ Would update in database (dry run)`);
            stats.recipesUpdated++;
          } else {
            console.log(`  ⏭️  No changes needed`);
            stats.skipped++;
          }
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
      }

      // Rate limiting between batches (2 seconds for paid model with no strict limits)
      if (batchNum < batches - 1) {
        const elapsed = (Date.now() - startTime) / 1000;
        const recipesPerMinute = stats.processed / (elapsed / 60);
        const remaining = stats.total - stats.processed;
        const eta = formatTimeEstimate(remaining, recipesPerMinute);

        console.log(
          `\n⏱️  Progress: ${stats.processed}/${stats.total} (${((stats.processed / stats.total) * 100).toFixed(1)}%)`
        );
        console.log(`   Rate: ${recipesPerMinute.toFixed(1)} recipes/min | ETA: ${eta}`);
        console.log('   Waiting 2 seconds...');

        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    // Save log
    const logPath = await saveLog(results, stats, timestamp);

    console.log(`\n${'━'.repeat(80)}\n`);
    console.log('✅ Processing complete!\n');
    console.log('📊 Summary:');
    console.log('========');
    console.log(`  Total processed: ${stats.processed.toLocaleString()}`);
    console.log(`  Titles updated: ${stats.titlesUpdated.toLocaleString()}`);
    console.log(`  Descriptions improved: ${stats.descriptionsUpdated.toLocaleString()}`);
    console.log(
      `  Ingredients fixed: ${stats.ingredientsFixed.toLocaleString()} (avg ${(stats.ingredientsFixed / (stats.recipesUpdated || 1)).toFixed(1)} per recipe)`
    );
    console.log(
      `  Recipes updated: ${stats.recipesUpdated.toLocaleString()} ${options.dryRun ? '(dry run)' : ''}`
    );
    console.log(`  Skipped (no changes): ${stats.skipped.toLocaleString()}`);
    console.log(`  Failed: ${stats.failed.toLocaleString()}`);

    if (stats.errors.length > 0) {
      console.log(`\n⚠️  Errors (${stats.errors.length}):`);
      stats.errors.slice(0, 10).forEach(({ recipeName, error }) => {
        console.log(`  - ${recipeName}: ${error}`);
      });
      if (stats.errors.length > 10) {
        console.log(`  ... and ${stats.errors.length - 10} more (see log file)`);
      }
    }

    const successRate =
      stats.total > 0
        ? (((stats.recipesUpdated + stats.skipped) / stats.total) * 100).toFixed(1)
        : 0;

    console.log(`\n✨ Success rate: ${successRate}%`);
    console.log(`\n📁 Files created:`);
    console.log(`   Backup: ${backupPath}`);
    console.log(`   Log: ${logPath}`);

    if (options.dryRun) {
      console.log(`\n💡 Next steps:`);
      console.log(`   - Review the changes above`);
      console.log(`   - Run with --execute to apply changes`);
      console.log(
        `   - Use rollback script if needed: npx tsx scripts/rollback-recipe-cleanup.ts ${timestamp}`
      );
    } else {
      console.log(
        `\n💾 Database updated with ${stats.recipesUpdated.toLocaleString()} improved recipes`
      );
      console.log(`\n⚠️  If you need to rollback:`);
      console.log(`   npx tsx scripts/rollback-recipe-cleanup.ts ${timestamp}`);
    }
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

// Parse CLI arguments
const args = process.argv.slice(2);
const options: CleanupOptions = {
  dryRun: !args.includes('--execute'),
  limit: args.find((a) => a.startsWith('--limit='))?.split('=')[1]
    ? parseInt(args.find((a) => a.startsWith('--limit='))?.split('=')[1], 10)
    : undefined,
  sample: args.includes('--sample'),
};

// Run
processRecipes(options)
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
