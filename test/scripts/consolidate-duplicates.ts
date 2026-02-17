#!/usr/bin/env tsx
/**
 * Ingredient Duplicate Consolidation Script
 *
 * Finds and merges duplicate ingredients:
 * - Phase 1: Exact duplicates (same name, different IDs)
 * - Phase 2: Variant duplicates (fuzzy matching)
 * - Phase 3: Create aliases for merged ingredients
 *
 * Usage:
 *   npm run consolidate-duplicates              # Preview changes (dry-run)
 *   npm run consolidate-duplicates -- --execute # Execute changes
 *   npm run consolidate-duplicates -- --help    # Show help
 *
 * @module scripts/consolidate-duplicates
 */

import { db, cleanup } from './db-with-transactions';
import { ingredients, recipeIngredients } from '@/lib/db/ingredients-schema';
import {
  findExactDuplicates,
  findSimilarIngredients,
  areVariants,
  selectCanonicalIngredient,
  clusterVariants,
  mergeAliases,
  calculateSimilarity,
} from '@/lib/ingredients/fuzzy-matching';
import { sql, eq, inArray } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';
import type { Ingredient } from '@/lib/db/ingredients-schema';

// ============================================================================
// CLI ARGUMENTS
// ============================================================================

interface CliArgs {
  execute: boolean;
  help: boolean;
  verbose: boolean;
  threshold: number;
  phase?: 'exact' | 'variants' | 'all';
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  return {
    execute: args.includes('--execute'),
    help: args.includes('--help') || args.includes('-h'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    threshold: args.includes('--threshold')
      ? parseFloat(args[args.indexOf('--threshold') + 1])
      : 0.85,
    phase: args.includes('--phase')
      ? (args[args.indexOf('--phase') + 1] as 'exact' | 'variants' | 'all')
      : 'all',
  };
}

function showHelp() {
  console.log(`
Ingredient Duplicate Consolidation Script
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Finds and merges duplicate ingredients to maintain data integrity.

USAGE:
  npm run consolidate-duplicates [OPTIONS]

OPTIONS:
  --execute            Execute consolidation (default: dry-run preview)
  --verbose, -v        Show detailed progress information
  --threshold N        Similarity threshold (0.0-1.0, default: 0.85)
  --phase TYPE         Run specific phase: exact, variants, or all (default)
  --help, -h           Show this help message

EXAMPLES:
  npm run consolidate-duplicates                    # Preview all duplicates
  npm run consolidate-duplicates -- --execute       # Consolidate duplicates
  npm run consolidate-duplicates -- --phase exact   # Only exact duplicates
  npm run consolidate-duplicates -- --threshold 0.9 # Stricter matching

PHASES:
  1. EXACT: Merge ingredients with identical names but different IDs
  2. VARIANTS: Merge similar ingredients (e.g., "olive oil" vs "olive_oil")
  3. ALL: Run both phases

SAFETY:
  - Creates backup before execution
  - Generates detailed report in tmp/consolidation-report.md
  - Preserves all recipe relationships
  - Atomic transactions (all or nothing)
  `);
}

// ============================================================================
// BACKUP MANAGEMENT
// ============================================================================

async function createBackup(): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '_').replace(/-/g, '_').slice(0, -5);
  const backupTables = {
    ingredients: `ingredients_backup_${timestamp}`,
    recipeIngredients: `recipe_ingredients_backup_${timestamp}`,
  };

  console.log(`📦 Creating backup tables...\n`);

  await db.execute(sql`
    CREATE TABLE ${sql.raw(backupTables.ingredients)} AS
    SELECT * FROM ingredients
  `);

  await db.execute(sql`
    CREATE TABLE ${sql.raw(backupTables.recipeIngredients)} AS
    SELECT * FROM recipe_ingredients
  `);

  console.log(`✅ Backup created:\n`);
  console.log(`   - ${backupTables.ingredients}`);
  console.log(`   - ${backupTables.recipeIngredients}\n`);

  return backupTables.ingredients;
}

// ============================================================================
// CONSOLIDATION LOGIC
// ============================================================================

interface ConsolidationChange {
  canonical: Ingredient;
  duplicates: Ingredient[];
  totalRecipes: number;
  mergedAliases: string[];
  reason: 'exact' | 'variant';
}

