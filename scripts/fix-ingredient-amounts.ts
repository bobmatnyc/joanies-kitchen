/**
 * Fix Ingredient Amounts Script
 *
 * This script processes all recipes in the database and adds realistic
 * ingredient amounts using the Gemini Flash LLM (FREE tier).
 *
 * Features:
 * - Detects recipes missing ingredient amounts
 * - Uses LLM to add realistic standard measurements
 * - Respects rate limits (10 req/sec for Gemini Flash)
 * - Provides detailed progress reporting
 * - Supports dry-run mode for testing
 *
 * Usage:
 *   pnpm fix:amounts           # Fix all recipes
 *   pnpm fix:amounts -- --dry-run    # Test without updating DB
 *   pnpm fix:amounts -- --limit 10   # Fix only first 10 recipes
 */

import { eq } from 'drizzle-orm';
import OpenAI from 'openai';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';

interface ProcessStats {
  total: number;
  processed: number;
  updated: number;
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
 * Use LLM to add realistic amounts to ingredients
 */
async function addAmountsToIngredients(
  recipeName: string,
  ingredients: string[],
  servings?: number
): Promise<string[]> {
  // Create OpenRouter client directly (avoiding server-only module)
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable is not set');
  }

  const openrouter = new OpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001',
      'X-Title': 'Recipe Manager - Ingredient Amounts Fixer',
    },
  });

  const servingsContext = servings ? `\nServings: ${servings}` : '';

  const prompt = `You are a professional chef and recipe writer. Given a recipe name and list of ingredients WITHOUT amounts, add realistic standard cooking amounts.

Recipe: ${recipeName}${servingsContext}

Ingredients (no amounts):
${ingredients.map((ing, i) => `${i + 1}. ${ing}`).join('\n')}

IMPORTANT INSTRUCTIONS:
1. Add realistic amounts using standard US measurements (cups, tablespoons, teaspoons, pounds, ounces, etc.)
2. Consider the recipe name and servings when determining amounts
3. Use proper cooking terminology (e.g., "diced", "minced", "chopped")
4. Be specific but realistic (e.g., "2 cups all-purpose flour", not "some flour")
5. For proteins, use weight measurements (e.g., "1 lb chicken breast")
6. For vegetables, use quantity or volume (e.g., "2 medium onions" or "1 cup diced tomatoes")
7. For spices/seasonings, use small measurements (e.g., "1 teaspoon salt", "1/2 teaspoon pepper")

Examples:
- "flour" → "2 cups all-purpose flour"
- "chicken" → "1 lb chicken breast, diced"
- "garlic" → "3 cloves garlic, minced"
- "salt" → "1 teaspoon salt"
- "olive oil" → "2 tablespoons olive oil"
- "onion" → "1 medium onion, diced"

Return ONLY a valid JSON object with an "ingredients" array of strings. No markdown formatting, no code blocks, just pure JSON:
{"ingredients": ["ingredient with amount 1", "ingredient with amount 2", ...]}`;

  // Retry logic for rate limits
  let lastError: Error | null = null;
  let response: any = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      response = await openrouter.chat.completions.create({
        model: 'google/gemini-2.0-flash-exp:free',
        messages: [
          {
            role: 'system',
            content:
              'You are a professional chef providing recipe ingredient amounts. Always respond with valid JSON only.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      });

      // Success! Break out of retry loop
      lastError = null;
      break;
    } catch (error: any) {
      lastError = error;

      // Check if it's a rate limit error (429)
      if (error.status === 429) {
        if (attempt < 3) {
          const waitSeconds = attempt * 10; // 10s, 20s
          console.log(
            `  ⏳ Rate limit hit, waiting ${waitSeconds}s before retry (attempt ${attempt}/3)...`
          );
          await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));
          continue;
        }
      }

      // Non-rate-limit error or exhausted retries, throw
      console.error('  ✗ LLM Error:', error);
      throw error;
    }
  }

  // If we still have an error after retries, throw it
  if (lastError) {
    console.error('  ✗ LLM Error after retries:', lastError);
    throw lastError;
  }

  // Parse and validate response
  try {
    const content = response?.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from LLM');
    }

    // Clean up response - remove markdown code blocks if present
    let cleanContent = content.trim();
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const result = JSON.parse(cleanContent);

    if (!result.ingredients || !Array.isArray(result.ingredients)) {
      throw new Error('Invalid response format: missing ingredients array');
    }

    if (result.ingredients.length !== ingredients.length) {
      console.warn(
        `  ⚠️  Warning: Expected ${ingredients.length} ingredients, got ${result.ingredients.length}`
      );
    }

    return result.ingredients;
  } catch (error) {
    console.error('  ✗ Parse Error:', error);
    throw error;
  }
}

