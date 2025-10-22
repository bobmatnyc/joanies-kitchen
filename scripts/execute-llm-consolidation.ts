/**
 * Phase 3: Execute LLM-Validated Consolidation
 *
 * Applies merge decisions from LLM analysis:
 * - Updates recipe_ingredients to point to canonical ingredient
 * - Updates canonical ingredient with correct name, category, aliases
 * - Deletes duplicate ingredients
 * - Creates backup before execution
 * - Atomic transactions per merge operation
 *
 * Usage: tsx scripts/execute-llm-consolidation.ts [--dry-run] [--skip-backup]
 */

import { db, cleanup } from './db-with-transactions';
import { ingredients, recipeIngredients } from '../src/lib/db/ingredients-schema';
import { eq, inArray, sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';
import type { ConsolidationDecision } from './llm-ingredient-consolidation';

interface ExecutionStats {
  totalDecisions: number;
  mergeAttempts: number;
  mergeSuccesses: number;
  mergeFailed: number;
  ingredientsDeleted: number;
  ingredientsUpdated: number;
  recipeIngredientsUpdated: number;
  errors: Array<{ group: string; error: string }>;
}

interface BackupData {
  timestamp: string;
  ingredients_backup: any[];
  recipe_ingredients_backup: any[];
  consolidation_decisions: ConsolidationDecision[];
}

const isDryRun = process.argv.includes('--dry-run');
const skipBackup = process.argv.includes('--skip-backup');

async function createBackup(decisions: ConsolidationDecision[]): Promise<void> {
  if (skipBackup) {
    console.log('⏭️  Skipping backup (--skip-backup flag)\n');
    return;
  }

  console.log('💾 Creating backup before consolidation...\n');

  // Get all affected ingredient IDs
  const affectedIds = new Set<string>();
  decisions
    .filter((d) => d.action === 'merge')
    .forEach((d) => {
      if (d.canonical_id) affectedIds.add(d.canonical_id);
      d.duplicates_to_merge?.forEach((id) => affectedIds.add(id));
    });

  const affectedIdsArray = Array.from(affectedIds);

  // Backup ingredients
  const ingredientsBackup = await db
    .select()
    .from(ingredients)
    .where(inArray(ingredients.id, affectedIdsArray));

  // Backup recipe_ingredients
  const recipeIngredientsBackup = await db
    .select()
    .from(recipeIngredients)
    .where(inArray(recipeIngredients.ingredient_id, affectedIdsArray));

  const backup: BackupData = {
    timestamp: new Date().toISOString(),
    ingredients_backup: ingredientsBackup,
    recipe_ingredients_backup: recipeIngredientsBackup,
    consolidation_decisions: decisions,
  };

  // Save backup
  const tmpDir = path.join(process.cwd(), 'tmp');
  const backupPath = path.join(tmpDir, `consolidation-backup-${Date.now()}.json`);

  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));

  console.log(`✅ Backup saved to: ${backupPath}`);
  console.log(`   - Ingredients backed up: ${ingredientsBackup.length}`);
  console.log(`   - Recipe ingredients backed up: ${recipeIngredientsBackup.length}\n`);
}

