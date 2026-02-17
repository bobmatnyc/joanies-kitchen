#!/usr/bin/env tsx
/**
 * Test fridge search functionality after ingredient consolidation
 */

import { db, cleanup } from './db-with-transactions';
import { getIngredientSuggestions } from '@/app/actions/ingredient-search';

async function test() {
  console.log('\n🔍 Testing Fridge Search Functionality...\n');

  const testIngredients = [
    'olive',
    'chicken',
    'tomato',
    'onion',
    'garlic',
  ];

  for (const query of testIngredients) {
    console.log(`\n🔎 Searching for: "${query}"`);
    try {
      const results = await getIngredientSuggestions(query, { limit: 5 });

      if (results.success && results.suggestions) {
        console.log(`   ✅ Found ${results.suggestions.length} suggestions:`);
        for (const suggestion of results.suggestions) {
          console.log(`      - ${suggestion.name} (${suggestion.usage_count || 0} uses)`);
        }
      } else {
        console.log(`   ❌ Error: ${results.error}`);
      }
    } catch (error) {
      console.log(`   ❌ Exception: ${error}`);
    }
  }

  console.log('\n✅ Fridge Search Test Complete!\n');

  await cleanup();
  process.exit(0);
}

test().catch(async (error) => {
  console.error('❌ Test failed:', error);
  await cleanup();
  process.exit(1);
});
