/**
 * Fix Duplicate Constraint Violations in Ingredient Consolidation
 *
 * Problem: Some recipes have BOTH a canonical ingredient AND its duplicate variants
 * (e.g., both "Chive" and "Chives"), causing unique constraint violations when trying
 * to merge both to the same canonical ingredient.
 *
 * Solution:
 * 1. Identify recipes with duplicate ingredient variants
 * 2. Merge amounts/units if both have them (sum quantities if units match)
 * 3. Keep only canonical variant's recipe_ingredient entry
 * 4. Delete duplicate variant entries BEFORE consolidation
 * 5. Re-execute failed consolidations
 *
 * Usage: tsx scripts/fix-duplicate-constraints.ts [--dry-run]
 */

import { db, cleanup } from './db-with-transactions';
import { ingredients, recipeIngredients } from '../src/lib/db/ingredients-schema';
import { eq, inArray, and, sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

interface ExecutionError {
  group: string;
  error: string;
}

interface ExecutionReport {
  totalDecisions: number;
  mergeAttempts: number;
  mergeSuccesses: number;
  mergeFailed: number;
  ingredientsDeleted: number;
  ingredientsUpdated: number;
  recipeIngredientsUpdated: number;
  errors: ExecutionError[];
}

interface ConsolidationDecision {
  group: string;
  action: string;
  canonical_id?: string;
  canonical_name?: string;
  canonical_category?: string;
  duplicates_to_merge?: string[];
  reason?: string;
  aliases?: string[];
  confidence?: string;
}

interface DuplicateRemovalStats {
  recipesAnalyzed: number;
  duplicatesFound: number;
  duplicatesRemoved: number;
  amountsMerged: number;
  errors: Array<{ recipe_id: string; error: string }>;
}

interface RetryStats {
  totalRetries: number;
  retrySuccesses: number;
  retryFailed: number;
  errors: ExecutionError[];
}

const isDryRun = process.argv.includes('--dry-run');

/**
 * Parse amount strings to numbers for merging
 * Handles fractions, ranges, and special values
 */
function parseAmount(amount: string | null): number | null {
  if (!amount) return null;

  // Clean the string
  const cleaned = amount.trim().toLowerCase();

  // Handle special cases
  if (cleaned.includes('to taste') || cleaned.includes('as needed')) {
    return null;
  }

  // Handle fractions (e.g., "1/2", "1 1/2")
  const fractionMatch = cleaned.match(/(\d+)?\s*\/\s*(\d+)/);
  if (fractionMatch) {
    const numerator = parseInt(fractionMatch[1] || '1');
    const denominator = parseInt(fractionMatch[2]);
    return numerator / denominator;
  }

  // Handle ranges (e.g., "1-2") - take average
  const rangeMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1]);
    const max = parseFloat(rangeMatch[2]);
    return (min + max) / 2;
  }

  // Try direct parsing
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Normalize units to a standard form for comparison
 */
function normalizeUnit(unit: string | null): string | null {
  if (!unit) return null;

  const normalized = unit.trim().toLowerCase();

  // Map plural/singular to common form
  const unitMap: Record<string, string> = {
    'cup': 'cup',
    'cups': 'cup',
    'c': 'cup',
    'tablespoon': 'tablespoon',
    'tablespoons': 'tablespoon',
    'tbsp': 'tablespoon',
    'teaspoon': 'teaspoon',
    'teaspoons': 'teaspoon',
    'tsp': 'teaspoon',
    'ounce': 'ounce',
    'ounces': 'ounce',
    'oz': 'ounce',
    'pound': 'pound',
    'pounds': 'pound',
    'lb': 'pound',
    'lbs': 'pound',
    'gram': 'gram',
    'grams': 'gram',
    'g': 'gram',
    'kilogram': 'kilogram',
    'kilograms': 'kilogram',
    'kg': 'kilogram',
    'piece': 'piece',
    'pieces': 'piece',
    'pc': 'piece',
    'slice': 'slice',
    'slices': 'slice',
    'clove': 'clove',
    'cloves': 'clove',
  };

  return unitMap[normalized] || normalized;
}

/**
 * Merge amounts from multiple recipe ingredient entries
 */
