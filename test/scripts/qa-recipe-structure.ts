/**
 * Phase 1: Recipe Structure Validation
 *
 * Purpose: Fast structural validation without LLM to identify recipes with:
 * - Missing ingredients (empty array or null)
 * - Missing instructions (empty array or null)
 * - Malformed JSON in ingredients/instructions fields
 * - Empty strings in arrays
 *
 * Output: tmp/qa-structure-report.json
 *
 * Usage:
 *   pnpm tsx scripts/qa-recipe-structure.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import cliProgress from 'cli-progress';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';

interface StructureIssue {
  recipe_id: string;
  recipe_name: string;
  issue_type: 'missing_ingredients' | 'missing_instructions' | 'malformed_json' | 'empty_strings';
  details: string;
  severity: 'critical' | 'high' | 'medium';
}

interface StructureReport {
  timestamp: string;
  total_recipes: number;
  critical_issues: {
    missing_ingredients: Array<{ id: string; name: string }>;
    missing_instructions: Array<{ id: string; name: string }>;
    malformed_json: Array<{ id: string; name: string; error: string }>;
  };
  warnings: {
    empty_strings_in_ingredients: Array<{ id: string; name: string; count: number }>;
    empty_strings_in_instructions: Array<{ id: string; name: string; count: number }>;
  };
  summary: {
    recipes_ok: number;
    recipes_flagged: number;
    by_severity: {
      critical: number;
      high: number;
      medium: number;
    };
  };
  all_issues: StructureIssue[];
}

function parseJsonField(
  field: string | null,
  fieldName: string
): { valid: boolean; data?: any; error?: string } {
  if (!field || field.trim() === '') {
    return { valid: false, error: `${fieldName} is null or empty` };
  }

  try {
    const parsed = JSON.parse(field);
    if (!Array.isArray(parsed)) {
      return { valid: false, error: `${fieldName} is not an array` };
    }
    return { valid: true, data: parsed };
  } catch (error) {
    return { valid: false, error: `${fieldName} JSON parse error: ${(error as Error).message}` };
  }
}

function countEmptyStrings(arr: any[]): number {
  return arr.filter((item) => typeof item === 'string' && item.trim() === '').length;
}

async function validateRecipeStructure() {
  console.log('🔍 Phase 1: Recipe Structure Validation\n');

  // Ensure tmp directory exists
  const tmpDir = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  // Fetch all recipes
  console.log('📊 Fetching all recipes from database...');
  const allRecipes = await db
    .select({
      id: recipes.id,
      name: recipes.name,
      ingredients: recipes.ingredients,
      instructions: recipes.instructions,
    })
    .from(recipes);

  console.log(`✅ Found ${allRecipes.length} recipes\n`);

  const report: StructureReport = {
    timestamp: new Date().toISOString(),
    total_recipes: allRecipes.length,
    critical_issues: {
      missing_ingredients: [],
      missing_instructions: [],
      malformed_json: [],
    },
    warnings: {
      empty_strings_in_ingredients: [],
      empty_strings_in_instructions: [],
    },
    summary: {
      recipes_ok: 0,
      recipes_flagged: 0,
      by_severity: {
        critical: 0,
        high: 0,
        medium: 0,
      },
    },
    all_issues: [],
  };

  // Progress bar
  const progressBar = new cliProgress.SingleBar({
    format: 'Validating |{bar}| {percentage}% | {value}/{total} recipes | ETA: {eta}s',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true,
  });

  progressBar.start(allRecipes.length, 0);

  let recipesWithIssues = 0;

  for (let i = 0; i < allRecipes.length; i++) {
    const recipe = allRecipes[i];
    let hasIssues = false;

    // Validate ingredients
    const ingredientsResult = parseJsonField(recipe.ingredients, 'ingredients');
    if (!ingredientsResult.valid) {
      hasIssues = true;
      report.critical_issues.malformed_json.push({
        id: recipe.id,
        name: recipe.name,
        error: ingredientsResult.error || 'Unknown error',
      });
      report.all_issues.push({
        recipe_id: recipe.id,
        recipe_name: recipe.name,
        issue_type: 'malformed_json',
        details: `Ingredients: ${ingredientsResult.error}`,
        severity: 'critical',
      });
      report.summary.by_severity.critical++;
    } else if (ingredientsResult.data && ingredientsResult.data.length === 0) {
      hasIssues = true;
      report.critical_issues.missing_ingredients.push({
        id: recipe.id,
        name: recipe.name,
      });
      report.all_issues.push({
        recipe_id: recipe.id,
        recipe_name: recipe.name,
        issue_type: 'missing_ingredients',
        details: 'Ingredients array is empty',
        severity: 'critical',
      });
      report.summary.by_severity.critical++;
    } else if (ingredientsResult.data) {
      const emptyCount = countEmptyStrings(ingredientsResult.data);
      if (emptyCount > 0) {
        hasIssues = true;
        report.warnings.empty_strings_in_ingredients.push({
          id: recipe.id,
          name: recipe.name,
          count: emptyCount,
        });
        report.all_issues.push({
          recipe_id: recipe.id,
          recipe_name: recipe.name,
          issue_type: 'empty_strings',
          details: `${emptyCount} empty string(s) in ingredients array`,
          severity: 'medium',
        });
        report.summary.by_severity.medium++;
      }
    }

    // Validate instructions
    const instructionsResult = parseJsonField(recipe.instructions, 'instructions');
    if (!instructionsResult.valid) {
      hasIssues = true;
      report.critical_issues.malformed_json.push({
        id: recipe.id,
        name: recipe.name,
        error: instructionsResult.error || 'Unknown error',
      });
      report.all_issues.push({
        recipe_id: recipe.id,
        recipe_name: recipe.name,
        issue_type: 'malformed_json',
        details: `Instructions: ${instructionsResult.error}`,
        severity: 'critical',
      });
      report.summary.by_severity.critical++;
    } else if (instructionsResult.data && instructionsResult.data.length === 0) {
      hasIssues = true;
      report.critical_issues.missing_instructions.push({
        id: recipe.id,
        name: recipe.name,
      });
      report.all_issues.push({
        recipe_id: recipe.id,
        recipe_name: recipe.name,
        issue_type: 'missing_instructions',
        details: 'Instructions array is empty',
        severity: 'critical',
      });
      report.summary.by_severity.critical++;
    } else if (instructionsResult.data) {
      const emptyCount = countEmptyStrings(instructionsResult.data);
      if (emptyCount > 0) {
        hasIssues = true;
        report.warnings.empty_strings_in_instructions.push({
          id: recipe.id,
          name: recipe.name,
          count: emptyCount,
        });
        report.all_issues.push({
          recipe_id: recipe.id,
          recipe_name: recipe.name,
          issue_type: 'empty_strings',
          details: `${emptyCount} empty string(s) in instructions array`,
          severity: 'medium',
        });
        report.summary.by_severity.medium++;
      }
    }

    if (hasIssues) {
      recipesWithIssues++;
    }

    progressBar.update(i + 1);
  }

  progressBar.stop();

  // Calculate summary
  report.summary.recipes_flagged = recipesWithIssues;
  report.summary.recipes_ok = allRecipes.length - recipesWithIssues;

  // Write report to file
  const reportPath = path.join(tmpDir, 'qa-structure-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  // Print summary
  console.log('\n📋 Structure Validation Summary:');
  console.log('─'.repeat(60));
  console.log(`Total Recipes:           ${report.total_recipes.toLocaleString()}`);
  console.log(
    `✅ Recipes OK:           ${report.summary.recipes_ok.toLocaleString()} (${((report.summary.recipes_ok / report.total_recipes) * 100).toFixed(2)}%)`
  );
  console.log(
    `⚠️  Recipes Flagged:      ${report.summary.recipes_flagged.toLocaleString()} (${((report.summary.recipes_flagged / report.total_recipes) * 100).toFixed(2)}%)`
  );
  console.log('');
  console.log('By Severity:');
  console.log(`  🔴 Critical:           ${report.summary.by_severity.critical.toLocaleString()}`);
  console.log(`  🟠 High:               ${report.summary.by_severity.high.toLocaleString()}`);
  console.log(`  🟡 Medium:             ${report.summary.by_severity.medium.toLocaleString()}`);
  console.log('');
  console.log('Critical Issues:');
  console.log(
    `  Missing Ingredients:   ${report.critical_issues.missing_ingredients.length.toLocaleString()}`
  );
  console.log(
    `  Missing Instructions:  ${report.critical_issues.missing_instructions.length.toLocaleString()}`
  );
  console.log(
    `  Malformed JSON:        ${report.critical_issues.malformed_json.length.toLocaleString()}`
  );
  console.log('');
  console.log('Warnings:');
  console.log(
    `  Empty Strings (Ingr):  ${report.warnings.empty_strings_in_ingredients.length.toLocaleString()}`
  );
  console.log(
    `  Empty Strings (Instr): ${report.warnings.empty_strings_in_instructions.length.toLocaleString()}`
  );
  console.log('─'.repeat(60));
  console.log(`\n✅ Report saved to: ${reportPath}\n`);

  return report;
}

// Run validation
validateRecipeStructure()
  .then(() => {
    console.log('✅ Structure validation complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error during validation:', error);
    process.exit(1);
  });
