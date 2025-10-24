import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { inArray } from 'drizzle-orm';
import fs from 'fs/promises';
import path from 'path';

// ============================================================================
// TYPES
// ============================================================================

interface CorruptedRecipe {
  id: string;
  name: string;
  corruption_type: 'empty_instructions' | 'empty_ingredients' | 'both' | 'corrupted_data';
  was_public: boolean;
  chef_id: string | null;
  source: string | null;
  created_at: Date;
}

interface HideReport {
  execution_mode: 'dry_run' | 'execute';
  timestamp: string;
  total_corrupted: number;
  total_hidden: number;
  breakdown: {
    empty_instructions: number;
    empty_ingredients: number;
    both: number;
    corrupted_data: number;
  };
  recipes: CorruptedRecipe[];
  summary: {
    was_public_count: number;
    was_private_count: number;
    by_source: Record<string, number>;
  };
}

// ============================================================================
// CORRUPTION DETECTION LOGIC
// ============================================================================

/**
 * Checks if a value represents empty JSON array or empty content
 */
function isEmptyOrInvalid(value: string | null): boolean {
  if (!value) return true;

  const trimmed = value.trim();

  // Check for empty string
  if (trimmed === '') return true;

  // Check for empty JSON array
  if (trimmed === '[]') return true;

  // Try to parse as JSON
  try {
    const parsed = JSON.parse(trimmed);

    // Check if array is empty
    if (Array.isArray(parsed) && parsed.length === 0) return true;

    // Check if array contains only empty strings
    if (Array.isArray(parsed) && parsed.every((item: any) =>
      typeof item === 'string' && item.trim() === ''
    )) {
      return true;
    }

    return false;
  } catch {
    // If it's not valid JSON, consider it corrupted
    return true;
  }
}

/**
 * Determines corruption type for a recipe
 */
function determineCorruptionType(
  instructions: string | null,
  ingredients: string | null
): 'empty_instructions' | 'empty_ingredients' | 'both' | null {
  const emptyInstructions = isEmptyOrInvalid(instructions);
  const emptyIngredients = isEmptyOrInvalid(ingredients);

  if (emptyInstructions && emptyIngredients) return 'both';
  if (emptyInstructions) return 'empty_instructions';
  if (emptyIngredients) return 'empty_ingredients';

  return null;
}

/**
 * Check for known corrupted recipes (e.g., Shannon Martinez)
 */
