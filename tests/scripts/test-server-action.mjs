// Direct test of matchRecipesToInventory Server Action
// Run with: node test-server-action.mjs

console.log('🧪 Testing Server Action directly...\n');

try {
  // Import the Server Action
  const { matchRecipesToInventory } = await import('./src/app/actions/inventory.ts');

  console.log('✅ Server Action imported successfully\n');
  console.log('📞 Calling matchRecipesToInventory with test params...\n');

  const result = await matchRecipesToInventory({
    minMatchPercentage: 0,
    prioritizeExpiring: false,
    limit: 5,
  });

  console.log('📊 Result:', JSON.stringify(result, null, 2));

  if (result.success) {
    console.log(`\n✅ SUCCESS: Found ${result.data?.length || 0} recipes`);
    if (result.data && result.data.length > 0) {
      console.log('\n🍳 Sample recipe:');
      console.log(`   - ${result.data[0].title}`);
      console.log(`   - Match: ${result.data[0].match_percentage}%`);
      console.log(`   - Total ingredients: ${result.data[0].total_ingredients}`);
    }
  } else {
    console.log(`\n❌ ERROR: ${result.error}`);
  }

} catch (error) {
  console.error('❌ Test failed:', error);
  console.error('\nStack:', error.stack);
}
