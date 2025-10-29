#!/usr/bin/env tsx
/**
 * Debug Recipe Script
 *
 * Diagnoses issues with recipe pages by checking data integrity.
 *
 * Usage:
 *   tsx scripts/debug-recipe.ts [slug]
 *
 * Example:
 *   tsx scripts/debug-recipe.ts salmon-eggs-eggs-benedict
 */

import { eq } from 'drizzle-orm';
import { recipeIngredients } from '../src/lib/db/ingredients-schema';
import { recipes } from '../src/lib/db/schema';
import { cleanup, db } from './db-with-transactions';

interface DiagnosticIssue {
  severity: 'ERROR' | 'WARNING' | 'INFO';
  message: string;
}

async function debugRecipe(slug: string) {
  const issues: DiagnosticIssue[] = [];

  console.log('='.repeat(70));
  console.log('Recipe Debug Diagnostic');
  console.log('='.repeat(70));
  console.log(`Target Slug: ${slug}`);
  console.log();

  try {
    // 1. Fetch recipe by slug
    console.log('1. Fetching recipe...');
    const recipe = await db.query.recipes.findFirst({
      where: eq(recipes.slug, slug),
    });

    if (!recipe) {
      console.log('❌ CRITICAL: Recipe not found!');
      console.log(`   No recipe exists with slug: "${slug}"`);
      return;
    }

    console.log('✅ Recipe found');
    console.log();

    // Display basic recipe info
    console.log('Recipe Information:');
    console.log('-'.repeat(70));
    console.log(`  ID:          ${recipe.id}`);
    console.log(`  Name:        ${recipe.name}`);
    console.log(`  User ID:     ${recipe.user_id}`);
    console.log(`  Is Public:   ${recipe.is_public}`);
    console.log(`  Is System:   ${recipe.is_system_recipe}`);
    console.log(`  Created:     ${recipe.created_at}`);
    console.log();

    // 2. Check ingredients JSON
    console.log('2. Checking ingredients field...');
    try {
      const ingredientsData = recipe.ingredients ? JSON.parse(recipe.ingredients) : null;
      if (!ingredientsData) {
        issues.push({
          severity: 'ERROR',
          message: 'Ingredients field is null or empty',
        });
      } else if (!Array.isArray(ingredientsData)) {
        issues.push({
          severity: 'ERROR',
          message: 'Ingredients field is not an array',
        });
      } else {
        console.log(`✅ Valid JSON (${ingredientsData.length} items)`);

        // Check for legacy object format
        if (
          ingredientsData.length > 0 &&
          typeof ingredientsData[0] === 'object' &&
          ingredientsData[0] !== null
        ) {
          if ('item' in ingredientsData[0] && 'quantity' in ingredientsData[0]) {
            issues.push({
              severity: 'INFO',
              message:
                'Recipe uses legacy object format [{item, quantity}] - parseRecipe handles this automatically',
            });
            console.log(`ℹ️  Legacy object format detected (handled by parseRecipe)`);
          }
        }

        if (ingredientsData.length === 0) {
          issues.push({
            severity: 'WARNING',
            message: 'Ingredients array is empty',
          });
        }
      }
    } catch (error) {
      issues.push({
        severity: 'ERROR',
        message: `Ingredients JSON parse error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      console.log(`❌ Invalid JSON`);
    }
    console.log();

    // 3. Check instructions JSON
    console.log('3. Checking instructions field...');
    try {
      const instructionsData = recipe.instructions ? JSON.parse(recipe.instructions) : null;
      if (!instructionsData) {
        issues.push({
          severity: 'ERROR',
          message: 'Instructions field is null or empty',
        });
      } else if (!Array.isArray(instructionsData)) {
        issues.push({
          severity: 'ERROR',
          message: 'Instructions field is not an array',
        });
      } else {
        console.log(`✅ Valid JSON (${instructionsData.length} steps)`);
        if (instructionsData.length === 0) {
          issues.push({
            severity: 'WARNING',
            message: 'Instructions array is empty',
          });
        }
      }
    } catch (error) {
      issues.push({
        severity: 'ERROR',
        message: `Instructions JSON parse error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      console.log(`❌ Invalid JSON`);
    }
    console.log();

    // 4. Check images JSON
    console.log('4. Checking images field...');
    try {
      if (recipe.images) {
        const imagesData = JSON.parse(recipe.images);
        if (!Array.isArray(imagesData)) {
          issues.push({
            severity: 'ERROR',
            message: 'Images field is not an array',
          });
        } else {
          console.log(`✅ Valid JSON (${imagesData.length} images)`);
        }
      } else {
        console.log(`ℹ️  No images field (null)`);
        issues.push({
          severity: 'INFO',
          message: 'Images field is null',
        });
      }
    } catch (error) {
      issues.push({
        severity: 'ERROR',
        message: `Images JSON parse error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      console.log(`❌ Invalid JSON`);
    }
    console.log();

    // 5. Check critical fields
    console.log('5. Checking critical fields...');
    const criticalFields = [
      { name: 'name', value: recipe.name },
      { name: 'description', value: recipe.description, optional: true },
      { name: 'user_id', value: recipe.user_id },
      { name: 'slug', value: recipe.slug },
    ];

    let criticalFieldsOk = true;
    for (const field of criticalFields) {
      if (!field.optional && (field.value === null || field.value === undefined)) {
        issues.push({
          severity: 'ERROR',
          message: `Critical field "${field.name}" is null or undefined`,
        });
        console.log(`❌ ${field.name}: null/undefined`);
        criticalFieldsOk = false;
      }
    }
    if (criticalFieldsOk) {
      console.log('✅ All critical fields present');
    }
    console.log();

    // 6. Check recipe_ingredients table
    console.log('6. Checking recipe_ingredients table...');
    const linkedIngredients = await db
      .select()
      .from(recipeIngredients)
      .where(eq(recipeIngredients.recipe_id, recipe.id));

    if (linkedIngredients.length === 0) {
      issues.push({
        severity: 'WARNING',
        message: 'No ingredients linked in recipe_ingredients table',
      });
      console.log('⚠️  No linked ingredients found');
    } else {
      console.log(`✅ ${linkedIngredients.length} ingredients linked`);

      // Check for orphaned references (using direct query)
      let orphanedCount = 0;
      for (const link of linkedIngredients) {
        const ingredientExists = await db.query.ingredients.findFirst({
          where: (ingredients, { eq }) => eq(ingredients.id, link.ingredient_id),
        });

        if (!ingredientExists) {
          orphanedCount++;
          issues.push({
            severity: 'ERROR',
            message: `Orphaned ingredient reference: ingredient_id ${link.ingredient_id} does not exist`,
          });
        }
      }

      if (orphanedCount > 0) {
        console.log(`❌ ${orphanedCount} orphaned ingredient references found`);
      } else {
        console.log('✅ No orphaned references');
      }
    }
    console.log();

    // 7. Check tags JSON
    console.log('7. Checking tags field...');
    try {
      if (recipe.tags) {
        const tagsData = JSON.parse(recipe.tags);
        if (!Array.isArray(tagsData)) {
          issues.push({
            severity: 'WARNING',
            message: 'Tags field is not an array',
          });
        } else {
          console.log(`✅ Valid JSON (${tagsData.length} tags)`);
        }
      } else {
        console.log(`ℹ️  No tags field (null)`);
      }
    } catch (error) {
      issues.push({
        severity: 'WARNING',
        message: `Tags JSON parse error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      console.log(`❌ Invalid JSON`);
    }
    console.log();

    // 8. Summary
    console.log('='.repeat(70));
    console.log('Diagnostic Summary');
    console.log('='.repeat(70));

    if (issues.length === 0) {
      console.log('✅ No issues found - recipe data appears valid!');
    } else {
      const errors = issues.filter((i) => i.severity === 'ERROR');
      const warnings = issues.filter((i) => i.severity === 'WARNING');
      const info = issues.filter((i) => i.severity === 'INFO');

      console.log(`Issues found: ${issues.length}`);
      console.log(`  Errors:   ${errors.length}`);
      console.log(`  Warnings: ${warnings.length}`);
      console.log(`  Info:     ${info.length}`);
      console.log();

      if (errors.length > 0) {
        console.log('ERRORS:');
        errors.forEach((issue, idx) => {
          console.log(`  ${idx + 1}. ${issue.message}`);
        });
        console.log();
      }

      if (warnings.length > 0) {
        console.log('WARNINGS:');
        warnings.forEach((issue, idx) => {
          console.log(`  ${idx + 1}. ${issue.message}`);
        });
        console.log();
      }

      if (info.length > 0) {
        console.log('INFO:');
        info.forEach((issue, idx) => {
          console.log(`  ${idx + 1}. ${issue.message}`);
        });
        console.log();
      }
    }

    console.log('='.repeat(70));
  } catch (error) {
    console.error('Fatal error during diagnostic:');
    console.error(error);
  } finally {
    await cleanup();
  }
}

// CLI execution
const slug = process.argv[2];

if (!slug) {
  console.error('Usage: tsx scripts/debug-recipe.ts <slug>');
  console.error('Example: tsx scripts/debug-recipe.ts salmon-eggs-eggs-benedict');
  process.exit(1);
}

debugRecipe(slug).catch(console.error);
