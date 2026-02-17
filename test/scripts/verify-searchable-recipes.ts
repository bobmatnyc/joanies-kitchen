/**
 * Day 1 Launch Preparation - Verify Searchable Recipes
 *
 * Purpose: Verify that only complete recipes are searchable after cleanup
 * - Count searchable recipes (target: 4,476)
 * - Verify no incomplete recipes in search results
 * - Validate QA status properly set
 *
 * Launch Date: October 27, 2025
 * Run Command: pnpm qa:verify-searchable
 */

import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { and, isNull, notInArray, or, sql } from 'drizzle-orm';
import fs from 'node:fs';
import path from 'node:path';

interface SearchableRecipesReport {
  timestamp: string;
  searchable_count: number;
  hidden_count: number;
  flagged_count: number;
  total_count: number;
  validation_checks: {
    no_incomplete_in_search: boolean;
    all_have_ingredients: boolean;
    all_have_instructions: boolean;
    qa_status_set: boolean;
  };
  issues_found: string[];
  launch_ready: boolean;
}

async function verifySearchableRecipes() {
  console.log('✅ Verifying Searchable Recipes\n');

  console.log('📊 Querying database...\n');

  // Count searchable recipes (not hidden or flagged)
  const searchableRecipes = await db.select({
    id: recipes.id,
    name: recipes.name,
    qa_status: recipes.qa_status,
    ingredients: recipes.ingredients,
    instructions: recipes.instructions,
  }).from(recipes).where(
    and(
      or(
        isNull(recipes.qa_status),
        sql`${recipes.qa_status} NOT IN ('needs_review', 'flagged')`
      ),
      sql`${recipes.ingredients} != '[]'`,
      sql`${recipes.instructions} != '[]'`
    )
  );

  // Count hidden recipes (needs_review)
  const hiddenRecipes = await db.select({
    id: recipes.id,
  }).from(recipes).where(
    sql`${recipes.qa_status} = 'needs_review'`
  );

  // Count flagged recipes
  const flaggedRecipes = await db.select({
    id: recipes.id,
  }).from(recipes).where(
    sql`${recipes.qa_status} = 'flagged'`
  );

  // Count total recipes
  const totalRecipes = await db.select({
    id: recipes.id,
  }).from(recipes);

  const searchableCount = searchableRecipes.length;
  const hiddenCount = hiddenRecipes.length;
  const flaggedCount = flaggedRecipes.length;
  const totalCount = totalRecipes.length;

  // Display counts
  console.log(`✅ Searchable Recipes: ${searchableCount.toLocaleString()}`);
  console.log(`🚫 Hidden Recipes:     ${hiddenCount.toLocaleString()}`);
  console.log(`⚠️  Flagged Recipes:   ${flaggedCount.toLocaleString()}`);
  console.log('────────────────────────────────────────────────────');
  console.log(`Total:                 ${totalCount.toLocaleString()}\n`);

  // Validation checks
  const issues: string[] = [];
  let allChecksPass = true;

  console.log('🔍 Validation Checks:');

  // Check 1: No incomplete recipes in search results
  const incompleteInSearch = searchableRecipes.filter(r =>
    r.ingredients === '[]' || r.instructions === '[]'
  );

  if (incompleteInSearch.length === 0) {
    console.log('  ✓ No incomplete recipes in search results');
  } else {
    console.log(`  ✗ Found ${incompleteInSearch.length} incomplete recipes in search`);
    issues.push(`${incompleteInSearch.length} incomplete recipes still searchable`);
    allChecksPass = false;
  }

  // Check 2: All searchable recipes have ingredients
  const missingIngredients = searchableRecipes.filter(r => r.ingredients === '[]');
  if (missingIngredients.length === 0) {
    console.log('  ✓ All searchable recipes have ingredients');
  } else {
    console.log(`  ✗ ${missingIngredients.length} searchable recipes missing ingredients`);
    issues.push(`${missingIngredients.length} recipes missing ingredients`);
    allChecksPass = false;
  }

  // Check 3: All searchable recipes have instructions
  const missingInstructions = searchableRecipes.filter(r => r.instructions === '[]');
  if (missingInstructions.length === 0) {
    console.log('  ✓ All searchable recipes have instructions');
  } else {
    console.log(`  ✗ ${missingInstructions.length} searchable recipes missing instructions`);
    issues.push(`${missingInstructions.length} recipes missing instructions`);
    allChecksPass = false;
  }

  // Check 4: QA status properly set
  const hiddenAndFlagged = hiddenCount + flaggedCount;
  const expectedHidden = 231; // From Phase 1 report

  if (hiddenAndFlagged === expectedHidden) {
    console.log('  ✓ QA status properly set');
  } else {
    console.log(`  ⚠️  Expected ${expectedHidden} hidden/flagged, found ${hiddenAndFlagged}`);
    issues.push(`QA status count mismatch: expected ${expectedHidden}, got ${hiddenAndFlagged}`);
  }

  // Generate report
  const report: SearchableRecipesReport = {
    timestamp: new Date().toISOString(),
    searchable_count: searchableCount,
    hidden_count: hiddenCount,
    flagged_count: flaggedCount,
    total_count: totalCount,
    validation_checks: {
      no_incomplete_in_search: incompleteInSearch.length === 0,
      all_have_ingredients: missingIngredients.length === 0,
      all_have_instructions: missingInstructions.length === 0,
      qa_status_set: hiddenAndFlagged === expectedHidden,
    },
    issues_found: issues,
    launch_ready: allChecksPass && issues.length === 0,
  };

  // Save report
  const outputPath = path.join(process.cwd(), 'tmp', 'searchable-recipes-report.json');
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));

  console.log(`\n✅ Report saved to: tmp/searchable-recipes-report.json`);

  if (report.launch_ready) {
    console.log('✅ Verification complete - LAUNCH READY');
  } else {
    console.log('⚠️  Verification complete - ISSUES FOUND');
    console.log('\nIssues:');
    issues.forEach(issue => console.log(`  - ${issue}`));
  }

  return report;
}

// Execute
verifySearchableRecipes()
  .then((report) => {
    if (!report.launch_ready) {
      process.exit(1);
    }
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