/**
 * Main function to fix all recipe amounts
 */
async function fixAllRecipeAmounts(options: { dryRun?: boolean; limit?: number } = {}) {
  const { dryRun = false, limit } = options;

  console.log('🔧 Recipe Ingredient Amounts Fixer\n');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no database updates)' : 'LIVE (will update database)'}`);
  console.log(`Limit: ${limit ? `${limit} recipes` : 'All recipes'}`);
  console.log(`Model: google/gemini-2.0-flash-exp:free (FREE tier)\n`);
  console.log('Starting in 3 seconds...\n');

  await new Promise((resolve) => setTimeout(resolve, 3000));

  const stats: ProcessStats = {
    total: 0,
    processed: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  try {
    // Fetch all recipes
    let allRecipes = await db.select().from(recipes);

    if (limit) {
      allRecipes = allRecipes.slice(0, limit);
    }

    stats.total = allRecipes.length;

    console.log(`📊 Found ${stats.total} recipes to process\n`);
    console.log(`${'━'.repeat(80)}\n`);

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
        } catch (_error) {
          console.log(`  ✗ Invalid ingredients format, skipping\n`);
          stats.skipped++;
          continue;
        }

        // Check if amounts already present
        const ingredientsWithoutAmounts = ingredients.filter((ing) => !hasAmount(ing));

        if (ingredientsWithoutAmounts.length === 0) {
          console.log(`  ✓ Already has amounts (${ingredients.length} ingredients), skipping\n`);
          stats.skipped++;
          continue;
        }

        console.log(
          `  📝 Missing amounts: ${ingredientsWithoutAmounts.length}/${ingredients.length} ingredients`
        );
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
          await db
            .update(recipes)
            .set({
              ingredients: JSON.stringify(withAmounts),
              updatedAt: new Date(),
            })
            .where(eq(recipes.id, recipe.id));

          console.log(`  ✅ Updated in database`);
        } else {
          console.log(`  ✓ Would update in database (dry run)`);
        }

        stats.updated++;
        console.log();

        // Rate limit (3000ms = 20 requests per minute for free tier)
        await new Promise((resolve) => setTimeout(resolve, 3000));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`  ✗ Failed: ${errorMessage}\n`);

        stats.failed++;
        stats.errors.push({
          recipeId: recipe.id,
          recipeName: recipe.name,
          error: errorMessage,
        });
      }
    }

    console.log(`${'━'.repeat(80)}\n`);
    console.log('✅ Processing complete!\n');
    console.log('📊 Final Statistics:');
    console.log(`  Total recipes: ${stats.total}`);
    console.log(`  Processed: ${stats.processed}`);
    console.log(`  Updated: ${stats.updated} ${dryRun ? '(dry run)' : ''}`);
    console.log(`  Skipped (already had amounts): ${stats.skipped}`);
    console.log(`  Failed: ${stats.failed}`);

    if (stats.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      stats.errors.forEach(({ recipeId, recipeName, error }) => {
        console.log(`  - ${recipeName} (${recipeId}): ${error}`);
      });
    }

    // Calculate success rate
    const successRate =
      stats.total > 0 ? (((stats.updated + stats.skipped) / stats.total) * 100).toFixed(1) : 0;

    console.log(`\n✨ Success rate: ${successRate}%`);

    if (!dryRun && stats.updated > 0) {
      console.log(`\n💾 Database updated with ${stats.updated} improved recipes`);
    }
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitArg = args.find((arg) => arg.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;

// Run the script
fixAllRecipeAmounts({ dryRun, limit })
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
