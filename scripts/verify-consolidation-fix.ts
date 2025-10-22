/**
 * Verify Consolidation Fix Results
 *
 * Validates database integrity after running the duplicate constraint fix:
 * - Check for remaining duplicate constraint violations
 * - Verify all recipe_ingredients reference valid ingredients
 * - Count ingredients before/after
 * - Validate no data corruption
 *
 * Usage: tsx scripts/verify-consolidation-fix.ts
 */

import { db, cleanup } from './db-with-transactions';
import { ingredients, recipeIngredients } from '../src/lib/db/ingredients-schema';
import { sql } from 'drizzle-orm';

interface VerificationResults {
  ingredientCount: number;
  recipeIngredientCount: number;
  duplicateConstraintViolations: number;
  orphanedRecipeIngredients: number;
  recipesWithMultiplePositions: number;
  nullIngredientReferences: number;
  validationPassed: boolean;
  issues: string[];
}

async function verifyConsolidationFix(): Promise<VerificationResults> {
  const results: VerificationResults = {
    ingredientCount: 0,
    recipeIngredientCount: 0,
    duplicateConstraintViolations: 0,
    orphanedRecipeIngredients: 0,
    recipesWithMultiplePositions: 0,
    nullIngredientReferences: 0,
    validationPassed: true,
    issues: [],
  };

  console.log('🔍 Verifying Consolidation Fix Results\n');
  console.log('═'.repeat(60));

  // Test 1: Count ingredients
  console.log('\n[Test 1/6] Counting ingredients...');
  const ingredientCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM ingredients`);
  results.ingredientCount = Number(ingredientCountResult.rows[0].count);
  console.log(`   ✓ Total ingredients: ${results.ingredientCount}`);

  // Test 2: Count recipe_ingredients
  console.log('\n[Test 2/6] Counting recipe_ingredients...');
  const recipeIngredientCountResult = await db.execute(
    sql`SELECT COUNT(*) as count FROM recipe_ingredients`
  );
  results.recipeIngredientCount = Number(recipeIngredientCountResult.rows[0].count);
  console.log(`   ✓ Total recipe_ingredients: ${results.recipeIngredientCount}`);

  // Test 3: Check for duplicate constraint violations
  console.log('\n[Test 3/6] Checking for duplicate constraint violations...');
  const duplicateViolations = await db.execute(sql`
    SELECT recipe_id, ingredient_id, position, COUNT(*) as count
    FROM recipe_ingredients
    GROUP BY recipe_id, ingredient_id, position
    HAVING COUNT(*) > 1
  `);

  results.duplicateConstraintViolations = duplicateViolations.rows.length;

  if (results.duplicateConstraintViolations === 0) {
    console.log(`   ✅ No duplicate constraint violations found`);
  } else {
    console.log(`   ❌ Found ${results.duplicateConstraintViolations} duplicate constraint violations`);
    results.validationPassed = false;
    results.issues.push(`${results.duplicateConstraintViolations} duplicate constraint violations detected`);

    // Show first 5 violations
    console.log('\n   First 5 violations:');
    duplicateViolations.rows.slice(0, 5).forEach((row: any) => {
      console.log(`      - Recipe: ${row.recipe_id}, Ingredient: ${row.ingredient_id}, Position: ${row.position}, Count: ${row.count}`);
    });
  }

  // Test 4: Check for orphaned recipe_ingredients (ingredient_id doesn't exist)
  console.log('\n[Test 4/6] Checking for orphaned recipe_ingredients...');
  const orphanedRecipeIngredients = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM recipe_ingredients ri
    LEFT JOIN ingredients i ON ri.ingredient_id = i.id
    WHERE i.id IS NULL
  `);

  results.orphanedRecipeIngredients = Number(orphanedRecipeIngredients.rows[0].count);

  if (results.orphanedRecipeIngredients === 0) {
    console.log(`   ✅ No orphaned recipe_ingredients found`);
  } else {
    console.log(`   ❌ Found ${results.orphanedRecipeIngredients} orphaned recipe_ingredients`);
    results.validationPassed = false;
    results.issues.push(`${results.orphanedRecipeIngredients} recipe_ingredients reference non-existent ingredients`);

    // Show orphaned IDs
    const orphanedIds = await db.execute(sql`
      SELECT DISTINCT ri.ingredient_id
      FROM recipe_ingredients ri
      LEFT JOIN ingredients i ON ri.ingredient_id = i.id
      WHERE i.id IS NULL
      LIMIT 10
    `);

    console.log('\n   Orphaned ingredient IDs (first 10):');
    orphanedIds.rows.forEach((row: any) => {
      console.log(`      - ${row.ingredient_id}`);
    });
  }

  // Test 5: Check for recipes with same ingredient at multiple positions
  console.log('\n[Test 5/6] Checking recipes with same ingredient at multiple positions...');
  const multiplePositions = await db.execute(sql`
    SELECT recipe_id, ingredient_id, COUNT(DISTINCT position) as position_count
    FROM recipe_ingredients
    GROUP BY recipe_id, ingredient_id
    HAVING COUNT(DISTINCT position) > 1
  `);

  results.recipesWithMultiplePositions = multiplePositions.rows.length;

  console.log(`   ℹ️  Found ${results.recipesWithMultiplePositions} recipe-ingredient pairs with multiple positions`);
  console.log(`      (This is normal - recipes can use same ingredient multiple times)`);

  if (results.recipesWithMultiplePositions > 0 && results.recipesWithMultiplePositions < 50) {
    console.log('\n   Examples (first 5):');
    multiplePositions.rows.slice(0, 5).forEach((row: any) => {
      console.log(`      - Recipe: ${row.recipe_id.slice(0, 8)}..., Ingredient: ${row.ingredient_id.slice(0, 8)}..., Positions: ${row.position_count}`);
    });
  }

  // Test 6: Check for null ingredient_id references
  console.log('\n[Test 6/6] Checking for null ingredient_id references...');
  const nullReferences = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM recipe_ingredients
    WHERE ingredient_id IS NULL
  `);

  results.nullIngredientReferences = Number(nullReferences.rows[0].count);

  if (results.nullIngredientReferences === 0) {
    console.log(`   ✅ No null ingredient_id references found`);
  } else {
    console.log(`   ❌ Found ${results.nullIngredientReferences} null ingredient_id references`);
    results.validationPassed = false;
    results.issues.push(`${results.nullIngredientReferences} recipe_ingredients have null ingredient_id`);
  }

  return results;
}

async function main() {
  try {
    const results = await verifyConsolidationFix();

    // Print final summary
    console.log('\n═'.repeat(60));
    console.log('\n📊 Verification Summary\n');

    console.log('Database Counts:');
    console.log(`   - Ingredients: ${results.ingredientCount}`);
    console.log(`   - Recipe Ingredients: ${results.recipeIngredientCount}\n`);

    console.log('Integrity Checks:');
    console.log(`   - Duplicate constraint violations: ${results.duplicateConstraintViolations}`);
    console.log(`   - Orphaned recipe_ingredients: ${results.orphanedRecipeIngredients}`);
    console.log(`   - Null ingredient_id references: ${results.nullIngredientReferences}`);
    console.log(`   - Recipes with multiple positions: ${results.recipesWithMultiplePositions} (normal)\n`);

    if (results.validationPassed) {
      console.log('✅ VALIDATION PASSED - Database integrity is good!\n');
    } else {
      console.log('❌ VALIDATION FAILED - Issues detected:\n');
      results.issues.forEach((issue, idx) => {
        console.log(`   ${idx + 1}. ${issue}`);
      });
      console.log('\n⚠️  Database may require manual intervention\n');
    }

    await cleanup();

    // Exit with appropriate code
    process.exit(results.validationPassed ? 0 : 1);
  } catch (error) {
    console.error('❌ Error during verification:', error);
    await cleanup();
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { verifyConsolidationFix };
export type { VerificationResults };
