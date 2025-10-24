import { scrapeRecipeFromUrl } from '../src/lib/scraping/firecrawl-scraper.js';

async function testSingleRecipe() {
  const url = 'https://barefootcontessa.com/recipes/ultimate-beef-stew';

  console.log('🔍 Testing recipe scrape from:', url);
  console.log('');

  try {
    const result = await scrapeRecipeFromUrl(url);

    if (result.success && result.recipe) {
      console.log('✅ SUCCESS! Recipe scraped:');
      console.log('');
      console.log('📝 Name:', result.recipe.name);
      console.log('👨‍🍳 Chef:', result.recipe.chefName);
      console.log('📖 Description:', result.recipe.description?.substring(0, 100) + '...');
      console.log('');
      console.log('🥘 Ingredients:', result.recipe.ingredients?.length || 0);
      if (result.recipe.ingredients && result.recipe.ingredients.length > 0) {
        console.log('   First 5:');
        result.recipe.ingredients.slice(0, 5).forEach((ing, idx) => {
          console.log(`   ${idx + 1}. ${ing}`);
        });
      }
      console.log('');
      console.log('📋 Instructions:', result.recipe.instructions?.length || 0, 'steps');
      if (result.recipe.instructions && result.recipe.instructions.length > 0) {
        console.log('   First step:', result.recipe.instructions[0].substring(0, 100) + '...');
      }
      console.log('');
      console.log('⏱️  Prep Time:', result.recipe.prepTime || 'N/A');
      console.log('🍳 Cook Time:', result.recipe.cookTime || 'N/A');
      console.log('👥 Servings:', result.recipe.servings || 'N/A');
      console.log('🏷️  Tags:', result.recipe.tags?.join(', ') || 'N/A');
      console.log('');
      console.log('📊 Full recipe object:');
      console.log(JSON.stringify(result.recipe, null, 2));
    } else {
      console.log('❌ FAILED to scrape recipe');
      console.log('Error:', result.error);
    }
  } catch (error) {
    console.error('❌ Exception during scraping:', error);
  }
}

testSingleRecipe();
