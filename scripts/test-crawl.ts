async function testCrawl() {
  console.log('Testing weekly recipe crawl...\n');

  const response = await fetch('http://localhost:3001/api/crawl/weekly', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      weeksAgo: 0, // This week
      maxResults: 5,
      autoApprove: false,
    }),
  });

  const result = await response.json();

  console.log('Status:', response.status);
  console.log('Result:', JSON.stringify(result, null, 2));

  if (result.success) {
    console.log(`\nWeek: ${result.weekInfo.year}-W${result.weekInfo.week}`);
    console.log(`Date range: ${result.weekInfo.startDate} to ${result.weekInfo.endDate}`);
    console.log('\nStats:');
    console.log(`- Discovered: ${result.stats.searched}`);
    console.log(`- Extracted: ${result.stats.converted}`);
    console.log(`- Approved: ${result.stats.approved}`);
    console.log(`- Stored: ${result.stats.stored}`);
    console.log(`- Failed: ${result.stats.failed}`);

    console.log('\nRecipes:');
    result.recipes.forEach((recipe: any, i: number) => {
      console.log(`${i + 1}. ${recipe.name} - ${recipe.status}`);
      if (recipe.id) console.log(`   View: http://localhost:3001/recipes/${recipe.id}`);
    });
  }
}

testCrawl().catch(console.error);