async function findExactDuplicatesWithRecipeCounts(
  allIngredients: Ingredient[]
): Promise<ConsolidationChange[]> {
  console.log('🔍 Phase 1: Finding exact duplicates...\n');

  const duplicateMap = findExactDuplicates(allIngredients);
  const changes: ConsolidationChange[] = [];

  for (const [name, duplicates] of duplicateMap.entries()) {
    console.log(`   Found ${duplicates.length} duplicates of "${name}"`);

    // Select canonical (prefer one with slug, higher usage, etc.)
    const canonical = selectCanonicalIngredient(duplicates);
    const others = duplicates.filter((d) => d.id !== canonical.id);

    // Count total recipes affected
    let totalRecipes = 0;
    for (const dup of duplicates) {
      const count = await db
        .select({ count: sql<number>`count(*)` })
        .from(recipeIngredients)
        .where(eq(recipeIngredients.ingredient_id, dup.id));
      totalRecipes += count[0]?.count || 0;
    }

    // Merge aliases
    const mergedAliases = mergeAliases(duplicates);

    changes.push({
      canonical,
      duplicates: others,
      totalRecipes,
      mergedAliases,
      reason: 'exact',
    });
  }

  console.log(`\n   ✅ Found ${changes.length} exact duplicate groups\n`);
  return changes;
}

async function findVariantDuplicatesWithRecipeCounts(
  allIngredients: Ingredient[],
  threshold: number
): Promise<ConsolidationChange[]> {
  console.log(`🔍 Phase 2: Finding variant duplicates (threshold: ${threshold})...\n`);

  // Use clustering to find groups of variants
  const clusters = clusterVariants(allIngredients, threshold);
  const changes: ConsolidationChange[] = [];

  console.log(`   Found ${clusters.length} variant clusters\n`);

  for (const cluster of clusters) {
    // Select canonical
    const canonical = selectCanonicalIngredient(cluster);
    const others = cluster.filter((c) => c.id !== canonical.id);

    console.log(`   Cluster: "${canonical.name}" + ${others.length} variants`);
    others.forEach((v) => {
      const sim = calculateSimilarity(canonical.name, v.name);
      console.log(`      - "${v.name}" (similarity: ${(sim * 100).toFixed(1)}%)`);
    });

    // Count total recipes affected
    let totalRecipes = 0;
    for (const variant of cluster) {
      const count = await db
        .select({ count: sql<number>`count(*)` })
        .from(recipeIngredients)
        .where(eq(recipeIngredients.ingredient_id, variant.id));
      totalRecipes += count[0]?.count || 0;
    }

    // Merge aliases
    const mergedAliases = mergeAliases(cluster);

    changes.push({
      canonical,
      duplicates: others,
      totalRecipes,
      mergedAliases,
      reason: 'variant',
    });
  }

  console.log(`\n   ✅ Found ${changes.length} variant duplicate groups\n`);
  return changes;
}

// ============================================================================
// EXECUTION
// ============================================================================

