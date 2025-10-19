#!/usr/bin/env tsx
import 'dotenv/config';
import { db } from '@/lib/db';
import { recipes, mealRecipes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
  console.log('\n📸 Meal Recipe Images - Final Report');
  console.log('═'.repeat(80));
  console.log('Meal: Healthy Week Meal Plan');
  console.log('Meal ID: 8437475b-f4b6-402f-b5b5-b89217341f92');
  console.log('');

  const mealId = '8437475b-f4b6-402f-b5b5-b89217341f92';

  const mealRecipesData = await db
    .select({ recipe: recipes, mealRecipe: mealRecipes })
    .from(mealRecipes)
    .innerJoin(recipes, eq(mealRecipes.recipe_id, recipes.id))
    .where(eq(mealRecipes.meal_id, mealId))
    .orderBy(mealRecipes.display_order);

  console.log(`Found ${mealRecipesData.length} recipes in meal:\n`);

  mealRecipesData.forEach((mr, i) => {
    const r = mr.recipe;
    console.log(`${i + 1}. ${r.name.trim()}`);
    console.log(`   Course: ${mr.mealRecipe.course_category}`);
    console.log(`   Recipe ID: ${r.id}`);

    if (r.images) {
      try {
        const images = JSON.parse(r.images);
        if (images.length > 0) {
          console.log(`   ✓ Has ${images.length} image(s):`);
          images.forEach((url: string, idx: number) => {
            const isNew = url.includes('/recipes/ai/meal-');
            const marker = isNew ? '🆕 ' : '   ';
            console.log(`   ${marker}${idx + 1}. ${url}`);
          });
        } else {
          console.log(`   ⚠️  Images array is empty`);
        }
      } catch (e) {
        console.log(`   ❌ Error parsing images`);
      }
    } else {
      console.log(`   ✗ No images`);
    }
    console.log('');
  });

  console.log('═'.repeat(80));
  console.log('Legend:');
  console.log('  🆕 = Newly generated image from this session');
  console.log('  ✓ = Has existing images');
  console.log('  ✗ = No images');
  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
