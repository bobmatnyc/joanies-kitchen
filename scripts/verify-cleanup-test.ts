#!/usr/bin/env tsx
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function verifyCleanup() {
  // Check the first recipe from test batch
  const recipe = await db.select().from(recipes).where(eq(recipes.id, '2758ce47-14a2-4b62-846d-ed1d713460b0')).limit(1);

  if (recipe[0]) {
    console.log('✅ Sample Recipe Verification\n');
    console.log('Recipe:', recipe[0].name);
    console.log('\nDescription:', recipe[0].description);
    console.log('\nIngredients:');
    const ingredients = JSON.parse(recipe[0].ingredients as string);
    ingredients.forEach((ing: string, i: number) => console.log(`  ${i+1}. ${ing}`));

    // Count ingredients with amounts
    const hasAmount = (ing: string) => /^[\d½¼¾⅓⅔⅛⅜⅝⅞]|^(a |an |one |two |three |some |few |several )/i.test(ing.trim());
    const withAmounts = ingredients.filter((ing: string) => hasAmount(ing)).length;

    console.log(`\n📊 Stats:`);
    console.log(`   Total ingredients: ${ingredients.length}`);
    console.log(`   With amounts: ${withAmounts} (${((withAmounts/ingredients.length)*100).toFixed(0)}%)`);
  }

  // Check another complex recipe (Mole Negro)
  const moleRecipe = await db.select().from(recipes).where(eq(recipes.id, '5a15ab37-1b32-40aa-ba70-e341dd8baeee')).limit(1);

  if (moleRecipe[0]) {
    console.log('\n\n✅ Complex Recipe Verification (Mole Negro)\n');
    console.log('Recipe:', moleRecipe[0].name);
    console.log('\nDescription:', moleRecipe[0].description);
    console.log('\nIngredients (sample):');
    const ingredients = JSON.parse(moleRecipe[0].ingredients as string);
    ingredients.slice(0, 5).forEach((ing: string, i: number) => console.log(`  ${i+1}. ${ing}`));
    console.log(`  ... and ${ingredients.length - 5} more`);

    const hasAmount = (ing: string) => /^[\d½¼¾⅓⅔⅛⅜⅝⅞]|^(a |an |one |two |three |some |few |several )/i.test(ing.trim());
    const withAmounts = ingredients.filter((ing: string) => hasAmount(ing)).length;

    console.log(`\n📊 Stats:`);
    console.log(`   Total ingredients: ${ingredients.length}`);
    console.log(`   With amounts: ${withAmounts} (${((withAmounts/ingredients.length)*100).toFixed(0)}%)`);
  }

  process.exit(0);
}

verifyCleanup().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
