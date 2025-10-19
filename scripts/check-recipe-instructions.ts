#!/usr/bin/env tsx
import { db } from '../src/lib/db';
import { recipes } from '../src/lib/db/schema';
import { and, like } from 'drizzle-orm';

async function checkRecipe() {
  // Search for Lidia's recipe with "Penne Rigate"
  const recipe = await db.select().from(recipes).where(
    and(
      like(recipes.name, '%Penne Rigate%'),
      like(recipes.source, '%Lidia%')
    )
  ).limit(1);

  if (recipe.length > 0) {
    console.log('Recipe found:', recipe[0].name);
    console.log('ID:', recipe[0].id);
    console.log('\nInstructions (raw):');
    console.log(recipe[0].instructions);
    console.log('\n\nInstructions (parsed):');
    const instructions = JSON.parse(recipe[0].instructions);
    instructions.forEach((inst: string, i: number) => {
      console.log(`\n--- Step ${i + 1} ---`);
      console.log('JSON:', JSON.stringify(inst));
      console.log('Display:');
      console.log(inst);
    });
  } else {
    console.log('Recipe not found, searching for any Lidia recipe...');
    const anyLidia = await db.select().from(recipes).where(
      like(recipes.source, '%Lidia%')
    ).limit(1);

    if (anyLidia.length > 0) {
      console.log('Found:', anyLidia[0].name);
      const instructions = JSON.parse(anyLidia[0].instructions);
      console.log('\nFirst 3 instructions:');
      instructions.slice(0, 3).forEach((inst: string, i: number) => {
        console.log(`\n--- Step ${i + 1} ---`);
        console.log('JSON:', JSON.stringify(inst));
        console.log('Display:');
        console.log(inst);
      });
    }
  }
}

checkRecipe().then(() => process.exit(0)).catch(console.error);
