/**
 * Day 1 Launch Preparation - Hide Incomplete Recipes
 *
 * Purpose: Update database to hide incomplete recipes from search results
 * - 211 recipes with missing instructions → qa_status = 'needs_review' (hidden)
 * - 20 recipes with missing ingredients → qa_status = 'flagged' (post-launch fix)
 *
 * Launch Date: October 27, 2025
 * Run Command: pnpm qa:hide-incomplete
 */

import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { inArray } from 'drizzle-orm';
import fs from 'node:fs';
import path from 'node:path';

interface QAStructureReport {
  timestamp: string;
  total_recipes: number;
  critical_issues: {
    missing_ingredients: Array<{ id: string; name: string }>;
    missing_instructions: Array<{ id: string; name: string }>;
  };
}

interface HideIncompleteReport {
  timestamp: string;
  total_updated: number;
  hidden_count: number;
  flagged_count: number;
  hidden_recipes: Array<{ id: string; name: string }>;
  flagged_recipes: Array<{ id: string; name: string }>;
}

async function hideIncompleteRecipes() {
  console.log('🔒 Hiding Incomplete Recipes from Search\n');

  // Load Phase 1 report
  console.log('📋 Loading Phase 1 report...');
  const reportPath = path.join(process.cwd(), 'tmp', 'qa-structure-report.json');

  if (!fs.existsSync(reportPath)) {
    console.error('❌ Error: Phase 1 report not found at:', reportPath);
    console.error('   Please run Phase 1 first: pnpm qa:phase1');
    process.exit(1);
  }

  const reportData = JSON.parse(fs.readFileSync(reportPath, 'utf-8')) as QAStructureReport;

  const missingInstructions = reportData.critical_issues.missing_instructions;
  const missingIngredients = reportData.critical_issues.missing_ingredients;

  const totalToUpdate = missingInstructions.length + missingIngredients.length;

  console.log(`✅ Found ${totalToUpdate} recipes to update\n`);

  // Hide recipes with missing instructions
  console.log(`🚫 Hiding ${missingInstructions.length} recipes with missing instructions...`);

  const missingInstructionsIds = missingInstructions.map(r => r.id);

  if (missingInstructionsIds.length > 0) {
    await db.update(recipes)
      .set({
        qa_status: 'needs_review',
        qa_notes: 'Missing instructions - hidden from search until fixed',
        qa_timestamp: new Date(),
        qa_method: 'automated-rules',
      })
      .where(inArray(recipes.id, missingInstructionsIds));

    // Log progress
    missingInstructions.slice(0, 5).forEach(recipe => {
      console.log(`  ✓ Updated recipe: "${recipe.name}"`);
    });
    if (missingInstructions.length > 5) {
      console.log(`  ... and ${missingInstructions.length - 5} more\n`);
    }
  }

  // Flag recipes with missing ingredients
  console.log(`⚠️  Flagging ${missingIngredients.length} recipes with missing ingredients...`);

  const missingIngredientsIds = missingIngredients.map(r => r.id);

  if (missingIngredientsIds.length > 0) {
    await db.update(recipes)
      .set({
        qa_status: 'flagged',
        qa_notes: 'Missing ingredient list - flagged for post-launch fix',
        qa_timestamp: new Date(),
        qa_method: 'automated-rules',
        qa_issues_found: JSON.stringify(['missing_ingredients']),
      })
      .where(inArray(recipes.id, missingIngredientsIds));

    // Log progress
    missingIngredients.slice(0, 5).forEach(recipe => {
      console.log(`  ✓ Flagged recipe: "${recipe.name}"`);
    });
    if (missingIngredients.length > 5) {
      console.log(`  ... and ${missingIngredients.length - 5} more\n`);
    }
  }

  // Generate summary report
  const report: HideIncompleteReport = {
    timestamp: new Date().toISOString(),
    total_updated: totalToUpdate,
    hidden_count: missingInstructions.length,
    flagged_count: missingIngredients.length,
    hidden_recipes: missingInstructions,
    flagged_recipes: missingIngredients,
  };

  // Save report
  const outputPath = path.join(process.cwd(), 'tmp', 'hide-incomplete-report.json');
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));

  // Print summary
  console.log('📊 Summary:');
  console.log('────────────────────────────────────────────────────');
  console.log(`Total Updated:             ${totalToUpdate}`);
  console.log(`  Hidden (missing instr):  ${missingInstructions.length}`);
  console.log(`  Flagged (missing ingr):  ${missingIngredients.length}`);
  console.log('────────────────────────────────────────────────────\n');
  console.log(`✅ Report saved to: tmp/hide-incomplete-report.json`);
  console.log('✅ Database updated successfully');
}

// Execute
hideIncompleteRecipes()
  .then(() => {
    console.log('\n🎉 Complete! Recipes hidden from search.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
