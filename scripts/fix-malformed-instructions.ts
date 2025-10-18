#!/usr/bin/env tsx
/**
 * Fix Malformed Chef Recipe Instructions
 *
 * The instructions field contains malformed data with number prefixes:
 * "1. [\"step1\",\"step2\"]" instead of "[\"step1\",\"step2\"]"
 *
 * This script removes the prefix and ensures proper JSON array format.
 *
 * Usage:
 *   pnpm tsx scripts/fix-malformed-instructions.ts           # Dry run
 *   pnpm tsx scripts/fix-malformed-instructions.ts --apply   # Apply changes
 *   pnpm tsx scripts/fix-malformed-instructions.ts --chef="lidia-bastianich"
 */

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

// Configuration
const DRY_RUN = !process.argv.includes('--apply');
const CHEF_FILTER = process.argv.find((arg) => arg.startsWith('--chef='))?.split('=')[1];

// Database client
const sql = neon(process.env.DATABASE_URL!);

// Stats tracking
const stats = {
  total: 0,
  malformed: 0,
  fixed: 0,
  alreadyValid: 0,
  errors: 0,
};

interface Recipe {
  id: string;
  name: string;
  chef_name: string;
  chef_slug: string;
  instructions: string;
}

/**
 * Check if instructions are valid JSON array
 */
function isValidJsonArray(str: string): boolean {
  try {
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) && parsed.length > 0;
  } catch {
    return false;
  }
}

/**
 * Fix malformed instructions
 * Removes number prefix like "1. " before JSON array
 */
function fixMalformedInstructions(instructions: string): string | null {
  const trimmed = instructions.trim();

  // Pattern: "1. [" or similar number prefix before JSON
  const match = trimmed.match(/^\d+\.\s*(\[.*\])$/s);

  if (match) {
    // Extract the JSON array part
    const jsonPart = match[1];

    // Validate it's proper JSON
    if (isValidJsonArray(jsonPart)) {
      return jsonPart;
    }
  }

  // Try to find JSON array anywhere in the string
  const arrayMatch = trimmed.match(/(\[.*\])/s);
  if (arrayMatch && isValidJsonArray(arrayMatch[1])) {
    return arrayMatch[1];
  }

  return null;
}

/**
 * Process a single recipe
 */
async function processRecipe(recipe: Recipe): Promise<boolean> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Recipe: ${recipe.name}`);
  console.log(`Chef: ${recipe.chef_name}`);
  console.log(`ID: ${recipe.id}`);

  // Check if already valid
  if (isValidJsonArray(recipe.instructions)) {
    console.log('  ✓ Already valid JSON array');
    stats.alreadyValid++;
    return false;
  }

  console.log('  ⚠ Malformed instructions detected');
  stats.malformed++;

  console.log('\nOriginal (first 200 chars):');
  console.log(`  ${recipe.instructions.substring(0, 200)}...`);

  // Fix the instructions
  const fixed = fixMalformedInstructions(recipe.instructions);

  if (!fixed) {
    console.log('  ❌ Could not fix instructions - no valid JSON found');
    stats.errors++;
    return false;
  }

  // Validate the fix
  const parsed = JSON.parse(fixed);
  console.log(`\n  ✓ Fixed! Found ${parsed.length} steps`);
  console.log('\nFixed format (first 2 steps):');
  parsed.slice(0, 2).forEach((step: string, i: number) => {
    const preview = step.length > 100 ? `${step.substring(0, 100)}...` : step;
    console.log(`  ${i + 1}. ${preview}`);
  });

  // Update database
  if (!DRY_RUN) {
    try {
      await sql`
        UPDATE recipes
        SET
          instructions = ${fixed},
          updated_at = NOW()
        WHERE id = ${recipe.id}
      `;
      console.log('\n  ✅ Database updated');
      stats.fixed++;
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

  return true;
}

/**
 * Main execution
 */
async function main() {
  console.log('🔧 Fix Malformed Chef Recipe Instructions');
  console.log('='.repeat(80));
  console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN (preview only)' : '✍️  APPLY (will update database)'}`);
  if (CHEF_FILTER) {
    console.log(`Filter: Chef slug = "${CHEF_FILTER}"`);
  }
  console.log('');

  // Fetch recipes
  let recipes: Recipe[];

  if (CHEF_FILTER) {
    recipes = (await sql`
      SELECT
        r.id,
        r.name,
        r.instructions,
        c.name as chef_name,
        c.slug as chef_slug
      FROM recipes r
      INNER JOIN chef_recipes cr ON r.id = cr.recipe_id
      INNER JOIN chefs c ON cr.chef_id = c.id
      WHERE c.is_active = true AND c.slug = ${CHEF_FILTER}
      ORDER BY r.name
    `) as Recipe[];
  } else {
    recipes = (await sql`
      SELECT
        r.id,
        r.name,
        r.instructions,
        c.name as chef_name,
        c.slug as chef_slug
      FROM recipes r
      INNER JOIN chef_recipes cr ON r.id = cr.recipe_id
      INNER JOIN chefs c ON cr.chef_id = c.id
      WHERE c.is_active = true
      ORDER BY c.name, r.name
    `) as Recipe[];
  }

  stats.total = recipes.length;

  console.log(`Found ${stats.total} recipes from featured chefs\n`);

  if (stats.total === 0) {
    console.log('No recipes found. Exiting.');
    return;
  }

  // Process each recipe
  for (const recipe of recipes) {
    await processRecipe(recipe);
  }

  // Print summary
  console.log(`\n\n${'='.repeat(80)}`);
  console.log('📊 Summary');
  console.log('='.repeat(80));
  console.log(`Total recipes: ${stats.total}`);
  console.log(`Already valid: ${stats.alreadyValid}`);
  console.log(`Malformed detected: ${stats.malformed}`);
  console.log(`Fixed: ${stats.fixed}`);
  console.log(`Errors: ${stats.errors}`);
  console.log('');

  if (DRY_RUN && stats.malformed > 0) {
    console.log('💡 Run with --apply flag to fix the database');
  }

  if (stats.errors > 0) {
    console.log(`\n⚠️  ${stats.errors} recipes had errors and could not be fixed`);
  }
}

// Run
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
