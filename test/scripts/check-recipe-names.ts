#!/usr/bin/env tsx
import 'dotenv/config';
import { db } from '@/lib/db';
import { recipes, mealRecipes, meals } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const mealId = '8437475b-f4b6-402f-b5b5-b89217341f92';

  const mealRecipesData = await db
    .select({ recipe: recipes })
    .from(mealRecipes)
    .innerJoin(recipes, eq(mealRecipes.recipe_id, recipes.id))
    .where(eq(mealRecipes.meal_id, mealId));

  console.log('\nRecipes in meal with images info:');
  for (const mr of mealRecipesData) {
    const r = mr.recipe;
    console.log(`\nName: "${r.name}"`);
    console.log(`ID: ${r.id}`);
    console.log(`Name length: ${r.name.length}`);

    if (r.images) {
      try {
        const images = JSON.parse(r.images);
        console.log(`Images: ${images.length} found`);
        images.forEach((url: string, i: number) => {
          console.log(`  ${i + 1}. ${url.substring(0, 80)}...`);
        });
      } catch (e) {
        console.log(`Images: Error parsing`);
      }
    } else {
      console.log(`Images: null/undefined`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
