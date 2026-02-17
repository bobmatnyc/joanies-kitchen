#!/usr/bin/env tsx
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { like } from 'drizzle-orm';

async function verifyFix() {
  // Check the Penne Rigate recipe
  const penneRecipes = await db.select().from(recipes).where(
    like(recipes.name, '%Penne Rigate%')
  ).limit(1);

  if (penneRecipes.length > 0) {
    const recipe = penneRecipes[0];
    console.log('Recipe:', recipe.name);
    console.log('ID:', recipe.id);
    console.log('\nInstructions (first 3):');

    const instructions = JSON.parse(recipe.instructions);
    instructions.slice(0, 3).forEach((inst: string, i: number) => {
      console.log(`\nStep ${i + 1}:`);
      console.log(`  Stored in DB: "${inst.substring(0, 100)}${inst.length > 100 ? '...' : ''}"`);
      console.log(`  Will display as: "${i + 1}. ${inst.substring(0, 80)}${inst.length > 80 ? '...' : ''}"`);

      // Check if it still has a number prefix
      if (/^\d+\./.test(inst)) {
        console.log('  ⚠️  WARNING: Still has number prefix!');
      } else {
        console.log('  ✅ Clean (no number prefix)');
      }
    });
  } else {
    console.log('Penne Rigate recipe not found');
  }

  // Check a few random fixed recipes
  console.log('\n\n=================================');
  console.log('Checking other fixed recipes:');
  console.log('=================================\n');

  const sampleRecipes = await db.select().from(recipes).where(
    like(recipes.name, '%Cassata Cake%')
  ).limit(1);

  for (const recipe of sampleRecipes) {
    console.log('\nRecipe:', recipe.name);
    const instructions = JSON.parse(recipe.instructions);
    const firstInst = instructions[0];

    console.log('First instruction:', firstInst.substring(0, 100));
    if (/^\d+\./.test(firstInst)) {
      console.log('❌ Still has number prefix');
    } else {
      console.log('✅ Fixed - no number prefix');
    }
  }
}

verifyFix().then(() => process.exit(0)).catch(console.error);
