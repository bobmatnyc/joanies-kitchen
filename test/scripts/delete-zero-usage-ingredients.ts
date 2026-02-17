/**
 * Delete Zero-Usage Ingredients Script
 *
 * Safely deletes ingredients identified in semantic consolidation analysis
 * that have 0 usage across all recipes.
 *
 * Features:
 * - Load zero-usage groups from consolidation decisions
 * - Verify zero usage by querying recipe_ingredients table
 * - Create backup before deletion
 * - Transaction-safe deletion with rollback capability
 * - Detailed logging and audit trail
 * - Dry-run support for preview
 *
 * Usage:
 *   npx tsx scripts/delete-zero-usage-ingredients.ts --dry-run  # Preview
 *   npx tsx scripts/delete-zero-usage-ingredients.ts            # Execute
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { eq, inArray, sql } from 'drizzle-orm';
import { ingredients, recipeIngredients } from '@/lib/db/ingredients-schema';
import { cleanup, db } from './db-with-transactions';

// ============================================================================
// TYPES
// ============================================================================

interface ConsolidationDecision {
  group: string;
  action: string;
  reason: string;
  confidence: string;
  canonical_id?: string;
  canonical_name?: string;
  canonical_category?: string;
  duplicates_to_merge?: string[];
}

interface IngredientToDelete {
  id: string;
  name: string;
  display_name: string;
  category: string | null;
  usage_count: number;
  verified_usage: number;
}

interface DeletionReport {
  timestamp: string;
  dry_run: boolean;
  total_groups_analyzed: number;
  total_ingredients_deleted: number;
  ingredients: IngredientToDelete[];
  verification_discrepancies: {
    ingredient_id: string;
    ingredient_name: string;
    stored_usage: number;
    actual_usage: number;
  }[];
  backup_file: string | null;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONSOLIDATION_FILE = path.join(process.cwd(), 'tmp/semantic-consolidation-decisions.json');
const BACKUP_DIR = path.join(process.cwd(), 'tmp');
const REPORT_DIR = path.join(process.cwd(), 'tmp');

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Load consolidation decisions from JSON file
 */
