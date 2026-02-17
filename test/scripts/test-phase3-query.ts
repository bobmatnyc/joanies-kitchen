/**
 * Test Phase 3 Database Query Fix
 *
 * Validates that the inArray() fix works correctly
 */

import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { inArray } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function testQuery() {
  console.log('🧪 Testing Phase 3 Database Query Fix\n');

  // Load Phase 1 structure report
  const tmpDir = path.join(process.cwd(), 'tmp');
  const structureReportPath = path.join(tmpDir, 'qa-structure-report.json');

  if (!fs.existsSync(structureReportPath)) {
    console.error('❌ Error: Structure report not found');
    console.error('   Please run Phase 1 first: pnpm tsx scripts/qa-recipe-structure.ts');
    process.exit(1);
  }

  const structureReport = JSON.parse(fs.readFileSync(structureReportPath, 'utf-8'));
  const missingIngredientsIds = structureReport.critical_issues.missing_ingredients.map(
    (item: any) => item.id
  );

  console.log(`📋 Found ${missingIngredientsIds.length} recipes with missing ingredients`);
  console.log(`🔍 Testing query with first 5 IDs: ${missingIngredientsIds.slice(0, 5).join(', ')}\n`);

  // Test the fixed query
  try {
    const testRecipes = await db.select({
      id: recipes.id,
      name: recipes.name,
      ingredients: recipes.ingredients,
      instructions: recipes.instructions,
    }).from(recipes).where(
      inArray(recipes.id, missingIngredientsIds.slice(0, 5))
    );

    console.log(`✅ Query successful! Retrieved ${testRecipes.length} recipes\n`);

    // Display results
    testRecipes.forEach((recipe, idx) => {
      console.log(`${idx + 1}. ${recipe.name}`);
      console.log(`   ID: ${recipe.id}`);
      const ingredientsArray = JSON.parse(recipe.ingredients);
      console.log(`   Ingredients: ${Array.isArray(ingredientsArray) ? ingredientsArray.length : 'Invalid'}`);
      console.log('');
    });

    console.log('🎉 Phase 3 database query fix verified!\n');
    return true;
  } catch (error) {
    console.error('❌ Query failed:', error);
    return false;
  }
}

// Run test
testQuery()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('❌ Test error:', error);
    process.exit(1);
  });