function mergeAmounts(entries: any[]): { amount: string | null; unit: string | null } {
  // Filter entries with amounts
  const withAmounts = entries.filter((e) => e.amount);

  if (withAmounts.length === 0) {
    return { amount: null, unit: null };
  }

  if (withAmounts.length === 1) {
    return { amount: withAmounts[0].amount, unit: withAmounts[0].unit };
  }

  // Get normalized units
  const normalizedUnits = withAmounts.map((e) => normalizeUnit(e.unit));
  const allSameUnit = normalizedUnits.every((u) => u === normalizedUnits[0]);

  if (!allSameUnit) {
    // Can't merge different units - keep first entry's amount
    console.log(`      ⚠️  Different units detected, keeping first entry's amount`);
    return { amount: withAmounts[0].amount, unit: withAmounts[0].unit };
  }

  // Parse and sum amounts
  const parsedAmounts = withAmounts.map((e) => parseAmount(e.amount)).filter((a) => a !== null) as number[];

  if (parsedAmounts.length === 0) {
    return { amount: withAmounts[0].amount, unit: withAmounts[0].unit };
  }

  const totalAmount = parsedAmounts.reduce((sum, amt) => sum + amt, 0);

  // Format the merged amount
  let mergedAmount: string;
  if (totalAmount % 1 === 0) {
    mergedAmount = totalAmount.toString();
  } else {
    mergedAmount = totalAmount.toFixed(2).replace(/\.?0+$/, '');
  }

  return { amount: mergedAmount, unit: withAmounts[0].unit };
}

/**
 * Find and remove duplicate ingredient entries within recipes
 * BEFORE attempting consolidation
 */