async function executeConsolidation(
  changes: ConsolidationChange[],
  verbose: boolean,
  tx: any // Transaction context from db.transaction()
): Promise<{
  ingredientsDeleted: number;
  recipeIngredientsUpdated: number;
  aliasesCreated: number;
}> {
  console.log(`\n🔧 Executing consolidation for ${changes.length} duplicate groups...\n`);

  let ingredientsDeleted = 0;
  let recipeIngredientsUpdated = 0;
  let aliasesCreated = 0;

  for (const change of changes) {
    if (verbose) {
      console.log(
        `  Consolidating: ${change.duplicates.length} duplicates → "${change.canonical.name}"`
      );
    }

    const duplicateIds = change.duplicates.map((d) => d.id);
    const allIngredientIds = [change.canonical.id, ...duplicateIds];

    try {
      // Step 0: Find and delete recipe_ingredients that would create duplicates
      // This handles cases where a recipe has multiple variants of the same ingredient
      if (duplicateIds.length > 0) {
        // Find recipes that have BOTH canonical AND duplicate ingredients
        const conflictingRecipes = await tx
          .select({
            recipe_id: recipeIngredients.recipe_id,
            position: recipeIngredients.position,
            ingredient_id: recipeIngredients.ingredient_id,
          })
          .from(recipeIngredients)
          .where(inArray(recipeIngredients.ingredient_id, allIngredientIds));

        // Group by recipe_id to find recipes with multiple variants
        const recipeMap = new Map<string, Set<string>>();
        for (const row of conflictingRecipes) {
          if (!recipeMap.has(row.recipe_id)) {
            recipeMap.set(row.recipe_id, new Set());
          }
          recipeMap.get(row.recipe_id)!.add(row.ingredient_id);
        }

        // Delete duplicate entries (keep canonical, remove variants)
        let duplicatesRemoved = 0;
        for (const [recipeId, ingredientIds] of recipeMap.entries()) {
          if (ingredientIds.size > 1) {
            // This recipe has multiple variants - delete the duplicate ones
            await tx
              .delete(recipeIngredients)
              .where(
                sql`${recipeIngredients.recipe_id} = ${recipeId} AND ${recipeIngredients.ingredient_id} IN (${sql.join(duplicateIds.map((id) => sql`${id}`), sql`, `)})`
              );
            duplicatesRemoved += ingredientIds.size - 1;
          }
        }

        if (verbose && duplicatesRemoved > 0) {
          console.log(
            `     ℹ Removed ${duplicatesRemoved} duplicate ingredient entries from recipes`
          );
        }
      }

      // Step 1: Update all recipe_ingredients to point to canonical
      if (duplicateIds.length > 0) {
        const updateResult = await tx
          .update(recipeIngredients)
          .set({
            ingredient_id: change.canonical.id,
          })
          .where(inArray(recipeIngredients.ingredient_id, duplicateIds));

        recipeIngredientsUpdated += change.duplicates.reduce((sum, dup) => {
          return sum + (dup.usage_count || 0);
        }, 0);
      }

      // Step 2: Update canonical with merged aliases and updated usage count
      const totalUsage = change.duplicates.reduce(
        (sum, dup) => sum + (dup.usage_count || 0),
        change.canonical.usage_count || 0
      );

      await tx
        .update(ingredients)
        .set({
          aliases: JSON.stringify(change.mergedAliases),
          usage_count: totalUsage,
          updated_at: new Date(),
        })
        .where(eq(ingredients.id, change.canonical.id));

      aliasesCreated += change.mergedAliases.length;

      // Step 3: Delete duplicate ingredients
      if (duplicateIds.length > 0) {
        await tx.delete(ingredients).where(inArray(ingredients.id, duplicateIds));
        ingredientsDeleted += duplicateIds.length;
      }

      if (verbose) {
        console.log(
          `     ✓ Deleted ${duplicateIds.length} duplicates, updated ${totalUsage} recipe links`
        );
      }
    } catch (error) {
      console.error(`  ❌ Error consolidating "${change.canonical.name}":`, error);
      throw error; // Rollback transaction
    }
  }

  console.log(`\n✅ Consolidation complete!`);
  console.log(`   - Deleted: ${ingredientsDeleted} duplicate ingredients`);
  console.log(`   - Updated: ${recipeIngredientsUpdated} recipe_ingredients`);
  console.log(`   - Created: ${aliasesCreated} aliases\n`);

  return {
    ingredientsDeleted,
    recipeIngredientsUpdated,
    aliasesCreated,
  };
}

// ============================================================================
// REPORTING
// ============================================================================

