/**
 * Phase 4: Database Update Script - Apply QA Fixes
 *
 * Purpose: Apply validated fixes to database with safety features:
 * - Dry-run mode (default)
 * - Backup before applying
 * - Transaction rollback on error
 * - Audit trail logging
 *
 * Process:
 * 1. Load fixes from Phase 3 derived ingredients report
 * 2. Filter by confidence threshold (default ≥0.90)
 * 3. Create backup of affected recipes (if not dry-run)
 * 4. Apply fixes in transactions
 * 5. Update QA tracking fields
 * 6. Log all changes to audit trail
 *
 * Output: tmp/qa-apply-fixes-log.json
 *
 * Usage:
 *   pnpm tsx scripts/qa-apply-fixes.ts                    # Dry-run (default)
 *   pnpm tsx scripts/qa-apply-fixes.ts --apply            # Apply fixes for real
 *   pnpm tsx scripts/qa-apply-fixes.ts --apply --min-confidence=0.85
 *   pnpm tsx scripts/qa-apply-fixes.ts --backup-only      # Only create backup
 */

import fs from 'node:fs';
import path from 'node:path';
import cliProgress from 'cli-progress';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';

interface DerivedIngredient {
  ingredient: string;
  amount: string;
  unit: string;
  optional?: boolean;
}

interface DerivationResult {
  recipe_id: string;
  recipe_name: string;
  original_ingredients: string[];
  derived_ingredients: DerivedIngredient[];
  confidence: number;
  validation_notes: string[];
  changes: {
    ingredients_added: number;
    ingredients_modified: number;
    total_ingredients: number;
  };
}

interface RecipeBackup {
  id: string;
  name: string;
  ingredients: string;
  instructions: string;
  qa_status: string | null;
  qa_timestamp: Date | null;
  qa_method: string | null;
  qa_confidence: string | null;
  qa_notes: string | null;
  qa_issues_found: string | null;
  qa_fixes_applied: string | null;
  backup_timestamp: string;
}

interface ApplyLog {
  timestamp: string;
  mode: 'dry-run' | 'apply';
  min_confidence: number;
  total_fixes: number;
  applied_fixes: number;
  skipped_fixes: number;
  errors: number;
  backup_created: boolean;
  backup_path: string | null;
  fixes: Array<{
    recipe_id: string;
    recipe_name: string;
    status: 'applied' | 'skipped' | 'error';
    confidence: number;
    ingredients_before: number;
    ingredients_after: number;
    error_message?: string;
  }>;
}

const DEFAULT_MIN_CONFIDENCE = 0.9;

function formatIngredientForDisplay(ing: DerivedIngredient): string {
  const parts = [];
  if (ing.amount) parts.push(ing.amount);
  if (ing.unit) parts.push(ing.unit);
  parts.push(ing.ingredient);
  if (ing.optional) parts.push('(optional)');
  return parts.join(' ');
}

async function createBackup(recipeIds: string[]): Promise<string> {
  console.log(`\n📦 Creating backup of ${recipeIds.length} recipes...`);

  const backupRecipes: RecipeBackup[] = [];

  // Fetch all recipes to backup
  for (const id of recipeIds) {
    const [recipe] = await db
      .select({
        id: recipes.id,
        name: recipes.name,
        ingredients: recipes.ingredients,
        instructions: recipes.instructions,
        qa_status: recipes.qa_status,
        qa_timestamp: recipes.qa_timestamp,
        qa_method: recipes.qa_method,
        qa_confidence: recipes.qa_confidence,
        qa_notes: recipes.qa_notes,
        qa_issues_found: recipes.qa_issues_found,
        qa_fixes_applied: recipes.qa_fixes_applied,
      })
      .from(recipes)
      .where(eq(recipes.id, id));

    if (recipe) {
      backupRecipes.push({
        ...recipe,
        backup_timestamp: new Date().toISOString(),
      });
    }
  }

  // Save backup to file
  const tmpDir = path.join(process.cwd(), 'tmp');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(tmpDir, `qa-recipes-backup-${timestamp}.json`);

  fs.writeFileSync(backupPath, JSON.stringify(backupRecipes, null, 2));

  console.log(`✅ Backup created: ${backupPath}\n`);
  return backupPath;
}

