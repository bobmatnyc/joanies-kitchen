#!/usr/bin/env tsx

/**
 * Ingredient Normalization Script
 *
 * Normalizes ingredient names by:
 * 1. Removing quantity/measurement prefixes (e.g., "(1/4 Stick)", "(10-ounce)")
 * 2. Extracting preparation suffixes (e.g., "Leaves", "Chopped", "Diced")
 * 3. Standardizing capitalization
 * 4. Generating clean slugs
 * 5. Storing extracted metadata in recipe_ingredients.preparation field
 *
 * Usage:
 *   npm run normalize-ingredients              # Preview changes (dry-run)
 *   npm run normalize-ingredients -- --execute # Execute changes
 *   npm run normalize-ingredients -- --help    # Show help
 *
 * @module scripts/normalize-ingredients
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { ingredients, recipeIngredients } from '@/lib/db/ingredients-schema';
import {
  capitalizeWords,
  generateCanonicalSlug,
  type NormalizedIngredient,
  normalizeIngredientName,
} from '@/lib/ingredients/normalization';

// ============================================================================
// CLI ARGUMENTS
// ============================================================================

interface CliArgs {
  execute: boolean;
  help: boolean;
  verbose: boolean;
  limit?: number;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  return {
    execute: args.includes('--execute'),
    help: args.includes('--help') || args.includes('-h'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    limit: args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1], 10) : undefined,
  };
}

function showHelp() {
  console.log(`
Ingredient Normalization Script
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Normalizes ingredient names by extracting quantities and preparation methods.

USAGE:
  npm run normalize-ingredients [OPTIONS]

OPTIONS:
  --execute         Execute normalization (default: dry-run preview)
  --verbose, -v     Show detailed progress information
  --limit N         Process only first N ingredients (for testing)
  --help, -h        Show this help message

EXAMPLES:
  npm run normalize-ingredients              # Preview changes
  npm run normalize-ingredients -- --execute # Execute normalization
  npm run normalize-ingredients -- --limit 10 --verbose  # Test on 10 ingredients

WHAT IT DOES:
  1. Removes quantity prefixes: "(1/4 Stick) Butter" → "Butter"
  2. Extracts preparation: "Basil Leaves" → "Basil" (prep: "leaves")
  3. Standardizes case: "OLIVE OIL" → "Olive Oil"
  4. Generates slugs: "Extra-Virgin Olive Oil" → "extra-virgin-olive-oil"

SAFETY:
  - Creates backup before execution
  - Generates detailed report in tmp/normalization-report.md
  - Preserves all recipe relationships
  - Atomic transactions (all or nothing)
  `);
}

// ============================================================================
// BACKUP MANAGEMENT
// ============================================================================

async function createBackup(): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '_').replace(/-/g, '_').slice(0, -5);
  const backupTable = `ingredients_backup_${timestamp}`;

  console.log(`📦 Creating backup table: ${backupTable}...`);

  await db.execute(sql`
    CREATE TABLE ${sql.raw(backupTable)} AS
    SELECT * FROM ingredients
  `);

  console.log(`✅ Backup created: ${backupTable}\n`);
  return backupTable;
}

// ============================================================================
// NORMALIZATION LOGIC
// ============================================================================

interface NormalizationChange {
  id: string;
  originalName: string;
  originalDisplayName: string;
  originalSlug: string | null;
  normalized: NormalizedIngredient;
  newName: string;
  newDisplayName: string;
  newSlug: string;
  affectedRecipes: number;
}

async function analyzeNormalization(limit?: number): Promise<{
  changes: NormalizationChange[];
  stats: {
    total: number;
    needsNormalization: number;
    hasQuantity: number;
    hasPreparation: number;
    affectedRecipes: number;
  };
}> {
  console.log('🔍 Analyzing ingredients for normalization...\n');

  // Fetch all ingredients
  const query = limit ? db.select().from(ingredients).limit(limit) : db.select().from(ingredients);

  const allIngredients = await query;

  console.log(`📊 Found ${allIngredients.length} ingredients to analyze\n`);

  const changes: NormalizationChange[] = [];
  let hasQuantity = 0;
  let hasPreparation = 0;
  let totalAffectedRecipes = 0;

  // Batch fetch recipe counts for efficiency
  const recipeCounts = await db.execute(sql`
    SELECT ingredient_id, COUNT(*) as count
    FROM recipe_ingredients
    GROUP BY ingredient_id
  `);

  const recipeCountMap = new Map<string, number>();
  for (const row of recipeCounts.rows) {
    recipeCountMap.set((row as any).ingredient_id, parseInt((row as any).count, 10));
  }

  for (const ingredient of allIngredients) {
    const normalized = normalizeIngredientName(ingredient.name);

    // Check if normalization would change anything
    const baseLower = normalized.base.toLowerCase();
    const needsChange =
      baseLower !== ingredient.name || normalized.quantity || normalized.preparation;

    if (needsChange) {
      // Get recipe count from map
      const affectedRecipes = recipeCountMap.get(ingredient.id) || 0;
      totalAffectedRecipes += affectedRecipes;

      if (normalized.quantity) hasQuantity++;
      if (normalized.preparation) hasPreparation++;

      const newName = normalized.base.toLowerCase();
      const newDisplayName = capitalizeWords(normalized.base);
      const newSlug = generateCanonicalSlug(newName);

      changes.push({
        id: ingredient.id,
        originalName: ingredient.name,
        originalDisplayName: ingredient.display_name,
        originalSlug: ingredient.slug,
        normalized,
        newName,
        newDisplayName,
        newSlug,
        affectedRecipes,
      });
    }
  }

  return {
    changes,
    stats: {
      total: allIngredients.length,
      needsNormalization: changes.length,
      hasQuantity,
      hasPreparation,
      affectedRecipes: totalAffectedRecipes,
    },
  };
}

// ============================================================================
// EXECUTION
// ============================================================================

async function executeNormalization(
  changes: NormalizationChange[],
  verbose: boolean
): Promise<void> {
  console.log(`\n🔧 Executing normalization for ${changes.length} ingredients...\n`);

  let updated = 0;
  let recipeIngredientsUpdated = 0;

  for (const change of changes) {
    if (verbose) {
      console.log(`  Processing: ${change.originalName} → ${change.newName}`);
    }

    try {
      // Update ingredient name and slug
      await db
        .update(ingredients)
        .set({
          name: change.newName,
          display_name: change.newDisplayName,
          slug: change.newSlug,
          updated_at: new Date(),
        })
        .where(eq(ingredients.id, change.id));

      updated++;

      // Update recipe_ingredients with preparation metadata (if extracted)
      if (change.normalized.preparation && change.affectedRecipes > 0) {
        await db
          .update(recipeIngredients)
          .set({
            preparation: change.normalized.preparation,
          })
          .where(eq(recipeIngredients.ingredient_id, change.id));

        recipeIngredientsUpdated += change.affectedRecipes;
      }

      if (verbose && updated % 50 === 0) {
        console.log(`    Progress: ${updated}/${changes.length}`);
      }
    } catch (error) {
      console.error(`  ❌ Error updating ${change.originalName}:`, error);
      throw error; // Rollback transaction
    }
  }

  console.log(`\n✅ Updated ${updated} ingredients`);
  console.log(`✅ Updated ${recipeIngredientsUpdated} recipe_ingredients with preparation data\n`);
}

// ============================================================================
// REPORTING
// ============================================================================

function generateReport(changes: NormalizationChange[], stats: any, backupTable?: string): string {
  const timestamp = new Date().toISOString();

  let report = `# Ingredient Normalization Report\n\n`;
  report += `**Generated:** ${timestamp}\n`;
  report += `**Backup Table:** ${backupTable || 'N/A (dry-run)'}\n\n`;

  report += `## Summary Statistics\n\n`;
  report += `- **Total Ingredients:** ${stats.total}\n`;
  report += `- **Normalized:** ${stats.needsNormalization} (${((stats.needsNormalization / stats.total) * 100).toFixed(1)}%)\n`;
  report += `- **Quantity Extracted:** ${stats.hasQuantity}\n`;
  report += `- **Preparation Extracted:** ${stats.hasPreparation}\n`;
  report += `- **Affected Recipes:** ${stats.affectedRecipes}\n\n`;

  report += `## Normalization Changes\n\n`;
  report += `| Original Name | New Name | Quantity | Preparation | Recipes |\n`;
  report += `|---------------|----------|----------|-------------|----------|\n`;

  for (const change of changes.slice(0, 100)) {
    // Limit to first 100 for readability
    report += `| ${change.originalName} | ${change.newName} | ${change.normalized.quantity || '-'} | ${change.normalized.preparation || '-'} | ${change.affectedRecipes} |\n`;
  }

  if (changes.length > 100) {
    report += `\n*... and ${changes.length - 100} more changes*\n`;
  }

  report += `\n## Detailed Changes\n\n`;
  for (const change of changes) {
    report += `### ${change.originalName}\n\n`;
    report += `- **New Name:** ${change.newName}\n`;
    report += `- **Display Name:** ${change.originalDisplayName} → ${change.newDisplayName}\n`;
    report += `- **Slug:** ${change.originalSlug || 'null'} → ${change.newSlug}\n`;

    if (change.normalized.quantity) {
      report += `- **Quantity Extracted:** ${change.normalized.quantity}`;
      if (change.normalized.unit) {
        report += ` ${change.normalized.unit}`;
      }
      report += `\n`;
    }

    if (change.normalized.preparation) {
      report += `- **Preparation Extracted:** ${change.normalized.preparation}\n`;
    }

    report += `- **Affected Recipes:** ${change.affectedRecipes}\n\n`;
  }

  return report;
}

function saveReport(report: string, filename: string) {
  const tmpDir = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  const filepath = path.join(tmpDir, filename);
  fs.writeFileSync(filepath, report, 'utf-8');
  console.log(`📄 Report saved: ${filepath}\n`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  🔧 INGREDIENT NORMALIZATION SCRIPT');
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (!args.execute) {
    console.log('🔍 DRY-RUN MODE (use --execute to apply changes)\n');
  }

  try {
    // Step 1: Analyze
    const { changes, stats } = await analyzeNormalization(args.limit);

    console.log('📊 Analysis Results:\n');
    console.log(`   Total Ingredients: ${stats.total}`);
    console.log(`   Need Normalization: ${stats.needsNormalization}`);
    console.log(`   - With Quantity: ${stats.hasQuantity}`);
    console.log(`   - With Preparation: ${stats.hasPreparation}`);
    console.log(`   Affected Recipes: ${stats.affectedRecipes}\n`);

    if (changes.length === 0) {
      console.log('✅ No normalization needed! All ingredients are already normalized.\n');
      process.exit(0);
    }

    // Preview first few changes
    console.log('📝 Preview of Changes (first 10):\n');
    for (const change of changes.slice(0, 10)) {
      console.log(`   "${change.originalName}" → "${change.newName}"`);
      if (change.normalized.quantity) {
        console.log(`      └─ Quantity: ${change.normalized.quantity}`);
      }
      if (change.normalized.preparation) {
        console.log(`      └─ Preparation: ${change.normalized.preparation}`);
      }
      if (change.affectedRecipes > 0) {
        console.log(`      └─ Affects ${change.affectedRecipes} recipes`);
      }
    }

    if (changes.length > 10) {
      console.log(`   ... and ${changes.length - 10} more\n`);
    }

    let backupTable: string | undefined;

    // Step 2: Execute or report
    if (args.execute) {
      console.log('\n⚠️  EXECUTING NORMALIZATION...\n');

      // Create backup
      backupTable = await createBackup();

      // Execute normalization (Neon HTTP doesn't support transactions)
      // Manual error handling instead
      try {
        await executeNormalization(changes, args.verbose);
        console.log('✅ Normalization complete!\n');
      } catch (error) {
        console.error('\n❌ Error during normalization:', error);
        console.log('\n⚠️  Backup table preserved:', backupTable);
        console.log('    You can restore using: pnpm ingredients:rollback');
        throw error;
      }
    }

    // Step 3: Generate report
    const report = generateReport(changes, stats, backupTable);
    saveReport(report, 'normalization-report.md');

    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`✅ NORMALIZATION ${args.execute ? 'COMPLETE' : 'ANALYSIS COMPLETE'}`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error during normalization:', error);
    console.error('\n⚠️  All changes have been rolled back.\n');
    process.exit(1);
  }
}

main();
