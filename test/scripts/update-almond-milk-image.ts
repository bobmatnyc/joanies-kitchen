import { db } from '@/lib/db/index.js';
import { ingredients } from '@/lib/db/ingredients-schema.js';
import { eq } from 'drizzle-orm';

async function main() {
  const result = await db
    .update(ingredients)
    .set({ image_url: '/images/ingredients/almond-milk.png' })
    .where(eq(ingredients.name, 'almond-milk'))
    .returning({ name: ingredients.name, display_name: ingredients.display_name });

  if (result.length > 0) {
    console.log('✅ Updated almond-milk image URL');
    console.log(`   Ingredient: ${result[0].display_name}`);
  } else {
    console.log('⚠️  almond-milk not found in database');
  }

  process.exit(0);
}

main().catch(console.error);