async function removeDuplicateEntriesInRecipes(
  canonicalId: string,
  duplicateIds: string[]
): Promise<DuplicateRemovalStats> {
  const stats: DuplicateRemovalStats = {
    recipesAnalyzed: 0,
    duplicatesFound: 0,
    duplicatesRemoved: 0,
    amountsMerged: 0,
    errors: [],
  };

  const allIds = [canonicalId, ...duplicateIds];

  // Find all recipes that have ANY of these ingredient IDs
  const allEntries = await db
    .select()
    .from(recipeIngredients)
    .where(inArray(recipeIngredients.ingredient_id, allIds));

  // Group by recipe_id
  const recipeGroups = new Map<string, any[]>();
  for (const entry of allEntries) {
    if (!recipeGroups.has(entry.recipe_id)) {
      recipeGroups.set(entry.recipe_id, []);
    }
    recipeGroups.get(entry.recipe_id)!.push(entry);
  }

  stats.recipesAnalyzed = recipeGroups.size;

  // Process each recipe
  for (const [recipeId, entries] of recipeGroups.entries()) {
    // Only process recipes with multiple entries (duplicates)
    if (entries.length <= 1) {
      continue;
    }

    stats.duplicatesFound++;

    try {
      // Find which entries are canonical vs duplicates
      const canonicalEntries = entries.filter((e) => e.ingredient_id === canonicalId);
      const duplicateEntries = entries.filter((e) => duplicateIds.includes(e.ingredient_id));

      if (duplicateEntries.length === 0) {
        continue; // No duplicates in this recipe
      }

      console.log(`      📋 Recipe ${recipeId.slice(0, 8)}... has ${entries.length} entries`);

      if (!isDryRun) {
        await db.transaction(async (tx) => {
          let targetEntry: any;

          if (canonicalEntries.length > 0) {
            // Use existing canonical entry
            targetEntry = canonicalEntries[0];

            // If there are multiple duplicates, merge amounts
            if (duplicateEntries.length > 0) {
              const allEntriesToMerge = [...canonicalEntries, ...duplicateEntries];
              const { amount, unit } = mergeAmounts(allEntriesToMerge);

              if (amount !== targetEntry.amount || unit !== targetEntry.unit) {
                // Update canonical entry with merged amount
                await tx
                  .update(recipeIngredients)
                  .set({ amount, unit })
                  .where(eq(recipeIngredients.id, targetEntry.id));

                console.log(`         ✓ Merged amounts: ${amount} ${unit || ''}`);
                stats.amountsMerged++;
              }
            }

            // Delete all duplicate entries
            const duplicateEntryIds = duplicateEntries.map((e) => e.id);
            if (duplicateEntryIds.length > 0) {
              await tx.delete(recipeIngredients).where(inArray(recipeIngredients.id, duplicateEntryIds));

              console.log(`         ✓ Deleted ${duplicateEntryIds.length} duplicate entries`);
              stats.duplicatesRemoved += duplicateEntryIds.length;
            }
          } else {
            // No canonical entry exists - update first duplicate to canonical, delete rest
            targetEntry = duplicateEntries[0];

            // Merge amounts from all duplicates
            const { amount, unit } = mergeAmounts(duplicateEntries);

            // Update first entry to point to canonical and merge amounts
            await tx
              .update(recipeIngredients)
              .set({
                ingredient_id: canonicalId,
                amount,
                unit,
              })
              .where(eq(recipeIngredients.id, targetEntry.id));

            console.log(`         ✓ Updated first entry to canonical with merged amount: ${amount} ${unit || ''}`);
            stats.amountsMerged++;

            // Delete remaining duplicate entries
            const remainingDuplicates = duplicateEntries.slice(1).map((e) => e.id);
            if (remainingDuplicates.length > 0) {
              await tx.delete(recipeIngredients).where(inArray(recipeIngredients.id, remainingDuplicates));

              console.log(`         ✓ Deleted ${remainingDuplicates.length} remaining duplicate entries`);
              stats.duplicatesRemoved += remainingDuplicates.length;
            }
          }
        });
      } else {
        console.log(`         [DRY RUN] Would merge and remove ${duplicateEntries.length} duplicate entries`);
        stats.duplicatesRemoved += duplicateEntries.length;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      stats.errors.push({ recipe_id: recipeId, error: errorMessage });
      console.error(`         ❌ Error processing recipe ${recipeId.slice(0, 8)}...: ${errorMessage}`);
    }
  }

  return stats;
}

/**
 * Build proper aliases from duplicate ingredient names
 * Only includes actual name variants, excludes product variants with qualifiers
 */
async function buildAliasesFromDuplicates(
  canonicalName: string,
  duplicateIds: string[]
): Promise<string[]> {
  if (duplicateIds.length === 0) {
    return [];
  }

  // Fetch the duplicate ingredients to get their display names
  const duplicateIngredients = await db
    .select()
    .from(ingredients)
    .where(inArray(ingredients.id, duplicateIds));

  const aliases: string[] = [];
  const canonicalLower = canonicalName.toLowerCase().trim();

  for (const duplicate of duplicateIngredients) {
    const duplicateName = duplicate.display_name.trim();
    const duplicateLower = duplicateName.toLowerCase();

    // Skip if same as canonical name
    if (duplicateLower === canonicalLower) {
      continue;
    }

    // Only include as alias if it's a simple plural/singular variant
    // NOT if it has additional qualifiers (e.g., "Marinated", "Roasted", etc.)

    // Extract base words (remove common qualifiers)
    const qualifiers = ['marinated', 'roasted', 'fresh', 'dried', 'frozen', 'canned', 'raw', 'cooked'];
    const canonicalWords = canonicalLower.split(/\s+/);
    const duplicateWords = duplicateLower.split(/\s+/);

    // Check if duplicate has extra qualifier words
    const hasExtraQualifiers = duplicateWords.some(word =>
      qualifiers.includes(word) && !canonicalWords.includes(word)
    );

    if (hasExtraQualifiers) {
      console.log(`      ⏭️  Skipping variant "${duplicateName}" (not a simple alias)`);
      continue;
    }

    // Check if it's just plural/singular difference or same base words
    const canonicalBase = canonicalWords.filter(w => !qualifiers.includes(w)).join(' ');
    const duplicateBase = duplicateWords.filter(w => !qualifiers.includes(w)).join(' ');

    // Simple heuristic: if bases are very similar (allowing for s/es endings), it's an alias
    const isSimilar =
      canonicalBase === duplicateBase ||
      canonicalBase + 's' === duplicateBase ||
      canonicalBase === duplicateBase + 's' ||
      canonicalBase + 'es' === duplicateBase ||
      canonicalBase === duplicateBase + 'es';

    if (isSimilar) {
      aliases.push(duplicateName);
      console.log(`      ✓ Adding alias: "${duplicateName}"`);
    } else {
      console.log(`      ⏭️  Skipping "${duplicateName}" (not similar enough to "${canonicalName}")`);
    }
  }

  return aliases;
}

/**
 * Retry a single failed consolidation after duplicates are removed
 */
async function retryConsolidation(decision: ConsolidationDecision): Promise<boolean> {
  try {
    const canonicalId = decision.canonical_id!;
    const duplicateIds = decision.duplicates_to_merge || [];

    if (duplicateIds.length === 0) {
      return true; // Nothing to do
    }

    // Check if duplicate ingredients still exist (they may have been deleted in a previous run)
    const existingDuplicates = await db
      .select()
      .from(ingredients)
      .where(inArray(ingredients.id, duplicateIds));

    if (existingDuplicates.length === 0) {
      console.log(`      ✅ Duplicates already deleted - consolidation complete`);
      return true;
    }

    console.log(`      🔍 Found ${existingDuplicates.length} duplicates still in database`);

    // Build proper aliases from actual duplicate names (always, even in dry run)
    console.log(`      🔍 Building aliases from ${existingDuplicates.length} duplicates...`);
    const aliases = await buildAliasesFromDuplicates(
      decision.canonical_name!,
      existingDuplicates.map((d) => d.id)
    );

    if (!isDryRun) {
      const existingDuplicateIds = existingDuplicates.map((d) => d.id);

      await db.transaction(async (tx) => {
        // Step 1: Update recipe_ingredients to point to canonical
        await tx
          .update(recipeIngredients)
          .set({ ingredient_id: canonicalId })
          .where(inArray(recipeIngredients.ingredient_id, existingDuplicateIds));

        console.log(`      ✓ Updated recipe_ingredients to point to canonical`);

        // Step 2: Update canonical ingredient with correct metadata
        // Fetch current canonical ingredient to preserve its name
        const [canonicalIngredient] = await tx
          .select()
          .from(ingredients)
          .where(eq(ingredients.id, canonicalId));

        if (!canonicalIngredient) {
          throw new Error(`Canonical ingredient ${canonicalId} not found!`);
        }

        // Only set aliases if we actually have any
        const aliasesJson = aliases.length > 0 ? JSON.stringify(aliases) : null;

        // IMPORTANT: Keep the canonical ingredient's existing name to avoid unique constraint violations
        // The canonical ID was chosen during initial consolidation - we trust that decision
        await tx
          .update(ingredients)
          .set({
            // Keep existing name and display_name from canonical ingredient
            aliases: aliasesJson,
            updated_at: new Date(),
          })
          .where(eq(ingredients.id, canonicalId));

        console.log(`      ✓ Updated canonical ingredient aliases (kept existing name: "${canonicalIngredient.name}")`);
        console.log(`         Aliases: ${aliases.length > 0 ? JSON.stringify(aliases) : 'none'}`);

        // Step 3: Delete duplicate ingredients
        await tx.delete(ingredients).where(inArray(ingredients.id, existingDuplicateIds));

        console.log(`      ✓ Deleted ${existingDuplicateIds.length} duplicate ingredients`);
      });
    } else {
      console.log(`      [DRY RUN] Would set aliases: ${aliases.length > 0 ? JSON.stringify(aliases) : 'none'}`);
      console.log(`      [DRY RUN] Would complete consolidation for ${decision.canonical_name}`);
    }

    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : '';
    console.error(`      ❌ Retry failed: ${errorMessage}`);
    if (errorStack && errorStack.includes('Failed query')) {
      console.error(`      📋 Full error details:`);
      console.error(errorStack.split('\n').slice(0, 10).join('\n'));
    }
    return false;
  }
}

/**
 * Main execution function
 */
async function main() {
  const tmpDir = path.join(process.cwd(), 'tmp');
  const executionReportPath = path.join(tmpDir, 'consolidation-execution-1761087233922.json');
  const decisionsPath = path.join(tmpDir, 'semantic-consolidation-decisions.json');

  // Verify files exist
  if (!fs.existsSync(executionReportPath)) {
    console.error('❌ Error: consolidation-execution-1761087233922.json not found!');
    process.exit(1);
  }

  if (!fs.existsSync(decisionsPath)) {
    console.error('❌ Error: semantic-consolidation-decisions.json not found!');
    process.exit(1);
  }

  // Load execution report and decisions
  const executionReport: ExecutionReport = JSON.parse(fs.readFileSync(executionReportPath, 'utf-8'));
  const allDecisions: ConsolidationDecision[] = JSON.parse(fs.readFileSync(decisionsPath, 'utf-8'));

  console.log('🔧 Fix Duplicate Constraint Violations\n');
  console.log('═'.repeat(60));
  console.log(`Failed consolidations to retry: ${executionReport.errors.length}`);

  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  // Extract failed groups
  const failedGroups = new Set(executionReport.errors.map((e) => e.group));
  const failedDecisions = allDecisions.filter((d) => failedGroups.has(d.group) && d.action === 'merge');

  console.log(`\nFound ${failedDecisions.length} decisions to retry\n`);

  const totalStats: DuplicateRemovalStats = {
    recipesAnalyzed: 0,
    duplicatesFound: 0,
    duplicatesRemoved: 0,
    amountsMerged: 0,
    errors: [],
  };

  const retryStats: RetryStats = {
    totalRetries: 0,
    retrySuccesses: 0,
    retryFailed: 0,
    errors: [],
  };

  // Process each failed decision
  for (let i = 0; i < failedDecisions.length; i++) {
    const decision = failedDecisions[i];

    console.log(`\n[${i + 1}/${failedDecisions.length}] 🔄 Processing: ${decision.canonical_name} [${decision.canonical_category}]`);
    console.log(`   Group: ${decision.group}`);
    console.log(`   Duplicates: ${decision.duplicates_to_merge?.length || 0}`);

    // Step 1: Remove duplicate entries within recipes
    console.log(`\n   Step 1: Removing duplicate entries within recipes...`);
    const removalStats = await removeDuplicateEntriesInRecipes(
      decision.canonical_id!,
      decision.duplicates_to_merge || []
    );

    totalStats.recipesAnalyzed += removalStats.recipesAnalyzed;
    totalStats.duplicatesFound += removalStats.duplicatesFound;
    totalStats.duplicatesRemoved += removalStats.duplicatesRemoved;
    totalStats.amountsMerged += removalStats.amountsMerged;
    totalStats.errors.push(...removalStats.errors);

    console.log(`      ✓ Analyzed ${removalStats.recipesAnalyzed} recipes`);
    console.log(`      ✓ Found ${removalStats.duplicatesFound} recipes with duplicates`);
    console.log(`      ✓ Removed ${removalStats.duplicatesRemoved} duplicate entries`);
    console.log(`      ✓ Merged amounts in ${removalStats.amountsMerged} cases`);

    if (removalStats.errors.length > 0) {
      console.log(`      ⚠️  Errors: ${removalStats.errors.length}`);
    }

    // Step 2: Retry consolidation
    console.log(`\n   Step 2: Retrying consolidation...`);
    retryStats.totalRetries++;

    const success = await retryConsolidation(decision);

    if (success) {
      retryStats.retrySuccesses++;
      console.log(`   ✅ SUCCESS - Consolidation completed for ${decision.canonical_name}`);
    } else {
      retryStats.retryFailed++;
      retryStats.errors.push({
        group: decision.group,
        error: 'Retry failed after duplicate removal',
      });
      console.log(`   ❌ FAILED - Could not complete consolidation for ${decision.canonical_name}`);
    }

    // Progress indicator
    if ((i + 1) % 10 === 0) {
      console.log(`\n📊 Progress: ${i + 1}/${failedDecisions.length} processed, ${retryStats.retrySuccesses} successful`);
    }
  }

  // Print final summary
  console.log('\n═'.repeat(60));
  console.log('\n✅ Fix Process Complete!\n');

  console.log('📊 Duplicate Removal Summary:');
  console.log(`   - Recipes analyzed: ${totalStats.recipesAnalyzed}`);
  console.log(`   - Recipes with duplicates: ${totalStats.duplicatesFound}`);
  console.log(`   - Duplicate entries removed: ${totalStats.duplicatesRemoved}`);
  console.log(`   - Amounts merged: ${totalStats.amountsMerged}`);
  console.log(`   - Removal errors: ${totalStats.errors.length}\n`);

  console.log('📊 Retry Summary:');
  console.log(`   - Total retries: ${retryStats.totalRetries}`);
  console.log(`   - Successful: ${retryStats.retrySuccesses}`);
  console.log(`   - Failed: ${retryStats.retryFailed}\n`);

  if (retryStats.errors.length > 0) {
    console.log(`⚠️  Failed retries: ${retryStats.errors.length}\n`);
    retryStats.errors.forEach((err, idx) => {
      console.log(`${idx + 1}. ${err.group}: ${err.error}`);
    });
    console.log('');
  }

  if (isDryRun) {
    console.log('🔍 DRY RUN completed - no actual changes made');
    console.log('   Remove --dry-run flag to execute for real\n');
  } else {
    console.log('💾 Database has been updated\n');
  }

  // Save detailed report
  const reportPath = path.join(tmpDir, `duplicate-fix-report-${Date.now()}.json`);
  const report = {
    timestamp: new Date().toISOString(),
    isDryRun,
    duplicateRemoval: totalStats,
    retry: retryStats,
    processedDecisions: failedDecisions.map((d) => ({
      group: d.group,
      canonical_name: d.canonical_name,
      duplicates_count: d.duplicates_to_merge?.length || 0,
    })),
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📁 Detailed report saved to: ${reportPath}\n`);

  await cleanup();

  // Exit with appropriate code
  if (retryStats.retryFailed > 0) {
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Fatal error during fix process:', error);
    cleanup().finally(() => process.exit(1));
  });
}

export { main as fixDuplicateConstraints };
