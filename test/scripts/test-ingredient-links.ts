#!/usr/bin/env tsx
/**
 * Test Ingredient Links
 * Verify that ingredient detail pages can resolve properly
 */

import { db } from '@/lib/db';
import { ingredients } from '@/lib/db/ingredients-schema';
import { getIngredientBySlug } from '@/app/actions/ingredients';

async function testLinks() {
  console.log('🔍 Testing ingredient links...\n');

  // Get a sample of ingredients
  const samples = await db
    .select({
      id: ingredients.id,
      name: ingredients.name,
      display_name: ingredients.display_name,
      slug: ingredients.slug,
    })
    .from(ingredients)
    .limit(10);

  console.log(`📊 Testing ${samples.length} sample ingredients\n`);

  let success = 0;
  let failed = 0;

  for (const ing of samples) {
    if (!ing.slug) {
      console.log(`❌ ${ing.display_name}: No slug`);
      failed++;
      continue;
    }

    try {
      const result = await getIngredientBySlug(ing.slug);

      if (result.success && result.ingredient) {
        console.log(`✅ ${ing.display_name}: /ingredients/${ing.slug} → works!`);
        success++;
      } else {
        console.log(`❌ ${ing.display_name}: /ingredients/${ing.slug} → ${result.error}`);
        failed++;
      }
    } catch (error: any) {
      console.log(`❌ ${ing.display_name}: /ingredients/${ing.slug} → Error: ${error.message}`);
      failed++;
    }
  }

  console.log('\n📈 Summary:');
  console.log(`  ✅ Working links: ${success}`);
  console.log(`  ❌ Failed links: ${failed}`);
  console.log(`  📊 Total tested: ${samples.length}`);

  if (success === samples.length) {
    console.log('\n🎉 All ingredient links are working!');
  } else {
    console.log('\n⚠️  Some ingredient links are not working');
  }
}

testLinks()
  .then(() => {
    console.log('\n✨ Test complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test failed:', error);
    process.exit(1);
  });
