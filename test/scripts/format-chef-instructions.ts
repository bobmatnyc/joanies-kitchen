#!/usr/bin/env tsx
/**
 * Format Chef Recipe Instructions
 *
 * Uses LLM to analyze and reformat instructions for all featured chef recipes.
 * Breaks run-on text into clear, numbered steps without changing wording.
 *
 * Usage:
 *   pnpm tsx scripts/format-chef-instructions.ts           # Dry run (preview only)
 *   pnpm tsx scripts/format-chef-instructions.ts --apply   # Apply changes to database
 *   pnpm tsx scripts/format-chef-instructions.ts --chef="kenji-lopez-alt"  # Single chef
 */

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import OpenAI from 'openai';

// Configuration
const DRY_RUN = !process.argv.includes('--apply');
const CHEF_FILTER = process.argv.find((arg) => arg.startsWith('--chef='))?.split('=')[1];
const MAX_RECIPES =
  parseInt(process.argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1] || '0', 10) ||
  999999;

// OpenRouter client
const openrouter = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY!,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002',
    'X-Title': 'Recipe Manager - Instructions Formatter',
  },
});

// Database client
const sql = neon(process.env.DATABASE_URL!);

// Stats tracking
const stats = {
  total: 0,
  processed: 0,
  updated: 0,
  skipped: 0,
  errors: 0,
  alreadyFormatted: 0,
};

interface Recipe {
  id: string;
  name: string;
  chef_name: string;
  chef_slug: string;
  instructions: string;
  instructions_backup?: string;
}

/**
 * Check if instructions are already well-formatted
 * (JSON array or clearly numbered steps)
 */
function isWellFormatted(instructions: string): boolean {
  // Check if already JSON array
  if (instructions.trim().startsWith('[') && instructions.trim().endsWith(']')) {
    try {
      const parsed = JSON.parse(instructions);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return true;
      }
    } catch {
      // Not valid JSON, continue checking
    }
  }

  // Check if has clear numbered steps (at least 3 steps with numbers)
  const numberedSteps = instructions.match(/^\d+\./gm);
  if (numberedSteps && numberedSteps.length >= 3) {
    return true;
  }

  return false;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Use LLM to format instructions into clear steps
 */
async function formatInstructionsWithLLM(
  recipeName: string,
  instructions: string,
  retryCount = 0
): Promise<string[] | null> {
  const prompt = `You are formatting recipe instructions. Your task is to take the provided recipe instructions text and format it into clear, numbered steps.

CRITICAL RULES:
- Do NOT change any wording
- Do NOT add new content
- Do NOT remove content
- ONLY break the text into logical steps
- Each step should be one clear action or set of related actions
- Preserve all temperatures, times, measurements, and specific details exactly as written
- Return ONLY a JSON array of strings, one per step
- Do not include step numbers in the text (the array index serves as the step number)

Recipe: ${recipeName}

Input instructions:
${instructions}

Output format (JSON array only, no markdown, no explanation):
["Step 1 text here", "Step 2 text here", ...]`;

  // Try multiple models in order of preference
  const models = ['meta-llama/llama-3.2-3b-instruct:free', 'mistralai/mistral-7b-instruct:free'];

  const modelToUse = models[retryCount % models.length];

  try {
    // Add delay between requests to avoid rate limiting
    if (retryCount > 0) {
      const delayMs = Math.min(1000 * 2 ** retryCount, 10000); // Exponential backoff
      console.log(`  ⏳ Waiting ${delayMs}ms before retry...`);
      await sleep(delayMs);
    }

    const completion = await openrouter.chat.completions.create({
      model: modelToUse,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.1, // Low temperature for consistent formatting
      max_tokens: 4000,
    });

    const responseText = completion.choices[0]?.message?.content?.trim();
    if (!responseText) {
      throw new Error('Empty response from LLM');
    }

    // Extract JSON array from response (handle markdown code blocks)
    let jsonText = responseText;
    if (jsonText.includes('```')) {
      const match = jsonText.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
      if (match) {
        jsonText = match[1];
      }
    }

    // Parse JSON
    const steps = JSON.parse(jsonText);

    // Validate output
    if (!Array.isArray(steps)) {
      throw new Error('Response is not an array');
    }
    if (steps.length === 0) {
      throw new Error('Empty steps array');
    }
    if (!steps.every((step) => typeof step === 'string')) {
      throw new Error('Not all steps are strings');
    }

    return steps;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`  ❌ LLM Error (${modelToUse}): ${errorMsg}`);

    // Retry with different model if rate limited
    if ((errorMsg.includes('429') || errorMsg.includes('rate limit')) && retryCount < 3) {
      console.log(`  🔄 Retrying with different model (attempt ${retryCount + 1})...`);
      return formatInstructionsWithLLM(recipeName, instructions, retryCount + 1);
    }

    return null;
  }
}

/**
 * Process a single recipe
 */
