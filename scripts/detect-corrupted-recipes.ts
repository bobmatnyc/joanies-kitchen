#!/usr/bin/env tsx

import { db } from '../src/lib/db';
import { recipes } from '../src/lib/db/schema';

interface CorruptionIssue {
  recipeId: string;
  recipeName: string;
  source: string | null;
  issueType: string;
  details: string;
  severity: 'critical' | 'high' | 'medium';
}

async function detectCorruptedRecipes() {
  console.log('🔍 Scanning all recipes for data corruption...\n');

  const allRecipes = await db.select().from(recipes);

  const issues: CorruptionIssue[] = [];

  for (const recipe of allRecipes) {
    // Check 1: Corrupted ingredients
    if (!recipe.ingredients || recipe.ingredients === '[]') {
      issues.push({
        recipeId: recipe.id,
        recipeName: recipe.name,
        source: recipe.source,
        issueType: 'empty_ingredients',
        details: 'Ingredients array is empty or null',
        severity: 'critical',
      });
    } else {
      try {
        const ingredientsArray = JSON.parse(recipe.ingredients);

        // Check for placeholder/invalid ingredients
        if (
          ingredientsArray.length === 1 &&
          (ingredientsArray[0] === '* *' ||
            ingredientsArray[0] === '*' ||
            ingredientsArray[0] === '' ||
            ingredientsArray[0].trim() === '')
        ) {
          issues.push({
            recipeId: recipe.id,
            recipeName: recipe.name,
            source: recipe.source,
            issueType: 'invalid_ingredients',
            details: `Ingredients contain placeholder: ${JSON.stringify(ingredientsArray)}`,
            severity: 'critical',
          });
        }
      } catch (_e) {
        issues.push({
          recipeId: recipe.id,
          recipeName: recipe.name,
          source: recipe.source,
          issueType: 'malformed_ingredients_json',
          details: 'Cannot parse ingredients JSON',
          severity: 'critical',
        });
      }
    }

    // Check 2: Empty or corrupted instructions
    if (!recipe.instructions || recipe.instructions === '[]') {
      issues.push({
        recipeId: recipe.id,
        recipeName: recipe.name,
        source: recipe.source,
        issueType: 'empty_instructions',
        details: 'Instructions array is empty or null',
        severity: 'critical',
      });
    }

    // Check 3: Malformed recipe names
    if (recipe.name.includes('\t') || recipe.name.includes('\n')) {
      issues.push({
        recipeId: recipe.id,
        recipeName: recipe.name,
        source: recipe.source,
        issueType: 'malformed_name',
        details: 'Recipe name contains tabs or newlines',
        severity: 'medium',
      });
    }

    // Check 4: Missing chef association for scraped recipes
    if (recipe.source?.includes('zerowastechef.com') && !recipe.chefId) {
      issues.push({
        recipeId: recipe.id,
        recipeName: recipe.name,
        source: recipe.source,
        issueType: 'missing_chef_association',
        details: 'Zero Waste Chef recipe missing chef_id',
        severity: 'high',
      });
    }

    // Check 5: Missing is_public for scraped recipes
    if (recipe.source && !recipe.userId && recipe.isPublic === null) {
      issues.push({
        recipeId: recipe.id,
        recipeName: recipe.name,
        source: recipe.source,
        issueType: 'missing_is_public',
        details: 'Scraped recipe has null is_public field',
        severity: 'high',
      });
    }
  }

  // Summary
  console.log('======================================================================');
  console.log('CORRUPTION SCAN SUMMARY');
  console.log('======================================================================');
  console.log(`Total recipes scanned: ${allRecipes.length}`);
  console.log(`Issues found: ${issues.length}`);
  console.log(`Recipes affected: ${new Set(issues.map((i) => i.recipeId)).size}\n`);

  // Group by severity
  const critical = issues.filter((i) => i.severity === 'critical');
  const high = issues.filter((i) => i.severity === 'high');
  const medium = issues.filter((i) => i.severity === 'medium');

  console.log(
    `🔴 Critical: ${critical.length} issues (${new Set(critical.map((i) => i.recipeId)).size} recipes)`
  );
  console.log(
    `🟡 High: ${high.length} issues (${new Set(high.map((i) => i.recipeId)).size} recipes)`
  );
  console.log(
    `🟢 Medium: ${medium.length} issues (${new Set(medium.map((i) => i.recipeId)).size} recipes)\n`
  );

  // Group by issue type
  const byType = issues.reduce(
    (acc, issue) => {
      acc[issue.issueType] = (acc[issue.issueType] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  console.log('Issue breakdown:');
  Object.entries(byType)
    .sort(([, a], [, b]) => b - a)
    .forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });

  // Show sample of critical issues
  if (critical.length > 0) {
    console.log('\n======================================================================');
    console.log('CRITICAL ISSUES (Sample - First 10)');
    console.log('======================================================================');
    critical.slice(0, 10).forEach((issue, idx) => {
      console.log(`\n${idx + 1}. Recipe: ${issue.recipeName}`);
      console.log(`   ID: ${issue.recipeId}`);
      console.log(`   Source: ${issue.source || 'N/A'}`);
      console.log(`   Issue: ${issue.issueType}`);
      console.log(`   Details: ${issue.details}`);
      console.log(`   URL: http://localhost:3002/recipes/${issue.recipeId}`);
    });
  }

  // Save to file
  const reportPath = 'tmp/recipe-corruption-report.json';
  const fs = await import('node:fs/promises');
  await fs.writeFile(
    reportPath,
    JSON.stringify(
      {
        scanDate: new Date().toISOString(),
        totalRecipes: allRecipes.length,
        totalIssues: issues.length,
        recipesAffected: new Set(issues.map((i) => i.recipeId)).size,
        summary: { critical: critical.length, high: high.length, medium: medium.length },
        issuesByType: byType,
        issues: issues,
      },
      null,
      2
    )
  );

  console.log(`\n📄 Full report saved to: ${reportPath}\n`);

  process.exit(0);
}

detectCorruptedRecipes();
