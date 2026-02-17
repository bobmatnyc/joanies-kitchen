import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/index.js';
import { recipes } from '@/lib/db/schema.js';

async function findBrokenImages() {
  console.log('🔍 Searching for recipes with example.com images...\n');

  const recipesWithBrokenImages = await db
    .select()
    .from(recipes)
    .where(sql`images::text LIKE '%example.com%'`);

  console.log(`Found ${recipesWithBrokenImages.length} recipe(s) with broken images:\n`);

  for (const recipe of recipesWithBrokenImages) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Recipe ID: ${recipe.id}`);
    console.log(`Name: ${recipe.name}`);
    console.log(`Description: ${recipe.description}`);
    console.log(`Current Images:`, JSON.stringify(recipe.images, null, 2));
    console.log(`User ID: ${recipe.userId}`);
    console.log(`Created: ${recipe.createdAt}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }

  return recipesWithBrokenImages;
}

findBrokenImages()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
