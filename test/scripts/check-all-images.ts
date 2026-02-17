import { db } from '@/lib/db/index.js';
import { recipes } from '@/lib/db/schema.js';
import { isNotNull } from 'drizzle-orm';

async function checkAllImages() {
  console.log('Checking all recipes with images...\n');

  const allRecipesWithImages = await db
    .select()
    .from(recipes)
    .where(isNotNull(recipes.images));

  console.log(`Found ${allRecipesWithImages.length} recipe(s) with images\n`);

  const problematicRecipes = allRecipesWithImages.filter(recipe => {
    const images = recipe.images as string[];
    if (!images || images.length === 0) return false;

    return images.some(img =>
      img.includes('example.com') ||
      img.includes('placeholder') ||
      img.includes('dummy') ||
      img.startsWith('http://example') ||
      img === '' ||
      !img.startsWith('http')
    );
  });

  console.log(`Found ${problematicRecipes.length} recipe(s) with problematic images:\n`);

  for (const recipe of problematicRecipes) {
    console.log('Recipe ID:', recipe.id);
    console.log('Name:', recipe.name);
    const desc = recipe.description || '';
    console.log('Description:', desc.substring(0, 100) + '...');
    console.log('Images:', JSON.stringify(recipe.images, null, 2));
    console.log('---\n');
  }

  const validRecipes = allRecipesWithImages
    .filter(r => !problematicRecipes.includes(r))
    .slice(0, 3);

  console.log('\nSample valid recipes:');
  for (const recipe of validRecipes) {
    const img = recipe.images?.[0] || '';
    console.log(`${recipe.name}: ${img.substring(0, 60)}...`);
  }
}

checkAllImages()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