async function processRecipe(recipe: Recipe): Promise<boolean> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Recipe: ${recipe.name}`);
  console.log(`Chef: ${recipe.chef_name}`);
  console.log(`ID: ${recipe.id}`);

  // Check if already formatted
  if (isWellFormatted(recipe.instructions)) {
    console.log('  ✓ Already well-formatted, skipping');
    stats.alreadyFormatted++;
    stats.skipped++;
    return false;
  }

  // Check if we have a backup (already processed before)
  if (recipe.instructions_backup) {
    console.log('  ⚠ Backup exists, already processed. Skipping to avoid re-processing.');
    stats.skipped++;
    return false;
  }

  console.log('\nOriginal instructions (first 300 chars):');
  console.log(`  ${recipe.instructions.substring(0, 300).replace(/\n/g, '\n  ')}...`);

  // Format with LLM
  console.log('\n  🤖 Formatting with LLM...');
  const formattedSteps = await formatInstructionsWithLLM(recipe.name, recipe.instructions);

  if (!formattedSteps) {
    stats.errors++;
    return false;
  }

  console.log(`\n  ✓ Formatted into ${formattedSteps.length} steps`);
  console.log('\nFormatted instructions:');
  formattedSteps.forEach((step, i) => {
    const preview = step.length > 100 ? `${step.substring(0, 100)}...` : step;
    console.log(`  ${i + 1}. ${preview}`);
  });

  // Update database
  if (!DRY_RUN) {
    try {
      await sql`
        UPDATE recipes
        SET
          instructions = ${JSON.stringify(formattedSteps)},
          instructions_backup = ${recipe.instructions},
          updated_at = NOW()
        WHERE id = ${recipe.id}
      `;
      console.log('\n  ✅ Database updated');
      stats.updated++;
    } catch (error) {
      console.error(
        `\n  ❌ Database error: ${error instanceof Error ? error.message : String(error)}`
      );
      stats.errors++;
      return false;
    }
  } else {
    console.log('\n  ℹ️  DRY RUN - No changes made to database');
  }

  stats.processed++;
  return true;
}

/**
 * Main execution
 */
async function main() {
  console.log('🔧 Recipe Instructions Formatter');
  console.log('='.repeat(80));
  console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN (preview only)' : '✍️  APPLY (will update database)'}`);
  if (CHEF_FILTER) {
    console.log(`Filter: Chef slug = "${CHEF_FILTER}"`);
  }
  if (MAX_RECIPES < 999999) {
    console.log(`Limit: ${MAX_RECIPES} recipes`);
  }
  console.log('');

  // Check for instructions_backup column
  try {
    await sql`
      ALTER TABLE recipes
      ADD COLUMN IF NOT EXISTS instructions_backup TEXT
    `;
    console.log('✓ Ensured instructions_backup column exists\n');
  } catch (error) {
    console.error('Warning: Could not add backup column:', error);
  }

  // Fetch recipes from featured chefs
  let recipes: Recipe[];

  if (CHEF_FILTER) {
    recipes = (await sql`
      SELECT
        r.id,
        r.name,
        r.instructions,
        r.instructions_backup,
        c.name as chef_name,
        c.slug as chef_slug
      FROM recipes r
      INNER JOIN chef_recipes cr ON r.id = cr.recipe_id
      INNER JOIN chefs c ON cr.chef_id = c.id
      WHERE c.is_active = true AND c.slug = ${CHEF_FILTER}
      ORDER BY c.name, r.name
      LIMIT ${MAX_RECIPES}
    `) as Recipe[];
  } else {
    recipes = (await sql`
      SELECT
        r.id,
        r.name,
        r.instructions,
        r.instructions_backup,
        c.name as chef_name,
        c.slug as chef_slug
      FROM recipes r
      INNER JOIN chef_recipes cr ON r.id = cr.recipe_id
      INNER JOIN chefs c ON cr.chef_id = c.id
      WHERE c.is_active = true
      ORDER BY c.name, r.name
      LIMIT ${MAX_RECIPES}
    `) as Recipe[];
  }
  stats.total = recipes.length;

  console.log(`Found ${stats.total} recipes from featured chefs\n`);

  if (stats.total === 0) {
    console.log('No recipes found. Exiting.');
    return;
  }

  // Process each recipe
  for (let i = 0; i < recipes.length; i++) {
    const recipe = recipes[i];
    await processRecipe(recipe);

    // Add delay between recipes to avoid rate limiting
    if (i < recipes.length - 1 && !DRY_RUN) {
      const delayMs = 2000; // 2 second delay between recipes
      console.log(`\n⏳ Waiting ${delayMs}ms before next recipe...`);
      await sleep(delayMs);
    }
  }

  // Print summary
  console.log(`\n\n${'='.repeat(80)}`);
  console.log('📊 Summary');
  console.log('='.repeat(80));
  console.log(`Total recipes: ${stats.total}`);
  console.log(`Already formatted: ${stats.alreadyFormatted}`);
  console.log(`Processed: ${stats.processed}`);
  console.log(`Updated: ${stats.updated}`);
  console.log(`Skipped: ${stats.skipped}`);
  console.log(`Errors: ${stats.errors}`);
  console.log('');

  if (DRY_RUN && stats.processed > 0) {
    console.log('💡 Run with --apply flag to update the database');
  }

  if (stats.errors > 0) {
    console.log(`\n⚠️  ${stats.errors} recipes had errors and were not processed`);
  }
}

// Run
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
