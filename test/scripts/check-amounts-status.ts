/**
 * Check Ingredient Amounts Status
 * Quick script to see how many recipes need amount fixes
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';

function hasAmount(ingredient: string): boolean {
  const trimmed = ingredient.trim();
  return /^[\d½¼¾⅓⅔⅛⅜⅝⅞]|^(a |an |one |two |three |some |few |several )/i.test(trimmed);
}

async function checkStatus() {
  console.log('📊 Ingredient Amounts Status Report\n');
  console.log(`${'━'.repeat(60)}\n`);

  // Get all recipes
  const allRecipes = await db
    .select({
      id: recipes.id,
      name: recipes.name,
      ingredients: recipes.ingredients,
    })
    .from(recipes);

  let totalRecipes = 0;
  let recipesNeedingFixes = 0;
  let recipesComplete = 0;
  let recipesWithErrors = 0;
  let totalIngredients = 0;
  let ingredientsMissingAmounts = 0;

  const needsFixing: Array<{ id: string; name: string; missing: number; total: number }> = [];

  for (const recipe of allRecipes) {
    totalRecipes++;

    try {
      const ingredients = JSON.parse(recipe.ingredients as string);
      if (!Array.isArray(ingredients)) continue;

      totalIngredients += ingredients.length;
      const missingAmounts = ingredients.filter((ing) => !hasAmount(ing));
      ingredientsMissingAmounts += missingAmounts.length;

      if (missingAmounts.length > 0) {
        recipesNeedingFixes++;
        needsFixing.push({
          id: recipe.id,
          name: recipe.name,
          missing: missingAmounts.length,
          total: ingredients.length,
        });
      } else {
        recipesComplete++;
      }
    } catch (_error) {
      recipesWithErrors++;
    }
  }

  // Print summary
  console.log('📈 Overall Statistics:');
  console.log(`  Total recipes: ${totalRecipes}`);
  console.log(
    `  ✅ Complete (all have amounts): ${recipesComplete} (${((recipesComplete / totalRecipes) * 100).toFixed(1)}%)`
  );
  console.log(
    `  ⚠️  Need fixing: ${recipesNeedingFixes} (${((recipesNeedingFixes / totalRecipes) * 100).toFixed(1)}%)`
  );
  console.log(`  ✗ Parsing errors: ${recipesWithErrors}`);
  console.log();
  console.log(`  Total ingredients: ${totalIngredients}`);
  console.log(
    `  Missing amounts: ${ingredientsMissingAmounts} (${((ingredientsMissingAmounts / totalIngredients) * 100).toFixed(1)}%)`
  );
  console.log();

  // Check progress file
  const progressFile = path.join(process.cwd(), 'tmp', 'ingredient-amounts-progress.json');
  if (fs.existsSync(progressFile)) {
    try {
      const progress = JSON.parse(fs.readFileSync(progressFile, 'utf-8'));
      console.log('💾 Saved Progress:');
      console.log(`  Processed: ${progress.processed}/${progress.total}`);
      console.log(`  Updated: ${progress.updated}`);
      console.log(`  Skipped: ${progress.skipped}`);
      console.log(`  Failed: ${progress.failed}`);
      console.log(`  Last processed ID: ${progress.lastProcessedId}`);
      console.log();
    } catch (_error) {
      console.log('⚠️  Could not read progress file\n');
    }
  } else {
    console.log('📝 No progress file found (not started or completed)\n');
  }

  // Show sample of recipes needing fixes
  if (needsFixing.length > 0) {
    console.log(`${'━'.repeat(60)}\n`);
    console.log('📋 Sample of Recipes Needing Fixes (first 10):\n');

    needsFixing.slice(0, 10).forEach((recipe, i) => {
      const percentage = ((recipe.missing / recipe.total) * 100).toFixed(0);
      console.log(`${i + 1}. ${recipe.name}`);
      console.log(`   ID: ${recipe.id}`);
      console.log(`   Missing: ${recipe.missing}/${recipe.total} ingredients (${percentage}%)`);
      console.log();
    });

    if (needsFixing.length > 10) {
      console.log(`... and ${needsFixing.length - 10} more recipes\n`);
    }
  }

  // Estimate time/cost
  if (recipesNeedingFixes > 0) {
    console.log(`${'━'.repeat(60)}\n`);
    console.log('⏱️  Estimated Processing Time/Cost:\n');
    console.log('Option 1: Batch Overnight (Free)');
    console.log(
      `  Time: ${Math.ceil(recipesNeedingFixes * 0.5)} - ${Math.ceil(recipesNeedingFixes * 1)} minutes (~${(recipesNeedingFixes / 100).toFixed(1)} hours)`
    );
    console.log(`  Cost: $0\n`);

    console.log('Option 2: Anthropic Direct API');
    console.log(
      `  Time: ${Math.ceil((recipesNeedingFixes / 600) * 60)} - ${Math.ceil((recipesNeedingFixes / 300) * 60)} minutes`
    );
    console.log(
      `  Cost: $${(recipesNeedingFixes * 0.0004).toFixed(2)} - $${(recipesNeedingFixes * 0.0006).toFixed(2)}\n`
    );

    console.log('Option 3: OpenRouter Paid Credits');
    console.log(
      `  Time: ${Math.ceil((recipesNeedingFixes / 500) * 60)} - ${Math.ceil((recipesNeedingFixes / 300) * 60)} minutes`
    );
    console.log(
      `  Cost: $${(recipesNeedingFixes * 0.0003).toFixed(2)} - $${(recipesNeedingFixes * 0.0005).toFixed(2)}\n`
    );
  }

  console.log('━'.repeat(60));
}

checkStatus()
  .then(() => {
    console.log('\n✅ Status check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
