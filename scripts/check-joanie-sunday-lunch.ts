import { db } from '../src/lib/db';
import { meals, mealRecipes } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function checkMeal() {
  console.log('Checking for Joanie\'s Sunday Lunch meal...\n');

  // Check by slug
  const mealBySlug = await db
    .select()
    .from(meals)
    .where(eq(meals.slug, 'joanies-sunday-lunch'));

  console.log('Results by slug "joanies-sunday-lunch":');
  console.log(JSON.stringify(mealBySlug, null, 2));

  // Check by ID
  const mealById = await db
    .select()
    .from(meals)
    .where(eq(meals.id, '59282c53-2260-4e3b-b7e2-5774e2de841e'));

  console.log('\nResults by ID "59282c53-2260-4e3b-b7e2-5774e2de841e":');
  console.log(JSON.stringify(mealById, null, 2));

  // Check all meals with user_id = 'system'
  const systemMeals = await db
    .select()
    .from(meals)
    .where(eq(meals.user_id, 'system'));

  console.log('\nAll meals with user_id = "system":');
  console.log(JSON.stringify(systemMeals, null, 2));

  // Check all meals (limit 10)
  const allMeals = await db
    .select()
    .from(meals)
    .limit(10);

  console.log('\nFirst 10 meals in database:');
  console.log(JSON.stringify(allMeals, null, 2));

  // Check meal_recipes for that meal ID
  const mealRecipesList = await db
    .select()
    .from(mealRecipes)
    .where(eq(mealRecipes.meal_id, '59282c53-2260-4e3b-b7e2-5774e2de841e'));

  console.log('\nMeal recipes for ID "59282c53-2260-4e3b-b7e2-5774e2de841e":');
  console.log(JSON.stringify(mealRecipesList, null, 2));

  process.exit(0);
}

checkMeal();
