import { discoverWeeklyRecipes } from '@/lib/perplexity-discovery';
import { getWeekInfo } from '@/lib/week-utils';

async function test() {
  console.log('Testing Perplexity discovery directly...\n');

  const weekInfo = getWeekInfo(1); // Last week
  console.log('Week Info:', weekInfo);

  const result = await discoverWeeklyRecipes(weekInfo, {
    maxResults: 3,
  });

  console.log('\nResult:', JSON.stringify(result, null, 2));

  if (result.success) {
    console.log(`\nFound ${result.recipes.length} recipes`);
    result.recipes.forEach((recipe, i) => {
      console.log(`\n${i + 1}. ${recipe.title}`);
      console.log(`   URL: ${recipe.url}`);
      console.log(`   Source: ${recipe.source}`);
      console.log(`   Date: ${recipe.publishedDate || 'N/A'}`);
      console.log(`   Snippet: ${recipe.snippet.substring(0, 100)}...`);
    });
  } else {
    console.error('\nError:', result.error);
  }
}

test().catch(console.error);
