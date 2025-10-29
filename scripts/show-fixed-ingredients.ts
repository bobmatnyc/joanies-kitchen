#!/usr/bin/env tsx

import { inArray } from 'drizzle-orm';
import { db } from '../src/lib/db/index.js';
import { recipes } from '../src/lib/db/schema.js';

async function showIngredients() {
  const categoryA = [
    '163f25de-7d7d-4525-9785-77162b2b7ea3',
    'b7d25ff5-98eb-44a7-8824-04b16e1ba471',
    'dc3a2745-b1fe-439d-b2fc-f22ff3e80e5b',
  ];

  const fixed = await db
    .select({
      name: recipes.name,
      ingredients: recipes.ingredients,
    })
    .from(recipes)
    .where(inArray(recipes.id, categoryA));

  console.log('🥘 Fixed Recipe Ingredients\n');

  for (const recipe of fixed) {
    const ingredientList = JSON.parse(recipe.ingredients || '[]');
    console.log('═'.repeat(80));
    console.log(`${recipe.name}`);
    console.log('─'.repeat(80));
    ingredientList.forEach((ingredient: string, idx: number) => {
      console.log(`  ${idx + 1}. ${ingredient}`);
    });
    console.log();
  }

  console.log('═'.repeat(80));
}

showIngredients()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
