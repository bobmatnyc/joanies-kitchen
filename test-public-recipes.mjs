import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL;
const sql = neon(databaseUrl);

async function checkPublicRecipes() {
  try {
    const recipes = await sql`SELECT id, name, is_public, image_url, images FROM recipes WHERE is_public = true LIMIT 10`;

    console.log(`\n========================================`);
    console.log(`PUBLIC RECIPES IN DATABASE: ${recipes.length}`);
    console.log(`========================================\n`);

    if (recipes.length === 0) {
      console.log('NO PUBLIC RECIPES FOUND');
      console.log('The SharedRecipeCarousel will not display (expected behavior).');
      console.log('\nTo test the carousel, you need to:');
      console.log('1. Create a recipe via /recipes/new');
      console.log('2. Edit the recipe and toggle "Make Public"');
      console.log('3. Or run: UPDATE recipes SET is_public = true WHERE id = <recipe_id>;');
    } else {
      recipes.forEach((recipe, index) => {
        const hasImages = !!(recipe.images || recipe.image_url);
        console.log(`${index + 1}. ${recipe.name}`);
        console.log(`   ID: ${recipe.id}`);
        console.log(`   Public: ${recipe.is_public}`);
        console.log(`   Has Images: ${hasImages}`);
        console.log(`   Image URL: ${recipe.image_url || 'none'}`);
        console.log(`   Images JSON: ${recipe.images ? 'yes' : 'none'}`);
        console.log('');
      });
    }

    // Also check total recipe count
    const allRecipes = await sql`SELECT COUNT(*) as count FROM recipes`;
    console.log(`Total recipes in database: ${allRecipes[0].count}`);

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error);
  }
}

checkPublicRecipes();
