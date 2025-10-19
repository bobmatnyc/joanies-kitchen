#!/usr/bin/env tsx
/**
 * Add Roasted Tomato Soup to a meal
 * This creates a meal relationship so we can then generate images for all recipes in that meal
 */

import 'dotenv/config';
import { db } from '@/lib/db';
import { recipes, meals, mealRecipes } from '@/lib/db/schema';
import { eq, or } from 'drizzle-orm';

async function main() {
  console.log('\n🍲 Adding Roasted Tomato Soup to Meal');
  console.log('═'.repeat(80));

  // Step 1: Find Roasted Tomato Soup
  console.log('\n🔍 Finding Roasted Tomato Soup...');

  const tomatoSoupRecipes = await db
    .select()
    .from(recipes)
    .where(or(
      eq(recipes.name, 'Roasted Tomato Soup'),
      eq(recipes.name, 'roasted tomato soup')
    ))
    .limit(1);

  if (tomatoSoupRecipes.length === 0) {
    console.error('❌ Roasted Tomato Soup not found');
    process.exit(1);
  }

  const tomatoSoup = tomatoSoupRecipes[0];
  console.log(`✅ Found: ${tomatoSoup.name} (ID: ${tomatoSoup.id})`);

  // Step 2: Find a suitable meal to add it to
  console.log('\n🍽️  Finding suitable meal...');

  const healthyWeekMeals = await db
    .select()
    .from(meals)
    .where(eq(meals.name, 'Healthy Week Meal Plan'))
    .limit(1);

  if (healthyWeekMeals.length === 0) {
    console.error('❌ No suitable meal found');
    process.exit(1);
  }

  const targetMeal = healthyWeekMeals[0];
  console.log(`✅ Selected meal: ${targetMeal.name} (ID: ${targetMeal.id})`);

  // Step 3: Check if already added
  const existing = await db
    .select()
    .from(mealRecipes)
    .where(
      eq(mealRecipes.meal_id, targetMeal.id),
    )
    .limit(100);

  const existingRecipeIds = existing.map(mr => mr.recipe_id);

  if (existingRecipeIds.includes(tomatoSoup.id)) {
    console.log(`\n✅ Roasted Tomato Soup is already in this meal!`);
    process.exit(0);
  }

  // Step 4: Get current max display_order
  const maxOrder = Math.max(0, ...existing.map(mr => mr.display_order || 0));

  // Step 5: Add to meal
  console.log('\n➕ Adding Roasted Tomato Soup to meal...');

  const [newMealRecipe] = await db
    .insert(mealRecipes)
    .values({
      meal_id: targetMeal.id,
      recipe_id: tomatoSoup.id,
      course_category: 'soup',
      display_order: maxOrder + 1,
      serving_multiplier: '1.00',
    })
    .returning();

  console.log(`✅ Successfully added!`);
  console.log(`   Meal Recipe ID: ${newMealRecipe.id}`);
  console.log(`   Course Category: ${newMealRecipe.course_category}`);
  console.log(`   Display Order: ${newMealRecipe.display_order}`);

  // Step 6: Show updated meal
  console.log('\n📋 Updated meal recipes:');

  const updatedMealRecipes = await db
    .select({ recipe: recipes })
    .from(mealRecipes)
    .innerJoin(recipes, eq(mealRecipes.recipe_id, recipes.id))
    .where(eq(mealRecipes.meal_id, targetMeal.id));

  updatedMealRecipes.forEach((mr, i) => {
    console.log(`   ${i + 1}. ${mr.recipe.name}`);
  });

  console.log('\n✅ Done! Now you can run the image generation script:');
  console.log(`   pnpm tsx scripts/generate-meal-recipe-images-flexible.ts "Healthy Week Meal Plan"`);
  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
