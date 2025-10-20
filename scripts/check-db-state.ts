#!/usr/bin/env tsx
/**
 * Check Database State for Fridge Feature
 *
 * Checks if the ingredients and recipe_ingredients tables are populated
 */

import { db } from '../src/lib/db/index.js';
import { recipes } from '../src/lib/db/schema.js';
import { ingredients, recipeIngredients } from '../src/lib/db/ingredients-schema.js';
import { eq, or, sql } from 'drizzle-orm';

async function checkDatabaseState() {
  console.log('🔍 Checking Database State for Fridge Feature...\n');

  try {
    // Check ingredients table
    const ingredientsCount = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(ingredients);

    console.log(`📦 Ingredients Table: ${ingredientsCount[0]?.count || 0} records`);

    // Check recipe_ingredients table
    const recipeIngredientsCount = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(recipeIngredients);

    console.log(`🔗 Recipe Ingredients Links: ${recipeIngredientsCount[0]?.count || 0} records`);

    // Check public/system recipes
    const publicRecipesCount = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(recipes)
      .where(
        or(
          eq(recipes.is_public, true),
          eq(recipes.is_system_recipe, true)
        )
      );

    console.log(`📖 Public/System Recipes: ${publicRecipesCount[0]?.count || 0} records`);

    // Check total recipes
    const totalRecipesCount = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(recipes);

    console.log(`📚 Total Recipes: ${totalRecipesCount[0]?.count || 0} records\n`);

    // Sample some ingredients
    if (ingredientsCount[0]?.count > 0) {
      const sampleIngredients = await db
        .select()
        .from(ingredients)
        .limit(10);

      console.log('📋 Sample Ingredients:');
      sampleIngredients.forEach((ing, idx) => {
        console.log(`  ${idx + 1}. ${ing.display_name} (${ing.name}) - Category: ${ing.category}`);
      });
      console.log('');
    }

    // Check if any recipes have ingredients linked
    if (recipeIngredientsCount[0]?.count > 0) {
      const sampleLinks = await db
        .select({
          recipeId: recipeIngredients.recipe_id,
          count: sql<number>`COUNT(*)::int`,
        })
        .from(recipeIngredients)
        .groupBy(recipeIngredients.recipe_id)
        .limit(5);

      console.log('🔗 Sample Recipe-Ingredient Links:');
      for (const link of sampleLinks) {
        const recipe = await db
          .select({ name: recipes.name })
          .from(recipes)
          .where(eq(recipes.id, link.recipeId))
          .limit(1);

        console.log(`  Recipe: "${recipe[0]?.name}" has ${link.count} ingredients linked`);
      }
      console.log('');
    }

    // Diagnosis
    console.log('🔍 DIAGNOSIS:');
    if (ingredientsCount[0]?.count === 0) {
      console.log('  ❌ PROBLEM: ingredients table is EMPTY');
      console.log('  💡 Solution: Run ingredient seeding/migration script');
    }

    if (recipeIngredientsCount[0]?.count === 0) {
      console.log('  ❌ PROBLEM: recipe_ingredients table is EMPTY');
      console.log('  💡 Solution: Run ingredient extraction/migration script');
    }

    if (publicRecipesCount[0]?.count === 0) {
      console.log('  ❌ PROBLEM: No public or system recipes available');
      console.log('  💡 Solution: Create/import public recipes or mark existing recipes as public');
    }

    if (
      ingredientsCount[0]?.count > 0 &&
      recipeIngredientsCount[0]?.count > 0 &&
      publicRecipesCount[0]?.count > 0
    ) {
      console.log('  ✅ Database looks healthy for fridge feature!');
    }

  } catch (error) {
    console.error('❌ Error checking database state:', error);
    process.exit(1);
  }
}

checkDatabaseState();
