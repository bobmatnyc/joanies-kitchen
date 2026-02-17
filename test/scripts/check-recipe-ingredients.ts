import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function checkRecipe() {
  const recipeId = process.argv[2] || '42c99b0f-05d2-4b96-95b0-d8d611c8bcde';

  const [recipe] = await db.select().from(recipes).where(eq(recipes.id, recipeId));

  if (!recipe) {
    console.log('Recipe not found');
    process.exit(1);
  }

  console.log(`Recipe: ${recipe.name}\n`);
  console.log('Current ingredients:');
  const ingredients = JSON.parse(recipe.ingredients as string);
  ingredients.forEach((ing: string, i: number) => {
    console.log(`${i + 1}. ${ing}`);
  });
}

checkRecipe();