function isKnownCorruptedRecipe(name: string, source: string | null): boolean {
  // Known corrupted recipe patterns
  const knownCorrupted = [
    { name: /shannon martinez/i, source: null },
  ];

  return knownCorrupted.some(pattern =>
    pattern.name.test(name) && (!pattern.source || pattern.source === source)
  );
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

/**
 * Find all corrupted recipes in the database
 */
async function findCorruptedRecipes(): Promise<CorruptedRecipe[]> {
  console.log('🔍 Scanning database for corrupted recipes...\n');

  // Fetch all recipes (we need to check each one)
  const allRecipes = await db.select({
    id: recipes.id,
    name: recipes.name,
    instructions: recipes.instructions,
    ingredients: recipes.ingredients,
    is_public: recipes.is_public,
    chef_id: recipes.chef_id,
    source: recipes.source,
    created_at: recipes.created_at,
  }).from(recipes);

  console.log(`📊 Total recipes in database: ${allRecipes.length}`);

  const corruptedRecipes: CorruptedRecipe[] = [];

  for (const recipe of allRecipes) {
    let corruptionType = determineCorruptionType(recipe.instructions, recipe.ingredients);

    // Check for known corrupted recipes
    if (!corruptionType && isKnownCorruptedRecipe(recipe.name, recipe.source)) {
      corruptionType = 'both';
      console.log(`⚠️  Found known corrupted recipe: "${recipe.name}"`);
    }

    if (corruptionType) {
      corruptedRecipes.push({
        id: recipe.id,
        name: recipe.name,
        corruption_type: corruptionType,
        was_public: recipe.is_public,
        chef_id: recipe.chef_id,
        source: recipe.source,
        created_at: recipe.created_at,
      });
    }
  }

  return corruptedRecipes;
}

/**
 * Hide corrupted recipes by setting is_public = false
 */
async function hideRecipes(recipeIds: string[], dryRun: boolean): Promise<number> {
  if (recipeIds.length === 0) {
    console.log('✅ No recipes to hide');
    return 0;
  }

  if (dryRun) {
    console.log(`\n🔍 DRY RUN: Would hide ${recipeIds.length} recipes`);
    return recipeIds.length;
  }

  console.log(`\n⚠️  EXECUTING: Hiding ${recipeIds.length} recipes...`);

  // Update recipes in batches to avoid timeout
  const batchSize = 100;
  let totalUpdated = 0;

  for (let i = 0; i < recipeIds.length; i += batchSize) {
    const batch = recipeIds.slice(i, i + batchSize);

    const result = await db
      .update(recipes)
      .set({
        is_public: false,
        updated_at: new Date(),
      })
      .where(inArray(recipes.id, batch));

    totalUpdated += batch.length;
    console.log(`  ✓ Updated batch ${Math.floor(i / batchSize) + 1} (${batch.length} recipes)`);
  }

  console.log(`✅ Successfully hidden ${totalUpdated} recipes\n`);

  return totalUpdated;
}

// ============================================================================
// REPORTING
// ============================================================================

/**
 * Generate detailed report
 */
function generateReport(
  corruptedRecipes: CorruptedRecipe[],
  dryRun: boolean,
  totalHidden: number
): HideReport {
  const breakdown = {
    empty_instructions: 0,
    empty_ingredients: 0,
    both: 0,
    corrupted_data: 0,
  };

  const bySource: Record<string, number> = {};
  let wasPublicCount = 0;
  let wasPrivateCount = 0;

  for (const recipe of corruptedRecipes) {
    // Count corruption types
    if (recipe.corruption_type === 'empty_instructions') breakdown.empty_instructions++;
    else if (recipe.corruption_type === 'empty_ingredients') breakdown.empty_ingredients++;
    else if (recipe.corruption_type === 'both') breakdown.both++;
    else breakdown.corrupted_data++;

    // Count public/private
    if (recipe.was_public) wasPublicCount++;
    else wasPrivateCount++;

    // Count by source
    const source = recipe.source || 'unknown';
    bySource[source] = (bySource[source] || 0) + 1;
  }

  return {
    execution_mode: dryRun ? 'dry_run' : 'execute',
    timestamp: new Date().toISOString(),
    total_corrupted: corruptedRecipes.length,
    total_hidden: totalHidden,
    breakdown,
    recipes: corruptedRecipes,
    summary: {
      was_public_count: wasPublicCount,
      was_private_count: wasPrivateCount,
      by_source: bySource,
    },
  };
}

/**
 * Print summary to console
 */
function printSummary(report: HideReport): void {
  console.log('\n' + '='.repeat(80));
  console.log('📊 CORRUPTION ANALYSIS SUMMARY');
  console.log('='.repeat(80));
  console.log(`Mode: ${report.execution_mode === 'dry_run' ? '🔍 DRY RUN' : '⚠️  EXECUTED'}`);
  console.log(`Timestamp: ${report.timestamp}`);
  console.log(`\nTotal Corrupted Recipes: ${report.total_corrupted}`);
  console.log(`Total Hidden: ${report.total_hidden}`);

  console.log('\n📋 Breakdown by Corruption Type:');
  console.log(`  - Empty Instructions Only: ${report.breakdown.empty_instructions}`);
  console.log(`  - Empty Ingredients Only: ${report.breakdown.empty_ingredients}`);
  console.log(`  - Both Empty: ${report.breakdown.both}`);
  console.log(`  - Corrupted Data: ${report.breakdown.corrupted_data}`);

  console.log('\n🔓 Visibility Status (Before):');
  console.log(`  - Was Public: ${report.summary.was_public_count}`);
  console.log(`  - Was Private: ${report.summary.was_private_count}`);

  console.log('\n📂 By Source:');
  const sortedSources = Object.entries(report.summary.by_source)
    .sort((a, b) => b[1] - a[1]);

  for (const [source, count] of sortedSources) {
    console.log(`  - ${source}: ${count}`);
  }

  console.log('\n' + '='.repeat(80));

  if (report.execution_mode === 'dry_run') {
    console.log('\n💡 This was a DRY RUN. No changes were made.');
    console.log('💡 Run with --execute to apply changes.');
  } else {
    console.log('\n✅ Changes have been applied to the database.');
    console.log('✅ All corrupted recipes are now hidden (is_public = false).');
  }

  console.log('\n');
}

/**
 * Save report to JSON file
 */
async function saveReport(report: HideReport): Promise<void> {
  const tmpDir = path.join(process.cwd(), 'tmp');

  // Ensure tmp directory exists
  try {
    await fs.mkdir(tmpDir, { recursive: true });
  } catch (error) {
    console.error('Failed to create tmp directory:', error);
  }

  const filename = path.join(tmpDir, 'corrupted-recipes-hidden-report.json');

  await fs.writeFile(filename, JSON.stringify(report, null, 2), 'utf-8');

  console.log(`📄 Report saved to: ${filename}`);
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--execute');
  const verbose = args.includes('--verbose');

  console.log('\n' + '='.repeat(80));
  console.log('🔧 HIDE CORRUPTED RECIPES SCRIPT');
  console.log('='.repeat(80));
  console.log(`Mode: ${dryRun ? '🔍 DRY RUN (preview only)' : '⚠️  EXECUTE (will make changes)'}`);
  console.log('='.repeat(80) + '\n');

  try {
    // Step 1: Find corrupted recipes
    const corruptedRecipes = await findCorruptedRecipes();

    console.log(`\n✅ Found ${corruptedRecipes.length} corrupted recipes\n`);

    // Step 2: Show sample of corrupted recipes if verbose
    if (verbose && corruptedRecipes.length > 0) {
      console.log('📋 Sample of corrupted recipes (first 10):');
      corruptedRecipes.slice(0, 10).forEach((recipe, idx) => {
        console.log(`  ${idx + 1}. ${recipe.name}`);
        console.log(`     Type: ${recipe.corruption_type}`);
        console.log(`     Public: ${recipe.was_public}`);
        console.log(`     Source: ${recipe.source || 'unknown'}`);
        console.log('');
      });
    }

    // Step 3: Hide recipes (or show what would be hidden)
    const recipeIds = corruptedRecipes.map(r => r.id);
    const totalHidden = await hideRecipes(recipeIds, dryRun);

    // Step 4: Generate report
    const report = generateReport(corruptedRecipes, dryRun, totalHidden);

    // Step 5: Save report
    await saveReport(report);

    // Step 6: Print summary
    printSummary(report);

    // Exit with appropriate code
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error during execution:', error);

    if (error instanceof Error) {
      console.error('\nError details:', error.message);
      console.error('\nStack trace:', error.stack);
    }

    process.exit(1);
  }
}

// Run the script
main();