async function executeConsolidation(decisions: ConsolidationDecision[]): Promise<ExecutionStats> {
  const stats: ExecutionStats = {
    totalDecisions: decisions.length,
    mergeAttempts: 0,
    mergeSuccesses: 0,
    mergeFailed: 0,
    ingredientsDeleted: 0,
    ingredientsUpdated: 0,
    recipeIngredientsUpdated: 0,
    errors: [],
  };

  // Filter for merge decisions only
  const mergeDecisions = decisions.filter((d) => d.action === 'merge' && d.canonical_id && d.duplicates_to_merge);

  console.log(`🔄 Executing ${mergeDecisions.length} merge operations...\n`);

  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  for (const decision of mergeDecisions) {
    stats.mergeAttempts++;

    try {
      const canonicalId = decision.canonical_id!;
      const duplicateIds = decision.duplicates_to_merge || [];

      if (duplicateIds.length === 0) {
        console.log(`⏭️  Skipping "${decision.canonical_name}" - no duplicates to merge`);
        continue;
      }

      console.log(`\n📌 Merging: ${decision.canonical_name} [${decision.canonical_category}]`);
      console.log(`   Consolidating ${duplicateIds.length} duplicates into canonical ID: ${canonicalId.slice(0, 8)}...`);

      if (!isDryRun) {
        await db.transaction(async (tx) => {
          // Step 1: Update recipe_ingredients to point to canonical
          const updateResult = await tx
            .update(recipeIngredients)
            .set({ ingredient_id: canonicalId })
            .where(inArray(recipeIngredients.ingredient_id, duplicateIds));

          stats.recipeIngredientsUpdated += duplicateIds.length; // Approximate

          console.log(`   ✓ Updated recipe_ingredients to point to canonical`);

          // Step 2: Update canonical ingredient with correct metadata
          const aliasesJson = decision.aliases && decision.aliases.length > 0 ? JSON.stringify(decision.aliases) : null;

          await tx
            .update(ingredients)
            .set({
              name: decision.canonical_name!.toLowerCase(),
              display_name: decision.canonical_name!,
              category: decision.canonical_category,
              aliases: aliasesJson,
              updated_at: new Date(),
            })
            .where(eq(ingredients.id, canonicalId));

          stats.ingredientsUpdated++;
          console.log(`   ✓ Updated canonical ingredient metadata`);

          // Step 3: Delete duplicate ingredients
          await tx.delete(ingredients).where(inArray(ingredients.id, duplicateIds));

          stats.ingredientsDeleted += duplicateIds.length;
          console.log(`   ✓ Deleted ${duplicateIds.length} duplicate ingredients`);
        });
      } else {
        console.log(`   [DRY RUN] Would update recipe_ingredients`);
        console.log(`   [DRY RUN] Would update canonical ingredient`);
        console.log(`   [DRY RUN] Would delete ${duplicateIds.length} duplicates`);
        stats.ingredientsDeleted += duplicateIds.length;
        stats.ingredientsUpdated++;
      }

      stats.mergeSuccesses++;

      // Progress indicator
      if (stats.mergeSuccesses % 10 === 0) {
        console.log(`\n📊 Progress: ${stats.mergeSuccesses}/${mergeDecisions.length} merges completed`);
      }
    } catch (error) {
      stats.mergeFailed++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      stats.errors.push({
        group: decision.group,
        error: errorMessage,
      });

      console.error(`   ❌ Error merging "${decision.canonical_name}": ${errorMessage}`);
    }
  }

  return stats;
}

async function main() {
  const tmpDir = path.join(process.cwd(), 'tmp');
  const decisionsPath = path.join(tmpDir, 'consolidation-decisions.json');

  // Check if decisions file exists
  if (!fs.existsSync(decisionsPath)) {
    console.error('❌ Error: consolidation-decisions.json not found!');
    console.error('   Run: tsx scripts/llm-ingredient-consolidation.ts first\n');
    process.exit(1);
  }

  // Load decisions
  const decisions: ConsolidationDecision[] = JSON.parse(fs.readFileSync(decisionsPath, 'utf-8'));

  console.log('🚀 LLM Ingredient Consolidation Execution\n');
  console.log('═'.repeat(60));
  console.log(`Loaded ${decisions.length} consolidation decisions\n`);

  // Create backup
  await createBackup(decisions);

  // Execute consolidation
  const stats = await executeConsolidation(decisions);

  // Print final summary
  console.log('\n═'.repeat(60));
  console.log('\n✅ Consolidation Complete!\n');

  console.log('📊 Execution Summary:');
  console.log(`   - Total decisions processed: ${stats.totalDecisions}`);
  console.log(`   - Merge attempts: ${stats.mergeAttempts}`);
  console.log(`   - Successful merges: ${stats.mergeSuccesses}`);
  console.log(`   - Failed merges: ${stats.mergeFailed}`);
  console.log(`   - Ingredients deleted: ${stats.ingredientsDeleted}`);
  console.log(`   - Ingredients updated: ${stats.ingredientsUpdated}\n`);

  if (stats.errors.length > 0) {
    console.log(`⚠️  Errors encountered: ${stats.errors.length}\n`);
    stats.errors.forEach((err, idx) => {
      console.log(`${idx + 1}. ${err.group}: ${err.error}`);
    });
    console.log('');
  }

  if (isDryRun) {
    console.log('🔍 DRY RUN completed - no actual changes made');
    console.log('   Remove --dry-run flag to execute for real\n');
  } else {
    console.log('💾 Database has been updated');
    console.log('   Backup available in tmp/ directory\n');
  }

  // Save execution report
  const reportPath = path.join(tmpDir, `consolidation-execution-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(stats, null, 2));
  console.log(`📁 Execution report saved to: ${reportPath}\n`);

  await cleanup();
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Fatal error during consolidation:', error);
    cleanup().finally(() => process.exit(1));
  });
}

export { executeConsolidation };
export type { ExecutionStats };
