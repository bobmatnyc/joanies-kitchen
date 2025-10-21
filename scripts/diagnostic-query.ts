#!/usr/bin/env tsx
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';

async function runDiagnostics() {
  console.log('📊 Database Diagnostic Report\n');
  console.log('=' .repeat(80) + '\n');

  // Count recipes
  const recipeCount = await db.execute(sql`SELECT COUNT(*) as count FROM recipes`);
  console.log(`Total Recipes: ${recipeCount.rows[0].count}`);

  // Count ingredients
  const ingredientCount = await db.execute(sql`SELECT COUNT(*) as count FROM ingredients`);
  console.log(`Total Ingredients: ${ingredientCount.rows[0].count}`);

  // Count recipe-ingredient links
  const linkCount = await db.execute(sql`SELECT COUNT(*) as count FROM recipe_ingredients`);
  console.log(`Recipe-Ingredient Links: ${linkCount.rows[0].count}`);

  // Count recipes WITH extracted ingredients
  const recipesWithIngredients = await db.execute(sql`
    SELECT COUNT(DISTINCT recipe_id) as count
    FROM recipe_ingredients
  `);
  console.log(`Recipes WITH extracted ingredients: ${recipesWithIngredients.rows[0].count}`);

  // Calculate extraction coverage
  const totalRecipes = Number(recipeCount.rows[0].count);
  const extractedRecipes = Number(recipesWithIngredients.rows[0].count);
  const coverage = totalRecipes > 0 ? ((extractedRecipes / totalRecipes) * 100).toFixed(1) : 0;
  console.log(`\nExtraction Coverage: ${coverage}% (${extractedRecipes}/${totalRecipes})`);

  // Sample 10 recipes WITHOUT ingredients
  console.log('\n📋 Sample Recipes WITHOUT Ingredients:\n');
  const recipesWithout = await db.execute(sql`
    SELECT r.id, r.name, r.source, LEFT(r.ingredients, 100) as ingredients_preview
    FROM recipes r
    LEFT JOIN recipe_ingredients ri ON r.id = ri.recipe_id
    WHERE ri.id IS NULL
    LIMIT 10
  `);

  recipesWithout.rows.forEach((recipe: any, i: number) => {
    console.log(`${i + 1}. ${recipe.name}`);
    console.log(`   ID: ${recipe.id}`);
    console.log(`   Source: ${recipe.source || 'N/A'}`);
    console.log(`   Ingredients Preview: ${recipe.ingredients_preview}...`);
    console.log('');
  });

  // Sample 5 recipes WITH ingredients
  console.log('✅ Sample Recipes WITH Ingredients:\n');
  const recipesWith = await db.execute(sql`
    SELECT r.id, r.name, COUNT(ri.id) as ingredient_count
    FROM recipes r
    JOIN recipe_ingredients ri ON r.id = ri.recipe_id
    GROUP BY r.id, r.name
    LIMIT 5
  `);

  recipesWith.rows.forEach((recipe: any, i: number) => {
    console.log(`${i + 1}. ${recipe.name} (${recipe.ingredient_count} ingredients extracted)`);
  });

  // Check for extraction logs
  console.log('\n📁 Checking for extraction logs...\n');
  const fs = await import('fs/promises');
  const path = await import('path');
  const tmpDir = path.join(process.cwd(), 'tmp');

  try {
    const files = await fs.readdir(tmpDir);
    const extractionFiles = files.filter(f => f.includes('ingredient-extraction'));

    if (extractionFiles.length > 0) {
      console.log('Found extraction files:');
      extractionFiles.forEach(f => console.log(`  - ${f}`));
    } else {
      console.log('⚠️  No extraction log files found in tmp/');
    }
  } catch (error) {
    console.log('⚠️  tmp/ directory does not exist');
  }

  process.exit(0);
}

runDiagnostics().catch(console.error);
