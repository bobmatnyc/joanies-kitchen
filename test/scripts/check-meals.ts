#!/usr/bin/env tsx
import 'dotenv/config';
import { db } from '@/lib/db';
import { meals, mealRecipes, recipes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
  console.log('Checking meals in database...\n');

  const allMeals = await db.select().from(meals).limit(20);

  console.log(`Found ${allMeals.length} meals total\n`);

  if (allMeals.length > 0) {
    for (const meal of allMeals) {
      console.log(`Meal: ${meal.name} (ID: ${meal.id})`);

      const mealRecipesData = await db
        .select({ recipe: recipes })
        .from(mealRecipes)
        .innerJoin(recipes, eq(mealRecipes.recipe_id, recipes.id))
        .where(eq(mealRecipes.meal_id, meal.id));

      console.log(`  Recipes (${mealRecipesData.length}):`);
      mealRecipesData.forEach((mr) => {
        console.log(`    - ${mr.recipe.name}`);
      });
      console.log('');
    }
  } else {
    console.log('No meals found in database.');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
