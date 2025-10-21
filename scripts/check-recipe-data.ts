#!/usr/bin/env tsx
/**
 * Quick diagnostic script to check recipe and ingredient data
 */

import { db } from '../src/lib/db/index';
import { recipes } from '../src/lib/db/schema';
import { ingredients, recipeIngredients } from '../src/lib/db/ingredients-schema';
import { sql } from 'drizzle-orm';

async function checkData() {
  console.log('🔍 Checking Recipe Database...\n');

  // Count total recipes
  const recipeCount = await db.select({ count: sql<number>`count(*)` }).from(recipes);
  console.log(`📚 Total Recipes: ${recipeCount[0].count}`);

  // Count public recipes
  const publicRecipeCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(recipes)
    .where(sql`${recipes.is_public} = true`);
  console.log(`🌍 Public Recipes: ${publicRecipeCount[0].count}`);

  // Count total ingredients
  const ingredientCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(ingredients);
  console.log(`🥕 Total Ingredients: ${ingredientCount[0].count}`);

  // Count recipe-ingredient relationships
  const recipeIngredientCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(recipeIngredients);
  console.log(`🔗 Recipe-Ingredient Links: ${recipeIngredientCount[0].count}`);

  // Sample a few ingredients
  console.log('\n📝 Sample Ingredients:');
  const sampleIngredients = await db
    .select({ name: ingredients.name })
    .from(ingredients)
    .limit(10);
  sampleIngredients.forEach((ing, idx) => {
    console.log(`  ${idx + 1}. ${ing.name}`);
  });

  // Check if ingredients table is properly linked
  const linkedRecipes = await db
    .select({
      recipeId: recipeIngredients.recipe_id,
      ingredientName: ingredients.name,
    })
    .from(recipeIngredients)
    .innerJoin(ingredients, sql`${recipeIngredients.ingredient_id} = ${ingredients.id}`)
    .limit(5);

  console.log('\n🔗 Sample Recipe-Ingredient Links:');
  linkedRecipes.forEach((link, idx) => {
    console.log(`  ${idx + 1}. Recipe ${link.recipeId} uses ${link.ingredientName}`);
  });

  process.exit(0);
}

checkData().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
