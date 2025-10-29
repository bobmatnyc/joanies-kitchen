import { writeFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { db } from '../src/lib/db/index.js';
import { ingredients } from '../src/lib/db/ingredients-schema.js';

async function queryOtherIngredients() {
  const results = await db
    .select({
      id: ingredients.id,
      name: ingredients.name,
      display_name: ingredients.display_name,
      type: ingredients.type,
      subtype: ingredients.subtype,
      category: ingredients.category,
    })
    .from(ingredients)
    .where(eq(ingredients.subtype, 'other_other'))
    .limit(500);

  console.log(`Found ${results.length} ingredients with subtype 'other_other'`);
  console.log('\nSample ingredients:');
  results.slice(0, 30).forEach((ing) => {
    console.log(`- ${ing.display_name} (category: ${ing.category})`);
  });

  // Save full list to file
  writeFileSync('tmp/other-ingredients.json', JSON.stringify(results, null, 2));
  console.log(`\nFull list saved to tmp/other-ingredients.json`);

  process.exit(0);
}

queryOtherIngredients().catch(console.error);