async function loadConsolidationDecisions(): Promise<ConsolidationDecision[]> {
  try {
    const content = await fs.readFile(CONSOLIDATION_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Failed to load consolidation decisions: ${error}`);
    throw error;
  }
}

/**
 * Filter for zero-usage groups
 */
function filterZeroUsageGroups(decisions: ConsolidationDecision[]): ConsolidationDecision[] {
  return decisions.filter(
    (d) => d.action === 'needs_review' && d.reason.includes('All variants have 0 usage')
  );
}

/**
 * Get all ingredient IDs from zero-usage groups
 */
async function getIngredientIdsFromGroups(groups: ConsolidationDecision[]): Promise<string[]> {
  const groupNames = groups.map((g) => g.group);

  console.log(`\nQuerying ingredients for ${groupNames.length} groups...`);

  // Query ingredients by normalized name matching group names
  const ingredientRecords = await db
    .select({
      id: ingredients.id,
      name: ingredients.name,
      display_name: ingredients.display_name,
    })
    .from(ingredients)
    .where(inArray(ingredients.name, groupNames));

  console.log(`Found ${ingredientRecords.length} ingredients matching group names`);

  return ingredientRecords.map((i) => i.id);
}

/**
 * Verify zero usage by querying recipe_ingredients table
 */
async function verifyZeroUsage(ingredientIds: string[]): Promise<{
  verified: IngredientToDelete[];
  discrepancies: DeletionReport['verification_discrepancies'];
}> {
  console.log(`\nVerifying zero usage for ${ingredientIds.length} ingredients...`);

  // Get ingredients with their stored usage_count
  const ingredientData = await db
    .select({
      id: ingredients.id,
      name: ingredients.name,
      display_name: ingredients.display_name,
      category: ingredients.category,
      usage_count: ingredients.usage_count,
    })
    .from(ingredients)
    .where(inArray(ingredients.id, ingredientIds));

  // Verify actual usage from recipe_ingredients table
  const verified: IngredientToDelete[] = [];
  const discrepancies: DeletionReport['verification_discrepancies'] = [];

  for (const ingredient of ingredientData) {
    // Count actual usage in recipe_ingredients
    const usageResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(recipeIngredients)
      .where(eq(recipeIngredients.ingredient_id, ingredient.id));

    const actualUsage = usageResult[0]?.count || 0;

    if (actualUsage === 0) {
      // Confirmed zero usage - safe to delete
      verified.push({
        id: ingredient.id,
        name: ingredient.name,
        display_name: ingredient.display_name,
        category: ingredient.category,
        usage_count: ingredient.usage_count,
        verified_usage: actualUsage,
      });
    } else {
      // Discrepancy detected - DO NOT DELETE
      console.warn(
        `⚠️  Discrepancy: ${ingredient.display_name} (${ingredient.id}) - ` +
          `stored: ${ingredient.usage_count}, actual: ${actualUsage}`
      );

      discrepancies.push({
        ingredient_id: ingredient.id,
        ingredient_name: ingredient.display_name,
        stored_usage: ingredient.usage_count,
        actual_usage: actualUsage,
      });
    }
  }

  return { verified, discrepancies };
}

/**
 * Create backup of ingredients to be deleted
 */
async function createBackup(ingredientsToDelete: IngredientToDelete[]): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(BACKUP_DIR, `ingredient-deletion-backup-${timestamp}.json`);

  await fs.writeFile(backupFile, JSON.stringify(ingredientsToDelete, null, 2), 'utf-8');

  console.log(`\n✅ Backup created: ${backupFile}`);
  return backupFile;
}

/**
 * Delete ingredients in a transaction
 */
async function deleteIngredients(ingredientIds: string[]): Promise<void> {
  await db.transaction(async (tx) => {
    // Delete from ingredients table
    // Note: recipe_ingredients will cascade delete automatically due to FK constraint
    await tx.delete(ingredients).where(inArray(ingredients.id, ingredientIds));

    console.log(`\n✅ Deleted ${ingredientIds.length} ingredients from database`);
  });
}

/**
 * Save deletion report
 */
async function saveDeletionReport(report: DeletionReport): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportFile = path.join(REPORT_DIR, `ingredient-deletion-report-${timestamp}.json`);

  await fs.writeFile(reportFile, JSON.stringify(report, null, 2), 'utf-8');

  console.log(`\n✅ Deletion report saved: ${reportFile}`);
  return reportFile;
}

/**
 * Print summary statistics
 */
function printSummary(
  verified: IngredientToDelete[],
  discrepancies: DeletionReport['verification_discrepancies'],
  dryRun: boolean
): void {
  console.log(`\n${'='.repeat(80)}`);
  console.log('DELETION SUMMARY');
  console.log('='.repeat(80));

  console.log(`\nMode: ${dryRun ? 'DRY RUN (preview only)' : 'LIVE EXECUTION'}`);
  console.log(`Total ingredients to delete: ${verified.length}`);
  console.log(`Verification discrepancies: ${discrepancies.length}`);

  if (verified.length > 0) {
    console.log('\nIngredients to be deleted:');
    console.log('-'.repeat(80));

    // Group by category
    const byCategory = verified.reduce(
      (acc, ing) => {
        const cat = ing.category || 'uncategorized';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(ing);
        return acc;
      },
      {} as Record<string, IngredientToDelete[]>
    );

    for (const [category, items] of Object.entries(byCategory)) {
      console.log(`\n${category.toUpperCase()} (${items.length}):`);
      items.forEach((ing) => {
        console.log(`  - ${ing.display_name} (${ing.name})`);
      });
    }
  }

  if (discrepancies.length > 0) {
    console.log('\n⚠️  DISCREPANCIES FOUND (NOT DELETED):');
    console.log('-'.repeat(80));
    discrepancies.forEach((d) => {
      console.log(`  - ${d.ingredient_name}: stored=${d.stored_usage}, actual=${d.actual_usage}`);
    });
  }

  console.log(`\n${'='.repeat(80)}`);
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log('='.repeat(80));
  console.log('DELETE ZERO-USAGE INGREDIENTS');
  console.log('='.repeat(80));
  console.log(`Mode: ${dryRun ? 'DRY RUN (preview only)' : 'LIVE EXECUTION'}`);
  console.log('='.repeat(80));

  try {
    // Step 1: Load consolidation decisions
    console.log('\n[1/6] Loading consolidation decisions...');
    const allDecisions = await loadConsolidationDecisions();
    console.log(`Loaded ${allDecisions.length} total decisions`);

    // Step 2: Filter for zero-usage groups
    console.log('\n[2/6] Filtering zero-usage groups...');
    const zeroUsageGroups = filterZeroUsageGroups(allDecisions);
    console.log(`Found ${zeroUsageGroups.length} zero-usage groups`);

    if (zeroUsageGroups.length === 0) {
      console.log('\n✅ No zero-usage ingredients to delete');
      return;
    }

    // Step 3: Get ingredient IDs from groups
    console.log('\n[3/6] Retrieving ingredient IDs...');
    const ingredientIds = await getIngredientIdsFromGroups(zeroUsageGroups);
    console.log(`Found ${ingredientIds.length} ingredient IDs`);

    if (ingredientIds.length === 0) {
      console.log('\n✅ No matching ingredients found in database');
      return;
    }

    // Step 4: Verify zero usage
    console.log('\n[4/6] Verifying zero usage...');
    const { verified, discrepancies } = await verifyZeroUsage(ingredientIds);
    console.log(`Verified ${verified.length} ingredients with 0 usage`);

    if (discrepancies.length > 0) {
      console.warn(`⚠️  Found ${discrepancies.length} discrepancies`);
    }

    // Step 5: Create backup (only if we have ingredients to delete)
    let backupFile: string | null = null;
    if (verified.length > 0 && !dryRun) {
      console.log('\n[5/6] Creating backup...');
      backupFile = await createBackup(verified);
    } else if (verified.length === 0) {
      console.log('\n[5/6] No ingredients to backup');
    } else {
      console.log('\n[5/6] Skipping backup (dry run mode)');
    }

    // Step 6: Delete ingredients (or skip in dry run)
    if (verified.length > 0 && !dryRun) {
      console.log('\n[6/6] Deleting ingredients...');
      const idsToDelete = verified.map((i) => i.id);
      await deleteIngredients(idsToDelete);
    } else if (verified.length === 0) {
      console.log('\n[6/6] No ingredients to delete');
    } else {
      console.log('\n[6/6] Skipping deletion (dry run mode)');
    }

    // Print summary
    printSummary(verified, discrepancies, dryRun);

    // Save report (always save, even when no deletions occurred)
    const report: DeletionReport = {
      timestamp: new Date().toISOString(),
      dry_run: dryRun,
      total_groups_analyzed: zeroUsageGroups.length,
      total_ingredients_deleted: dryRun ? 0 : verified.length,
      ingredients: verified,
      verification_discrepancies: discrepancies,
      backup_file: backupFile,
    };

    console.log('\nSaving deletion report...');
    const reportFile = await saveDeletionReport(report);

    if (verified.length === 0) {
      console.log('\n✅ No ingredients verified for deletion');
      console.log(`   Report: ${reportFile}`);
      if (discrepancies.length > 0) {
        console.log(`\n⚠️  ${discrepancies.length} ingredients have usage discrepancies`);
        console.log('   These ingredients have usage_count=0 but are actually used in recipes.');
        console.log('   Run update-ingredient-usage-counts.ts to fix usage counts.');
      }
    } else if (dryRun) {
      console.log('\n💡 Run without --dry-run to execute deletion');
      console.log(`   Report: ${reportFile}`);
    } else {
      console.log(`\n✅ Successfully deleted ${verified.length} ingredients`);
      console.log(`   Backup: ${backupFile}`);
      console.log(`   Report: ${reportFile}`);
    }
  } catch (error) {
    console.error('\n❌ Error during deletion:', error);
    throw error;
  } finally {
    await cleanup();
  }
}

// Run if called directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { main };
