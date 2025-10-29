import { db } from '../src/lib/db/index';
import { recipes } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const recipe = await db
    .select({ id: recipes.id, name: recipes.name, ingredients: recipes.ingredients })
    .from(recipes)
    .where(eq(recipes.slug, 'kale-white-bean-stew-2'))
    .limit(1);

  if (recipe.length > 0) {
    console.log('Recipe:', recipe[0].name);
    console.log('Ingredients type:', typeof recipe[0].ingredients);
    console.log('\nFirst 500 chars of ingredients:');
    console.log(recipe[0].ingredients.substring(0, 500));
    console.log('\n\nTrying to parse:');

    try {
      const parsed = JSON.parse(recipe[0].ingredients);
      console.log('Parsed type:', typeof parsed);
      console.log('Is array:', Array.isArray(parsed));
      if (Array.isArray(parsed)) {
        console.log('Array length:', parsed.length);
        console.log('First item:', parsed[0]);
        console.log('First item type:', typeof parsed[0]);
      }
    } catch (e) {
      console.error('Parse error:', e);
    }
  } else {
    console.log('Recipe not found');
  }
}

main().catch(console.error);
