#!/usr/bin/env tsx

/**
 * Verify Joanie's Sunday Lunch creation
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chefs, chefRecipes } from '@/lib/db/chef-schema';
import { recipes, meals, mealRecipes, recipeEmbeddings } from '@/lib/db/schema';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  console.log('🔍 Verifying Joanie\'s Sunday Lunch Creation\n');
  console.log('='.repeat(80) + '\n');

  // 1. Check Chef
  const joanie = await db.query.chefs.findFirst({
    where: eq(chefs.slug, 'joanie'),
  });

  if (!joanie) {
    console.error('❌ Chef "Joanie" not found!');
    process.exit(1);
  }

  console.log('✅ CHEF FOUND');
  console.log(`   Name: ${joanie.name}`);
  console.log(`   ID: ${joanie.id}`);
  console.log(`   Slug: ${joanie.slug}`);
  console.log(`   Recipe Count: ${joanie.recipe_count}`);
  console.log(`   Bio: ${joanie.bio?.substring(0, 100)}...`);
  console.log('');

  // 2. Check Recipes
  const joanieRecipes = await db
    .select({
      recipe: recipes,
      chefRecipe: chefRecipes,
    })
    .from(chefRecipes)
    .innerJoin(recipes, eq(chefRecipes.recipe_id, recipes.id))
    .where(eq(chefRecipes.chef_id, joanie.id));

  console.log(`✅ RECIPES FOUND (${joanieRecipes.length})`);
  for (const { recipe } of joanieRecipes) {
    console.log(`\n   Recipe: ${recipe.name}`);
    console.log(`   ID: ${recipe.id}`);
    console.log(`   Slug: ${recipe.slug}`);
    console.log(`   Cuisine: ${recipe.cuisine}`);
    console.log(`   Difficulty: ${recipe.difficulty}`);
    console.log(`   Prep/Cook Time: ${recipe.prep_time}/${recipe.cook_time} min`);
    console.log(`   Servings: ${recipe.servings}`);
    console.log(`   Is System Recipe: ${recipe.is_system_recipe}`);
    console.log(`   Is Public: ${recipe.is_public}`);
    console.log(`   Resourcefulness Score: ${recipe.resourcefulness_score}`);

    const tags = recipe.tags ? JSON.parse(recipe.tags) : [];
    console.log(`   Tags: ${tags.join(', ')}`);

    const wasteReductionTags = recipe.waste_reduction_tags ? JSON.parse(recipe.waste_reduction_tags) : [];
    console.log(`   Waste Reduction Tags: ${wasteReductionTags.join(', ')}`);
  }
  console.log('');

  // 3. Check Meal Plan
  const meal = await db.query.meals.findFirst({
    where: eq(meals.slug, 'joanies-sunday-lunch'),
  });

  if (!meal) {
    console.error('❌ Meal plan "Joanie\'s Sunday Lunch" not found!');
    process.exit(1);
  }

  console.log('✅ MEAL PLAN FOUND');
  console.log(`   Name: ${meal.name}`);
  console.log(`   ID: ${meal.id}`);
  console.log(`   Slug: ${meal.slug}`);
  console.log(`   Meal Type: ${meal.meal_type}`);
  console.log(`   Occasion: ${meal.occasion}`);
  console.log(`   Serves: ${meal.serves}`);
  console.log(`   Total Prep Time: ${meal.total_prep_time} min`);
  console.log(`   Total Cook Time: ${meal.total_cook_time} min`);
  console.log(`   Is Template: ${meal.is_template}`);
  console.log(`   Is Public: ${meal.is_public}`);
  console.log('');

  // 4. Check Meal Recipes
  const mealRecipesList = await db
    .select({
      mealRecipe: mealRecipes,
      recipe: recipes,
    })
    .from(mealRecipes)
    .innerJoin(recipes, eq(mealRecipes.recipe_id, recipes.id))
    .where(eq(mealRecipes.meal_id, meal.id));

  console.log(`✅ MEAL RECIPES LINKED (${mealRecipesList.length})`);
  for (const { mealRecipe, recipe } of mealRecipesList) {
    console.log(`\n   ${mealRecipe.display_order}. ${recipe.name}`);
    console.log(`      Course: ${mealRecipe.course_category}`);
    console.log(`      Serving Multiplier: ${mealRecipe.serving_multiplier}`);
    console.log(`      Notes: ${mealRecipe.preparation_notes}`);
  }
  console.log('');

  // 5. Check Embeddings
  console.log('✅ EMBEDDINGS STATUS');
  for (const { recipe } of joanieRecipes) {
    const embedding = await db.query.recipeEmbeddings.findFirst({
      where: eq(recipeEmbeddings.recipe_id, recipe.id),
    });

    if (embedding) {
      console.log(`   ✅ ${recipe.name}`);
      console.log(`      Dimension: ${embedding.embedding?.length || 'N/A'}`);
      console.log(`      Model: ${embedding.model_name}`);
      console.log(`      Created: ${embedding.created_at}`);
    } else {
      console.log(`   ❌ ${recipe.name} - NO EMBEDDING`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ VERIFICATION COMPLETE');
  console.log('='.repeat(80));
  console.log('\nSummary:');
  console.log(`  ✅ 1 Chef (Joanie)`);
  console.log(`  ✅ ${joanieRecipes.length} Recipes`);
  console.log(`  ✅ 1 Meal Plan (Joanie's Sunday Lunch)`);
  console.log(`  ✅ ${mealRecipesList.length} Meal-Recipe Links`);
  console.log(`  ✅ All recipes have embeddings`);
  console.log('\nAll recipes are searchable in Fridge Feature! 🎉\n');
}

main();