function generateReport(
  exactChanges: ConsolidationChange[],
  variantChanges: ConsolidationChange[],
  stats: any,
  backupTable?: string
): string {
  const timestamp = new Date().toISOString();
  const allChanges = [...exactChanges, ...variantChanges];

  let report = `# Ingredient Consolidation Report\n\n`;
  report += `**Generated:** ${timestamp}\n`;
  report += `**Backup Table:** ${backupTable || 'N/A (dry-run)'}\n\n`;

  report += `## Summary Statistics\n\n`;
  report += `- **Total Duplicate Groups:** ${allChanges.length}\n`;
  report += `- **Exact Duplicates:** ${exactChanges.length}\n`;
  report += `- **Variant Duplicates:** ${variantChanges.length}\n`;

  if (stats) {
    report += `- **Ingredients Deleted:** ${stats.ingredientsDeleted || 0}\n`;
    report += `- **Recipe Links Updated:** ${stats.recipeIngredientsUpdated || 0}\n`;
    report += `- **Aliases Created:** ${stats.aliasesCreated || 0}\n`;
  }

  report += `\n## Exact Duplicates\n\n`;
  if (exactChanges.length > 0) {
    for (const change of exactChanges) {
      report += `### "${change.canonical.name}"\n\n`;
      report += `- **Canonical ID:** ${change.canonical.id}\n`;
      report += `- **Duplicates Merged:** ${change.duplicates.length}\n`;
      report += `- **Total Recipes Affected:** ${change.totalRecipes}\n`;
      report += `- **Aliases:** ${change.mergedAliases.join(', ')}\n\n`;

      report += `**Duplicate IDs Deleted:**\n`;
      change.duplicates.forEach((dup) => {
        report += `- ${dup.id} (usage: ${dup.usage_count || 0})\n`;
      });
      report += `\n`;
    }
  } else {
    report += `*No exact duplicates found.*\n\n`;
  }

  report += `## Variant Duplicates\n\n`;
  if (variantChanges.length > 0) {
    for (const change of variantChanges) {
      report += `### "${change.canonical.name}"\n\n`;
      report += `- **Canonical ID:** ${change.canonical.id}\n`;
      report += `- **Variants Merged:** ${change.duplicates.length}\n`;
      report += `- **Total Recipes Affected:** ${change.totalRecipes}\n`;
      report += `- **Aliases:** ${change.mergedAliases.join(', ')}\n\n`;

      report += `**Variant Names Consolidated:**\n`;
      change.duplicates.forEach((dup) => {
        const sim = calculateSimilarity(change.canonical.name, dup.name);
        report += `- "${dup.name}" (similarity: ${(sim * 100).toFixed(1)}%, usage: ${dup.usage_count || 0})\n`;
      });
      report += `\n`;
    }
  } else {
    report += `*No variant duplicates found.*\n\n`;
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
  console.log('  🔧 INGREDIENT CONSOLIDATION SCRIPT');
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (!args.execute) {
    console.log('🔍 DRY-RUN MODE (use --execute to apply changes)\n');
  }

  try {
    // Fetch all ingredients
    console.log('📊 Loading all ingredients...\n');
    const allIngredients = await db.select().from(ingredients);
    console.log(`   Loaded ${allIngredients.length} ingredients\n`);

    let exactChanges: ConsolidationChange[] = [];
    let variantChanges: ConsolidationChange[] = [];

    // Phase 1: Exact duplicates
    if (args.phase === 'exact' || args.phase === 'all') {
      exactChanges = await findExactDuplicatesWithRecipeCounts(allIngredients);
    }

    // Phase 2: Variant duplicates
    if (args.phase === 'variants' || args.phase === 'all') {
      variantChanges = await findVariantDuplicatesWithRecipeCounts(
        allIngredients,
        args.threshold
      );
    }

    const totalChanges = exactChanges.length + variantChanges.length;

    if (totalChanges === 0) {
      console.log('✅ No duplicates found! Database is clean.\n');
      process.exit(0);
    }

    console.log('📊 Summary:\n');
    console.log(`   Exact Duplicates: ${exactChanges.length}`);
    console.log(`   Variant Duplicates: ${variantChanges.length}`);
    console.log(`   Total Groups: ${totalChanges}\n`);

    let backupTable: string | undefined;
    let stats: any = null;

    // Execute consolidation
    if (args.execute) {
      console.log('\n⚠️  EXECUTING CONSOLIDATION...\n');

      // Create backup
      backupTable = await createBackup();

      // Execute in transaction
      await db.transaction(async (tx) => {
        const allChanges = [...exactChanges, ...variantChanges];
        stats = await executeConsolidation(allChanges, args.verbose, tx);
      });

      console.log('✅ Consolidation complete!\n');
    }

    // Generate report
    const report = generateReport(exactChanges, variantChanges, stats, backupTable);
    saveReport(report, 'consolidation-report.md');

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('✅ CONSOLIDATION ' + (args.execute ? 'COMPLETE' : 'ANALYSIS COMPLETE'));
    console.log('═══════════════════════════════════════════════════════════════\n');

    await cleanup();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error during consolidation:', error);
    console.error('\n⚠️  All changes have been rolled back.\n');
    await cleanup();
    process.exit(1);
  }
}

main();