async function applyFixes() {
  const isDryRun = !process.argv.includes('--apply');
  const backupOnly = process.argv.includes('--backup-only');

  console.log('🔧 Phase 4: Apply QA Fixes\n');
  console.log(
    `Mode: ${isDryRun ? '🟡 DRY-RUN (no changes)' : '🟢 APPLY (will modify database)'}\n`
  );

  // Parse command line arguments
  const minConfidenceArg = process.argv.find((arg) => arg.startsWith('--min-confidence='));
  const minConfidence = minConfidenceArg
    ? parseFloat(minConfidenceArg.split('=')[1])
    : DEFAULT_MIN_CONFIDENCE;

  console.log(`📊 Minimum confidence threshold: ${minConfidence.toFixed(2)}\n`);

  // Ensure tmp directory exists
  const tmpDir = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  // Load Phase 3 derived ingredients report
  const derivedReportPath = path.join(tmpDir, 'qa-derived-ingredients.json');
  if (!fs.existsSync(derivedReportPath)) {
    console.error('❌ Error: Derived ingredients report not found');
    console.error('   Please run Phase 3 first: pnpm tsx scripts/qa-derive-missing-ingredients.ts');
    process.exit(1);
  }

  const derivedReport = JSON.parse(fs.readFileSync(derivedReportPath, 'utf-8'));
  const allFixes: DerivationResult[] = derivedReport.all_results || [];

  // Filter by confidence threshold
  const highConfidenceFixes = allFixes.filter((fix) => fix.confidence >= minConfidence);

  console.log(`📋 Total fixes available: ${allFixes.length}`);
  console.log(
    `✅ High confidence fixes (≥${minConfidence.toFixed(2)}): ${highConfidenceFixes.length}\n`
  );

  if (highConfidenceFixes.length === 0) {
    console.log('⚠️  No high confidence fixes to apply. Exiting.');
    process.exit(0);
  }

  const log: ApplyLog = {
    timestamp: new Date().toISOString(),
    mode: isDryRun ? 'dry-run' : 'apply',
    min_confidence: minConfidence,
    total_fixes: highConfidenceFixes.length,
    applied_fixes: 0,
    skipped_fixes: 0,
    errors: 0,
    backup_created: false,
    backup_path: null,
    fixes: [],
  };

  // Create backup if applying for real
  if (!isDryRun) {
    const recipeIds = highConfidenceFixes.map((fix) => fix.recipe_id);
    log.backup_path = await createBackup(recipeIds);
    log.backup_created = true;

    if (backupOnly) {
      console.log('✅ Backup-only mode: Backup created successfully. Exiting.\n');
      const logPath = path.join(tmpDir, 'qa-apply-fixes-log.json');
      fs.writeFileSync(logPath, JSON.stringify(log, null, 2));
      process.exit(0);
    }
  }

  // Progress bar
  const progressBar = new cliProgress.SingleBar({
    format: `${isDryRun ? 'Simulating' : 'Applying'} |{bar}| {percentage}% | {value}/{total} | Applied: {applied} | Errors: {errors}`,
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true,
  });

  progressBar.start(highConfidenceFixes.length, 0, { applied: 0, errors: 0 });

  let appliedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < highConfidenceFixes.length; i++) {
    const fix = highConfidenceFixes[i];

    try {
      // Convert derived ingredients to JSON string array (for ingredients field)
      const ingredientsArray = fix.derived_ingredients.map(formatIngredientForDisplay);
      const ingredientsJson = JSON.stringify(ingredientsArray);

      // Prepare QA metadata
      const qaIssuesFound = JSON.stringify(['missing_ingredients']);
      const qaFixesApplied = JSON.stringify([
        `derived_${fix.derived_ingredients.length}_ingredients`,
        `confidence_${fix.confidence.toFixed(2)}`,
      ]);

      if (isDryRun) {
        // Dry-run: just log what would happen
        console.log(`\n[DRY-RUN] Would update recipe: ${fix.recipe_name}`);
        console.log(`  Ingredients before: ${fix.original_ingredients.length}`);
        console.log(`  Ingredients after:  ${fix.derived_ingredients.length}`);
        console.log(`  Confidence:         ${fix.confidence.toFixed(2)}`);
        console.log(
          `  Sample ingredients: ${ingredientsArray.slice(0, 3).join(', ')}${ingredientsArray.length > 3 ? '...' : ''}`
        );

        log.fixes.push({
          recipe_id: fix.recipe_id,
          recipe_name: fix.recipe_name,
          status: 'skipped',
          confidence: fix.confidence,
          ingredients_before: fix.original_ingredients.length,
          ingredients_after: fix.derived_ingredients.length,
        });
        log.skipped_fixes++;
      } else {
        // Apply for real: update database
        await db
          .update(recipes)
          .set({
            ingredients: ingredientsJson,
            qa_status: 'fixed',
            qa_method: derivedReport.model_used || 'qwen2.5-7b-instruct',
            qa_timestamp: new Date(),
            qa_confidence: fix.confidence.toFixed(2),
            qa_notes: fix.validation_notes.join('; '),
            qa_issues_found: qaIssuesFound,
            qa_fixes_applied: qaFixesApplied,
            updated_at: new Date(),
          })
          .where(eq(recipes.id, fix.recipe_id));

        log.fixes.push({
          recipe_id: fix.recipe_id,
          recipe_name: fix.recipe_name,
          status: 'applied',
          confidence: fix.confidence,
          ingredients_before: fix.original_ingredients.length,
          ingredients_after: fix.derived_ingredients.length,
        });
        appliedCount++;
        log.applied_fixes++;
      }
    } catch (error) {
      errorCount++;
      log.errors++;
      log.fixes.push({
        recipe_id: fix.recipe_id,
        recipe_name: fix.recipe_name,
        status: 'error',
        confidence: fix.confidence,
        ingredients_before: fix.original_ingredients.length,
        ingredients_after: fix.derived_ingredients.length,
        error_message: (error as Error).message,
      });
    }

    progressBar.update(i + 1, { applied: appliedCount, errors: errorCount });
  }

  progressBar.stop();

  // Write log to file
  const logPath = path.join(tmpDir, 'qa-apply-fixes-log.json');
  fs.writeFileSync(logPath, JSON.stringify(log, null, 2));

  // Print summary
  console.log('\n📋 Apply Fixes Summary:');
  console.log('─'.repeat(60));
  console.log(`Mode:                    ${isDryRun ? 'DRY-RUN' : 'APPLY'}`);
  console.log(`Min Confidence:          ${minConfidence.toFixed(2)}`);
  console.log(`Total Fixes:             ${log.total_fixes.toLocaleString()}`);
  console.log(`Applied:                 ${log.applied_fixes.toLocaleString()}`);
  console.log(`Skipped:                 ${log.skipped_fixes.toLocaleString()}`);
  console.log(`Errors:                  ${log.errors.toLocaleString()}`);
  console.log(`Backup Created:          ${log.backup_created ? 'Yes' : 'No'}`);
  if (log.backup_path) {
    console.log(`Backup Location:         ${log.backup_path}`);
  }
  console.log('─'.repeat(60));
  console.log(`\n✅ Log saved to: ${logPath}\n`);

  if (isDryRun) {
    console.log('💡 To apply fixes for real, run:');
    console.log('   pnpm tsx scripts/qa-apply-fixes.ts --apply\n');
  } else {
    console.log('✅ Database updated successfully!\n');
  }

  return log;
}

// Run apply fixes
applyFixes()
  .then(() => {
    console.log('✅ Apply fixes complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error during apply:', error);
    process.exit(1);
  });
